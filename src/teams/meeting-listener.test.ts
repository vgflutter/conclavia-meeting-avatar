import assert from "node:assert/strict";
import test from "node:test";

import {
  canSpeculateAddressedTurn,
  canSpeculateTurn,
  isTranscriptionPromptEcho,
  pcm16MonoToWav,
  pcm16Rms,
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
});
