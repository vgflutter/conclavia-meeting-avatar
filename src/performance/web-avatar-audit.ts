import { readFile } from "node:fs/promises";

import type { WebAvatarManifest } from "./web-avatar-manifest.js";

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
  missingNodes: string[];
  missingMorphTargets: string[];
  missingAnimationClips: string[];
  missingVisemeMappings: string[];
  missingMoodMappings: string[];
  missingGestureMappings: string[];
  insufficientAmbientVariety: string[];
  externalImages: string[];
}

const requiredVisemes = [
  "sil", "p", "t", "S", "T", "f", "k", "i", "r", "s", "u", "@", "a", "e", "E", "o", "O",
] as const;
const requiredMoods = [
  "neutral", "attentive", "curious", "amused", "confident", "skeptical",
  "concerned", "surprised", "empathetic", "assertive", "frustrated", "reflective",
] as const;
const requiredGestures = [
  "nod", "tilt", "emphasis", "settle", "raise-hand", "lower-hand", "applause",
] as const;

function missingNonEmptyMappings(
  required: readonly string[],
  mappings: Readonly<Record<string, Readonly<Record<string, number>> | undefined>>,
  emptyAllowed: ReadonlySet<string> = new Set(),
): string[] {
  return required.filter((name) => {
    const mapping = mappings[name];
    return !mapping || (!emptyAllowed.has(name) && Object.keys(mapping).length === 0);
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

export async function auditWebAvatar(
  manifest: WebAvatarManifest,
  modelPath: string,
): Promise<WebAvatarAudit> {
  const document = parseGlbJson(await readFile(modelPath));
  const nodeNames = new Set(
    (document.nodes ?? []).map((node) => node.name).filter((name): name is string => Boolean(name)),
  );
  const morphNames = new Set(
    (document.meshes ?? []).flatMap((mesh) => mesh.extras?.targetNames ?? []),
  );
  const clipNames = new Set(
    (document.animations ?? [])
      .map((animation) => animation.name)
      .filter((name): name is string => Boolean(name)),
  );
  const requiredNodes = Object.values(manifest.nodes);
  const requiredMorphs = new Set([
    ...Object.values(manifest.morphs.visemes).flatMap((weights) => Object.keys(weights)),
    ...Object.values(manifest.morphs.moods).flatMap((weights) => Object.keys(weights ?? {})),
  ]);
  const requiredClips = new Set([
    ...manifest.clips.idle,
    ...manifest.clips.listening,
    ...Object.values(manifest.clips.gestures),
  ]);
  const externalImages = (document.images ?? [])
    .map((image) => image.uri)
    .filter((uri): uri is string => typeof uri === "string" && !uri.startsWith("data:"));
  const missingNodes = requiredNodes.filter((name) => !nodeNames.has(name));
  const missingMorphTargets = [...requiredMorphs].filter((name) => !morphNames.has(name));
  const missingAnimationClips = [...requiredClips].filter((name) => !clipNames.has(name));
  const missingVisemeMappings = missingNonEmptyMappings(
    requiredVisemes,
    manifest.morphs.visemes,
    new Set(["sil"]),
  );
  const missingMoodMappings = missingNonEmptyMappings(
    requiredMoods,
    manifest.morphs.moods,
    new Set(["neutral"]),
  );
  const missingGestureMappings = requiredGestures.filter(
    (gesture) => !manifest.clips.gestures[gesture],
  );
  const insufficientAmbientVariety = [
    ...(new Set(manifest.clips.idle).size >= 2 ? [] : ["idle"]),
    ...(new Set(manifest.clips.listening).size >= 2 ? [] : ["listening"]),
  ];
  const skinned = Boolean(document.skins?.length)
    || (document.nodes ?? []).some((node) => node.skin !== undefined);
  return {
    valid: skinned
      && missingNodes.length === 0
      && missingMorphTargets.length === 0
      && missingAnimationClips.length === 0
      && missingVisemeMappings.length === 0
      && missingMoodMappings.length === 0
      && missingGestureMappings.length === 0
      && insufficientAmbientVariety.length === 0
      && externalImages.length === 0,
    gltfVersion: document.asset?.version ?? null,
    skinned,
    nodeCount: document.nodes?.length ?? 0,
    morphTargetCount: morphNames.size,
    animationCount: document.animations?.length ?? 0,
    missingNodes,
    missingMorphTargets,
    missingAnimationClips,
    missingVisemeMappings,
    missingMoodMappings,
    missingGestureMappings,
    insufficientAmbientVariety,
    externalImages,
  };
}
