import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repositoryFile = (path: string): URL => new URL(`../../${path}`, import.meta.url);

await test("keeps legacy podcast body assets out of the meeting runtime", async () => {
  const [
    engineConfig,
    moduleSource,
    startScript,
    stageBuilder,
    supervisor,
    readinessVerifier,
  ] = await Promise.all([
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
    readFile(
      repositoryFile("unreal/ConclaviaStudio/Scripts/Start-StudioSupervisor.ps1"),
      "utf8",
    ),
    readFile(
      repositoryFile("unreal/ConclaviaStudio/Scripts/Verify-SingleHeroReadiness.cjs"),
      "utf8",
    ),
  ]);

  assert.match(
    engineConfig,
    /^MeetingHandRaiseAnimation=\/Game\/Conclavia\/Meeting\/Animations\/AS_MeetingHandRaise_SeatedMarkerless_v1\.AS_MeetingHandRaise_SeatedMarkerless_v1$/mu,
  );
  assert.match(engineConfig, /^MeetingHandRaiseStartTimeSeconds=1\.75$/mu);
  assert.match(engineConfig, /^MeetingHandRaiseHoldTimeSeconds=3\.25$/mu);
  assert.match(engineConfig, /^MeetingHandRaiseLowerTimeSeconds=5\.75$/mu);
  assert.match(engineConfig, /^MeetingHandRaiseEndTimeSeconds=7\.50$/mu);
  assert.match(
    engineConfig,
    /^MeetingApplauseAnimation=\/Game\/Conclavia\/Meeting\/Animations\/AS_MeetingApplause_SeatedMarkerless_v1\.AS_MeetingApplause_SeatedMarkerless_v1$/mu,
  );
  assert.match(engineConfig, /^MeetingApplauseStartTimeSeconds=19\.25$/mu);
  assert.match(engineConfig, /^MeetingApplauseEndTimeSeconds=21\.65$/mu);
  assert.match(moduleSource, /Rejected non-meeting gesture asset/);
  assert.match(moduleSource, /Rejected non-meeting applause asset/);
  assert.doesNotMatch(moduleSource, /BodyGestureRaiseSeconds/);
  assert.match(moduleSource, /BodyGestureHoldSeconds - BodyGestureStartSeconds/);
  assert.match(moduleSource, /BodyGestureEndSeconds - BodyGestureLowerStartSeconds/);
  assert.match(
    moduleSource,
    /\/Game\/Conclavia\/Meeting\/Animations\/AS_MeetingAttentiveIdle_v1/,
  );
  assert.match(moduleSource, /AS_MeetingCalmIdle_v1/);
  assert.match(moduleSource, /AS_MeetingEngagedIdle_v1/);
  assert.match(moduleSource, /AS_MeetingReflectiveIdle_v1/);
  assert.match(moduleSource, /FMath::RandRange\(1, Paths\.Num\(\) - 1\)/);
  assert.match(moduleSource, /PlayAnimation\(BodyIdle, false\)/);
  assert.match(moduleSource, /BodyIdleVariationTimer/);
  assert.match(moduleSource, /performanceSemanticMood/);
  assert.match(moduleSource, /applauseGestureReady/);
  assert.match(moduleSource, /BodyGesturePhase == TEXT\("applauding"\)/);
  assert.match(moduleSource, /const bool bApplauseCue/);
  assert.match(moduleSource, /AS_MeetingPositiveExpression_CurveOnly_v1/);
  assert.match(moduleSource, /ue58-metahuman-curve-only-positive-expression/);
  assert.doesNotMatch(moduleSource, /commercial-mood-happiness-ue56-calibrated/);
  assert.doesNotMatch(moduleSource, /facialloop_happy_f_s001/);
  assert.doesNotMatch(moduleSource, /CAM_Meeting_Applause/);
  assert.doesNotMatch(moduleSource, /CAM_Meeting_Gesture/);
  assert.match(moduleSource, /Clamp\(Intensity, 0\.0f, 0\.85f\)/);
  assert.match(moduleSource, /ApplauseGestureEndSeconds - ApplauseGestureStartSeconds/);
  assert.match(startScript, /L_MeetingAvatar_v17/);
  assert.match(engineConfig, /^GameDefaultMap=\/Game\/Conclavia\/Meeting\/L_MeetingAvatar_v17$/mu);
  assert.match(engineConfig, /^EditorStartupMap=\/Game\/Conclavia\/Meeting\/L_MeetingAvatar_v17$/mu);
  assert.match(stageBuilder, /^STAGE_REVISION = "v17"$/mu);
  assert.doesNotMatch(stageBuilder, /CAM_Meeting_Applause/);
  assert.doesNotMatch(stageBuilder, /CAM_Meeting_Gesture/);
  assert.match(stageBuilder, /^CONTENT_ROOT = "\/Game\/Conclavia\/Meeting"$/mu);
  assert.match(stageBuilder, /^LEVEL_PATH = f"\{CONTENT_ROOT\}\/L_MeetingAvatar_\{STAGE_REVISION\}"$/mu);
  assert.match(stageBuilder, /webcam_position = unreal\.Vector\(-360\.0, 0\.0, 185\.0\)/);
  assert.match(stageBuilder, /webcam_target = unreal\.Vector\(0\.0, 0\.0, 165\.0\)/);
  assert.match(stageBuilder, /^MEETING_AVATAR_SCREEN_OFFSET_Y_CM = 4\.0$/mu);
  assert.match(stageBuilder, /webcam_focal_length = 168\.0/);
  assert.match(stageBuilder, /unreal\.Vector\(-300\.0, -310\.0, 375\.0\)/);
  assert.match(stageBuilder, /\n\s{8}185\.0,\n/);
  assert.match(engineConfig, /^r\.SSS\.Quality=2$/mu);
  assert.match(engineConfig, /^r\.SSS\.SampleSet=2$/mu);
  assert.match(engineConfig, /^r\.Tonemapper\.Sharpen=0\.15$/mu);
  assert.match(startScript, /r\.SSS\.SampleSet 2/);
  assert.match(startScript, /r\.Tonemapper\.Sharpen 0\.15/);
  assert.match(startScript, /build_meeting_attentive_idle\.py/);
  assert.match(startScript, /\$meetingIdleFiles = @\(/);
  assert.match(supervisor, /performanceSemanticMood/);
  assert.match(supervisor, /bodyIdleVariantCount/);
  assert.match(supervisor, /bodyIdleSwitchCount/);
  assert.match(readinessVerifier, /decodedFps >= 25/);
  assert.match(readinessVerifier, /exposureMeanLuma <= 190/);
  assert.match(readinessVerifier, /exposureNearWhiteRatio <= 0\.16/);
  assert.match(startScript, /\$readinessErrorText/);
  assert.match(startScript, /build_seated_idle\.py/);
  assert.match(stageBuilder, /MEETING_Chair_Seat/);
  assert.match(stageBuilder, /MEETING_Chair_Back/);
  assert.doesNotMatch(stageBuilder, /save_directory/);
});

await test("builds meeting gestures from private markerless captures with visual gates", async () => {
  const [
    project,
    rendererManifest,
    solveScript,
    handBuildScript,
    applauseBuildScript,
    applauseCaptureScript,
    positiveExpressionBuilder,
    deployScript,
    supervisor,
    ignoreRules,
  ] =
    await Promise.all([
    readFile(repositoryFile("unreal/ConclaviaStudio/ConclaviaStudio.uproject"), "utf8"),
    readFile(repositoryFile("unreal/renderer-manifest.json"), "utf8"),
    readFile(
      repositoryFile("unreal/ConclaviaStudio/Scripts/process_markerless_hand_raise.py"),
      "utf8",
    ),
    readFile(
      repositoryFile("unreal/ConclaviaStudio/Scripts/Build-MarkerlessHandRaise.ps1"),
      "utf8",
    ),
    readFile(
      repositoryFile("unreal/ConclaviaStudio/Scripts/Build-MarkerlessApplause.ps1"),
      "utf8",
    ),
    readFile(
      repositoryFile("unreal/ConclaviaStudio/Scripts/Capture-ApplauseSequence.cjs"),
      "utf8",
    ),
    readFile(
      repositoryFile("unreal/ConclaviaStudio/Scripts/build_metahuman_positive_expression.py"),
      "utf8",
    ),
    readFile(repositoryFile("scripts/deploy-3d-source.sh"), "utf8"),
    readFile(
      repositoryFile("unreal/ConclaviaStudio/Scripts/Start-StudioSupervisor.ps1"),
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
  assert.match(solveScript, /expected_duration_seconds/);
  assert.match(solveScript, /Bake markerless MetaHuman body solve/);
  assert.match(solveScript, /required_arm_tracks/);
  assert.match(solveScript, /motion_rotation_deltas/);
  assert.match(solveScript, /SEATED_BASE_TRACKS/);
  assert.match(solveScript, /AS_Conclavia_SeatedIdle/);
  assert.match(solveScript, /seated_leg_delta/);
  assert.match(solveScript, /rotation_only_tracks/);
  assert.match(solveScript, /delta_from_stabilized_pose/);
  assert.match(solveScript, /load_processed_performance/);
  assert.match(solveScript, /--reuse-performance/);
  assert.match(solveScript, /captured_base_rotation\.inversed\(\)/);
  assert.match(solveScript, /base_transform\.rotation \* captured_delta/);
  assert.match(solveScript, /transformed\.rotation = frame\[bone_name\]\.rotation/);
  assert.match(handBuildScript, /CONCLAVIA_MARKERLESS_PIPELINE_OK/);
  assert.match(applauseBuildScript, /MHP_MeetingApplause_Markerless_v1/);
  assert.doesNotMatch(applauseBuildScript, /--delta-from-stabilized-pose/);
  assert.match(applauseBuildScript, /--preserve-motion-translations/);
  assert.match(applauseBuildScript, /--stabilize-meeting-torso/);
  assert.match(applauseBuildScript, /--ease-segment-start-seconds", "19\.25/);
  assert.match(applauseBuildScript, /--ease-segment-end-seconds", "21\.65/);
  assert.match(handBuildScript, /--transition-seconds", "0\.80/);
  assert.match(handBuildScript, /--gesture-strength", "0\.82/);
  assert.match(handBuildScript, /--hold-pose-seconds", "3\.25/);
  assert.match(handBuildScript, /--lower-segment-start-seconds", "5\.75/);
  assert.match(applauseBuildScript, /--transition-seconds", "0\.75/);
  assert.match(applauseBuildScript, /--gesture-strength", "0\.78/);
  assert.match(solveScript, /def release_weight/);
  assert.match(solveScript, /gesture_weight\(frame_index\) \* gesture_strength/);
  assert.match(solveScript, /STABLE_MEETING_TORSO_TRACKS/);
  assert.match(solveScript, /seated_transform\.rotation\.slerp_quat/);
  assert.match(solveScript, /linear \* linear \* \(3\.0 - 2\.0 \* linear\)/);
  assert.match(applauseBuildScript, /ReusePerformance/);
  assert.match(
    applauseBuildScript,
    /upperarm_l,lowerarm_l,hand_l,upperarm_r,lowerarm_r,hand_r/,
  );
  assert.match(applauseBuildScript, /CONCLAVIA_MARKERLESS_PIPELINE_OK/);
  assert.match(applauseCaptureScript, /applauseGestureReady/);
  assert.match(applauseCaptureScript, /bodyGesturePhase === "applauding"/);
  assert.match(applauseCaptureScript, /commercialMood === "happiness"/);
  assert.match(applauseCaptureScript, /performanceSemanticMood === "amused"/);
  assert.match(applauseCaptureScript, /applauseExpressionActive === true/);
  assert.match(applauseCaptureScript, /cameraCount === fixedCamera\.count/);
  assert.match(applauseCaptureScript, /activeCamera === fixedCamera\.name/);
  assert.match(applauseCaptureScript, /ue58-metahuman-curve-only-positive-expression/);
  assert.match(positiveExpressionBuilder, /AS_MeetingPositiveExpression_CurveOnly_v1/);
  assert.match(positiveExpressionBuilder, /RawCurveTrackTypes\.RCT_FLOAT/);
  assert.match(positiveExpressionBuilder, /ctrl_expressions_mouthcornerpull/);
  assert.match(positiveExpressionBuilder, /ctrl_expressions_eyecheekraise/);
  assert.match(positiveExpressionBuilder, /DURATION_SECONDS = 2\.4/);
  assert.match(positiveExpressionBuilder, /mouthcornerpulll": 0\.20/);
  assert.match(positiveExpressionBuilder, /if bone_tracks or len\(curve_names\)/);
  assert.doesNotMatch(positiveExpressionBuilder, /browdown|jawopen|eyelook/iu);
  assert.match(deployScript, /Build-MeetingPositiveExpression\.ps1/);
  assert.match(supervisor, /applauseGestureDriver/);
  assert.match(supervisor, /applauseExpressionDriver/);
  assert.match(
    rendererManifest,
    /AS_MeetingApplause_SeatedMarkerless_v1/,
  );
  assert.match(rendererManifest, /Build-MarkerlessApplause\.ps1/);
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
