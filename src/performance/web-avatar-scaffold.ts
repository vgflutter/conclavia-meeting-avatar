import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import type { PerformanceGesture } from "./performance-plan.js";
import {
  inspectWebAvatarModel,
  webAvatarGestureNames,
  webAvatarMoodNames,
  webAvatarVisemeNames,
  type WebAvatarModelInventory,
} from "./web-avatar-audit.js";
import {
  isWebAvatarId,
  parseWebAvatarManifest,
  webAvatarManifestSchema,
  webAvatarManifestVersion,
  type WebAvatarManifest,
} from "./web-avatar-manifest.js";

export interface WebAvatarScaffold {
  manifest: WebAvatarManifest;
  outputPath: string;
  unresolved: {
    nodes: string[];
    visemes: string[];
    moods: string[];
    gestures: string[];
    ambientClips: string[];
  };
}

export interface WebAvatarScaffoldOptions {
  animationModelPaths?: readonly string[];
  clips?: WebAvatarManifest["clips"];
}

function normalized(name: string): string {
  return name.toLowerCase().replaceAll(/[^a-z0-9]/gu, "");
}

function exactName(names: readonly string[], aliases: readonly string[]): string | undefined {
  const candidates = new Set(aliases.map(normalized));
  return names.find((name) => candidates.has(normalized(name)));
}

function matchingClips(
  inventory: WebAvatarModelInventory,
  patterns: readonly RegExp[],
): string[] {
  return inventory.animationClipNames.filter((name) => {
    const candidate = normalized(name);
    return patterns.some((pattern) => pattern.test(candidate));
  });
}

function firstMatchingClip(
  inventory: WebAvatarModelInventory,
  patterns: readonly RegExp[],
): string | undefined {
  return matchingClips(inventory, patterns)[0];
}

function inferredNodes(inventory: WebAvatarModelInventory): WebAvatarManifest["nodes"] {
  const head = exactName(inventory.nodeNames, ["head", "headjoint", "headbone"]);
  const leftEye = exactName(inventory.nodeNames, ["eye_l", "eyel", "lefteye", "eyeleft"]);
  const rightEye = exactName(inventory.nodeNames, ["eye_r", "eyer", "righteye", "eyeright"]);
  return {
    ...(head ? { head } : {}),
    ...(leftEye ? { leftEye } : {}),
    ...(rightEye ? { rightEye } : {}),
  };
}

function inferredGestures(
  inventory: WebAvatarModelInventory,
): Partial<Record<PerformanceGesture, string>> {
  const candidates: Record<(typeof webAvatarGestureNames)[number], readonly RegExp[]> = {
    nod: [/nod/u],
    tilt: [/headtilt/u, /tilt/u],
    emphasis: [/emphasis/u, /emphasize/u],
    settle: [/settle/u, /relax/u],
    "raise-hand": [/raisehand/u, /handraise/u],
    "lower-hand": [/lowerhand/u, /handlower/u],
    applause: [/applause/u, /clap/u],
  };
  return Object.fromEntries(
    webAvatarGestureNames.flatMap((gesture) => {
      const clip = firstMatchingClip(inventory, candidates[gesture]);
      return clip ? [[gesture, clip]] : [];
    }),
  );
}

function emptyMorphMap(names: readonly string[]): Record<string, Record<string, number>> {
  return Object.fromEntries(names.map((name) => [name, {}]));
}

export async function scaffoldWebAvatarManifest(
  modelPath: string,
  avatarId: string,
  options: WebAvatarScaffoldOptions = {},
): Promise<WebAvatarScaffold> {
  if (!isWebAvatarId(avatarId)) {
    throw new Error("Avatar id must use lowercase letters, digits, hyphens or underscores");
  }
  if (!modelPath.toLowerCase().endsWith(".glb")) {
    throw new Error("Web avatar model must be a .glb file");
  }
  const baseInventory = await inspectWebAvatarModel(modelPath);
  if (baseInventory.gltfVersion !== "2.0") {
    throw new Error("Web avatar model must use glTF 2.0");
  }
  if (!baseInventory.skinned) throw new Error("Web avatar model must contain a skin");
  const modelDirectory = resolve(dirname(modelPath));
  const animationModelPaths = options.animationModelPaths?.map((path) => resolve(path)) ?? [];
  if (animationModelPaths.some((path) => resolve(dirname(path)) !== modelDirectory)) {
    throw new Error("Web avatar animation GLBs must sit beside the base model");
  }
  const animationInventories = await Promise.all(
    animationModelPaths.map((path) => inspectWebAvatarModel(path)),
  );
  if (animationInventories.some((candidate) =>
    candidate.gltfVersion !== "2.0" || candidate.animationCount < 1
  )) {
    throw new Error("Every Web avatar animation asset must be a glTF 2.0 GLB with a clip");
  }
  const inventory: WebAvatarModelInventory = {
    ...baseInventory,
    animationCount: baseInventory.animationCount
      + animationInventories.reduce((total, candidate) => total + candidate.animationCount, 0),
    animationClipNames: [...new Set([
      ...baseInventory.animationClipNames,
      ...animationInventories.flatMap((candidate) => candidate.animationClipNames),
    ])],
  };

  const nodes = inferredNodes(inventory);
  const idle = options.clips?.idle
    ? [...options.clips.idle]
    : matchingClips(inventory, [/idle/u]).slice(0, 12);
  const listening = options.clips?.listening
    ? [...options.clips.listening]
    : matchingClips(inventory, [/listen/u]).slice(0, 12);
  const gestures = options.clips?.gestures
    ? { ...options.clips.gestures }
    : inferredGestures(inventory);
  const manifest: WebAvatarManifest = {
    schema: webAvatarManifestSchema,
    version: webAvatarManifestVersion,
    id: avatarId,
    displayName: `${avatarId} Web Avatar`,
    assetVersion: "draft-1",
    model: basename(modelPath),
    animationModels: animationModelPaths.map((path) => basename(path)),
    framing: { camera: [0, 1.56, 1.18], target: [0, 1.49, 0], fov: 34, scale: 1 },
    nodes,
    morphs: {
      visemes: emptyMorphMap(webAvatarVisemeNames),
      moods: emptyMorphMap(webAvatarMoodNames),
    },
    clips: { idle, listening, gestures },
    environment: { background: "#123b35", keyLightIntensity: 2.4, fillLightIntensity: 1.1 },
  };
  return {
    manifest,
    outputPath: join(dirname(modelPath), "manifest.json"),
    unresolved: {
      nodes: ["head", "leftEye", "rightEye"].filter((role) => !(role in nodes)),
      visemes: webAvatarVisemeNames.filter((name) => name !== "sil"),
      moods: webAvatarMoodNames.filter((name) => name !== "neutral"),
      gestures: webAvatarGestureNames.filter((gesture) => !gestures[gesture]),
      ambientClips: [
        ...(idle.length >= 2 ? [] : ["idle"]),
        ...(listening.length >= 2 ? [] : ["listening"]),
      ],
    },
  };
}

export async function writeWebAvatarScaffold(
  modelPath: string,
  avatarId: string,
  options: WebAvatarScaffoldOptions = {},
): Promise<WebAvatarScaffold> {
  const result = await scaffoldWebAvatarManifest(modelPath, avatarId, options);
  await writeFile(result.outputPath, `${JSON.stringify(result.manifest, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  return result;
}

export async function writeWebAvatarBundleScaffold(
  exportInventoryPath: string,
): Promise<WebAvatarScaffold> {
  const inventoryPath = resolve(exportInventoryPath);
  const raw = JSON.parse(await readFile(inventoryPath, "utf8")) as unknown;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("Web avatar export inventory is invalid");
  }
  const record = raw as Record<string, unknown>;
  if (
    record.schema !== "conclavia.web-avatar-export"
    || record.version !== 1
    || typeof record.id !== "string"
    || !isWebAvatarId(record.id)
    || typeof record.model !== "string"
    || !Array.isArray(record.animationModels)
  ) throw new Error("Web avatar export inventory is invalid");
  const directory = dirname(inventoryPath);
  const candidate = parseWebAvatarManifest({
    schema: webAvatarManifestSchema,
    version: webAvatarManifestVersion,
    id: record.id,
    displayName: `${record.id} Web Avatar`,
    assetVersion: "draft-1",
    model: record.model,
    animationModels: record.animationModels,
    framing: { camera: [0, 1.56, 1.18], target: [0, 1.49, 0], fov: 34, scale: 1 },
    nodes: {},
    morphs: { visemes: {}, moods: {} },
    clips: record.clips,
    environment: { background: "#123b35", keyLightIntensity: 2.4, fillLightIntensity: 1.1 },
  });
  if (!candidate) throw new Error("Web avatar export inventory contains unsafe assets or clips");
  return writeWebAvatarScaffold(
    join(directory, candidate.model),
    candidate.id,
    {
      animationModelPaths: candidate.animationModels.map((filename) => join(directory, filename)),
      clips: candidate.clips,
    },
  );
}
