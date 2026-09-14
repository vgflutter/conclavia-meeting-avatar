import assert from "node:assert/strict";
import test from "node:test";
import { compareCaptionEvidence, diagnoseCaptions, diagnosticFailureMessage } from "../../scripts/diagnose-captions.mjs";

const meetingId = "a".repeat(24);
const meeting = () => ({
  id: meetingId, status: "completed", language: "it",
  context: "PRIVATE_CONTEXT", meetingUrl: "https://teams.live.com/meet/private?p=PRIVATE_INVITATION",
  bot: { provider: "attendee", externalBotId: "bot_test123", entryAttemptId: "attempt1",
    outputToken: "PRIVATE_TOKEN", captionLanguage: "it-it", captionLanguageRequestedAt: "2030-01-01T10:00:01Z",
    joinedAt: "2030-01-01T10:00:00Z", leftAt: "2030-01-01T10:10:00Z" },
  transcript: [{ sequence: 1, createdAt: "2030-01-01T10:01:00Z", startMs: 60000,
    speakerName: "Private participant", text: "Charlie cardo.", language: "it" }],
});
const row = (text = "Charlie cardo.") => ({ speaker_name: "Private participant", timestamp_ms: 60000,
  transcription: { transcript: text } });

function fixture({ local = meeting(), remoteRows = [row()], after = local } = {}) {
  const calls = [];
  let localReads = 0;
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    assert.equal(init.method, "GET");
    assert.equal(init.redirect, "error");
    if (url.startsWith("http://127.0.0.1:3000/")) {
      assert.equal(init.headers.Authorization, undefined);
      return Response.json({ meeting: ++localReads === 1 ? local : after });
    }
    assert.ok(url.startsWith("https://app.attendee.dev/api/v1/bots/bot_test123"));
    assert.equal(init.headers.Authorization, "Token fixture-only");
    return Response.json(url.endsWith("/transcript") ? remoteRows : {
      id: "bot_test123", state: "ended",
      transcription_settings: { meeting_closed_captions: { teams_language: "it-it" } },
      private: "PRIVATE_PROVIDER_FIELD",
    });
  };
  return { calls, run: extra => diagnoseCaptions({ meetingId, apiKey: "fixture-only", fetcher, ...extra }) };
}

test("wrong captions already present at provider are evidence, not corrected or marked verified", async () => {
  const probe = fixture();
  const result = await probe.run();
  assert.equal(result.comparisons[0].comparison, "identical");
  assert.equal(result.observedTeamsLanguage, "unavailable");
  assert.equal(result.observedBotLanguagePermission, "unavailable");
  assert.equal(result.microphoneAcceptance, "not_tested");
  assert.equal(result.requestedLanguage, "it-it");
  assert.equal(probe.calls.length, 4);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|Private participant|Charlie|fixture-only|teams\.live/);
});

test("differing provider text is not silently treated as equivalent", async () => {
  const result = await fixture({ remoteRows: [row("Ciao Riccardo.")] }).run();
  assert.equal(result.comparisons[0].comparison, "different");
  assert.equal(result.microphoneAcceptance, "not_tested");
});

test("ambiguity, missing data and timestamps are explicit, not false matches", () => {
  assert.equal(compareCaptionEvidence(meeting(), [row(), row()])[0].comparison, "ambiguous");
  assert.equal(compareCaptionEvidence(meeting(), [])[0].comparison, "not_found");
  assert.equal(compareCaptionEvidence(meeting(), [{ ...row(), speaker_name: "Another person" }])[0].comparison, "not_found");
  assert.equal(compareCaptionEvidence(meeting(), [{ ...row(), transcription: {} }])[0].comparison, "uncomparable");
  const missing = meeting();
  delete missing.transcript[0].startMs;
  assert.equal(compareCaptionEvidence(missing, [row()])[0].comparison, "uncomparable");
  assert.throws(() => compareCaptionEvidence(meeting(), { results: [] }), /schema/);
});

test("only the current attempt is compared, without mutating transcripts", () => {
  const local = meeting();
  local.transcript.push({ ...local.transcript[0], sequence: 2, createdAt: "2029-12-31T10:01:00Z" });
  local.transcript.push({ ...local.transcript[0], sequence: 3, createdAt: "2030-01-01T11:01:00Z" });
  const original = structuredClone(local);
  assert.equal(compareCaptionEvidence(local, [row()]).length, 1);
  assert.deepEqual(local, original);
  delete local.bot.joinedAt;
  assert.deepEqual(compareCaptionEvidence(local, [row()]), []);
});

test("reject changed attempt rather than comparing against a replacement bot", async () => {
  const after = meeting();
  after.bot.entryAttemptId = "attempt2";
  await assert.rejects(fixture({ after }).run(), /attempt changed/);
});

test("never sends credentials to arbitrary origins or follows redirects", async () => {
  for (const config of [
    { origin: "https://external.example" },
    { origin: "http://127.0.0.1:3000@external.example" },
    { apiBaseUrl: "http://app.attendee.dev/api/v1" },
    { apiBaseUrl: "https://attendee.dev.external.example/api/v1" },
    { apiBaseUrl: "https://app.attendee.dev/api/v1?key=private" },
    { apiBaseUrl: "https://user:pass@app.attendee.dev/api/v1" },
    { apiBaseUrl: "https://app.attendee.dev:8443/api/v1" },
    { meetingId: "../other" },
  ]) {
    const probe = fixture();
    await assert.rejects(probe.run(config));
    assert.equal(probe.calls.length, 0);
  }
});

test("HTTP failures do not echo confidential provider response bodies", async () => {
  await assert.rejects(diagnoseCaptions({ meetingId, apiKey: "fixture-only",
    fetcher: async () => Response.json({ error: "PRIVATE_PROVIDER_FIELD" }, { status: 403 }),
  }), error => /403/.test(error.message) && !/PRIVATE/.test(error.message));
});

test("unexpected network and parsing errors cannot leak response text or URLs", () => {
  assert.doesNotMatch(diagnosticFailureMessage(new SyntaxError("PRIVATE_TRANSCRIPT")), /PRIVATE/);
  assert.doesNotMatch(diagnosticFailureMessage(new Error("https://private.example?token=PRIVATE_TOKEN")), /private|PRIVATE/);
  assert.match(diagnosticFailureMessage({ cause: { code: "SELF_SIGNED_CERT_IN_CHAIN" } }), /SELF_SIGNED_CERT_IN_CHAIN/);
  assert.doesNotMatch(diagnosticFailureMessage({ cause: { code: "PRIVATE_TOKEN" } }), /PRIVATE/);
});
