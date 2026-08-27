import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { WebAvatarManifest } from "./web-avatar-manifest.js";
import { auditWebAvatar, inspectWebAvatarModel } from "./web-avatar-audit.js";

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
  animationModels: [],
  appearance: {
    sourceIdentity: "Test",
    hairGeometry: "cards",
    visualReview: "approved",
  },
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
  facialClips: { visemes: {}, moods: {} },
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

function glbWithBinary(document: unknown, binary: Uint8Array): Uint8Array {
  const encoded = new TextEncoder().encode(JSON.stringify(document));
  const jsonLength = Math.ceil(encoded.byteLength / 4) * 4;
  const binaryLength = Math.ceil(binary.byteLength / 4) * 4;
  const output = new Uint8Array(28 + jsonLength + binaryLength);
  output.fill(0x20, 20, 20 + jsonLength);
  const view = new DataView(output.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, output.byteLength, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  output.set(encoded, 20);
  const binaryHeader = 20 + jsonLength;
  view.setUint32(binaryHeader, binaryLength, true);
  view.setUint32(binaryHeader + 4, 0x004e4942, true);
  output.set(binary, binaryHeader + 8);
  return output;
}

function pngHeader(size: number): Uint8Array {
  const output = new Uint8Array(24);
  output.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(output.buffer);
  view.setUint32(16, size);
  view.setUint32(20, size);
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
  assert.deepEqual(await inspectWebAvatarModel(path), {
    gltfVersion: "2.0",
    skinned: true,
    nodeCount: 1,
    meshCount: 1,
    skinCount: 1,
    imageCount: 1,
    embeddedImageCount: 1,
    animationCount: 5,
    skinnedPrimitiveCount: 0,
    minimumSkinInfluenceSets: 0,
    maximumSkinInfluenceSets: 0,
    deformingPrimitiveCount: 0,
    minimumDeformingSkinInfluenceSets: 0,
    nodeNames: ["head"],
    morphTargetNames: ["mouthClose", "smile"],
    animationClipNames: ["idle_a", "idle_b", "listen_a", "listen_b", "raise_hand"],
    externalImages: [],
    embeddedImages: [],
  });
});

await test("unions clips from separately exported Unreal animation GLBs", async () => {
  const directory = await mkdtemp(join(tmpdir(), "conclavia-glb-bundle-"));
  const modelPath = join(directory, "test.glb");
  const ambientPath = join(directory, "ambient.glb");
  const gesturesPath = join(directory, "gestures.glb");
  await writeFile(modelPath, glb({
    asset: { version: "2.0" },
    nodes: [{ name: "head", mesh: 0, skin: 0 }],
    meshes: [{ extras: { targetNames: ["mouthClose", "smile"] } }],
    skins: [{}],
    images: [{ bufferView: 2 }],
  }));
  await writeFile(ambientPath, glb({
    asset: { version: "2.0" },
    animations: ["idle_a", "idle_b", "listen_a", "listen_b"].map((name) => ({ name })),
  }));
  await writeFile(gesturesPath, glb({
    asset: { version: "2.0" },
    animations: [{ name: "raise_hand" }],
  }));
  const result = await auditWebAvatar(
    { ...manifest, animationModels: ["ambient.glb", "gestures.glb"] },
    modelPath,
    [ambientPath, gesturesPath],
  );
  assert.equal(result.valid, true);
  assert.equal(result.animationCount, 5);
  assert.equal(result.animationAssetCount, 2);
  assert.deepEqual(result.missingAnimationClips, []);
  assert.deepEqual(result.invalidAnimationAssets, []);
});

await test("accepts identity-baked skeletal facial clips instead of morph targets", async () => {
  const directory = await mkdtemp(join(tmpdir(), "conclavia-glb-face-bundle-"));
  const modelPath = join(directory, "test.glb");
  const animationPath = join(directory, "face.glb");
  await writeFile(modelPath, glb({
    asset: { version: "2.0" },
    nodes: [{ name: "head", mesh: 0, skin: 0 }],
    meshes: [{}],
    skins: [{}],
    animations: [
      { name: "idle_a" }, { name: "idle_b" },
      { name: "listen_a" }, { name: "listen_b" },
      { name: "raise_hand" },
    ],
    images: [{ bufferView: 2 }],
  }));
  await writeFile(animationPath, glb({
    asset: { version: "2.0" },
    nodes: [{ name: "FACIAL_C_Jaw" }],
    animations: [{ name: "face_pose" }],
  }));
  const facialManifest: WebAvatarManifest = {
    ...manifest,
    animationModels: ["face.glb"],
    morphs: { visemes: { sil: {} }, moods: { neutral: {} } },
    facialClips: {
      visemes: Object.fromEntries(
        visemes.filter((name) => name !== "sil").map((name) => [name, "face_pose"]),
      ),
      moods: Object.fromEntries(
        moods.filter((name) => name !== "neutral").map((name) => [name, {
          clip: "face_pose",
          startSeconds: 0.2,
          endSeconds: 0.8,
          loop: true,
        }]),
      ),
    },
  };
  const result = await auditWebAvatar(facialManifest, modelPath, [animationPath]);
  assert.equal(result.valid, true);
  assert.equal(result.morphTargetCount, 0);
  assert.deepEqual(result.missingVisemeMappings, []);
  assert.deepEqual(result.missingMoodMappings, []);
  assert.deepEqual(result.missingAnimationClips, []);
});

await test("rejects facial GLBs that only rename the same neutral payload", async () => {
  const directory = await mkdtemp(join(tmpdir(), "conclavia-glb-face-duplicate-"));
  const modelPath = join(directory, "test.glb");
  const firstPath = join(directory, "anim-face-attentive.glb");
  const secondPath = join(directory, "anim-face-curious.glb");
  await writeFile(modelPath, glb({
    asset: { version: "2.0" },
    nodes: [{ name: "head", mesh: 0, skin: 0 }],
    meshes: [{}],
    skins: [{}],
    animations: [
      { name: "idle_a" }, { name: "idle_b" },
      { name: "listen_a" }, { name: "listen_b" },
      { name: "raise_hand" },
    ],
    images: [{ bufferView: 2 }],
  }));
  const duplicatePayload = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  await writeFile(firstPath, glbWithBinary({
    asset: { version: "2.0" },
    animations: [{ name: "face_pose" }],
    buffers: [{ byteLength: duplicatePayload.byteLength }],
  }, duplicatePayload));
  await writeFile(secondPath, glbWithBinary({
    asset: { version: "2.0" },
    animations: [{ name: "face_pose" }],
    buffers: [{ byteLength: duplicatePayload.byteLength }],
  }, duplicatePayload));
  const result = await auditWebAvatar(
    {
      ...manifest,
      animationModels: ["anim-face-attentive.glb", "anim-face-curious.glb"],
      morphs: { visemes: { sil: {} }, moods: { neutral: {} } },
      facialClips: {
        visemes: Object.fromEntries(
          visemes.filter((name) => name !== "sil").map((name) => [name, "face_pose"]),
        ),
        moods: Object.fromEntries(
          moods.filter((name) => name !== "neutral").map((name) => [name, "face_pose"]),
        ),
      },
    },
    modelPath,
    [firstPath, secondPath],
  );
  assert.equal(result.valid, false);
  assert.deepEqual(result.invalidAnimationAssets, [
    "anim-face-curious.glb:duplicate-facial-payload:anim-face-attentive.glb",
  ]);
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
  const inventory = await inspectWebAvatarModel(path);
  assert.equal(inventory.embeddedImageCount, 0);
  assert.deepEqual(inventory.externalImages, ["skin.png"]);
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

await test("fails closed until Showcase hair and the visual review are verified", async () => {
  const directory = await mkdtemp(join(tmpdir(), "conclavia-glb-appearance-"));
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
  const result = await auditWebAvatar({
    ...manifest,
    id: "showcase",
    appearance: {
      sourceIdentity: "MHC_Showcase",
      hairGeometry: "missing",
      visualReview: "pending",
    },
  }, path);
  assert.equal(result.valid, false);
  assert.deepEqual(result.appearanceIssues, [
    "hair-geometry-missing",
    "visual-review-pending",
  ]);
});

await test("enforces measurable meeting-HQ skinning and texture gates", async () => {
  const directory = await mkdtemp(join(tmpdir(), "conclavia-glb-hq-"));
  const path = join(directory, "test.glb");
  const texture = pngHeader(2_048);
  const groomControlTexture = pngHeader(512);
  const binary = new Uint8Array(texture.byteLength * 3 + groomControlTexture.byteLength * 2);
  binary.set(texture, 0);
  binary.set(texture, texture.byteLength);
  binary.set(texture, texture.byteLength * 2);
  binary.set(groomControlTexture, texture.byteLength * 3);
  binary.set(groomControlTexture, texture.byteLength * 3 + groomControlTexture.byteLength);
  const hqManifest: WebAvatarManifest = {
    ...manifest,
    appearance: {
      ...manifest.appearance!,
      qualityTier: "meeting-hq",
      minimumTextureSize: 2_048,
      minimumSkinInfluenceSets: 2,
    },
  };
  const baseDocument = {
    asset: { version: "2.0" },
    nodes: [{ name: "head", mesh: 0, skin: 0 }],
    materials: [
      { name: "MI_BodyShapeA_Shirt" },
      { name: "MI_Face_Skin" },
    ],
    meshes: [{
      name: "MHC_Showcase_Outfits",
      extras: { targetNames: ["mouthClose", "smile"] },
      primitives: [{
        attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2, JOINTS_1: 3, WEIGHTS_1: 4 },
        material: 0,
      }],
    }, {
      name: "SKM_MHC_Showcase_FaceMesh",
      primitives: [{
        attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 },
        material: 1,
      }],
    }],
    skins: [{}],
    animations: [
      { name: "idle_a" }, { name: "idle_b" },
      { name: "listen_a" }, { name: "listen_b" },
      { name: "raise_hand" },
    ],
    buffers: [{ byteLength: binary.byteLength }],
    bufferViews: [
      ...[0, 1, 2].map((index) => ({
        byteOffset: index * texture.byteLength,
        byteLength: texture.byteLength,
      })),
      {
        byteOffset: texture.byteLength * 3,
        byteLength: groomControlTexture.byteLength,
      },
      {
        byteOffset: texture.byteLength * 3 + groomControlTexture.byteLength,
        byteLength: groomControlTexture.byteLength,
      },
    ],
    images: [
      { name: "MI_Face_Skin_BaseColor", mimeType: "image/png", bufferView: 0 },
      { name: "MI_Hair_Cards_BaseColor", mimeType: "image/png", bufferView: 1 },
      { name: "MI_BodyShapeA_Shirt_BaseColor", mimeType: "image/png", bufferView: 2 },
      { name: "Conclavia_HairCards_CompactTangent", mimeType: "image/png", bufferView: 3 },
      { name: "Conclavia_HairCards_CompactAttribute", mimeType: "image/png", bufferView: 4 },
    ],
  };
  await writeFile(path, glbWithBinary(baseDocument, binary));
  const accepted = await auditWebAvatar(hqManifest, path);
  assert.equal(accepted.valid, true);
  assert.equal(accepted.minimumSkinInfluenceSets, 2);
  assert.equal(accepted.minimumCriticalTextureSize, 2_048);

  await writeFile(path, glb({
    ...baseDocument,
    meshes: [{
      ...baseDocument.meshes[0],
      primitives: [{
        attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 },
        material: 0,
      }],
    }],
    bufferViews: undefined,
    images: [{ bufferView: 0 }],
  }));
  const rejected = await auditWebAvatar(hqManifest, path);
  assert.equal(rejected.valid, false);
  assert.ok(rejected.appearanceIssues.includes("deforming-skin-influence-sets:1<2"));
  assert.ok(rejected.appearanceIssues.includes("critical-texture-missing:face"));
  assert.ok(rejected.appearanceIssues.includes("critical-texture-missing:hair"));
  assert.ok(rejected.appearanceIssues.includes("critical-texture-missing:wardrobe"));
});
