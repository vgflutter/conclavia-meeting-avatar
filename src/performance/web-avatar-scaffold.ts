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
  type WebAvatarClipReference,
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
  facialClips?: WebAvatarManifest["facialClips"];
  displayName?: string;
  assetVersion?: string;
  rotationDegrees?: readonly [number, number, number];
  appearance?: WebAvatarManifest["appearance"];
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

function resolvedClipName(
  inventory: WebAvatarModelInventory,
  requestedName: string,
): string | undefined {
  const requested = normalized(requestedName);
  const exact = inventory.animationClipNames.find((name) => normalized(name) === requested);
  if (exact) return exact;
  const numbered = inventory.animationClipNames.filter((name) => {
    const candidate = normalized(name);
    return candidate.startsWith(requested)
      && /^\d+$/u.test(candidate.slice(requested.length));
  });
  return numbered.length === 1 ? numbered[0] : undefined;
}

function resolvedClipReference(
  inventory: WebAvatarModelInventory,
  reference: WebAvatarClipReference,
): WebAvatarClipReference | undefined {
  const requestedName = typeof reference === "string" ? reference : reference.clip;
  const clip = resolvedClipName(inventory, requestedName);
  if (!clip) return undefined;
  return typeof reference === "string" ? clip : { ...reference, clip };
}

function inferredNodes(inventory: WebAvatarModelInventory): WebAvatarManifest["nodes"] {
  const head = exactName(inventory.nodeNames, ["head", "headjoint", "headbone"]);
  const leftEye = exactName(inventory.nodeNames, [
    "eye_l", "eyel", "lefteye", "eyeleft", "FACIAL_L_Eye",
  ]);
  const rightEye = exactName(inventory.nodeNames, [
    "eye_r", "eyer", "righteye", "eyeright", "FACIAL_R_Eye",
  ]);
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
    ? options.clips.idle.flatMap((reference) => {
      const clip = resolvedClipName(inventory, reference);
      return clip ? [clip] : [];
    })
    : matchingClips(inventory, [/idle/u]).slice(0, 12);
  const listening = options.clips?.listening
    ? options.clips.listening.flatMap((reference) => {
      const clip = resolvedClipName(inventory, reference);
      return clip ? [clip] : [];
    })
    : matchingClips(inventory, [/listen/u]).slice(0, 12);
  const gestures = options.clips?.gestures
    ? Object.fromEntries(
      Object.entries(options.clips.gestures).flatMap(([gesture, reference]) => {
        const resolved = resolvedClipReference(inventory, reference);
        return resolved ? [[gesture, resolved]] : [];
      }),
    )
    : inferredGestures(inventory);
  const facialClips: WebAvatarManifest["facialClips"] = {
    visemes: Object.fromEntries(
      Object.entries(options.facialClips?.visemes ?? {}).flatMap(([viseme, reference]) => {
        const resolved = resolvedClipReference(inventory, reference);
        return resolved ? [[viseme, resolved]] : [];
      }),
    ),
    moods: Object.fromEntries(
      Object.entries(options.facialClips?.moods ?? {}).flatMap(([mood, reference]) => {
        const resolved = resolvedClipReference(inventory, reference);
        return resolved ? [[mood, resolved]] : [];
      }),
    ),
  };
  const manifestCandidate: WebAvatarManifest = {
    schema: webAvatarManifestSchema,
    version: webAvatarManifestVersion,
    id: avatarId,
    displayName: options.displayName ?? `${avatarId} Web Avatar`,
    assetVersion: options.assetVersion ?? "draft-1",
    model: basename(modelPath),
    animationModels: animationModelPaths.map((path) => basename(path)),
    ...(options.appearance ? { appearance: options.appearance } : {}),
    framing: {
      camera: [0, 1.56, 1.02],
      target: [0, 1.49, 0],
      fov: 34,
      scale: 1,
      ...(options.rotationDegrees ? { rotationDegrees: options.rotationDegrees } : {}),
    },
    nodes,
    morphs: {
      visemes: emptyMorphMap(webAvatarVisemeNames),
      moods: emptyMorphMap(webAvatarMoodNames),
    },
    facialClips,
    clips: { idle, listening, gestures },
    environment: { background: "#123b35", keyLightIntensity: 2.4, fillLightIntensity: 1.1 },
  };
  const manifest = parseWebAvatarManifest(manifestCandidate);
  if (!manifest) {
    throw new Error("Web avatar scaffold metadata is invalid");
  }
  return {
    manifest,
    outputPath: join(dirname(modelPath), "manifest.json"),
    unresolved: {
      nodes: ["head", "leftEye", "rightEye"].filter((role) => !(role in nodes)),
      visemes: webAvatarVisemeNames.filter(
        (name) => name !== "sil" && !manifest.facialClips.visemes[name],
      ),
      moods: webAvatarMoodNames.filter(
        (name) => name !== "neutral" && !manifest.facialClips.moods[name],
      ),
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
  const displayName = typeof record.displayName === "string"
    ? record.displayName
    : `${record.id} Web Avatar`;
  const assetVersion = typeof record.assetVersion === "string"
    ? record.assetVersion
    : "draft-1";
  const candidate = parseWebAvatarManifest({
    schema: webAvatarManifestSchema,
    version: webAvatarManifestVersion,
    id: record.id,
    displayName,
    assetVersion,
    model: record.model,
    animationModels: record.animationModels,
    ...(record.appearance === undefined ? {} : { appearance: record.appearance }),
    framing: {
      camera: [0, 1.56, 1.02],
      target: [0, 1.49, 0],
      fov: 34,
      scale: 1,
      ...(record.rotationDegrees === undefined
        ? {}
        : { rotationDegrees: record.rotationDegrees }),
    },
    nodes: {},
    morphs: { visemes: {}, moods: {} },
    facialClips: record.facialClips ?? { visemes: {}, moods: {} },
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
      facialClips: candidate.facialClips,
      displayName: candidate.displayName,
      assetVersion: candidate.assetVersion,
      ...(candidate.framing.rotationDegrees
        ? { rotationDegrees: candidate.framing.rotationDegrees }
        : {}),
      ...(candidate.appearance ? { appearance: candidate.appearance } : {}),
    },
  );
}
