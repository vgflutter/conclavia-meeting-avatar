import assert from "node:assert/strict";

// Opt-in real AI check through synthetic Attendee callbacks. Creates only owned,
// autoJoin:false records, never POSTs to a bot provider, and never prints tokens.
const origin = process.env.CONCLAVIA_TEST_ORIGIN || "http://127.0.0.1:3000";
const owned = [];
const metrics = [];
async function api(path, data, method = data ? "POST" : "GET") {
  const response = await fetch(new URL(path, origin), {
    method, ...(data ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  assert(response.ok, `Test request failed: ${response.status}`);
  return response.json();
}
async function create() {
  const { meeting } = await api("/api/meetings", {
    title: `Live trigger verification ${crypto.randomUUID()}`, objective: "Pianificare budget e collaudo del progetto Aurora",
    meetingUrl: "https://teams.microsoft.com/l/meetup-join/local-trigger-verification",
    scheduledStart: new Date(Date.now() + 86400000).toISOString(), durationMinutes: 30,
    timezone: "Europe/Rome", language: "it", autoJoin: false, correctionPolicy: "important_only",
    agenda: [{ title: "Budget e responsabilità del collaudo", mandatory: true }],
  });
  assert.equal(meeting.autoJoin, false);
  assert(!meeting.bot.externalBotId, "Fixture must not create an external participant");
  owned.push(meeting);
  return meeting;
}
async function callback(meeting, trigger, data) {
  return api(`/api/webhooks/attendee?meeting_token=${meeting.bot.outputToken}`, {
    idempotency_key: crypto.randomUUID(), bot_id: `local-audit-${meeting.id}`,
    bot_metadata: { conclavia_meeting_id: meeting.id }, trigger, data,
  });
}
async function say(meeting, text, time) {
  return callback(meeting, "transcript.update", { speaker_name: "Partecipante di test", timestamp_ms: time,
    duration_ms: 1000, transcription: { transcript: text, words: [] } });
}
async function until(meeting, predicate) {
  const start = performance.now();
  while (performance.now() - start < 20000) {
    const { meeting: current } = await api(`/api/meetings/${meeting.id}`);
    if (predicate(current)) return current;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("Expected intervention state was not reached within 20 seconds");
}
try {
  for (const scenario of [
    { type: "correction", fact: "Il budget approvato del progetto Aurora è 48000 euro.",
      statement: "Confermo che il budget approvato per il progetto Aurora è 99000 euro.", expected: /48[.\s,]?000|quarantottomila/iu },
    { type: "relevant_information", fact: "Marco Bianchi è il responsabile del collaudo del progetto Aurora, già assegnato e confermato.",
      statement: "Passiamo alla pianificazione del collaudo del progetto Aurora e alla distribuzione delle responsabilità operative.", expected: /Marco Bianchi/iu },
  ]) {
    const meeting = await create();
    await api(`/api/meetings/${meeting.id}/commands`, { kind: "remember", prompt: scenario.fact });
    const started = performance.now();
    await say(meeting, scenario.statement, 1000);
    const pending = await until(meeting, (current) => Boolean(current.pendingIntervention));
    assert.equal(pending.pendingIntervention.type, scenario.type);
    assert.match(pending.pendingIntervention.response, scenario.expected);
    assert.equal(pending.commandHistory.length, 1, "Contribution must not speak without permission");
    const proposalMs = Math.round(performance.now() - started);
    const grantedAt = performance.now();
    await say(meeting, `${meeting.assistant.wakeWord}, vai pure`, 3000);
    const delivered = await until(meeting, (current) => current.commandHistory.length === 2);
    assert(!delivered.pendingIntervention);
    assert.equal(delivered.commandHistory.at(-1).kind, scenario.type === "correction" ? "correct" : "inform");
    assert.match(delivered.commandHistory.at(-1).response, scenario.expected);
    metrics.push({ type: scenario.type, proposalMs, permissionToStoredCommandMs: Math.round(performance.now() - grantedAt), response: delivered.commandHistory.at(-1).response });
  }
  console.log(JSON.stringify({ passed: true, transport: "synthetic callbacks, real AI, no Teams participant", metrics }, null, 2));
} finally {
  // End only our synthetic provider bindings before deleting our own records.
  // Never attempt provider leave/delete with these synthetic IDs.
  for (const meeting of owned.reverse()) {
    const { meeting: current } = await api(`/api/meetings/${meeting.id}`);
    if (current.bot.externalBotId) {
      assert.equal(current.bot.externalBotId, `local-audit-${meeting.id}`);
      await callback(meeting, "bot.state_change", { new_state: "ended", created_at: new Date().toISOString() });
      await until(meeting, (item) => ["completed", "failed"].includes(item.status) && Boolean(item.bot.leftAt));
    }
    await api(`/api/meetings/${meeting.id}`, undefined, "DELETE");
  }
}
