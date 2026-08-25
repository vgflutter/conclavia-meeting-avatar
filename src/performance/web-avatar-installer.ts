import { randomUUID } from "node:crypto";
import {
  access,
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { auditWebAvatar, type WebAvatarAudit } from "./web-avatar-audit.js";
import {
  parseWebAvatarManifest,
  type WebAvatarManifest,
} from "./web-avatar-manifest.js";

export interface InstalledWebAvatar {
  manifest: WebAvatarManifest;
  audit: WebAvatarAudit;
  directory: string;
  modelPath: string;
  modelBytes: number;
  animationPaths: string[];
  animationBytes: number;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function installWebAvatar(
  sourceManifestPath: string,
  destinationRoot: string,
): Promise<InstalledWebAvatar> {
  const sourceManifest = resolve(sourceManifestPath);
  let rawManifest: unknown;
  try {
    rawManifest = JSON.parse(await readFile(sourceManifest, "utf8")) as unknown;
  } catch (error) {
    throw new Error(
      `Cannot read Web avatar manifest: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const manifest = parseWebAvatarManifest(rawManifest);
  if (!manifest) throw new Error("Web avatar manifest is invalid");
  const sourceModel = join(dirname(sourceManifest), manifest.model);
  const sourceAnimations = manifest.animationModels.map(
    (filename) => join(dirname(sourceManifest), filename),
  );
  const audit = await auditWebAvatar(manifest, sourceModel, sourceAnimations);
  if (!audit.valid) {
    throw new Error(`Web avatar failed meeting-readiness audit: ${JSON.stringify(audit)}`);
  }

  const root = resolve(destinationRoot);
  const destination = join(root, manifest.id);
  await mkdir(root, { recursive: true });
  if (await pathExists(destination)) {
    throw new Error(`Web avatar is already installed: ${manifest.id}`);
  }

  const temporary = join(root, `.install-${manifest.id}-${randomUUID()}`);
  const installedModel = join(temporary, manifest.model);
  try {
    await mkdir(temporary);
    await copyFile(sourceModel, installedModel);
    await Promise.all(manifest.animationModels.map((filename, index) =>
      copyFile(sourceAnimations[index]!, join(temporary, filename))
    ));
    await writeFile(
      join(temporary, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      { flag: "wx" },
    );
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }

  const modelPath = join(destination, manifest.model);
  const animationPaths = manifest.animationModels.map((filename) => join(destination, filename));
  const animationMetadata = await Promise.all(animationPaths.map((path) => stat(path)));
  return {
    manifest,
    audit,
    directory: destination,
    modelPath,
    modelBytes: (await stat(modelPath)).size,
    animationPaths,
    animationBytes: animationMetadata.reduce((total, metadata) => total + metadata.size, 0),
  };
}
