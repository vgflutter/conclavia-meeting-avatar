import { readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import type { AvatarMood } from "../domain/protocol.js";
import type { PerformanceGesture } from "./performance-plan.js";

export const webAvatarManifestSchema = "conclavia.web-avatar" as const;
export const webAvatarManifestVersion = 1 as const;

type Vector3Tuple = readonly [number, number, number];
type MorphWeights = Readonly<Record<string, number>>;

export interface WebAvatarManifest {
  schema: typeof webAvatarManifestSchema;
  version: typeof webAvatarManifestVersion;
  id: string;
  displayName: string;
  assetVersion: string;
  model: string;
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
    gestures: Partial<Readonly<Record<PerformanceGesture, string>>>;
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
  const model = cleanText(record.model, 160);
  if (
    !id
    || !displayName
    || !assetVersion
    || !model
    || basename(model) !== model
    || !model.toLowerCase().endsWith(".glb")
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
  const gestures: Partial<Record<PerformanceGesture, string>> = {};
  for (const [gesture, clip] of Object.entries(gesturesRecord)) {
    if (!performanceGestures.includes(gesture as PerformanceGesture)) return null;
    const cleanClip = cleanText(clip, 160);
    if (!cleanClip) return null;
    gestures[gesture as PerformanceGesture] = cleanClip;
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
