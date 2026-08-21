import assert from "node:assert/strict";
import test from "node:test";

import { canSpeculateAddressedTurn, canSpeculateTurn, pcm16Rms } from "./meeting-listener.js";

await test("measures digital silence as zero", () => {
  assert.equal(pcm16Rms(Buffer.alloc(4_800)), 0);
});

await test("detects an audible PCM16 signal above the client VAD threshold", () => {
  const pcm = Buffer.alloc(4_800);
  for (let offset = 0; offset < pcm.byteLength; offset += 2) {
    pcm.writeInt16LE(offset % 4 === 0 ? 2_000 : -2_000, offset);
  }
  assert.ok(pcm16Rms(pcm) > 0.006);
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
