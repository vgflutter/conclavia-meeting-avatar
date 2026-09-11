import { expect, test } from "@playwright/test";
import { classifyTranscriptSource, participantTranscript, transcriptEventIndex } from "../../src/lib/meeting-transcript-source";

const start = Date.parse("2026-09-11T08:38:27Z");
const command = {
  id: "reply", response: "Certo: perché il libro di matematica era triste? Perché aveva troppi problemi.",
  createdAt: new Date(start - 1000), playbackStartedAt: new Date(start), playbackEndedAt: new Date(start + 8000),
};
const meeting = { assistant: { wakeWord: "Riccardo" }, commandHistory: [command], bot: {} };
const segment = { speakerName: "Vincenzo Giacchina", text: "Certo, perché il libro.", createdAt: new Date(start + 4000) };

test("echo: asynchronous work selects its original speaker even with identical text and sequence", () => {
  const echo = {...segment, segmentId: "a", sequence: 1, speakerName: "Riccardo (Guest)"};
  const human = {...segment, segmentId: "b", sequence: 1, text: "Riccardo, mi senti?"};
  const later = {...human, segmentId: "c", speakerName: "Riccardo (Guest)"};
  const events = [echo, human, later];
  expect(classifyTranscriptSource(meeting, events[transcriptEventIndex(events, echo.text, "a")]).source).toBe("avatar");
  expect(classifyTranscriptSource(meeting, events[transcriptEventIndex(events, human.text, "b")]).source).toBe("participant");
  expect(transcriptEventIndex(events, human.text, "missing")).toBe(-1);
  expect(transcriptEventIndex(events, "unrelated", "b")).toBe(-1);
});

test("echo: screenshot fragment remains raw but is quarantined", () => {
  expect(classifyTranscriptSource(meeting, segment)).toEqual({ source: "suspected_echo", echoCommandId: "reply" });
  expect(segment.speakerName).toBe("Vincenzo Giacchina");
  expect(classifyTranscriptSource(meeting, { ...segment, speakerName: "Riccardo (Guest)" }).source).toBe("avatar");
});

for (const text of ["Sì", "Va bene", "Il libro", "Certo perché", "Riccardo, mi senti?", "Certo, perché il libro? Non ho capito la battuta.", "Il libro è triste ma il budget è confermato"]) {
  test(`echo: keeps short or additional human speech: ${text}`, () => {
    expect(classifyTranscriptSource(meeting, { ...segment, text }).source).toBe("participant");
  });
}

test("echo: matching text before playback or after tail is not suppressed", () => {
  for (const at of [start - 1, start + 13_001, start + 120_000]) {
    expect(classifyTranscriptSource(meeting, { ...segment, createdAt: new Date(at) }).source).toBe("participant");
  }
});

test("echo: generation, errors without playback and stale speaking are not evidence", () => {
  const unsaid = { id: "reply", response: command.response, createdAt: command.createdAt };
  expect(classifyTranscriptSource({ ...meeting, commandHistory: [unsaid] }, segment).source).toBe("participant");
  expect(classifyTranscriptSource({ ...meeting, commandHistory: [unsaid], bot: {
    outputSpeechCommandId: "reply", outputSpeechState: "error", outputSpeechUpdatedAt: new Date(start),
  } }, segment).source).toBe("participant");
  expect(classifyTranscriptSource({ ...meeting, commandHistory: [{ ...unsaid, playbackStartedAt: new Date(start) }] },
    { ...segment, createdAt: new Date(start + 96_000) }).source).toBe("participant");
});

test("echo: delayed delivery uses epoch speech timestamp and the original command", () => {
  const delayed = { ...segment, startMs: start + 4000, createdAt: new Date(start + 120_000) };
  const later = { ...command, id: "next", response: "Parliamo ora del budget.", playbackStartedAt: new Date(start + 30_000) };
  expect(classifyTranscriptSource({ ...meeting, commandHistory: [command, later] }, delayed).echoCommandId).toBe("reply");
  expect(classifyTranscriptSource(meeting, { ...delayed, startMs: start - 1000 }).source).toBe("participant");
});

test("echo: existing live sessions use confirmed playback, never arbitrary history", () => {
  const legacy = { ...meeting, commandHistory: [{ id: "reply", response: command.response, createdAt: command.createdAt }], bot: {
    outputSpeechCommandId: "reply", outputSpeechState: "completed", outputSpeechUpdatedAt: new Date(start + 8000),
  } };
  expect(classifyTranscriptSource(legacy, segment).source).toBe("suspected_echo");
  expect(classifyTranscriptSource({ ...legacy, bot: { ...legacy.bot, outputSpeechCommandId: "other" } }, segment).source).toBe("participant");
});

test("echo: participant context excludes avatar and suspicious text, supports dynamic names", () => {
  const human = { ...segment, text: "Il budget è confermato a 500 euro." };
  expect(participantTranscript({ ...meeting, transcript: [segment, { ...segment, speakerName: "Riccardo" }, human] })).toEqual([human]);
  expect(classifyTranscriptSource({ ...meeting, assistant: { wakeWord: "Nora" } }, { ...human, speakerName: "Nora (Unverified)" }).source).toBe("avatar");
  expect(classifyTranscriptSource(meeting, { ...human, speakerName: "Riccardo Rossi" }).source).toBe("participant");
});
