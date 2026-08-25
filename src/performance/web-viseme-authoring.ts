import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const webVisemeCalibration = [
  { viseme: "p", alias: "p", mark: "p" },
  { viseme: "t", alias: "t", mark: "t" },
  { viseme: "S", alias: "sh", mark: "S" },
  { viseme: "T", alias: "th", mark: "T" },
  { viseme: "f", alias: "f", mark: "f" },
  { viseme: "k", alias: "k", mark: "k" },
  { viseme: "i", alias: "i", mark: "i" },
  { viseme: "r", alias: "r", mark: "r" },
  { viseme: "s", alias: "s", mark: "s" },
  { viseme: "u", alias: "u", mark: "u" },
  { viseme: "@", alias: "schwa", mark: "@" },
  { viseme: "a", alias: "a", mark: "a" },
  { viseme: "e", alias: "e-close", mark: "e" },
  { viseme: "E", alias: "e-open", mark: "E" },
  { viseme: "o", alias: "o-close", mark: "o" },
  { viseme: "O", alias: "o-open", mark: "O" },
] as const;

interface PollyVisemeMark {
  time: number;
  type: "viseme";
  value: string;
}

interface FacialFrame {
  atMs: number;
  controls: Readonly<Record<string, number>>;
}

interface FacialCapture {
  viseme: string;
  source: string;
  frameCount: number;
  frames: readonly FacialFrame[];
}

export interface SelectedWebViseme {
  viseme: string;
  alias: string;
  targetMark: string;
  centerMs: number;
  frameTimesMs: readonly number[];
  controls: Readonly<Record<string, number>>;
}

export interface WebVisemeSelectionReport {
  schema: "conclavia.web-visemes";
  version: 1;
  runtimeRevision: string;
  engineVersion: string;
  leadingSilenceMs: number;
  selectionRadiusMs: number;
  samples: readonly SelectedWebViseme[];
  quality: {
    controlCount: number;
    minimumPairwiseDistance: number;
    closestPair: readonly [string, string];
  };
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseControls(value: unknown): Record<string, number> | null {
  const source = record(value);
  if (!source) return null;
  const controls: Record<string, number> = {};
  for (const [name, rawValue] of Object.entries(source)) {
    const value = finiteNumber(rawValue);
    if (!name || value === null || Math.abs(value) > 4) return null;
    controls[name] = value;
  }
  return controls;
}

function parseCaptures(value: unknown): FacialCapture[] {
  const root = record(value);
  if (!root || !Array.isArray(root.captures)) {
    throw new Error("Licensed viseme capture report is invalid");
  }
  const captures = root.captures.map((rawCapture): FacialCapture => {
    const capture = record(rawCapture);
    if (
      !capture
      || typeof capture.viseme !== "string"
      || typeof capture.source !== "string"
      || !Array.isArray(capture.frames)
    ) throw new Error("Licensed viseme capture contains an invalid sample");
    const frames = capture.frames.map((rawFrame): FacialFrame => {
      const frame = record(rawFrame);
      const atMs = finiteNumber(frame?.atMs);
      const controls = parseControls(frame?.controls);
      if (atMs === null || atMs < 0 || !controls) {
        throw new Error(`Viseme ${capture.viseme as string} contains an invalid frame`);
      }
      return { atMs, controls };
    });
    if (frames.length < 3) {
      throw new Error(`Viseme ${capture.viseme} does not contain enough frames`);
    }
    return {
      viseme: capture.viseme,
      source: capture.source,
      frameCount: frames.length,
      frames,
    };
  });
  if (new Set(captures.map(({ viseme }) => viseme)).size !== captures.length) {
    throw new Error("Licensed viseme capture contains duplicate case-sensitive labels");
  }
  return captures;
}

function speechControl(name: string): boolean {
  return /(mouth|jaw|tongue|teeth|neck|throat)/iu.test(name);
}

function averageControls(
  frames: readonly FacialFrame[],
  names: readonly string[],
): Record<string, number> {
  return Object.fromEntries(names.map((name) => [
    name,
    frames.reduce((sum, frame) => sum + (frame.controls[name] ?? 0), 0) / frames.length,
  ]));
}

function vectorDistance(
  left: Readonly<Record<string, number>>,
  right: Readonly<Record<string, number>>,
  names: readonly string[],
): number {
  return Math.sqrt(names.reduce((sum, name) => {
    const delta = (left[name] ?? 0) - (right[name] ?? 0);
    return sum + delta * delta;
  }, 0));
}

export function selectWebVisemeControls(
  captureReport: unknown,
  speechMarks: Readonly<Record<string, readonly PollyVisemeMark[]>>,
  options: { leadingSilenceMs?: number; selectionRadiusMs?: number } = {},
): WebVisemeSelectionReport {
  const root = record(captureReport);
  const captures = parseCaptures(captureReport);
  const leadingSilenceMs = options.leadingSilenceMs ?? 350;
  const selectionRadiusMs = options.selectionRadiusMs ?? 60;
  const samples = webVisemeCalibration.map((recipe): SelectedWebViseme => {
    const capture = captures.find(({ viseme }) => viseme === recipe.viseme);
    if (!capture) throw new Error(`Missing licensed capture for viseme ${recipe.viseme}`);
    const marks = speechMarks[recipe.alias];
    const markIndex = marks?.findIndex(
      (mark) => mark.type === "viseme" && mark.value === recipe.mark,
    ) ?? -1;
    const mark = marks?.[markIndex];
    const nextMark = marks?.[markIndex + 1];
    if (!mark || !nextMark || nextMark.time <= mark.time) {
      throw new Error(`Missing aligned Polly mark for viseme ${recipe.viseme}`);
    }
    const centerMs = leadingSilenceMs + (mark.time + nextMark.time) / 2;
    const nearby = capture.frames.filter(
      (frame) => Math.abs(frame.atMs - centerMs) <= selectionRadiusMs,
    );
    const selectedFrames = nearby.length > 0
      ? nearby
      : [capture.frames.reduce((closest, frame) =>
        Math.abs(frame.atMs - centerMs) < Math.abs(closest.atMs - centerMs)
          ? frame
          : closest
      )];
    const controlNames = Object.keys(capture.frames[0]?.controls ?? {})
      .filter(speechControl)
      .sort();
    if (controlNames.length < 20) {
      throw new Error(`Viseme ${recipe.viseme} has no complete speech-control vocabulary`);
    }
    return {
      viseme: recipe.viseme,
      alias: recipe.alias,
      targetMark: recipe.mark,
      centerMs,
      frameTimesMs: selectedFrames.map(({ atMs }) => atMs),
      controls: averageControls(selectedFrames, controlNames),
    };
  });
  const controlNames = [...new Set(samples.flatMap(({ controls }) => Object.keys(controls)))].sort();
  const distances: { pair: readonly [string, string]; distance: number }[] = [];
  for (let leftIndex = 0; leftIndex < samples.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < samples.length; rightIndex += 1) {
      const left = samples[leftIndex]!;
      const right = samples[rightIndex]!;
      distances.push({
        pair: [left.viseme, right.viseme],
        distance: vectorDistance(left.controls, right.controls, controlNames),
      });
    }
  }
  distances.sort((left, right) => left.distance - right.distance);
  const closest = distances[0];
  if (!closest || closest.distance < 0.075) {
    throw new Error(
      `Licensed viseme calibration contains a collision: ${closest?.pair.join("/") ?? "unknown"}`,
    );
  }
  return {
    schema: "conclavia.web-visemes",
    version: 1,
    runtimeRevision: typeof root?.runtimeRevision === "string" ? root.runtimeRevision : "unknown",
    engineVersion: typeof root?.engineVersion === "string" ? root.engineVersion : "unknown",
    leadingSilenceMs,
    selectionRadiusMs,
    samples,
    quality: {
      controlCount: controlNames.length,
      minimumPairwiseDistance: closest.distance,
      closestPair: closest.pair,
    },
  };
}

function parseJsonWithBom(text: string): unknown {
  return JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text) as unknown;
}

async function runCli(): Promise<void> {
  const [capturePath, marksDirectory, outputPath] = process.argv.slice(2);
  if (!capturePath || !marksDirectory || !outputPath) {
    throw new Error(
      "Usage: web-viseme-authoring <capture.json> <speech-marks-directory> <output.json>",
    );
  }
  const marks = Object.fromEntries(await Promise.all(
    webVisemeCalibration.map(async ({ alias }) => {
      const lines = (await readFile(resolve(marksDirectory, `${alias}-marks.jsonl`), "utf8"))
        .split(/\r?\n/u)
        .filter(Boolean)
        .map((line) => parseJsonWithBom(line) as PollyVisemeMark);
      return [alias, lines] as const;
    }),
  ));
  const capture = parseJsonWithBom(await readFile(resolve(capturePath), "utf8"));
  const report = selectWebVisemeControls(capture, marks);
  await writeFile(resolve(outputPath), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({
    outputPath: resolve(outputPath),
    visemes: report.samples.length,
    controls: report.quality.controlCount,
    minimumPairwiseDistance: report.quality.minimumPairwiseDistance,
    closestPair: report.quality.closestPair,
  })}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runCli();
}
