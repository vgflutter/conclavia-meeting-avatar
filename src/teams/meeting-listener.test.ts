import assert from "node:assert/strict";
import test from "node:test";

import {
  canSpeculateAddressedTurn,
  canSpeculateTurn,
  fileTranscriptionGuidance,
  ignoredTranscriptionReason,
  isTranscriptionPromptEcho,
  isMeetingSpeechRms,
  meetingAudioFilter,
  meetingTranscriptionPrompt,
  pcm16MonoToWav,
  pcm16Rms,
  realtimeNoiseReduction,
  realtimeTranscriptionGuidance,
} from "./meeting-listener.js";

await test("measures digital silence as zero", () => {
  assert.equal(pcm16Rms(Buffer.alloc(4_800)), 0);
});

await test("wraps captured PCM16 turns in a valid mono 24 kHz WAV", () => {
  const pcm = Buffer.alloc(4_800, 1);
  const wav = pcm16MonoToWav(pcm);
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.toString("ascii", 8, 12), "WAVE");
  assert.equal(wav.readUInt16LE(22), 1);
  assert.equal(wav.readUInt32LE(24), 24_000);
  assert.equal(wav.readUInt32LE(40), pcm.byteLength);
  assert.deepEqual(wav.subarray(44), pcm);
});

await test("detects an audible PCM16 signal above the client VAD threshold", () => {
  const pcm = Buffer.alloc(4_800);
  for (let offset = 0; offset < pcm.byteLength; offset += 2) {
    pcm.writeInt16LE(offset % 4 === 0 ? 2_000 : -2_000, offset);
  }
  assert.ok(pcm16Rms(pcm) > 0.006);
});

await test("does not mistake a low-level PCM16 signal for speech", () => {
  const pcm = Buffer.alloc(4_800);
  for (let offset = 0; offset < pcm.byteLength; offset += 2) {
    pcm.writeInt16LE(offset % 4 === 0 ? 100 : -100, offset);
  }
  assert.ok(pcm16Rms(pcm) < 0.006);
  assert.equal(isMeetingSpeechRms(pcm16Rms(pcm)), false);
});

await test("requires a finite -44 dBFS signal before opening a meeting turn", () => {
  assert.equal(isMeetingSpeechRms(0.0059), false);
  assert.equal(isMeetingSpeechRms(0.006), true);
  assert.equal(isMeetingSpeechRms(Number.NaN), false);
});

await test("guides Italian meeting transcription without correcting factual mistakes", () => {
  const prompt = meetingTranscriptionPrompt("Mary");
  assert.match(prompt, /prevalentemente in italiano/iu);
  assert.match(prompt, /senza .*correggere affermazioni fattualmente errate/iu);
  assert.match(prompt, /tre più tre fa nove/iu);
  assert.match(prompt, /non .*fan nove/iu);
  assert.match(prompt, /nome esatto .* Mary/iu);
});

await test("uses high-accuracy multilingual hints for gpt-transcribe", () => {
  assert.deepEqual(realtimeTranscriptionGuidance("gpt-transcribe", "Mary"), {
    model: "gpt-transcribe",
    languages: ["it", "en"],
    prompt: meetingTranscriptionPrompt("Mary"),
    keywords: [
      "Mary",
      "Conclavia",
      "MetaHuman",
      "Microsoft Teams",
      "Google Meet",
      "AWS",
      "Unreal Engine",
      "OpenAI",
    ],
  });
  assert.deepEqual(fileTranscriptionGuidance("gpt-transcribe", "Mary"), {
    languages: ["it", "en"],
    prompt: meetingTranscriptionPrompt("Mary"),
    keywords: [
      "Mary",
      "Conclavia",
      "MetaHuman",
      "Microsoft Teams",
      "Google Meet",
      "AWS",
      "Unreal Engine",
      "OpenAI",
    ],
  });
});

await test("uses medium delay for balanced live-transcription accuracy", () => {
  const guidance = realtimeTranscriptionGuidance("gpt-live-transcribe", "Mary");
  assert.equal(guidance.delay, "medium");
  assert.deepEqual(guidance.languages, ["it", "en"]);
});

await test("does not double-denoise a BlackHole virtual meeting bus", () => {
  assert.equal(realtimeNoiseReduction("BlackHole 16ch"), undefined);
  assert.deepEqual(realtimeNoiseReduction("MacBook Pro Microphone"), { type: "far_field" });
  const filter = meetingAudioFilter("BlackHole 16ch");
  assert.match(filter, /pan=mono/iu);
  assert.match(filter, /highpass=f=65/iu);
  assert.match(filter, /afftdn=nr=6/iu);
});

await test("speculates only when a useful partial turn addresses Mary", () => {
  assert.equal(canSpeculateAddressedTurn("Mary, cosa ne pensi?", "Mary"), true);
  assert.equal(canSpeculateAddressedTurn("Cosa ne pensi, Mary?", "Mary"), true);
  assert.equal(canSpeculateAddressedTurn("Mary", "Mary"), false);
  assert.equal(canSpeculateAddressedTurn("Parlo con Mario", "Mary"), false);
});

await test("recognizes partial turns long enough for speculative processing", () => {
  assert.equal(canSpeculateTurn("E perché no?"), true);
  assert.equal(canSpeculateTurn("Perché?"), false);
});

await test("filters the transcription prompt when silence echoes it back", () => {
  assert.equal(
    isTranscriptionPromptEcho(
      "Riunione di lavoro in italiano. L'assistente virtuale si chiama Mary.",
      "Mary",
    ),
    true,
  );
  assert.equal(
    isTranscriptionPromptEcho(
      "Riunione di lavoro in italiano. Il nome dell'assistente virtuale è Mary.",
      "Mary",
    ),
    true,
  );
  assert.equal(
    isTranscriptionPromptEcho("Mary, quanto fa due più due?", "Mary"),
    false,
  );
  assert.equal(
    isTranscriptionPromptEcho(meetingTranscriptionPrompt("Mary"), "Mary"),
    true,
  );
  assert.equal(
    isTranscriptionPromptEcho(
      "Trascrivi fedelmente ciò che viene pronunciato, senza completare frasi.",
      "Mary",
    ),
    true,
  );
});

await test("filters recurring silent-buffer hallucinations without losing short invocations", () => {
  for (const hallucination of ["이", "어", "Apa?", "Čau", "Iya iya", "Sampai jumpa"]) {
    assert.equal(ignoredTranscriptionReason(hallucination, "Mary"), "noise", hallucination);
  }
  assert.equal(ignoredTranscriptionReason("Mary?", "Mary"), null);
  assert.equal(ignoredTranscriptionReason("Ehi Mary", "Mary"), null);
  assert.equal(ignoredTranscriptionReason("Sì", "Mary"), null);
  assert.equal(ignoredTranscriptionReason("No", "Mary"), null);
  assert.equal(ignoredTranscriptionReason("Tre più tre fa nove", "Mary"), null);
});
