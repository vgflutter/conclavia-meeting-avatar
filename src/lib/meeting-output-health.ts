export class MeetingOutputUnavailableError extends Error {
  constructor() { super("The public avatar page is unavailable; no participant was sent."); }
}

// Only server-configured origins are passed here. Never follow redirects carrying a meeting capability.
export async function verifyMeetingOutput(outputUrl: string, fetcher: typeof fetch = fetch): Promise<void> {
  try {
    const url = new URL(outputUrl);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error();
    const match = /^\/meeting-room\/([0-9a-f-]{36})$/iu.exec(url.pathname);
    if (!match) throw new Error();
    const init: RequestInit = { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8_000) };
    const [page, state] = await Promise.all([
      fetcher(url, init),
      fetcher(new URL(`/api/meeting-room/${match[1]}/state`, url), init),
    ]);
    if (!page.ok || !state.ok || !page.headers.get("content-type")?.includes("text/html")) throw new Error();
    const [html, payload] = await Promise.all([page.text(), state.json()]);
    if (!html.includes('data-output-runtime="conclavia-v1"') || typeof payload.status !== "string" || payload.voice?.ready === false) throw new Error();
    const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/giu)].map((match) => new URL(match[1].replace(/&amp;/gu, "&"), url));
    if (!scripts.length || scripts.length > 24 || scripts.some((asset) => asset.origin !== url.origin || !asset.pathname.startsWith("/_next/"))) throw new Error();
    // Probe the executable assets too: HTML can return 200 while Next rejects the new tunnel origin.
    for (let start = 0; start < scripts.length; start += 4) {
      await Promise.all(scripts.slice(start, start + 4).map(async (asset) => {
        const response = await fetcher(asset, { ...init, headers: { Origin: url.origin } });
        const usable = response.ok && /(?:javascript|ecmascript)/iu.test(response.headers.get("content-type") || "");
        await response.body?.cancel();
        if (!usable) throw new Error();
      }));
    }
  } catch {
    // Never expose the output capability, response contents or raw network errors.
    throw new MeetingOutputUnavailableError();
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
