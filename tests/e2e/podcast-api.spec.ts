import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { connectToDatabase } from "../../src/lib/mongodb";
import { TalkModel } from "../../src/models/PodcastTalk";
import { TalkRunModel } from "../../src/models/PodcastRun";
import { AudienceRoomModel } from "../../src/models/PodcastAudienceRoom";
import { MeetingModel } from "../../src/models/Meeting";
import type { TalkInput, TalkResponse } from "../../src/types/podcast";
import type { TalkRunResponse } from "../../src/types/podcast-run";

// API-only acceptance. No page/browser, real database, microphone or paid provider.
const ids: string[] = [];
let originalMeetingCount = 0;
function input({ humanOnly = false, status = "ready" }: { humanOnly?: boolean; status?: TalkInput["status"] } = {}): TalkInput {
  return {
    title: `E2E Podcast ${randomUUID()}`, topic: "AI e decisioni di lavoro",
    centralQuestion: "Chi deve assumersi la decisione finale?", editorialInstructions: "Chiedi esempi, poi chiarisci il disaccordo.",
    description: "Contesto della puntata, senza confonderlo con decisioni prese.", language: "it", status,
    participants: [
      { kind: humanOnly ? "human" : "ai", sex: "male", name: "Riccardo", role: "Conduttore critico", perspectiveMode: "custom", perspectivePrompt: "Privilegia prove e controllo umano", goals: "Chiarire i limiti", speakingStylePrompt: "Curioso e diretto", nonNegotiables: "Non inventare dati", voiceId: humanOnly ? undefined : "Gianni", voiceDelivery: "natural", assertiveness: 62, patience: 64, interruptiveness: 16, baselineTension: 21 },
      { kind: humanOnly ? "human" : "ai", sex: "female", name: "Giulia", role: "Conduttrice pragmatica", perspectiveMode: "custom", perspectivePrompt: "Cerca opportunità concrete", goals: "Portare un esempio utile", speakingStylePrompt: "Calda e ironica", voiceId: humanOnly ? undefined : "Orietta", voiceDelivery: "energetic", assertiveness: 54, patience: 76, interruptiveness: 12, baselineTension: 10 },
      ...(humanOnly ? [] : [{ kind: "human" as const, sex: "male" as const, name: "Ospite", role: "Esperienza diretta", perspectiveMode: "custom" as const, perspectivePrompt: "", assertiveness: 50, patience: 50, interruptiveness: 0, baselineTension: 10 }]),
    ],
    moderator: { kind: "none", style: "neutral", canInterrupt: false, manageTime: true, summarizeAtEnd: true },
    settings: { maxTurns: 16, targetDurationMinutes: 5, videoMode: "cartoon", studioTheme: "clean-line", defaultModel: "openai-default", allowInterruptions: false, pace: "balanced" },
  };
}
async function create(request: APIRequestContext, data = input()): Promise<TalkResponse> {
  const response = await request.post("/api/podcast/talks", { data });
  expect(response.status(), await response.text()).toBe(201);
  const { talk } = await response.json(); ids.push(talk.id); return talk;
}
async function start(request: APIRequestContext, talk: TalkResponse): Promise<TalkRunResponse> {
  const response = await request.post(`/api/podcast/talks/${talk.id}/runs`);
  expect([200, 201], await response.text()).toContain(response.status());
  return (await response.json()).run;
}

test.beforeAll(async () => {
  if (process.env.MONGODB_URI !== "mongodb://127.0.0.1:27018" || !process.env.MONGODB_DB_NAME?.startsWith("conclavia_e2e_")) throw new Error("Podcast acceptance requires the isolated temporary MongoDB URI and conclavia_e2e_* name");
  if (process.env.PODCAST_AI_ENABLED !== "false" || process.env.PODCAST_SPEECH_ENABLED !== "false") throw new Error("Podcast acceptance must explicitly disable both paid provider boundaries");
  await connectToDatabase();
  originalMeetingCount = await MeetingModel.countDocuments();
});

test.afterEach(async () => {
  const talkIds = ids.splice(0);
  const runIds = await TalkRunModel.distinct("_id", { talkId: { $in: talkIds } });
  await AudienceRoomModel.deleteMany({ runId: { $in: runIds } });
  await TalkRunModel.deleteMany({ talkId: { $in: talkIds } });
  await TalkModel.deleteMany({ _id: { $in: talkIds }, title: /^E2E Podcast /u });
  expect(await MeetingModel.countDocuments()).toBe(originalMeetingCount);
});

test("podcast management validates configuration and blocks foreign-origin mutations before work", async ({ request }) => {
  const data = input();
  expect((await request.post("/api/podcast/talks", { headers: { origin: "https://unrelated.invalid" }, data })).status()).toBe(403);
  expect((await request.post("/api/podcast/talks", { headers: { "sec-fetch-site": "cross-site" }, data })).status()).toBe(403);
  expect((await request.post("/api/podcast/talks", { data: { ...data, participants: data.participants.slice(0, 1) } })).status()).toBe(400);
  expect((await request.post("/api/podcast/talks", { data: { ...data, settings: { ...data.settings, videoMode: "liveavatar" } } })).status()).toBe(400);
  expect((await request.post("/api/podcast/talks", { data: { ...data, topic: "x".repeat(41_000) } })).status()).toBe(413);
  for (const suffix of ["next", "next/stream", "human-turn", "stop", "speech"]) {
    const response = await request.post(`/api/podcast/runs/000000000000000000000000/${suffix}`, { headers: { origin: "https://unrelated.invalid" }, data: { content: "test", sequence: 1 } });
    expect(response.status(), suffix).toBe(403);
  }
  expect((await request.get("/api/podcast/talks/not-an-id")).status()).toBe(404);
});

test("episode saves personalities and editorial direction; run snapshots isolate later edits and Start is idempotent", async ({ request }) => {
  const data = input(), talk = await create(request, data);
  expect(talk.centralQuestion).toBe(data.centralQuestion);
  expect(talk.editorialInstructions).toBe(data.editorialInstructions);
  expect(talk.participants[0].perspectivePrompt).toBe(data.participants[0].perspectivePrompt);
  expect(talk.participants[1].speakingStylePrompt).toBe(data.participants[1].speakingStylePrompt);
  expect(talk.participants[2].kind).toBe("human");
  const list = await (await request.get("/api/podcast/talks")).json();
  expect(list.talks.some((item: TalkResponse) => item.id === talk.id)).toBe(true);
  const attempts = await Promise.all([request.post(`/api/podcast/talks/${talk.id}/runs`), request.post(`/api/podcast/talks/${talk.id}/runs`)]);
  for (const response of attempts) expect([200, 201], await response.text()).toContain(response.status());
  const runs = await Promise.all(attempts.map(response => response.json()));
  expect(runs[0].run.id).toBe(runs[1].run.id);
  expect(await TalkRunModel.countDocuments({ talkId: talk.id })).toBe(1);
  const run: TalkRunResponse = runs[0].run;
  expect(run.discussionState.centralQuestion).toBe(data.centralQuestion);
  expect(run.messages).toEqual([]);
  const changed = { ...data, topic: "Nuovo tema per una prossima puntata", centralQuestion: "Nuova domanda?", editorialInstructions: "Nuova direzione" };
  const patched = await request.patch(`/api/podcast/talks/${talk.id}`, { data: changed });
  expect(patched.status()).toBe(200);
  expect((await (await request.get(`/api/podcast/talks/${talk.id}`)).json()).talk.topic).toBe(changed.topic);
  const stored: TalkRunResponse = (await (await request.get(`/api/podcast/runs/${run.id}`)).json()).run;
  expect(stored.talkSnapshot?.topic).toBe(data.topic);
  expect(stored.talkSnapshot?.editorialInstructions).toBe(data.editorialInstructions);
});

test("paid boundaries remain disabled; stopping permits a fresh run and preserves history", async ({ request }) => {
  const flags = await (await request.get("/api/podcast/config")).json();
  expect(flags.ai.enabled).toBe(false); expect(flags.ai.ready).toBe(false);
  expect(flags.speech.enabled).toBe(false); expect(flags.speech.ready).toBe(false);
  const serialized = JSON.stringify(flags); expect(serialized).not.toContain("API_KEY");
  const talk = await create(request, { ...input(), participants: input().participants.slice(0, 2) });
  const run = await start(request, talk);
  const response = await request.post(`/api/podcast/runs/${run.id}/next`);
  expect(response.status(), await response.text()).toBe(503);
  const failure = await response.json();
  expect(failure.code).toBe("podcast_ai_unavailable"); expect(failure.run.status).toBe("idle");
  expect(failure.run.messages).toEqual([]);
  expect((await request.post(`/api/podcast/runs/${run.id}/speech`, { data: { sequence: 1 } })).status()).toBe(503);
  expect((await request.post(`/api/podcast/runs/${run.id}/stop`)).status()).toBe(200);
  const next = await start(request, talk); expect(next.id).not.toBe(run.id);
  const history = await (await request.get(`/api/podcast/talks/${talk.id}/runs`)).json();
  expect(history.runs).toHaveLength(2); expect(history.run.id).toBe(next.id);
  expect(history.runs.find((item: TalkRunResponse) => item.id === run.id).status).toBe("completed");
  const deleted = await request.delete(`/api/podcast/talks/${talk.id}`);
  expect(deleted.status()).toBe(200); expect((await deleted.json()).deletedRuns).toBe(2);
  expect((await request.get(`/api/podcast/runs/${run.id}`)).status()).toBe(404);
  expect((await request.get(`/api/podcast/runs/${next.id}`)).status()).toBe(404);
});

test("real human text is claimed once, persists with human attribution, and next seat follows cast size", async ({ request }) => {
  const talk = await create(request, input({ humanOnly: true }));
  const run = await start(request, talk);
  expect(run.status).toBe("waiting_for_human");
  const speakerIndex = run.activeTurn?.participantIndex;
  expect(speakerIndex).toBeDefined();
  const results = await Promise.all([
    request.post(`/api/podcast/runs/${run.id}/human-turn`, { data: { content: "Preferisco una verifica umana prima della decisione." } }),
    request.post(`/api/podcast/runs/${run.id}/human-turn`, { data: { content: "Questa richiesta duplicata non deve aggiungere un secondo turno." } }),
  ]);
  expect(results.map(response => response.status()).sort()).toEqual([200, 409]);
  const saved: TalkRunResponse = (await (await request.get(`/api/podcast/runs/${run.id}`)).json()).run;
  expect(saved.messages).toHaveLength(1); expect(saved.messages[0].origin).toBe("human");
  expect(saved.messages[0].participantIndex).toBe(speakerIndex);
  expect(saved.messages[0].provider).toBeUndefined(); expect(saved.messages[0].model).toBeUndefined();
  expect(saved.nextParticipantIndex).toBe(((speakerIndex ?? 0) + 1) % 2);
  const advanced = await request.post(`/api/podcast/runs/${run.id}/next`);
  expect(advanced.status()).toBe(200); expect((await advanced.json()).run.status).toBe("waiting_for_human");
});

test("drafts cannot run and namespaced persistence never touches Meeting or legacy Talk collections", async ({ request }) => {
  const talk = await create(request, input({ status: "draft" }));
  const response = await request.post(`/api/podcast/talks/${talk.id}/runs`);
  expect(response.status()).toBe(409); expect((await response.json()).code).toBe("draft_talk");
  expect(TalkModel.modelName).toBe("PodcastTalk"); expect(TalkModel.collection.collectionName).toBe("podcast_talks");
  expect(TalkRunModel.modelName).toBe("PodcastRun"); expect(TalkRunModel.collection.collectionName).toBe("podcast_runs");
  expect(AudienceRoomModel.modelName).toBe("PodcastAudienceRoom"); expect(AudienceRoomModel.collection.collectionName).toBe("podcast_audience_rooms");
  expect(await MeetingModel.countDocuments()).toBe(originalMeetingCount);
});
