import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { auditWebAvatar } from "./web-avatar-audit.js";
import { parseWebAvatarManifest } from "./web-avatar-manifest.js";
import {
  scaffoldWebAvatarManifest,
  writeWebAvatarBundleScaffold,
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

await test("refuses unsafe scaffold metadata", async () => {
  const modelPath = await riggedModel();
  await assert.rejects(
    scaffoldWebAvatarManifest(modelPath, "showcase", {
      displayName: "x".repeat(121),
    }),
    /metadata is invalid/u,
  );
  await assert.rejects(
    scaffoldWebAvatarManifest(modelPath, "showcase", {
      assetVersion: "x".repeat(81),
    }),
    /metadata is invalid/u,
  );
});

await test("turns the UE 5.8 export inventory into a multi-GLB manifest draft", async () => {
  const directory = await mkdtemp(join(tmpdir(), "conclavia-export-bundle-"));
  await writeFile(join(directory, "model.glb"), glb({
    asset: { version: "2.0" },
    nodes: [{ name: "Head", mesh: 0, skin: 0 }],
    meshes: [{ extras: { targetNames: ["jawOpen", "mouthSmileLeft"] } }],
    skins: [{}],
  }));
  await writeFile(join(directory, "anim-idle.glb"), glb({
    asset: { version: "2.0" },
    animations: ["Idle_A", "Idle_B", "Listen_A", "Listen_B"].map((name) => ({ name })),
  }));
  await writeFile(join(directory, "anim-gesture.glb"), glb({
    asset: { version: "2.0" },
    animations: [{ name: "Hand_Raise" }, { name: "Applause" }],
  }));
  const inventoryPath = join(directory, "export.json");
  await writeFile(inventoryPath, JSON.stringify({
    schema: "conclavia.web-avatar-export",
    version: 1,
    id: "showcase",
    displayName: "Showcase Web MetaHuman",
    assetVersion: "ue58-v30",
    model: "model.glb",
    animationModels: ["anim-idle.glb", "anim-gesture.glb"],
    appearance: {
      sourceIdentity: "MHC_Showcase",
      hairGeometry: "missing",
      visualReview: "pending",
    },
    clips: {
      idle: ["Idle_A", "Idle_B"],
      listening: ["Listen_A", "Listen_B"],
      gestures: {
        "raise-hand": { clip: "Hand_Raise", startSeconds: 1, endSeconds: 2 },
        "lower-hand": { clip: "Hand_Raise", startSeconds: 3, endSeconds: 4 },
        applause: { clip: "Applause", startSeconds: 1, endSeconds: 3, loop: true },
      },
    },
  }));

  const result = await writeWebAvatarBundleScaffold(inventoryPath);
  assert.deepEqual(result.manifest.animationModels, ["anim-idle.glb", "anim-gesture.glb"]);
  assert.equal(result.manifest.displayName, "Showcase Web MetaHuman");
  assert.equal(result.manifest.assetVersion, "ue58-v30");
  assert.deepEqual(result.manifest.appearance, {
    sourceIdentity: "MHC_Showcase",
    hairGeometry: "missing",
    visualReview: "pending",
  });
  assert.deepEqual(result.manifest.clips.gestures["lower-hand"], {
    clip: "Hand_Raise",
    startSeconds: 3,
    endSeconds: 4,
  });
  assert.deepEqual(result.unresolved.ambientClips, []);
  assert.ok(parseWebAvatarManifest(
    JSON.parse(await readFile(result.outputPath, "utf8")) as unknown,
  ));
});

await test("resolves UE glTF numeric clip suffixes without losing authored segments", async () => {
  const directory = await mkdtemp(join(tmpdir(), "conclavia-export-bundle-"));
  await writeFile(join(directory, "model.glb"), glb({
    asset: { version: "2.0" },
    nodes: [
      { name: "head", mesh: 0, skin: 0 },
      { name: "FACIAL_L_Eye" },
      { name: "FACIAL_R_Eye" },
    ],
    meshes: [{}],
    skins: [{}],
  }));
  await writeFile(join(directory, "animations.glb"), glb({
    asset: { version: "2.0" },
    animations: [
      { name: "AS_MeetingCalmIdle_v1_0" },
      { name: "AS_MeetingEngagedIdle_v1_0" },
      { name: "AS_MeetingAttentiveIdle_v1_0" },
      { name: "AS_MeetingReflectiveIdle_v1_0" },
      { name: "AS_MeetingHandRaise_SeatedMarkerless_v1_0" },
      { name: "AS_MeetingApplause_SeatedMarkerless_v1_0" },
      { name: "AS_WebFacialPositiveProbe_v1_0" },
    ],
  }));
  const result = await scaffoldWebAvatarManifest(join(directory, "model.glb"), "showcase", {
    animationModelPaths: [join(directory, "animations.glb")],
    clips: {
      idle: ["AS_MeetingCalmIdle_v1", "AS_MeetingEngagedIdle_v1"],
      listening: ["AS_MeetingAttentiveIdle_v1", "AS_MeetingReflectiveIdle_v1"],
      gestures: {
        "raise-hand": {
          clip: "AS_MeetingHandRaise_SeatedMarkerless_v1",
          startSeconds: 1.75,
          endSeconds: 3.25,
        },
        applause: {
          clip: "AS_MeetingApplause_SeatedMarkerless_v1",
          startSeconds: 3.25,
          endSeconds: 6.75,
          loop: true,
        },
      },
    },
    facialClips: {
      visemes: { p: "AS_WebFacialPositiveProbe_v1" },
      moods: {
        amused: {
          clip: "AS_WebFacialPositiveProbe_v1",
          startSeconds: 0.68,
          endSeconds: 1.72,
          loop: true,
        },
      },
    },
  });
  assert.deepEqual(result.manifest.nodes, {
    head: "head",
    leftEye: "FACIAL_L_Eye",
    rightEye: "FACIAL_R_Eye",
  });
  assert.deepEqual(result.manifest.clips.idle, [
    "AS_MeetingCalmIdle_v1_0",
    "AS_MeetingEngagedIdle_v1_0",
  ]);
  assert.deepEqual(result.manifest.clips.gestures.applause, {
    clip: "AS_MeetingApplause_SeatedMarkerless_v1_0",
    startSeconds: 3.25,
    endSeconds: 6.75,
    loop: true,
  });
  assert.equal(
    result.manifest.facialClips.visemes.p,
    "AS_WebFacialPositiveProbe_v1_0",
  );
  assert.deepEqual(result.manifest.facialClips.moods.amused, {
    clip: "AS_WebFacialPositiveProbe_v1_0",
    startSeconds: 0.68,
    endSeconds: 1.72,
    loop: true,
  });
  assert.ok(!result.unresolved.visemes.includes("p"));
  assert.ok(!result.unresolved.moods.includes("amused"));
  assert.deepEqual(result.unresolved.nodes, []);
  assert.deepEqual(result.unresolved.ambientClips, []);
});
