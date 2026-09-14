import { pathToFileURL } from "node:url";

class CaptionDiagnosticError extends Error {}

export function diagnosticFailureMessage(error) {
  if (error instanceof CaptionDiagnosticError) return error.message;
  const code = error?.cause?.code;
  if (["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "SELF_SIGNED_CERT_IN_CHAIN"].includes(code)) {
    return `Diagnostic connection failed (${code}).`;
  }
  return "Diagnostic response or connection could not be read.";
}

// Read-only evidence collector. No joins, PATCH, recording, model calls or
// transcript exports. Settings returned by the provider are NOT read-back from
// the Teams browser. Never label them as observed/verified speech language.
function localOrigin(value) {
  const url = new URL(value);
  if (!(["http:", "https:"].includes(url.protocol)) ||
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new CaptionDiagnosticError("The diagnostic requires a loopback application origin.");
  }
  return url.origin;
}

function providerOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" ||
      !(url.hostname === "attendee.dev" || url.hostname.endsWith(".attendee.dev")) ||
      url.username || url.password || url.search || url.hash || (url.port && url.port !== "443")) {
    throw new CaptionDiagnosticError("The diagnostic requires an HTTPS Attendee API origin.");
  }
  return url.href.replace(/\/$/, "");
}

function transcriptText(value) {
  if (typeof value === "string") return value.trim().slice(0, 10_000);
  if (value && typeof value.transcript === "string") return value.transcript.trim().slice(0, 10_000);
  return undefined;
}

export function compareCaptionEvidence(meeting, providerRows) {
  if (!Array.isArray(providerRows)) throw new CaptionDiagnosticError("Unexpected provider transcript schema.");
  const joinedAt = Date.parse(meeting.bot.joinedAt || "");
  const leftAt = meeting.bot.leftAt ? Date.parse(meeting.bot.leftAt) : Infinity;
  const rows = (meeting.transcript || []).filter(row =>
    Number.isFinite(joinedAt) && Date.parse(row.createdAt) >= joinedAt && Date.parse(row.createdAt) <= leftAt);
  return rows.map(row => {
    const candidates = Number.isFinite(row.startMs) ? providerRows.filter(candidate =>
      candidate && typeof candidate.timestamp_ms === "number" && Math.round(candidate.timestamp_ms) === row.startMs &&
      typeof candidate.speaker_name === "string" && candidate.speaker_name.trim().slice(0, 160) === row.speakerName) : [];
    let comparison = "uncomparable";
    if (Number.isFinite(row.startMs)) {
      comparison = candidates.length > 1 ? "ambiguous" : candidates.length === 0 ? "not_found"
        : transcriptText(candidates[0].transcription) === undefined ? "uncomparable"
          : transcriptText(candidates[0].transcription) === row.text ? "identical" : "different";
    }
    return { sequence: row.sequence, receivedAt: row.createdAt, comparison };
  });
}

export async function diagnoseCaptions({ meetingId, origin = "http://127.0.0.1:3000",
  apiBaseUrl = "https://app.attendee.dev/api/v1", apiKey, fetcher = fetch }) {
  if (!/^[a-f0-9]{24}$/i.test(meetingId || "")) throw new CaptionDiagnosticError("Provide one valid meeting ID.");
  const app = localOrigin(origin);
  const provider = providerOrigin(apiBaseUrl);
  if (!apiKey?.trim()) throw new CaptionDiagnosticError("Attendee is not configured in this runtime.");

  async function getJson(url, authenticated = false) {
    const response = await fetcher(url, {
      method: "GET", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15_000),
      headers: { Accept: "application/json", ...(authenticated ? { Authorization: `Token ${apiKey.trim()}` } : {}) },
    });
    // Do not echo URLs, provider bodies or thrown network errors: they may
    // contain capabilities, private conversation or runtime configuration.
    if (!response.ok) throw new CaptionDiagnosticError(`${authenticated ? "Provider" : "Local app"} diagnostic returned HTTP ${response.status}.`);
    const reader = response.body?.getReader();
    if (!reader) throw new CaptionDiagnosticError("Empty diagnostic response.");
    const chunks = [];
    let bytes = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 5_000_000) throw new CaptionDiagnosticError("Diagnostic response exceeds the 5 MB safety limit.");
        chunks.push(value);
      }
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } finally {
      await reader.cancel();
    }
  }

  const { meeting } = await getJson(`${app}/api/meetings/${meetingId}`);
  if (!meeting || meeting.id !== meetingId || meeting.bot?.provider !== "attendee" ||
      !/^bot_[a-z0-9]+$/i.test(meeting.bot.externalBotId || "")) {
    throw new CaptionDiagnosticError("This meeting has no identifiable Attendee attempt.");
  }
  const botPath = `${provider}/bots/${encodeURIComponent(meeting.bot.externalBotId)}`;
  const [details, transcript] = await Promise.all([getJson(botPath, true), getJson(`${botPath}/transcript`, true)]);
  if (details.id !== meeting.bot.externalBotId) throw new CaptionDiagnosticError("Provider bot identity mismatch.");
  const { meeting: current } = await getJson(`${app}/api/meetings/${meetingId}`);
  if (!current || current.bot.externalBotId !== meeting.bot.externalBotId || current.bot.entryAttemptId !== meeting.bot.entryAttemptId) {
    throw new CaptionDiagnosticError("The meeting attempt changed during diagnosis; discard this comparison and retry.");
  }
  const comparisons = compareCaptionEvidence(meeting, transcript);
  const knownStates = ["ready", "scheduled", "joining", "joined_not_recording", "joined_recording", "leaving", "post_processing", "ended", "fatal_error", "cancelled"];
  return {
    meetingId,
    botId: meeting.bot.externalBotId,
    collectedAt: new Date().toISOString(),
    providerState: knownStates.includes(details.state) ? details.state : "unknown",
    requestedLanguage: ["it-it", "en-us"].includes(meeting.bot.captionLanguage) ? meeting.bot.captionLanguage : null,
    requestAcknowledgedAt: meeting.bot.captionLanguageRequestedAt || null,
    observedTeamsLanguage: "unavailable",
    observedBotLanguagePermission: "unavailable",
    microphoneAcceptance: "not_tested",
    comparisonScope: "Current attempt; exact speaker and provider timestamp; normal ingestion trim/length limit.",
    comparisons,
    interpretation: "Identical text means Attendee already returned that text. It does not prove microphone accuracy or the actual Teams language. Differences may include provider transcript revisions and require inspection.",
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { loadEnvConfig } = await import("@next/env").then(module => module.default || module);
  loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
  try {
    if (process.argv.length !== 3) throw new CaptionDiagnosticError("Usage: npm run diagnose:captions -- <meeting-id>");
    const result = await diagnoseCaptions({
      meetingId: process.argv[2], origin: process.env.CONCLAVIA_TEST_ORIGIN,
      apiBaseUrl: process.env.ATTENDEE_API_BASE_URL, apiKey: process.env.ATTENDEE_API_KEY,
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`${diagnosticFailureMessage(error)} No meeting was modified.`);
    if (["SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "UNABLE_TO_VERIFY_LEAF_SIGNATURE"].includes(error?.cause?.code)) {
      console.error("On a managed machine, use the project's trusted system CA loader: node --import ./scripts/system-ca.mjs scripts/diagnose-captions.mjs <meeting-id>");
    }
    process.exitCode = 1;
  }
}
