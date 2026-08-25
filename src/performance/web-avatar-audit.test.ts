import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { WebAvatarManifest } from "./web-avatar-manifest.js";
import { auditWebAvatar } from "./web-avatar-audit.js";

const visemes = [
  "sil", "p", "t", "S", "T", "f", "k", "i", "r", "s", "u", "@", "a", "e", "E", "o", "O",
];
const moods = [
  "neutral", "attentive", "curious", "amused", "confident", "skeptical",
  "concerned", "surprised", "empathetic", "assertive", "frustrated", "reflective",
];

const manifest: WebAvatarManifest = {
  schema: "conclavia.web-avatar",
  version: 1,
  id: "test",
  displayName: "Test",
  assetVersion: "1",
  model: "test.glb",
  framing: { camera: [0, 1, 2], target: [0, 1, 0], fov: 35, scale: 1 },
  nodes: { head: "head" },
  morphs: {
    visemes: Object.fromEntries(
      visemes.map((viseme) => [viseme, viseme === "sil" ? {} : { mouthClose: 1 }]),
    ),
    moods: Object.fromEntries(
      moods.map((mood) => [mood, mood === "neutral" ? {} : { smile: 0.5 }]),
    ),
  },
  clips: {
    idle: ["idle_a", "idle_b"],
    listening: ["listen_a", "listen_b"],
    gestures: {
      nod: "raise_hand",
      tilt: "raise_hand",
      emphasis: "raise_hand",
      settle: "raise_hand",
      "raise-hand": "raise_hand",
      "lower-hand": "raise_hand",
      applause: "raise_hand",
    },
  },
  environment: { background: "#123456", keyLightIntensity: 2, fillLightIntensity: 1 },
};

function glb(document: unknown): Uint8Array {
  const encoded = new TextEncoder().encode(JSON.stringify(document));
  const paddedLength = Math.ceil(encoded.byteLength / 4) * 4;
  const output = new Uint8Array(20 + paddedLength);
  output.fill(0x20, 20);
  const view = new DataView(output.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, output.byteLength, true);
  view.setUint32(12, paddedLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  output.set(encoded, 20);
  return output;
}

await test("audits a self-contained rigged Web avatar", async () => {
  const directory = await mkdtemp(join(tmpdir(), "conclavia-glb-"));
  const path = join(directory, "test.glb");
  await writeFile(path, glb({
    asset: { version: "2.0" },
    nodes: [{ name: "head", mesh: 0, skin: 0 }],
    meshes: [{ extras: { targetNames: ["mouthClose", "smile"] } }],
    skins: [{}],
    animations: [
      { name: "idle_a" },
      { name: "idle_b" },
      { name: "listen_a" },
      { name: "listen_b" },
      { name: "raise_hand" },
    ],
    images: [{ bufferView: 2 }],
  }));
  const result = await auditWebAvatar(manifest, path);
  assert.equal(result.valid, true);
  assert.equal(result.skinned, true);
  assert.equal(result.morphTargetCount, 2);
});

await test("reports missing rig channels and external texture dependencies", async () => {
  const directory = await mkdtemp(join(tmpdir(), "conclavia-glb-"));
  const path = join(directory, "test.glb");
  await writeFile(path, glb({
    asset: { version: "2.0" },
    nodes: [{ name: "root" }],
    meshes: [{ extras: { targetNames: ["mouthClose"] } }],
    animations: [{ name: "idle_a" }],
    images: [{ uri: "skin.png" }],
  }));
  const result = await auditWebAvatar(manifest, path);
  assert.equal(result.valid, false);
  assert.deepEqual(result.missingNodes, ["head"]);
  assert.deepEqual(result.missingMorphTargets, ["smile"]);
  assert.deepEqual(result.missingAnimationClips, [
    "idle_b",
    "listen_a",
    "listen_b",
    "raise_hand",
  ]);
  assert.deepEqual(result.externalImages, ["skin.png"]);
});

await test("rejects a rig without the complete meeting-performance vocabulary", async () => {
  const directory = await mkdtemp(join(tmpdir(), "conclavia-glb-"));
  const path = join(directory, "test.glb");
  await writeFile(path, glb({
    asset: { version: "2.0" },
    nodes: [{ name: "head", mesh: 0, skin: 0 }],
    meshes: [{ extras: { targetNames: ["mouthClose", "smile"] } }],
    skins: [{}],
    animations: [{ name: "idle_a" }, { name: "listen_a" }, { name: "raise_hand" }],
    images: [{ bufferView: 2 }],
  }));
  const result = await auditWebAvatar({
    ...manifest,
    morphs: { visemes: { sil: {} }, moods: { neutral: {} } },
    clips: {
      idle: ["idle_a"],
      listening: ["listen_a"],
      gestures: { "raise-hand": "raise_hand" },
    },
  }, path);
  assert.equal(result.valid, false);
  assert.ok(result.missingVisemeMappings.includes("p"));
  assert.ok(result.missingMoodMappings.includes("attentive"));
  assert.ok(result.missingGestureMappings.includes("applause"));
  assert.deepEqual(result.insufficientAmbientVariety, ["idle", "listening"]);
});
