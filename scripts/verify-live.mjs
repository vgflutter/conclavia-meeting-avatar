import assert from "node:assert/strict";

if (process.argv.includes("--audio")) {
  throw new Error("For audio verification, run scripts/verify-streaming-voice.mjs.");
}

// Opt-in check against the configured running app; never joins an external meeting.
const origin = process.env.CONCLAVIA_TEST_ORIGIN || "http://127.0.0.1:3000";
const marker = `Live verification ${crypto.randomUUID()}`;
const created = [];
const metrics = [];

async function api(path, data, method = data ? "POST" : "GET") {
  const start = performance.now();
  const response = await fetch(new URL(path, origin), {
    method, ...(data ? {headers: {"Content-Type": "application/json"}, body: JSON.stringify(data)} : {}),
    signal: AbortSignal.timeout(30000),
  });
  assert(response.ok, `${method} request failed: ${response.status}`);
  const payload = await response.json();
  return {payload, elapsedMs: Math.round(performance.now() - start)};
}

async function create(offset) {
  const {payload} = await api("/api/meetings", {
    title: `${marker} ${offset}`, objective: "Preparare la consegna del progetto Aurora",
    seriesLabel: marker, meetingUrl: "https://teams.microsoft.com/l/meetup-join/local-verification",
    scheduledStart: new Date(Date.now() + offset * 86400000).toISOString(), durationMinutes: 30,
    timezone: "Europe/Rome", language: "auto", autoJoin: false, correctionPolicy: "important_only",
    agenda: [{title: "Confermare il budget", mandatory: true}, {title: "Definire la consegna", mandatory: false}],
  });
  created.push(payload.meeting.id);
  return payload.meeting.id;
}

async function command(id, kind, prompt, expected) {
  const result = await api(`/api/meetings/${id}/commands`, {kind, prompt});
  if (expected) assert.match(result.payload.response, expected);
  if (/^Who is /i.test(prompt)) {
    assert.doesNotMatch(result.payload.response, /\b(?:è|responsabile|progetto|della|del)\b/iu, "An English question must not receive an Italian sentence");
  }
  metrics.push({kind, elapsedMs: result.elapsedMs, response: result.payload.response});
  return result.payload;
}

try {
  await api("/api/health");
  const previous = await create(-1);
  await api(`/api/meetings/${previous}/outcome`, {
    overview: "Il responsabile del progetto Aurora è Elena Costa. Il budget approvato è 48000 euro.",
    rememberedFacts: Array.from({length: 16}, (_, i) => `Il documento di lavoro ${i + 1} è disponibile in archivio.`),
    decisions: ["La consegna del progetto Aurora è il 27 novembre."],
    actionItems: [], openQuestions: [],
  });
  const current = await create(0);
  await command(current, "ask", "Mi senti?", /ti sento/i);
  await command(current, "remember", "Il collaudo sarà seguito da Marco Bianchi", /salvato/i);
  await command(current, "agenda", "", /budget/i);
  await command(current, "agenda", "Confermare il budget completato", /completato/i);
  await command(current, "ask", "Chi è il responsabile del progetto Aurora?", /Elena Costa/i);
  await command(current, "ask", "Quando è prevista la consegna di Aurora?", /27 novembre/i);
  await command(current, "ask", "Who is responsible for the Aurora project?", /Elena Costa/i);
  await command(current, "ask", "Qual è il codice segreto del progetto Aurora?", /non|sconosciut|disponibil|unknown/i);
  const summary = await command(current, "summary", "", /Aurora/i);
  assert.match(summary.response, /48[.,\s]?000|quarantottomila/i, "Summary must retain the approved budget from shared memory");
  assert.match(summary.response, /27 novembre|ventisette novembre/i, "Summary must retain the known delivery date");
  assert.match(summary.response, /Marco Bianchi/i, "Summary must retain the current meeting's action owner");
  assert.doesNotMatch(summary.response, /\b(?:open question|current commitments)\b/iu, "An Italian spoken summary must not expose internal English category labels");
  console.log(JSON.stringify({passed: true, metrics}, null, 2));
} finally {
  for (const id of created.reverse()) await api(`/api/meetings/${id}`, undefined, "DELETE");
}
