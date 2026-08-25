import { stat } from "node:fs/promises";
import { join, resolve } from "node:path";

import { auditWebAvatar, type WebAvatarAudit } from "./web-avatar-audit.js";
import {
  isWebAvatarId,
  loadWebAvatarManifest,
  type WebAvatarManifest,
  webAvatarAnimationPaths,
  webAvatarModelPath,
} from "./web-avatar-manifest.js";

export interface WebAvatarInspection {
  id: string;
  installed: boolean;
  ready: boolean;
  manifest: WebAvatarManifest | null;
  modelPath: string | null;
  animationPaths: string[];
  audit: WebAvatarAudit | null;
  error: "manifest-missing" | "manifest-invalid" | "model-missing" | "animation-missing" | "audit-failed" | null;
}

interface CachedInspection {
  stamp: string;
  inspection: WebAvatarInspection;
}

function auditIssues(audit: WebAvatarAudit): string[] {
  return [
    ...(!audit.skinned ? ["skin"] : []),
    ...(audit.gltfVersion !== "2.0" ? ["gltf-version"] : []),
    ...audit.missingNodes.map((value) => `node:${value}`),
    ...audit.missingMorphTargets.map((value) => `morph:${value}`),
    ...audit.missingAnimationClips.map((value) => `clip:${value}`),
    ...audit.missingVisemeMappings.map((value) => `viseme:${value}`),
    ...audit.missingMoodMappings.map((value) => `mood:${value}`),
    ...audit.missingGestureMappings.map((value) => `gesture:${value}`),
    ...audit.insufficientAmbientVariety.map((value) => `variety:${value}`),
    ...audit.externalImages.map((value) => `external-image:${value}`),
    ...audit.invalidAnimationAssets.map((value) => `animation-asset:${value}`),
    ...audit.appearanceIssues.map((value) => `appearance:${value}`),
  ];
}

export function publicWebAvatarStatus(inspection: WebAvatarInspection): {
  id: string;
  installed: boolean;
  ready: boolean;
  assetVersion: string | null;
  performer: "three" | "photo-fallback";
  error: WebAvatarInspection["error"];
  issues: string[];
} {
  return {
    id: inspection.id,
    installed: inspection.installed,
    ready: inspection.ready,
    assetVersion: inspection.manifest?.assetVersion ?? null,
    performer: inspection.ready ? "three" : "photo-fallback",
    error: inspection.error,
    issues: inspection.audit ? auditIssues(inspection.audit) : [],
  };
}

export class WebAvatarRegistry {
  readonly #directory: string;
  readonly #cache = new Map<string, CachedInspection>();
  readonly #inflight = new Map<string, Promise<WebAvatarInspection>>();

  constructor(directory: string) {
    this.#directory = resolve(directory);
  }

  clear(avatarId?: string): void {
    if (avatarId) this.#cache.delete(avatarId);
    else this.#cache.clear();
  }

  async inspect(avatarId: string): Promise<WebAvatarInspection> {
    const inflight = this.#inflight.get(avatarId);
    if (inflight) return inflight;
    const operation = this.#inspect(avatarId);
    this.#inflight.set(avatarId, operation);
    try {
      return await operation;
    } finally {
      if (this.#inflight.get(avatarId) === operation) this.#inflight.delete(avatarId);
    }
  }

  async #inspect(avatarId: string): Promise<WebAvatarInspection> {
    if (!isWebAvatarId(avatarId)) {
      return {
        id: avatarId,
        installed: false,
        ready: false,
        manifest: null,
        modelPath: null,
        animationPaths: [],
        audit: null,
        error: "manifest-missing",
      };
    }
    const manifestPath = join(this.#directory, avatarId, "manifest.json");
    let manifestMetadata;
    try {
      manifestMetadata = await stat(manifestPath);
    } catch {
      this.#cache.delete(avatarId);
      return {
        id: avatarId,
        installed: false,
        ready: false,
        manifest: null,
        modelPath: null,
        animationPaths: [],
        audit: null,
        error: "manifest-missing",
      };
    }
    const manifest = await loadWebAvatarManifest(this.#directory, avatarId);
    if (!manifest) {
      return {
        id: avatarId,
        installed: true,
        ready: false,
        manifest: null,
        modelPath: null,
        animationPaths: [],
        audit: null,
        error: "manifest-invalid",
      };
    }
    const modelPath = webAvatarModelPath(this.#directory, manifest);
    const animationPaths = webAvatarAnimationPaths(this.#directory, manifest);
    let modelMetadata;
    try {
      modelMetadata = await stat(modelPath);
    } catch {
      return {
        id: avatarId,
        installed: true,
        ready: false,
        manifest,
        modelPath,
        animationPaths,
        audit: null,
        error: "model-missing",
      };
    }
    const animationMetadata = [];
    for (const path of animationPaths) {
      try {
        animationMetadata.push(await stat(path));
      } catch {
        return {
          id: avatarId,
          installed: true,
          ready: false,
          manifest,
          modelPath,
          animationPaths,
          audit: null,
          error: "animation-missing",
        };
      }
    }
    const stamp = [
      manifestMetadata.size,
      manifestMetadata.mtimeMs,
      modelMetadata.size,
      modelMetadata.mtimeMs,
      ...animationMetadata.flatMap((metadata) => [metadata.size, metadata.mtimeMs]),
    ].join(":");
    const cached = this.#cache.get(avatarId);
    if (cached?.stamp === stamp) return cached.inspection;

    let inspection: WebAvatarInspection;
    try {
      const audit = await auditWebAvatar(manifest, modelPath, animationPaths);
      inspection = {
        id: avatarId,
        installed: true,
        ready: audit.valid,
        manifest,
        modelPath,
        animationPaths,
        audit,
        error: audit.valid ? null : "audit-failed",
      };
    } catch {
      inspection = {
        id: avatarId,
        installed: true,
        ready: false,
        manifest,
        modelPath,
        animationPaths,
        audit: null,
        error: "audit-failed",
      };
    }
    this.#cache.set(avatarId, { stamp, inspection });
    return inspection;
  }
}
