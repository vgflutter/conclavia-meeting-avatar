import assert from "node:assert/strict";
import test from "node:test";

import {
  selectWebVisemeControls,
  webVisemeCalibration,
} from "./web-viseme-authoring.js";

await test("selects all case-sensitive visemes at their aligned speech marks", () => {
  const controls = (value: number): Record<string, number> => Object.fromEntries(
    Array.from({ length: 20 }, (_, controlIndex) => [
      `CTRL_C_mouth_${controlIndex}.ty`,
      value + controlIndex * 0.001,
    ]),
  );
  const captures = webVisemeCalibration.map((recipe, index) => ({
    viseme: recipe.viseme,
    source: `${recipe.alias}.pcm`,
    frameCount: 3,
    frames: [
      { atMs: 0, controls: controls(0) },
      { atMs: 400, controls: controls((index + 1) * 0.1) },
      { atMs: 800, controls: controls(0) },
    ],
  }));
  const marks = Object.fromEntries(webVisemeCalibration.map((recipe) => [
    recipe.alias,
    [
      { time: 0, type: "viseme" as const, value: recipe.mark },
      { time: 100, type: "viseme" as const, value: "sil" },
    ],
  ]));
  const report = selectWebVisemeControls(
    { runtimeRevision: "test", engineVersion: "5.8.1", captures },
    marks,
  );
  assert.deepEqual(report.samples.map(({ viseme }) => viseme), [
    "p", "t", "S", "T", "f", "k", "i", "r", "s", "u", "@", "a", "e", "E", "o", "O",
  ]);
  assert.equal(report.samples[0]?.centerMs, 400);
  assert.equal(report.quality.controlCount, 20);
  assert.ok(report.quality.minimumPairwiseDistance >= 0.1);
});

await test("rejects a case-sensitive viseme collision", () => {
  const captures = webVisemeCalibration.map((recipe) => ({
    viseme: recipe.viseme,
    source: `${recipe.alias}.pcm`,
    frameCount: 3,
    frames: [0, 400, 800].map((atMs) => ({
      atMs,
      controls: Object.fromEntries(
        Array.from({ length: 20 }, (_, index) => [`CTRL_C_mouth_${index}.ty`, atMs === 400 ? 0.2 : 0]),
      ),
    })),
  }));
  const marks = Object.fromEntries(webVisemeCalibration.map((recipe) => [
    recipe.alias,
    [
      { time: 0, type: "viseme" as const, value: recipe.mark },
      { time: 100, type: "viseme" as const, value: "sil" },
    ],
  ]));
  assert.throws(
    () => selectWebVisemeControls({ captures }, marks),
    /calibration contains a collision/u,
  );
});
