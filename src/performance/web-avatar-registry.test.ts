import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { installWebAvatar } from "./web-avatar-installer.js";
import { publicWebAvatarStatus, WebAvatarRegistry } from "./web-avatar-registry.js";

const visemes = [
  "sil", "p", "t", "S", "T", "f", "k", "i", "r", "s", "u", "@", "a", "e", "E", "o", "O",
];
const moods = [
  "neutral", "attentive", "curious", "amused", "confident", "skeptical",
  "concerned", "surprised", "empathetic", "assertive", "frustrated", "reflective",
];

function manifest(): unknown {
  return {
    schema: "conclavia.web-avatar",
    version: 1,
    id: "showcase",
    displayName: "Showcase",
    assetVersion: "test-1",
    model: "showcase.glb",
    framing: { camera: [0, 1, 2], target: [0, 1, 0], fov: 35, scale: 1 },
    nodes: { head: "head" },
    morphs: {
      visemes: Object.fromEntries(
        visemes.map((name) => [name, name === "sil" ? {} : { mouthClose: 1 }]),
      ),
      moods: Object.fromEntries(
        moods.map((name) => [name, name === "neutral" ? {} : { smile: 0.4 }]),
      ),
    },
    clips: {
      idle: ["idle_a", "idle_b"],
      listening: ["listen_a", "listen_b"],
      gestures: {
        nod: "gesture",
        tilt: "gesture",
        emphasis: "gesture",
        settle: "gesture",
        "raise-hand": "gesture",
        "lower-hand": "gesture",
        applause: "gesture",
      },
    },
    environment: { background: "#123456", keyLightIntensity: 2, fillLightIntensity: 1 },
  };
}

function glb(document: unknown): Uint8Array {
  const encoded = new TextEncoder().encode(JSON.stringify(document));
  const paddedLength = Math.ceil(encoded.byteLength / 4) * 4;
  const output = new Uint8Array(20 + paddedLength);
  output.fill(0x20, 20);
  const view = new DataView(output.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, output.byteLength, true);
  view.setUint32(12, paddedLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  output.set(encoded, 20);
  return output;
}

await test("caches a meeting-ready Web avatar until its files change", async () => {
  const sourceDirectory = await mkdtemp(join(tmpdir(), "conclavia-avatar-source-"));
  const sourceManifest = join(sourceDirectory, "manifest.json");
  await writeFile(sourceManifest, JSON.stringify(manifest()));
  await writeFile(join(sourceDirectory, "showcase.glb"), glb({
    asset: { version: "2.0" },
    nodes: [{ name: "head", mesh: 0, skin: 0 }],
    meshes: [{ extras: { targetNames: ["mouthClose", "smile"] } }],
    skins: [{}],
    animations: ["idle_a", "idle_b", "listen_a", "listen_b", "gesture"]
      .map((name) => ({ name })),
    images: [{ bufferView: 2 }],
  }));

  const directory = await mkdtemp(join(tmpdir(), "conclavia-avatar-registry-"));
  const installed = await installWebAvatar(sourceManifest, directory);
  assert.equal(installed.manifest.id, "showcase");
  assert.equal(installed.audit.valid, true);
  await assert.rejects(
    installWebAvatar(sourceManifest, directory),
    /already installed/u,
  );

  const registry = new WebAvatarRegistry(directory);
  const [first, concurrent] = await Promise.all([
    registry.inspect("showcase"),
    registry.inspect("showcase"),
  ]);
  assert.strictEqual(concurrent, first);
  const cached = await registry.inspect("showcase");
  assert.equal(first.ready, true);
  assert.strictEqual(cached, first);
  assert.deepEqual(publicWebAvatarStatus(first), {
    id: "showcase",
    installed: true,
    ready: true,
    assetVersion: "test-1",
    performer: "three",
    error: null,
    issues: [],
  });

  await writeFile(installed.modelPath, "broken glb");
  const changed = await registry.inspect("showcase");
  assert.equal(changed.ready, false);
  assert.equal(changed.error, "audit-failed");
  assert.notStrictEqual(changed, first);
});

await test("distinguishes missing and invalid Web avatar manifests", async () => {
  const directory = await mkdtemp(join(tmpdir(), "conclavia-avatar-registry-"));
  const registry = new WebAvatarRegistry(directory);
  assert.equal((await registry.inspect("showcase")).error, "manifest-missing");
  await mkdir(join(directory, "showcase"));
  await writeFile(join(directory, "showcase", "manifest.json"), "{}");
  const invalid = await registry.inspect("showcase");
  assert.equal(invalid.installed, true);
  assert.equal(invalid.error, "manifest-invalid");
});
