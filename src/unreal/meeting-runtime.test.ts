import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repositoryFile = (path: string): URL => new URL(`../../${path}`, import.meta.url);

await test("keeps legacy podcast body assets out of the meeting runtime", async () => {
  const [engineConfig, moduleSource, startScript] = await Promise.all([
    readFile(repositoryFile("unreal/ConclaviaStudio/Config/DefaultEngine.ini"), "utf8"),
    readFile(
      repositoryFile(
        "unreal/ConclaviaStudio/Source/ConclaviaStudio/Private/ConclaviaStudioModule.cpp",
      ),
      "utf8",
    ),
    readFile(
      repositoryFile("unreal/ConclaviaStudio/Scripts/Start-ReviewStream.ps1"),
      "utf8",
    ),
  ]);

  assert.match(engineConfig, /^MeetingHandRaiseAnimation=$/mu);
  assert.match(engineConfig, /^MeetingHandRaiseStartTimeSeconds=1\.75$/mu);
  assert.match(engineConfig, /^MeetingHandRaiseHoldTimeSeconds=3\.25$/mu);
  assert.match(engineConfig, /^MeetingHandRaiseLowerTimeSeconds=5\.75$/mu);
  assert.match(engineConfig, /^MeetingHandRaiseEndTimeSeconds=7\.50$/mu);
  assert.match(moduleSource, /Rejected non-meeting gesture asset/);
  assert.doesNotMatch(moduleSource, /BodyGestureRaiseSeconds/);
  assert.match(moduleSource, /BodyGestureHoldSeconds - BodyGestureStartSeconds/);
  assert.match(moduleSource, /BodyGestureEndSeconds - BodyGestureLowerStartSeconds/);
  assert.match(
    moduleSource,
    /\/Game\/Conclavia\/Meeting\/Animations\/AS_MeetingAttentiveIdle_v1/,
  );
  assert.match(startScript, /L_MeetingAvatar_v4/);
  assert.match(startScript, /build_meeting_attentive_idle\.py/);
});

await test("builds hand raise from private markerless capture with a visual gate", async () => {
  const [project, solveScript, buildScript, ignoreRules] = await Promise.all([
    readFile(repositoryFile("unreal/ConclaviaStudio/ConclaviaStudio.uproject"), "utf8"),
    readFile(
      repositoryFile("unreal/ConclaviaStudio/Scripts/process_markerless_hand_raise.py"),
      "utf8",
    ),
    readFile(
      repositoryFile("unreal/ConclaviaStudio/Scripts/Build-MarkerlessHandRaise.ps1"),
      "utf8",
    ),
    readFile(repositoryFile(".gitignore"), "utf8"),
  ]);

  assert.match(project, /"Name": "CaptureManagerEditor", "Enabled": true/);
  assert.match(solveScript, /ingest_mono_video_sync/);
  assert.match(solveScript, /body_tracking", True/);
  assert.match(solveScript, /enable_foot_locking", True/);
  assert.match(solveScript, /RTG_MH_IKRig\.RTG_MH_IKRig/);
  assert.match(solveScript, /export_body = True/);
  assert.match(solveScript, /export_face = False/);
  assert.match(buildScript, /CONCLAVIA_MARKERLESS_PIPELINE_OK/);
  assert.match(ignoreRules, /^unreal\/ConclaviaStudio\/Capture\/$/mu);
});
