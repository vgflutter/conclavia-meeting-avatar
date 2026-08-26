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
  primitives?: Array<{
    attributes?: Record<string, number>;
    material?: number;
  }>;
}

interface GltfMaterial {
  name?: string;
}

interface GltfAnimation {
  name?: string;
}

interface GltfImage {
  name?: string;
  mimeType?: string;
  uri?: string;
  bufferView?: number;
}

interface GltfBufferView {
  byteOffset?: number;
  byteLength?: number;
}

interface GltfDocument {
  asset?: { version?: string };
  nodes?: GltfNode[];
  meshes?: GltfMesh[];
  animations?: GltfAnimation[];
  images?: GltfImage[];
  materials?: GltfMaterial[];
  bufferViews?: GltfBufferView[];
  skins?: unknown[];
}

export interface WebAvatarEmbeddedImage {
  name: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
}

export interface WebAvatarAudit {
  valid: boolean;
  gltfVersion: string | null;
  skinned: boolean;
  nodeCount: number;
  morphTargetCount: number;
  animationCount: number;
  animationAssetCount: number;
  minimumSkinInfluenceSets: number;
  minimumCriticalTextureSize: number | null;
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
  skinnedPrimitiveCount: number;
  minimumSkinInfluenceSets: number;
  maximumSkinInfluenceSets: number;
  deformingPrimitiveCount: number;
  minimumDeformingSkinInfluenceSets: number;
  nodeNames: string[];
  morphTargetNames: string[];
  animationClipNames: string[];
  externalImages: string[];
  embeddedImages: WebAvatarEmbeddedImage[];
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

function parseGlb(bytes: Uint8Array): {
  document: GltfDocument;
  binary: Uint8Array | null;
} {
  if (bytes.byteLength < 20) throw new Error("GLB is too small");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error("Invalid GLB magic");
  if (view.getUint32(4, true) !== 2) throw new Error("Only glTF 2.0 GLB is supported");
  if (view.getUint32(8, true) !== bytes.byteLength) {
    throw new Error("GLB length header does not match the file");
  }
  let offset = 12;
  let document: GltfDocument | null = null;
  let binary: Uint8Array | null = null;
  while (offset + 8 <= bytes.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const start = offset + 8;
    const end = start + length;
    if (end > bytes.byteLength) throw new Error("GLB contains a truncated chunk");
    if (type === 0x4e4f534a) {
      const json = new TextDecoder().decode(bytes.subarray(start, end)).trim();
      document = JSON.parse(json) as GltfDocument;
    } else if (type === 0x004e4942) {
      binary = bytes.subarray(start, end);
    }
    offset = end;
  }
  if (!document) throw new Error("GLB JSON chunk not found");
  return { document, binary };
}

function imageDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (
    bytes.byteLength >= 24
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
  ) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (bytes.byteLength < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 8 < bytes.byteLength) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1]!;
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const length = (bytes[offset + 2]! << 8) | bytes[offset + 3]!;
    if (length < 2 || offset + 2 + length > bytes.byteLength) return null;
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7)
      || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return {
        height: (bytes[offset + 5]! << 8) | bytes[offset + 6]!,
        width: (bytes[offset + 7]! << 8) | bytes[offset + 8]!,
      };
    }
    offset += 2 + length;
  }
  return null;
}

function embeddedImageBytes(
  image: GltfImage,
  document: GltfDocument,
  binary: Uint8Array | null,
): Uint8Array | null {
  if (image.bufferView !== undefined && binary) {
    const view = document.bufferViews?.[image.bufferView];
    if (!view || !Number.isInteger(view.byteLength)) return null;
    const start = view.byteOffset ?? 0;
    const end = start + (view.byteLength ?? 0);
    return start >= 0 && end <= binary.byteLength ? binary.subarray(start, end) : null;
  }
  if (!image.uri?.startsWith("data:")) return null;
  const comma = image.uri.indexOf(",");
  if (comma < 0) return null;
  try {
    return image.uri.slice(0, comma).includes(";base64")
      ? Buffer.from(image.uri.slice(comma + 1), "base64")
      : Buffer.from(decodeURIComponent(image.uri.slice(comma + 1)));
  } catch {
    return null;
  }
}

function skinInfluenceSetCount(attributes: Readonly<Record<string, number>> = {}): number {
  let sets = 0;
  for (let index = 0; index < 3; index += 1) {
    if (`JOINTS_${index}` in attributes && `WEIGHTS_${index}` in attributes) sets += 1;
  }
  return sets;
}

function isDeformationCriticalPrimitive(
  meshName: string,
  materialName: string,
): boolean {
  const identity = `${meshName} ${materialName}`.toLowerCase();
  return ["bodymesh", "outfit", "garment", "bodyshape", "shirt", "short"]
    .some((token) => identity.includes(token));
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

const meetingTextureGroups = [
  { name: "face", patterns: ["face_skin"] },
  { name: "hair", patterns: ["hair_cards", "haircards"] },
  { name: "wardrobe", patterns: ["bodyshapea_shirt", "shirt"] },
] as const;

function inspectCriticalTextures(
  images: readonly WebAvatarEmbeddedImage[],
  requiredSize: number,
): { issues: string[]; minimumSize: number | null } {
  const issues: string[] = [];
  const sizes: number[] = [];
  for (const group of meetingTextureGroups) {
    const matches = images.filter((image) => {
      const name = image.name.toLowerCase();
      return group.patterns.some((pattern) => name.includes(pattern));
    });
    if (!matches.length) {
      issues.push(`critical-texture-missing:${group.name}`);
      continue;
    }
    const readableSizes = matches.flatMap((image) => (
      image.width && image.height ? [Math.min(image.width, image.height)] : []
    ));
    if (!readableSizes.length) {
      issues.push(`critical-texture-unreadable:${group.name}`);
      continue;
    }
    const groupMinimum = Math.min(...readableSizes);
    sizes.push(groupMinimum);
    if (groupMinimum < requiredSize) {
      issues.push(`critical-texture-resolution:${group.name}:${groupMinimum}<${requiredSize}`);
    }
  }
  return {
    issues,
    minimumSize: sizes.length ? Math.min(...sizes) : null,
  };
}

export async function inspectWebAvatarModel(modelPath: string): Promise<WebAvatarModelInventory> {
  const { document, binary } = parseGlb(await readFile(modelPath));
  const images = document.images ?? [];
  const externalImages = images
    .map((image) => image.uri)
    .filter((uri): uri is string => typeof uri === "string" && !uri.startsWith("data:"));
  const influenceInventories = (document.meshes ?? []).flatMap((mesh) => (
    (mesh.primitives ?? []).map((primitive) => {
      const sets = skinInfluenceSetCount(primitive.attributes);
      const materialName = primitive.material === undefined
        ? ""
        : document.materials?.[primitive.material]?.name ?? "";
      return {
        sets,
        deformationCritical: isDeformationCriticalPrimitive(mesh.name ?? "", materialName),
      };
    })
  )).filter((inventory) => inventory.sets > 0);
  const influenceSetCounts = influenceInventories.map((inventory) => inventory.sets);
  const deformingInfluenceSetCounts = influenceInventories
    .filter((inventory) => inventory.deformationCritical)
    .map((inventory) => inventory.sets);
  const embeddedImages = images.flatMap((image, index) => {
    const bytes = embeddedImageBytes(image, document, binary);
    if (!bytes) return [];
    const dimensions = imageDimensions(bytes);
    return [{
      name: image.name || `image-${index}`,
      mimeType: image.mimeType ?? null,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
    }];
  });
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
    skinnedPrimitiveCount: influenceSetCounts.length,
    minimumSkinInfluenceSets: influenceSetCounts.length ? Math.min(...influenceSetCounts) : 0,
    maximumSkinInfluenceSets: influenceSetCounts.length ? Math.max(...influenceSetCounts) : 0,
    deformingPrimitiveCount: deformingInfluenceSetCounts.length,
    minimumDeformingSkinInfluenceSets: deformingInfluenceSetCounts.length
      ? Math.min(...deformingInfluenceSetCounts)
      : 0,
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
    embeddedImages,
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
  const meetingHq = manifest.appearance?.qualityTier === "meeting-hq";
  const requiredInfluenceSets = manifest.appearance?.minimumSkinInfluenceSets
    ?? (meetingHq ? 2 : 0);
  const requiredTextureSize = manifest.appearance?.minimumTextureSize
    ?? (meetingHq ? 2_048 : 0);
  const criticalTextures = requiredTextureSize > 0
    ? inspectCriticalTextures(inventory.embeddedImages, requiredTextureSize)
    : { issues: [], minimumSize: null };
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
    ...(requiredInfluenceSets === 0
      || (inventory.deformingPrimitiveCount > 0
        && inventory.minimumDeformingSkinInfluenceSets >= requiredInfluenceSets)
      ? []
      : [
        `deforming-skin-influence-sets:${inventory.minimumDeformingSkinInfluenceSets}<${requiredInfluenceSets}`,
      ]),
    ...criticalTextures.issues,
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
    minimumSkinInfluenceSets: inventory.minimumDeformingSkinInfluenceSets,
    minimumCriticalTextureSize: criticalTextures.minimumSize,
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
