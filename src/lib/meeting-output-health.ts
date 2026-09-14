type OutputCheckStage = "url" | "page" | "state" | "scripts";
type OutputCheckReason = "timeout" | "network" | "tls" | "http" | "invalid" | "voice";

export const OUTPUT_CHECK_REQUEST_MS = 15_000;
export const OUTPUT_CHECK_TOTAL_MS = 45_000;

export class MeetingOutputUnavailableError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  constructor(stage?: OutputCheckStage, reason: OutputCheckReason = "invalid", status?: number) {
    super("The public avatar check failed.");
    // Persist only bounded, safe diagnostics, never a URL, capability or raw error.
    this.code = stage ? `output_${stage}_${reason}${reason === "http" && status ? `_${status}` : ""}` : "output_unavailable";
    this.retryable = reason === "timeout" || reason === "network" ||
      (reason === "http" && Boolean(status && (status >= 500 || status === 408 || status === 429)));
  }
}

// Tests may shorten these bounds; runtime uses the constants above.
type CheckTiming = { requestMs?: number; totalMs?: number; retryDelayMs?: number };

// Read-only checks only: no retries of participant creation or media mutations.
export async function verifyMeetingOutput(outputUrl: string, fetcher: typeof fetch = fetch, timing: CheckTiming = {}): Promise<void> {
  let url: URL;
  try {
    url = new URL(outputUrl);
    if (url.protocol !== "https:" || url.username || url.password || !/^\/meeting-room\/[0-9a-f-]{36}$/iu.test(url.pathname)) throw new Error();
  } catch { throw new MeetingOutputUnavailableError("url", "invalid"); }
  const token = url.pathname.split("/").at(-1)!;
  const overall = new AbortController();
  const totalTimer = setTimeout(() => overall.abort(), timing.totalMs ?? OUTPUT_CHECK_TOTAL_MS);

  async function probe<T>(stage: OutputCheckStage, target: URL, consume: (response: Response) => Promise<T>, headers?: HeadersInit): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      if (overall.signal.aborted) throw new MeetingOutputUnavailableError(stage, "timeout");
      const controller = new AbortController();
      const signal = AbortSignal.any([overall.signal, controller.signal]);
      const timer = setTimeout(() => controller.abort(), timing.requestMs ?? OUTPUT_CHECK_REQUEST_MS);
      let response: Response | undefined;
      let onAbort!: () => void;
      const interrupted = new Promise<never>((_, reject) => {
        onAbort = () => reject(new MeetingOutputUnavailableError(stage, "timeout"));
        signal.addEventListener("abort", onAbort, { once: true });
        if (signal.aborted) onAbort();
      });
      try {
        return await Promise.race([interrupted, (async () => {
          response = await fetcher(target, { method: "GET", cache: "no-store", redirect: "error", signal, headers });
          if (!response.ok) throw new MeetingOutputUnavailableError(stage, "http", response.status);
          return consume(response);
        })()]);
      } catch (error) {
        const raw = error as { name?: string; cause?: { code?: string } } | undefined;
        const tls = ["SELF_SIGNED_CERT_IN_CHAIN", "DEPTH_ZERO_SELF_SIGNED_CERT", "ERR_TLS_CERT_ALTNAME_INVALID", "CERT_HAS_EXPIRED", "CERT_NOT_YET_VALID", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "UNABLE_TO_VERIFY_LEAF_SIGNATURE"].includes(raw?.cause?.code || "");
        const failure = error instanceof MeetingOutputUnavailableError ? error : new MeetingOutputUnavailableError(stage,
          signal.aborted || raw?.name === "TimeoutError" || raw?.name === "AbortError" ? "timeout" : tls ? "tls" : raw?.name === "SyntaxError" ? "invalid" : "network");
        if (attempt || !failure.retryable || overall.signal.aborted) throw failure;
      } finally {
        clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        controller.abort();
        // Cancel unread HTTP error/script bodies without retaining provider content.
        if (response?.body && !response.bodyUsed) void response.body.cancel().catch(() => undefined);
      }
      await new Promise<void>(resolve => {
        const finish = () => { clearTimeout(delay); overall.signal.removeEventListener("abort", finish); resolve(); };
        const delay = setTimeout(finish, timing.retryDelayMs ?? 250);
        overall.signal.addEventListener("abort", finish, { once: true });
        if (overall.signal.aborted) finish();
      });
    }
  }

  try {
    const [html] = await Promise.all([
      probe("page", url, async response => {
        if (!response.headers.get("content-type")?.includes("text/html")) throw new MeetingOutputUnavailableError("page", "invalid");
        const html = await response.text();
        if (!html.includes('data-output-runtime="conclavia-v1"')) throw new MeetingOutputUnavailableError("page", "invalid");
        return html;
      }),
      probe("state", new URL(`/api/meeting-room/${token}/state`, url), async response => {
        const payload = await response.json();
        if (!payload || typeof payload.status !== "string") throw new MeetingOutputUnavailableError("state", "invalid");
        if (payload.voice?.ready === false) throw new MeetingOutputUnavailableError("state", "voice");
      }),
    ]);
    let scripts: URL[];
    try {
      scripts = [...new Set([...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/giu)].map(match => new URL(match[1].replace(/&amp;/gu, "&"), url).href))].map(value => new URL(value));
      if (!scripts.length || scripts.length > 24 || scripts.some(asset => asset.origin !== url.origin || asset.username || asset.password || !asset.pathname.startsWith("/_next/"))) throw new Error();
    } catch { throw new MeetingOutputUnavailableError("scripts", "invalid"); }
    // Each asset gets its own timer, independent of time spent compiling the page.
    for (let start = 0; start < scripts.length; start += 4) {
      await Promise.all(scripts.slice(start, start + 4).map(asset => probe("scripts", asset, async response => {
        if (!/(?:javascript|ecmascript)/iu.test(response.headers.get("content-type") || "")) throw new MeetingOutputUnavailableError("scripts", "invalid");
      }, { Origin: url.origin })));
    }
  } finally {
    clearTimeout(totalTimer);
    overall.abort(); // Cancel siblings on failure; no checks continue after rejection.
  }
}

export const OUTPUT_HEARTBEAT_MAX_AGE_MS = 20_000;

export function meetingOutputReadiness(bot: {
  outputLastSeenAt?: string | Date; outputVoiceReady?: boolean;
}, now = Date.now()): "missing" | "preparing" | "ready" {
  const seen = bot.outputLastSeenAt ? new Date(bot.outputLastSeenAt).getTime() : 0;
  if (!seen || now - seen > OUTPUT_HEARTBEAT_MAX_AGE_MS || seen > now + 1_000) return "missing";
  return bot.outputVoiceReady ? "ready" : "preparing";
}
