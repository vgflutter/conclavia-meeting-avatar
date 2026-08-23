import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repositoryFile = (path: string): URL => new URL(`../../${path}`, import.meta.url);

await test("keeps legacy podcast body assets out of the meeting runtime", async () => {
  const [engineConfig, moduleSource, startScript, stageBuilder] = await Promise.all([
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
    readFile(
      repositoryFile("unreal/ConclaviaStudio/Scripts/build_meeting_avatar_stage.py"),
      "utf8",
    ),
  ]);

  assert.match(
    engineConfig,
    /^MeetingHandRaiseAnimation=\/Game\/Conclavia\/Meeting\/Animations\/AS_MeetingHandRaise_Markerless_v1\.AS_MeetingHandRaise_Markerless_v1$/mu,
  );
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
  assert.match(startScript, /L_MeetingAvatar_v7/);
  assert.match(engineConfig, /^GameDefaultMap=\/Game\/Conclavia\/Meeting\/L_MeetingAvatar_v7$/mu);
  assert.match(engineConfig, /^EditorStartupMap=\/Game\/Conclavia\/Meeting\/L_MeetingAvatar_v7$/mu);
  assert.match(stageBuilder, /^STAGE_REVISION = "v7"$/mu);
  assert.match(stageBuilder, /unreal\.Vector\(-420\.0, 0\.0, 210\.0\)/);
  assert.match(stageBuilder, /unreal\.Vector\(0\.0, 0\.0, 190\.0\)/);
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
  assert.match(project, /"Name": "MetaHumanBodyTracker", "Enabled": true/);
  assert.match(solveScript, /ingest_mono_video_sync/);
  assert.match(solveScript, /FrameAnimationDataType\.BODY/);
  assert.match(solveScript, /CONCLAVIA_MARKERLESS_SOLVE_REUSED/);
  assert.match(solveScript, /body_tracking", True/);
  assert.match(solveScript, /enable_foot_locking", True/);
  assert.match(solveScript, /get_animation_data\(\)/);
  assert.match(solveScript, /Bake markerless MetaHuman body solve/);
  assert.match(solveScript, /required_arm_tracks/);
  assert.match(solveScript, /STABILIZED_BODY_TRACKS/);
  assert.match(buildScript, /CONCLAVIA_MARKERLESS_PIPELINE_OK/);
  assert.match(ignoreRules, /^unreal\/ConclaviaStudio\/Capture\/$/mu);
});

await test("keeps the licensed markerless bootstrap reproducible and auth ephemeral", async () => {
  const [installer, bootstrap, deployScript] = await Promise.all([
    readFile(
      repositoryFile("unreal/bootstrap/Install-MarkerlessBodyTracker.ps1"),
      "utf8",
    ),
    readFile(
      repositoryFile("unreal/bootstrap/fab/FabMarkerlessBootstrap.cpp"),
      "utf8",
    ),
    readFile(repositoryFile("scripts/deploy-3d-source.sh"), "utf8"),
  ]);

  assert.match(installer, /ConclaviaLauncherTokenFile/);
  assert.match(installer, /WriteAllBytes\(\$LauncherTokenFile/);
  assert.match(installer, /Remove-Item \$LauncherTokenFile -Force/);
  assert.match(bootstrap, /CONCLAVIA_MARKERLESS_PLUGIN_INSTALL_OK/);
  assert.doesNotMatch(bootstrap, /LauncherClientSecret|refresh_token/);
  assert.match(deployScript, /unreal\/bootstrap/);
});
