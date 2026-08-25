import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  loadWebAvatarManifest,
  parseWebAvatarManifest,
  webAvatarModelPath,
} from "./web-avatar-manifest.js";

const validManifest = {
  schema: "conclavia.web-avatar",
  version: 1,
  id: "showcase",
  displayName: "Mary Showcase",
  assetVersion: "2026.08.1",
  model: "showcase.glb",
  framing: {
    camera: [0, 1.58, 1.25],
    target: [0, 1.5, 0],
    fov: 36,
    scale: 1,
  },
  nodes: { head: "head", leftEye: "eye_l", rightEye: "eye_r" },
  morphs: {
    visemes: { p: { mouthClose: 0.8 } },
    moods: { amused: { mouthSmileLeft: 0.4, mouthSmileRight: 0.4 } },
  },
  clips: {
    idle: ["idle_a", "idle_b"],
    listening: ["listen_a"],
    gestures: { "raise-hand": "raise_hand", applause: "applause" },
  },
  environment: {
    background: "#123b35",
    keyLightIntensity: 2.4,
    fillLightIntensity: 1.1,
  },
} as const;

await test("accepts a bounded Web avatar manifest", () => {
  const manifest = parseWebAvatarManifest(validManifest);
  assert.equal(manifest?.id, "showcase");
  assert.equal(manifest?.morphs.visemes.p?.mouthClose, 0.8);
  assert.equal(manifest?.clips.gestures["raise-hand"], "raise_hand");
});

await test("rejects model traversal and unknown mood or gesture keys", () => {
  assert.equal(parseWebAvatarManifest({
    ...validManifest,
    model: "../showcase.glb",
  }), null);
  assert.equal(parseWebAvatarManifest({
    ...validManifest,
    morphs: { ...validManifest.morphs, moods: { impossible: {} } },
  }), null);
  assert.equal(parseWebAvatarManifest({
    ...validManifest,
    clips: { ...validManifest.clips, gestures: { dance: "dance" } },
  }), null);
});

await test("loads only a manifest whose id matches its directory", async () => {
  const directory = await mkdtemp(join(tmpdir(), "conclavia-web-avatar-"));
  await mkdir(join(directory, "showcase"));
  await writeFile(
    join(directory, "showcase", "manifest.json"),
    JSON.stringify(validManifest),
  );
  const manifest = await loadWebAvatarManifest(directory, "showcase");
  assert.equal(manifest?.displayName, "Mary Showcase");
  assert.equal(webAvatarModelPath(directory, manifest), join(
    directory,
    "showcase",
    "showcase.glb",
  ));
  assert.equal(await loadWebAvatarManifest(directory, "../showcase"), null);
});
