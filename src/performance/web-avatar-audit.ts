import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import {
  webAvatarClipName,
  type WebAvatarManifest,
} from "./web-avatar-manifest.js";

interface GltfNode {
  name?: string;
  mesh?: number;
  skin?: number;
}

interface GltfMesh {
  name?: string;
  extras?: { targetNames?: string[] };
}

interface GltfAnimation {
  name?: string;
}

interface GltfImage {
  uri?: string;
  bufferView?: number;
}

interface GltfDocument {
  asset?: { version?: string };
  nodes?: GltfNode[];
  meshes?: GltfMesh[];
  animations?: GltfAnimation[];
  images?: GltfImage[];
  skins?: unknown[];
}

export interface WebAvatarAudit {
  valid: boolean;
  gltfVersion: string | null;
  skinned: boolean;
  nodeCount: number;
  morphTargetCount: number;
  animationCount: number;
  animationAssetCount: number;
  missingNodes: string[];
  missingMorphTargets: string[];
  missingAnimationClips: string[];
  missingVisemeMappings: string[];
  missingMoodMappings: string[];
  missingGestureMappings: string[];
  insufficientAmbientVariety: string[];
  externalImages: string[];
  invalidAnimationAssets: string[];
  appearanceIssues: string[];
}

export interface WebAvatarModelInventory {
  gltfVersion: string | null;
  skinned: boolean;
  nodeCount: number;
  meshCount: number;
  skinCount: number;
  imageCount: number;
  embeddedImageCount: number;
  animationCount: number;
  nodeNames: string[];
  morphTargetNames: string[];
  animationClipNames: string[];
  externalImages: string[];
}

export const webAvatarVisemeNames = [
  "sil", "p", "t", "S", "T", "f", "k", "i", "r", "s", "u", "@", "a", "e", "E", "o", "O",
] as const;
export const webAvatarMoodNames = [
  "neutral", "attentive", "curious", "amused", "confident", "skeptical",
  "concerned", "surprised", "empathetic", "assertive", "frustrated", "reflective",
] as const;
export const webAvatarGestureNames = [
  "nod", "tilt", "emphasis", "settle", "raise-hand", "lower-hand", "applause",
] as const;

function missingNonEmptyMappings(
  required: readonly string[],
  mappings: Readonly<Record<string, Readonly<Record<string, number>> | undefined>>,
  clipMappings: Readonly<Record<string, unknown>>,
  emptyAllowed: ReadonlySet<string> = new Set(),
): string[] {
  return required.filter((name) => {
    const mapping = mappings[name];
    return !clipMappings[name]
      && (!mapping || (!emptyAllowed.has(name) && Object.keys(mapping).length === 0));
  });
}

function parseGlbJson(bytes: Uint8Array): GltfDocument {
  if (bytes.byteLength < 20) throw new Error("GLB is too small");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error("Invalid GLB magic");
  if (view.getUint32(4, true) !== 2) throw new Error("Only glTF 2.0 GLB is supported");
  if (view.getUint32(8, true) !== bytes.byteLength) {
    throw new Error("GLB length header does not match the file");
  }
  let offset = 12;
  while (offset + 8 <= bytes.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const start = offset + 8;
    const end = start + length;
    if (end > bytes.byteLength) throw new Error("GLB contains a truncated chunk");
    if (type === 0x4e4f534a) {
      const json = new TextDecoder().decode(bytes.subarray(start, end)).trim();
      return JSON.parse(json) as GltfDocument;
    }
    offset = end;
  }
  throw new Error("GLB JSON chunk not found");
}

function glbBinaryFingerprint(bytes: Uint8Array): string | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  while (offset + 8 <= bytes.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const start = offset + 8;
    const end = start + length;
    if (end > bytes.byteLength) throw new Error("GLB contains a truncated chunk");
    if (type === 0x004e4942) {
      return createHash("sha256").update(bytes.subarray(start, end)).digest("hex");
    }
    offset = end;
  }
  return null;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export async function inspectWebAvatarModel(modelPath: string): Promise<WebAvatarModelInventory> {
  const document = parseGlbJson(await readFile(modelPath));
  const images = document.images ?? [];
  const externalImages = images
    .map((image) => image.uri)
    .filter((uri): uri is string => typeof uri === "string" && !uri.startsWith("data:"));
  return {
    gltfVersion: document.asset?.version ?? null,
    skinned: Boolean(document.skins?.length)
      || (document.nodes ?? []).some((node) => node.skin !== undefined),
    nodeCount: document.nodes?.length ?? 0,
    meshCount: document.meshes?.length ?? 0,
    skinCount: document.skins?.length ?? 0,
    imageCount: images.length,
    embeddedImageCount: images.filter(
      (image) => image.bufferView !== undefined || image.uri?.startsWith("data:"),
    ).length,
    animationCount: document.animations?.length ?? 0,
    nodeNames: sortedUnique(
      (document.nodes ?? [])
        .map((node) => node.name)
        .filter((name): name is string => Boolean(name)),
    ),
    morphTargetNames: sortedUnique(
      (document.meshes ?? []).flatMap((mesh) => mesh.extras?.targetNames ?? []),
    ),
    animationClipNames: sortedUnique(
      (document.animations ?? [])
        .map((animation) => animation.name)
        .filter((name): name is string => Boolean(name)),
    ),
    externalImages: sortedUnique(externalImages),
  };
}

export async function auditWebAvatar(
  manifest: WebAvatarManifest,
  modelPath: string,
  animationModelPaths: readonly string[] = [],
): Promise<WebAvatarAudit> {
  const inventory = await inspectWebAvatarModel(modelPath);
  const animationInventories = await Promise.all(
    animationModelPaths.map(async (path) => {
      const bytes = await readFile(path);
      return {
        path,
        inventory: await inspectWebAvatarModel(path),
        binaryFingerprint: glbBinaryFingerprint(bytes),
      };
    }),
  );
  const nodeNames = new Set(inventory.nodeNames);
  const morphNames = new Set(inventory.morphTargetNames);
  const clipNames = new Set([
    ...inventory.animationClipNames,
    ...animationInventories.flatMap(({ inventory: asset }) => asset.animationClipNames),
  ]);
  const requiredNodes = Object.values(manifest.nodes);
  const requiredMorphs = new Set([
    ...Object.values(manifest.morphs.visemes).flatMap((weights) => Object.keys(weights)),
    ...Object.values(manifest.morphs.moods).flatMap((weights) => Object.keys(weights ?? {})),
  ]);
  const requiredClips = new Set([
    ...manifest.clips.idle,
    ...manifest.clips.listening,
    ...Object.values(manifest.clips.gestures).map(webAvatarClipName),
    ...Object.values(manifest.facialClips.visemes).map(webAvatarClipName),
    ...Object.values(manifest.facialClips.moods).map(webAvatarClipName),
  ]);
  const externalImages = sortedUnique([
    ...inventory.externalImages,
    ...animationInventories.flatMap(({ inventory: asset }) => asset.externalImages),
  ]);
  const duplicateFacialFingerprints = new Map<string, string>();
  const duplicateFacialAssets = animationInventories.flatMap(({ path, binaryFingerprint }) => {
    if (!/^anim-(?:face|viseme)-.+\.glb$/i.test(basename(path)) || !binaryFingerprint) {
      return [];
    }
    const first = duplicateFacialFingerprints.get(binaryFingerprint);
    if (!first) {
      duplicateFacialFingerprints.set(binaryFingerprint, basename(path));
      return [];
    }
    return [`${basename(path)}:duplicate-facial-payload:${first}`];
  });
  const invalidAnimationAssets = [
    ...animationInventories.flatMap(({ path, inventory: asset }) => {
      const issues = [
        ...(asset.gltfVersion === "2.0" ? [] : ["gltf-version"]),
        ...(asset.animationCount > 0 ? [] : ["animations"]),
        ...(asset.externalImages.length === 0 ? [] : ["external-images"]),
      ];
      return issues.map((issue) => `${basename(path)}:${issue}`);
    }),
    ...duplicateFacialAssets,
  ];
  const missingNodes = requiredNodes.filter((name) => !nodeNames.has(name));
  const missingMorphTargets = [...requiredMorphs].filter((name) => !morphNames.has(name));
  const missingAnimationClips = [...requiredClips].filter((name) => !clipNames.has(name));
  const missingVisemeMappings = missingNonEmptyMappings(
    webAvatarVisemeNames,
    manifest.morphs.visemes,
    manifest.facialClips.visemes,
    new Set(["sil"]),
  );
  const missingMoodMappings = missingNonEmptyMappings(
    webAvatarMoodNames,
    manifest.morphs.moods,
    manifest.facialClips.moods,
    new Set(["neutral"]),
  );
  const missingGestureMappings = webAvatarGestureNames.filter(
    (gesture) => !manifest.clips.gestures[gesture],
  );
  const insufficientAmbientVariety = [
    ...(new Set(manifest.clips.idle).size >= 2 ? [] : ["idle"]),
    ...(new Set(manifest.clips.listening).size >= 2 ? [] : ["listening"]),
  ];
  const appearanceIssues = [
    ...(manifest.appearance ? [] : ["appearance-metadata-missing"]),
    ...(manifest.id !== "showcase"
      || manifest.appearance?.sourceIdentity.toLowerCase().includes("showcase")
      ? []
      : ["source-identity-unverified"]),
    ...(manifest.appearance?.hairGeometry === "cards"
      || manifest.appearance?.hairGeometry === "mesh"
      ? []
      : ["hair-geometry-missing"]),
    ...(manifest.appearance?.visualReview === "approved"
      ? []
      : ["visual-review-pending"]),
  ];
  const skinned = inventory.skinned;
  return {
    valid: inventory.gltfVersion === "2.0"
      && skinned
      && missingNodes.length === 0
      && missingMorphTargets.length === 0
      && missingAnimationClips.length === 0
      && missingVisemeMappings.length === 0
      && missingMoodMappings.length === 0
      && missingGestureMappings.length === 0
      && insufficientAmbientVariety.length === 0
      && externalImages.length === 0
      && invalidAnimationAssets.length === 0
      && appearanceIssues.length === 0,
    gltfVersion: inventory.gltfVersion,
    skinned,
    nodeCount: inventory.nodeCount,
    morphTargetCount: morphNames.size,
    animationCount: clipNames.size,
    animationAssetCount: animationInventories.length,
    missingNodes,
    missingMorphTargets,
    missingAnimationClips,
    missingVisemeMappings,
    missingMoodMappings,
    missingGestureMappings,
    insufficientAmbientVariety,
    externalImages,
    invalidAnimationAssets,
    appearanceIssues,
  };
}
