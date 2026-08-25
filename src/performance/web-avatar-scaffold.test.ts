import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { auditWebAvatar } from "./web-avatar-audit.js";
import { parseWebAvatarManifest } from "./web-avatar-manifest.js";
import {
  scaffoldWebAvatarManifest,
  writeWebAvatarScaffold,
} from "./web-avatar-scaffold.js";

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

async function riggedModel(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "conclavia-scaffold-"));
  const modelPath = join(directory, "mary.glb");
  await writeFile(modelPath, glb({
    asset: { version: "2.0" },
    nodes: [
      { name: "Head", mesh: 0, skin: 0 },
      { name: "eye_l" },
      { name: "eye_r" },
    ],
    meshes: [{ extras: { targetNames: ["jawOpen", "mouthSmileLeft"] } }],
    skins: [{}],
    animations: [
      { name: "Idle_Attentive_A" },
      { name: "Idle_Attentive_B" },
      { name: "Listen_Neutral_A" },
      { name: "Listen_Reflective" },
      { name: "Gesture_Nod" },
      { name: "Gesture_RaiseHand_Seated" },
      { name: "Gesture_Applause_Seated" },
    ],
  }));
  return modelPath;
}

await test("scaffolds only unambiguous Web avatar nodes and clips", async () => {
  const modelPath = await riggedModel();
  const result = await scaffoldWebAvatarManifest(modelPath, "showcase");
  assert.deepEqual(result.manifest.nodes, {
    head: "Head",
    leftEye: "eye_l",
    rightEye: "eye_r",
  });
  assert.deepEqual(result.manifest.clips.idle, ["Idle_Attentive_A", "Idle_Attentive_B"]);
  assert.deepEqual(result.manifest.clips.listening, ["Listen_Neutral_A", "Listen_Reflective"]);
  assert.equal(result.manifest.clips.gestures.nod, "Gesture_Nod");
  assert.equal(result.manifest.clips.gestures["raise-hand"], "Gesture_RaiseHand_Seated");
  assert.equal(result.manifest.clips.gestures.applause, "Gesture_Applause_Seated");
  assert.deepEqual(result.unresolved.nodes, []);
  assert.ok(result.unresolved.visemes.includes("a"));
  assert.ok(result.unresolved.moods.includes("amused"));
  assert.ok(result.unresolved.gestures.includes("lower-hand"));
  assert.deepEqual(result.unresolved.ambientClips, []);
  assert.ok(parseWebAvatarManifest(result.manifest));
  const audit = await auditWebAvatar(result.manifest, modelPath);
  assert.equal(audit.valid, false);
  assert.ok(audit.missingVisemeMappings.includes("a"));
  assert.ok(audit.missingMoodMappings.includes("amused"));
});

await test("writes beside the GLB and never overwrites an existing manifest", async () => {
  const modelPath = await riggedModel();
  const result = await writeWebAvatarScaffold(modelPath, "showcase");
  const stored = JSON.parse(await readFile(result.outputPath, "utf8")) as unknown;
  assert.ok(parseWebAvatarManifest(stored));
  await assert.rejects(
    writeWebAvatarScaffold(modelPath, "showcase"),
    (error: unknown) => (error as NodeJS.ErrnoException).code === "EEXIST",
  );
});

await test("refuses an unskinned model", async () => {
  const directory = await mkdtemp(join(tmpdir(), "conclavia-scaffold-"));
  const modelPath = join(directory, "prop.glb");
  await writeFile(modelPath, glb({ asset: { version: "2.0" }, nodes: [{ name: "Head" }] }));
  await assert.rejects(
    scaffoldWebAvatarManifest(modelPath, "showcase"),
    /must contain a skin/u,
  );
});
