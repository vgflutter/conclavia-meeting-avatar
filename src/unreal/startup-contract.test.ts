import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const startScript = await readFile(
  new URL("../../scripts/start-3d-studio.sh", import.meta.url),
  "utf8",
);

await test("pins the production startup to Unreal and waits for an armed avatar", () => {
  assert.match(startScript, /CONCLAVIA_RENDERER_MODE: "unreal"/);
  assert.match(startScript, /\/api\/renderer\/start/);
  assert.match(startScript, /status\.armed === true && status\.available === true/);
});

await test("keeps temporary GPU capacity retries bounded and configurable", () => {
  assert.match(startScript, /CONCLAVIA_3D_START_ATTEMPTS:-8/);
  assert.match(startScript, /START_ATTEMPTS < 1 \|\| START_ATTEMPTS > 60/);
  assert.match(startScript, /InsufficientInstanceCapacity/);
});
