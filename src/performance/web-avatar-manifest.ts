import { readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import type { AvatarMood } from "../domain/protocol.js";
import type { PerformanceGesture } from "./performance-plan.js";

export const webAvatarManifestSchema = "conclavia.web-avatar" as const;
export const webAvatarManifestVersion = 1 as const;

type Vector3Tuple = readonly [number, number, number];
type MorphWeights = Readonly<Record<string, number>>;

export interface WebAvatarClipSegment {
  clip: string;
  startSeconds?: number;
  endSeconds?: number;
  loop?: boolean;
}

export type WebAvatarClipReference = string | WebAvatarClipSegment;

export interface WebAvatarManifest {
  schema: typeof webAvatarManifestSchema;
  version: typeof webAvatarManifestVersion;
  id: string;
  displayName: string;
  assetVersion: string;
  model: string;
  animationModels: readonly string[];
  framing: {
    camera: Vector3Tuple;
    target: Vector3Tuple;
    fov: number;
    scale: number;
  };
  nodes: {
    head?: string;
    leftEye?: string;
    rightEye?: string;
  };
  morphs: {
    visemes: Readonly<Record<string, MorphWeights>>;
    moods: Partial<Readonly<Record<AvatarMood, MorphWeights>>>;
  };
  clips: {
    idle: readonly string[];
    listening: readonly string[];
    gestures: Partial<Readonly<Record<PerformanceGesture, WebAvatarClipReference>>>;
  };
  environment: {
    background: string;
    keyLightIntensity: number;
    fillLightIntensity: number;
  };
}

const avatarMoods: readonly AvatarMood[] = [
  "neutral",
  "attentive",
  "curious",
  "amused",
  "confident",
  "skeptical",
  "concerned",
  "surprised",
  "empathetic",
  "assertive",
  "frustrated",
  "reflective",
];

const performanceGestures: readonly PerformanceGesture[] = [
  "none",
  "nod",
  "tilt",
  "emphasis",
  "settle",
  "raise-hand",
  "lower-hand",
  "applause",
];

function objectRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function cleanId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return /^[a-z0-9][a-z0-9_-]{0,63}$/u.test(result) ? result : null;
}

export function isWebAvatarId(value: string): boolean {
  return cleanId(value) === value;
}

function cleanText(value: unknown, maxLength = 120): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result && result.length <= maxLength ? result : null;
}

function finiteNumber(
  value: unknown,
  minimum: number,
  maximum: number,
): number | null {
  return typeof value === "number"
    && Number.isFinite(value)
    && value >= minimum
    && value <= maximum
    ? value
    : null;
}

function vector3(value: unknown): Vector3Tuple | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const values = value.map((item) => finiteNumber(item, -100_000, 100_000));
  return values.every((item): item is number => item !== null)
    ? [values[0]!, values[1]!, values[2]!] as const
    : null;
}

function stringArray(value: unknown, maximum = 12): string[] | null {
  if (!Array.isArray(value) || value.length > maximum) return null;
  const values = value.map((item) => cleanText(item, 160));
  return values.every((item): item is string => item !== null) ? values : null;
}

function glbFilename(value: unknown): string | null {
  const filename = cleanText(value, 160);
  return filename
    && basename(filename) === filename
    && filename.toLowerCase().endsWith(".glb")
    ? filename
    : null;
}

function morphWeights(value: unknown): Record<string, number> | null {
  const record = objectRecord(value);
  if (!record || Object.keys(record).length > 24) return null;
  const result: Record<string, number> = {};
  for (const [name, weight] of Object.entries(record)) {
    const cleanName = cleanText(name, 120);
    const cleanWeight = finiteNumber(weight, 0, 1);
    if (!cleanName || cleanWeight === null) return null;
    result[cleanName] = cleanWeight;
  }
  return result;
}

function morphMap(value: unknown, maximum = 64): Record<string, MorphWeights> | null {
  const record = objectRecord(value);
  if (!record || Object.keys(record).length > maximum) return null;
  const result: Record<string, MorphWeights> = {};
  for (const [name, weights] of Object.entries(record)) {
    const cleanName = cleanText(name, 80);
    const cleanWeights = morphWeights(weights);
    if (!cleanName || !cleanWeights) return null;
    result[cleanName] = cleanWeights;
  }
  return result;
}

function clipReference(value: unknown): WebAvatarClipReference | null {
  const direct = cleanText(value, 160);
  if (direct) return direct;
  const record = objectRecord(value);
  if (!record) return null;
  const clip = cleanText(record.clip, 160);
  if (!clip) return null;
  const startSeconds = record.startSeconds === undefined
    ? undefined
    : finiteNumber(record.startSeconds, 0, 3_600);
  const endSeconds = record.endSeconds === undefined
    ? undefined
    : finiteNumber(record.endSeconds, 0, 3_600);
  if (
    startSeconds === null
    || endSeconds === null
    || (startSeconds !== undefined && endSeconds !== undefined && endSeconds <= startSeconds)
    || (record.loop !== undefined && typeof record.loop !== "boolean")
  ) return null;
  return {
    clip,
    ...(startSeconds === undefined ? {} : { startSeconds }),
    ...(endSeconds === undefined ? {} : { endSeconds }),
    ...(record.loop === undefined ? {} : { loop: record.loop }),
  };
}

export function webAvatarClipName(reference: WebAvatarClipReference): string {
  return typeof reference === "string" ? reference : reference.clip;
}

export function parseWebAvatarManifest(value: unknown): WebAvatarManifest | null {
  const record = objectRecord(value);
  if (
    !record
    || record.schema !== webAvatarManifestSchema
    || record.version !== webAvatarManifestVersion
  ) return null;
  const id = cleanId(record.id);
  const displayName = cleanText(record.displayName);
  const assetVersion = cleanText(record.assetVersion, 80);
  const model = glbFilename(record.model);
  if (
    !id
    || !displayName
    || !assetVersion
    || !model
  ) return null;
  const rawAnimationModels = record.animationModels ?? [];
  if (!Array.isArray(rawAnimationModels) || rawAnimationModels.length > 16) return null;
  const animationModels = rawAnimationModels.map(glbFilename);
  if (
    !animationModels.every((filename): filename is string => filename !== null)
    || new Set(animationModels).size !== animationModels.length
    || animationModels.includes(model)
  ) return null;

  const framingRecord = objectRecord(record.framing);
  const camera = vector3(framingRecord?.camera);
  const target = vector3(framingRecord?.target);
  const fov = finiteNumber(framingRecord?.fov, 15, 90);
  const scale = finiteNumber(framingRecord?.scale, 0.001, 1_000);
  if (!camera || !target || fov === null || scale === null) return null;

  const nodesRecord = objectRecord(record.nodes) ?? {};
  const nodes: WebAvatarManifest["nodes"] = {};
  for (const key of ["head", "leftEye", "rightEye"] as const) {
    if (nodesRecord[key] === undefined) continue;
    const name = cleanText(nodesRecord[key], 120);
    if (!name) return null;
    nodes[key] = name;
  }

  const morphsRecord = objectRecord(record.morphs);
  const visemes = morphMap(morphsRecord?.visemes);
  const rawMoods = morphMap(morphsRecord?.moods, avatarMoods.length);
  if (!visemes || !rawMoods) return null;
  const moods: Partial<Record<AvatarMood, MorphWeights>> = {};
  for (const [mood, weights] of Object.entries(rawMoods)) {
    if (!avatarMoods.includes(mood as AvatarMood)) return null;
    moods[mood as AvatarMood] = weights;
  }

  const clipsRecord = objectRecord(record.clips);
  const idle = stringArray(clipsRecord?.idle);
  const listening = stringArray(clipsRecord?.listening);
  const gesturesRecord = objectRecord(clipsRecord?.gestures);
  if (!idle || !listening || !gesturesRecord) return null;
  const gestures: Partial<Record<PerformanceGesture, WebAvatarClipReference>> = {};
  for (const [gesture, rawClip] of Object.entries(gesturesRecord)) {
    if (!performanceGestures.includes(gesture as PerformanceGesture)) return null;
    const clip = clipReference(rawClip);
    if (!clip) return null;
    gestures[gesture as PerformanceGesture] = clip;
  }

  const environmentRecord = objectRecord(record.environment);
  const background = cleanText(environmentRecord?.background, 32);
  const keyLightIntensity = finiteNumber(environmentRecord?.keyLightIntensity, 0, 20);
  const fillLightIntensity = finiteNumber(environmentRecord?.fillLightIntensity, 0, 20);
  if (
    !background
    || !/^#[0-9a-f]{6}$/iu.test(background)
    || keyLightIntensity === null
    || fillLightIntensity === null
  ) return null;

  return {
    schema: webAvatarManifestSchema,
    version: webAvatarManifestVersion,
    id,
    displayName,
    assetVersion,
    model,
    animationModels,
    framing: { camera, target, fov, scale },
    nodes,
    morphs: { visemes, moods },
    clips: { idle, listening, gestures },
    environment: { background, keyLightIntensity, fillLightIntensity },
  };
}

export async function loadWebAvatarManifest(
  directory: string,
  avatarId: string,
): Promise<WebAvatarManifest | null> {
  const id = cleanId(avatarId);
  if (!id) return null;
  try {
    const value = JSON.parse(
      await readFile(join(resolve(directory), id, "manifest.json"), "utf8"),
    ) as unknown;
    const manifest = parseWebAvatarManifest(value);
    return manifest?.id === id ? manifest : null;
  } catch {
    return null;
  }
}

export function webAvatarModelPath(
  directory: string,
  manifest: WebAvatarManifest,
): string {
  return join(resolve(directory), manifest.id, manifest.model);
}

export function webAvatarAnimationPaths(
  directory: string,
  manifest: WebAvatarManifest,
): string[] {
  const root = join(resolve(directory), manifest.id);
  return manifest.animationModels.map((filename) => join(root, filename));
}

export function webAvatarAssetPaths(
  directory: string,
  manifest: WebAvatarManifest,
): string[] {
  return [
    webAvatarModelPath(directory, manifest),
    ...webAvatarAnimationPaths(directory, manifest),
  ];
}
