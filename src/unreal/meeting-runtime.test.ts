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
  assert.match(engineConfig, /^MeetingApplauseStartTimeSeconds=3\.25$/mu);
  assert.match(engineConfig, /^MeetingApplauseEndTimeSeconds=6\.75$/mu);
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
  assert.match(moduleSource, /TMap<FString, float> ListeningControls/);
  assert.match(moduleSource, /Generator->SetControlValues\(ListeningControls\)/);
  assert.match(moduleSource, /ListeningPrimingTicksRemaining = 6/);
  assert.match(moduleSource, /ListeningPrimingTicksRemaining > 2/);
  assert.match(moduleSource, /bListeningGeneratorVisible/);
  assert.match(moduleSource, /Node->ResetTime = bListening \? 20\.0f : 0\.28f/);
  assert.match(moduleSource, /Node->InterpolationSpeed = bListening \? 12\.0f : 45\.0f/);
  assert.match(moduleSource, /Control\.Key\.Contains\(TEXT\("mouth"\)/);
  assert.match(moduleSource, /Control\.Key\.Contains\(TEXT\("jaw"\)/);
  assert.match(moduleSource, /Control\.Key\.Contains\(TEXT\("tongue"\)/);
  assert.match(moduleSource, /Control\.Key\.Contains\(TEXT\("teeth"\)/);
  assert.match(moduleSource, /Control\.Key\.Contains\(TEXT\("neck"\)/);
  assert.match(moduleSource, /ApplauseGestureEndSeconds - ApplauseGestureStartSeconds/);
  assert.match(startScript, /L_MeetingAvatar_v19/);
  assert.match(engineConfig, /^GameDefaultMap=\/Game\/Conclavia\/Meeting\/L_MeetingAvatar_v19$/mu);
  assert.match(engineConfig, /^EditorStartupMap=\/Game\/Conclavia\/Meeting\/L_MeetingAvatar_v19$/mu);
  assert.match(stageBuilder, /^STAGE_REVISION = "v19"$/mu);
  assert.doesNotMatch(stageBuilder, /CAM_Meeting_Applause/);
  assert.doesNotMatch(stageBuilder, /CAM_Meeting_Gesture/);
  assert.match(stageBuilder, /^CONTENT_ROOT = "\/Game\/Conclavia\/Meeting"$/mu);
  assert.match(stageBuilder, /^LEVEL_PATH = f"\{CONTENT_ROOT\}\/L_MeetingAvatar_\{STAGE_REVISION\}"$/mu);
  assert.match(stageBuilder, /webcam_position = unreal\.Vector\(-360\.0, 0\.0, 185\.0\)/);
  assert.match(stageBuilder, /webcam_target = unreal\.Vector\(0\.0, 0\.0, 165\.0\)/);
  assert.match(stageBuilder, /^MEETING_AVATAR_SCREEN_OFFSET_Y_CM = 4\.0$/mu);
  assert.match(stageBuilder, /webcam_focal_length = 163\.0/);
  assert.match(stageBuilder, /unreal\.Vector\(-300\.0, -335\.0, 335\.0\)/);
  assert.match(stageBuilder, /\n\s{8}132\.0,\n/);
  assert.match(stageBuilder, /sky_component\.set_editor_property\("intensity", 0\.035\)/);
  assert.match(engineConfig, /^r\.SSS\.Quality=2$/mu);
  assert.match(engineConfig, /^r\.SSS\.SampleSet=2$/mu);
  assert.match(engineConfig, /^r\.Tonemapper\.Sharpen=0\.22$/mu);
  assert.match(startScript, /r\.SSS\.SampleSet 2/);
  assert.match(startScript, /r\.Tonemapper\.Sharpen 0\.22/);
  assert.match(moduleSource, /ConfigureShowcaseSkinDetail/);
  assert.match(moduleSource, /Micro Skin Normal Strength[\s\S]*1\.22f/);
  assert.match(moduleSource, /Roughness Adjust[\s\S]*1\.16f/);
  assert.match(moduleSource, /ue58-commercial-lipsync-v28-web-facial-authoring/);
  assert.match(startScript, /build_meeting_attentive_idle\.py/);
  assert.match(startScript, /\$meetingIdleFiles = @\(/);
  assert.match(supervisor, /performanceSemanticMood/);
  assert.match(supervisor, /bodyIdleVariantCount/);
  assert.match(supervisor, /bodyIdleSwitchCount/);
  assert.match(readinessVerifier, /decodedFps >= 24\.5/);
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
    applauseContactScript,
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
      repositoryFile("unreal/ConclaviaStudio/Scripts/refine_applause_hand_contact.py"),
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
  assert.match(applauseBuildScript, /--ease-segment-start-seconds", "3\.25/);
  assert.match(applauseBuildScript, /--ease-segment-end-seconds", "6\.75/);
  assert.match(handBuildScript, /--transition-seconds", "0\.80/);
  assert.match(handBuildScript, /\[string\]\$CapturePath = ""/);
  assert.match(handBuildScript, /if \(-not \$ReusePerformance/);
  assert.match(handBuildScript, /--gesture-strength", "0\.82/);
  assert.match(handBuildScript, /--hold-pose-seconds", "3\.25/);
  assert.match(handBuildScript, /--lower-segment-start-seconds", "5\.75/);
  assert.match(applauseBuildScript, /--transition-seconds", "0\.75/);
  assert.match(applauseBuildScript, /--gesture-strength", "1\.0/);
  assert.match(solveScript, /def release_weight/);
  assert.match(solveScript, /gesture_weight\(frame_index\) \* gesture_strength/);
  assert.match(
    solveScript,
    /Markerless gesture segment exceeds the solved performance/,
  );
  assert.match(solveScript, /STABLE_MEETING_TORSO_TRACKS/);
  assert.match(solveScript, /seated_transform\.rotation\.slerp_quat/);
  assert.match(solveScript, /linear \* linear \* \(3\.0 - 2\.0 \* linear\)/);
  assert.match(applauseBuildScript, /ReusePerformance/);
  assert.match(
    applauseBuildScript,
    /upperarm_l,lowerarm_l,hand_l,upperarm_r,lowerarm_r,hand_r/,
  );
  assert.match(applauseBuildScript, /CONCLAVIA_MARKERLESS_PIPELINE_OK/);
  assert.match(applauseContactScript, /MetaHuman_ControlRig/);
  assert.match(applauseContactScript, /hand_\{side\}_ik_ctrl/);
  assert.match(applauseContactScript, /CONTACT_TARGET_CM = 5\.0/);
  assert.match(applauseContactScript, /corrected_pair/);
  assert.match(rendererManifest, /AS_MeetingApplause_SeatedContactIK_v3/);
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
  assert.match(positiveExpressionBuilder, /mouthcornerpulll": 0\.27/);
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

await test("exports a portable Web performer from the authored UE 5.8 meeting assets", async () => {
  const [
    project,
    rendererManifest,
    exporter,
    showcaseResolver,
    facialBaker,
    visemeBaker,
    wrapper,
  ] = await Promise.all([
    readFile(repositoryFile("unreal/ConclaviaStudio/ConclaviaStudio.uproject"), "utf8"),
    readFile(repositoryFile("unreal/renderer-manifest.json"), "utf8"),
    readFile(
      repositoryFile("unreal/ConclaviaStudio/Scripts/export_web_avatar_bundle.py"),
      "utf8",
    ),
    readFile(
      repositoryFile("unreal/ConclaviaStudio/Scripts/web_showcase_actor.py"),
      "utf8",
    ),
    readFile(
      repositoryFile("unreal/ConclaviaStudio/Scripts/bake_web_facial_moods.py"),
      "utf8",
    ),
    readFile(
      repositoryFile("unreal/ConclaviaStudio/Scripts/bake_web_facial_visemes.py"),
      "utf8",
    ),
    readFile(
      repositoryFile("unreal/ConclaviaStudio/Scripts/Export-WebAvatarBundle.ps1"),
      "utf8",
    ),
  ]);

  assert.match(project, /"Name": "GLTFExporter", "Enabled": true/);
  assert.match(rendererManifest, /export_web_avatar_bundle\.py/);
  assert.match(exporter, /\/Game\/Conclavia\/Meeting\/L_MeetingAvatar_v19/);
  assert.match(exporter, /ensure_showcase_export_actor/);
  assert.match(showcaseResolver, /MeetingAvatarAnchor/);
  assert.match(showcaseResolver, /BP_MHC_Showcase\.BP_MHC_Showcase_C/);
  assert.match(showcaseResolver, /refusing a bald Web export/);
  assert.match(exporter, /export_vertex_skin_weights/);
  assert.match(exporter, /export_morph_targets/);
  assert.match(exporter, /"export_morph_targets": False/);
  assert.match(exporter, /export_preview_mesh/);
  assert.match(exporter, /configure_options\(preview_mesh=False\)/);
  assert.match(exporter, /FACIAL_MOODS/);
  assert.match(exporter, /anim-face-\{mood\}\.glb/);
  assert.match(exporter, /AS_WebMood\{label\}_v1/);
  assert.match(exporter, /FACIAL_VISEMES/);
  assert.match(exporter, /anim-viseme-\{alias\}\.glb/);
  assert.match(exporter, /AS_WebViseme\{label\}_v1/);
  assert.match(exporter, /"attentive"/);
  assert.match(exporter, /"amused"/);
  assert.match(exporter, /GLTFExporter\.export_to_gltf/);
  assert.match(exporter, /AS_MeetingHandRaise_SeatedMarkerless_v1/);
  assert.match(exporter, /AS_MeetingApplause_SeatedMarkerless_v1/);
  assert.doesNotMatch(exporter, /AS_MeetingApplause_SeatedContactIK_v3/);
  assert.match(exporter, /"startSeconds": 5\.75/);
  assert.match(exporter, /CONCLAVIA_WEB_AVATAR_EXPORT_OK/);
  assert.match(exporter, /"assetVersion": ASSET_VERSION/);
  assert.match(exporter, /"hairGeometry": "missing"/);
  assert.match(exporter, /"visualReview": "pending"/);
  assert.match(facialBaker, /TemplateAnimations\/Facial_Poses/);
  assert.match(facialBaker, /SequencerTools\.export_anim_sequence/);
  assert.match(facialBaker, /evaluate_all_skeletal_mesh_components/);
  assert.match(facialBaker, /close_level_sequence\(\)/);
  assert.match(facialBaker, /"export_preview_mesh": False/);
  assert.match(facialBaker, /"export_morph_targets": False/);
  assert.match(facialBaker, /anim-face-\{mood\}\.glb/);
  assert.match(facialBaker, /CONCLAVIA_WEB_FACIAL_MOODS: \{message\}/);
  assert.doesNotMatch(facialBaker, /jawopen|tongue|teeth|mouthpress|mouthpucker/iu);
  assert.match(visemeBaker, /conclavia\.web-visemes/);
  assert.match(visemeBaker, /SequencerTools\.export_anim_sequence/);
  assert.match(visemeBaker, /evaluate_all_skeletal_mesh_components/);
  assert.match(visemeBaker, /close_level_sequence\(\)/);
  assert.match(visemeBaker, /anim-viseme-\{alias\}\.glb/);
  assert.match(visemeBaker, /\("S", "sh", "Sh"\)/);
  assert.match(visemeBaker, /\("T", "th", "Th"\)/);
  assert.match(visemeBaker, /CONCLAVIA_WEB_FACIAL_VISEMES: \{message\}/);
  assert.match(wrapper, /UnrealEditor-Cmd\.exe/);
  assert.match(wrapper, /Compress-Archive/);
  assert.match(wrapper, /Web avatar export directory must be empty/);
  assert.match(wrapper, /bake_web_facial_moods\.py/);
  assert.match(wrapper, /bake_web_facial_visemes\.py/);
  assert.match(wrapper, /CONCLAVIA_WEB_FACIAL_MOODS: READY/);
  assert.match(wrapper, /CONCLAVIA_WEB_FACIAL_VISEMES: READY/);
  assert.match(wrapper, /selected-viseme-controls\.json/);
  assert.match(wrapper, /completedBeforeShutdown/);
});

await test("builds and audits a separate hair-card Showcase assembly for Web", async () => {
  const [builder, wrapper, audit, auditWrapper, deployScript, rendererManifest] =
    await Promise.all([
      readFile(
        repositoryFile(
          "unreal/ConclaviaStudio/Scripts/build_showcase_web_avatar.py",
        ),
        "utf8",
      ),
      readFile(
        repositoryFile(
          "unreal/ConclaviaStudio/Scripts/Build-ShowcaseWebAvatar.ps1",
        ),
        "utf8",
      ),
      readFile(
        repositoryFile(
          "unreal/ConclaviaStudio/Scripts/inspect_showcase_web_hair.py",
        ),
        "utf8",
      ),
      readFile(
        repositoryFile(
          "unreal/ConclaviaStudio/Scripts/Audit-ShowcaseWebHair.ps1",
        ),
        "utf8",
      ),
      readFile(repositoryFile("scripts/deploy-3d-source.sh"), "utf8"),
      readFile(repositoryFile("unreal/renderer-manifest.json"), "utf8"),
    ]);

  assert.match(builder, /MetaHumanDefaultPipelineType\.OPTIMIZED/);
  assert.match(builder, /MetaHumanQualityLevel\.LOW/);
  assert.match(builder, /MHC_Showcase_WebLow/);
  assert.doesNotMatch(builder, /delete_asset\(CHARACTER_PATH\)/);
  assert.match(wrapper, /CONCLAVIA_SHOWCASE_WEB_BUILD: READY/);
  assert.match(audit, /get_hair_groups_cards/);
  assert.match(audit, /get_hair_groups_meshes/);
  assert.match(audit, /exportableHairMeshes/);
  assert.match(auditWrapper, /CONCLAVIA_SHOWCASE_HAIR_AUDIT_OK/);
  assert.match(deployScript, /Build-ShowcaseWebAvatar\.ps1/);
  assert.match(rendererManifest, /build_showcase_web_avatar\.py/);
  assert.match(rendererManifest, /inspect_showcase_web_hair\.py/);
});

await test("bakes curve-driven facial performance on the staged MetaHuman identity", async () => {
  const [baker, wrapper] = await Promise.all([
    readFile(
      repositoryFile("unreal/ConclaviaStudio/Scripts/bake_web_facial_probe.py"),
      "utf8",
    ),
    readFile(
      repositoryFile("unreal/ConclaviaStudio/Scripts/Export-WebFacialProbe.ps1"),
      "utf8",
    ),
  ]);
  assert.match(baker, /AS_MeetingPositiveExpression_CurveOnly_v1/);
  assert.match(baker, /SequencerTools\.export_anim_sequence/);
  assert.match(baker, /evaluate_all_skeletal_mesh_components/);
  assert.match(baker, /Facial bake produced no bone transforms/);
  assert.match(baker, /"export_preview_mesh": False/);
  assert.match(baker, /"export_morph_targets": False/);
  assert.match(baker, /GLTFExporter\.export_to_gltf/);
  assert.match(wrapper, /CONCLAVIA_WEB_FACIAL_PROBE_OK/);
});

await test("audits the licensed facial generator before authoring Web clips", async () => {
  const [audit, wrapper, rendererManifest] = await Promise.all([
    readFile(
      repositoryFile("unreal/ConclaviaStudio/Scripts/audit_web_facial_api.py"),
      "utf8",
    ),
    readFile(
      repositoryFile("unreal/ConclaviaStudio/Scripts/Audit-WebFacialApi.ps1"),
      "utf8",
    ),
    readFile(repositoryFile("unreal/renderer-manifest.json"), "utf8"),
  ]);
  assert.match(audit, /RealisticMetaHumanLipSyncMoodConfig/);
  assert.match(audit, /create_realistic_meta_human_lip_sync_with_mood_generator/);
  assert.match(audit, /get_control_values/);
  assert.match(audit, /process_audio_data/);
  assert.match(audit, /CONCLAVIA_WEB_FACIAL_API_AUDIT_OK/);
  assert.doesNotMatch(audit, /process_audio_data\s*\(/);
  assert.match(wrapper, /UnrealEditor-Cmd\.exe/);
  assert.match(wrapper, /CONCLAVIA_WEB_FACIAL_API_AUDIT_OK/);
  assert.match(rendererManifest, /audit_web_facial_api\.py/);
  assert.match(rendererManifest, /Audit-WebFacialApi\.ps1/);
});

await test("catalogs authored MetaHuman body motion before selecting Web microgestures", async () => {
  const [catalog, probe, builder, wrapper, exporter, deployScript, rendererManifest] = await Promise.all([
    readFile(
      repositoryFile(
        "unreal/ConclaviaStudio/Scripts/audit_official_body_animation_catalog.py",
      ),
      "utf8",
    ),
    readFile(
      repositoryFile(
        "unreal/ConclaviaStudio/Scripts/export_official_body_motion_probe.py",
      ),
      "utf8",
    ),
    readFile(
      repositoryFile(
        "unreal/ConclaviaStudio/Scripts/build_web_authored_microgestures.py",
      ),
      "utf8",
    ),
    readFile(
      repositoryFile(
        "unreal/ConclaviaStudio/Scripts/Build-WebAuthoredMicrogestures.ps1",
      ),
      "utf8",
    ),
    readFile(
      repositoryFile(
        "unreal/ConclaviaStudio/Scripts/export_web_avatar_bundle.py",
      ),
      "utf8",
    ),
    readFile(repositoryFile("scripts/deploy-3d-source.sh"), "utf8"),
    readFile(repositoryFile("unreal/renderer-manifest.json"), "utf8"),
  ]);
  assert.match(catalog, /TemplateAnimations/);
  assert.match(catalog, /"nod"/);
  assert.match(catalog, /"tilt"/);
  assert.match(catalog, /"emphasis"/);
  assert.match(catalog, /"settle"/);
  assert.match(catalog, /AnimSequence/);
  assert.match(catalog, /CONCLAVIA_WEB_BODY_CATALOG: \{message\}/);
  assert.doesNotMatch(catalog, /add_bone_track|add_bone_transform_curve/iu);
  assert.match(rendererManifest, /audit_official_body_animation_catalog\.py/);
  assert.match(probe, /BodyROM\/mhc_body_rom_body/);
  assert.match(probe, /export_preview_mesh/);
  assert.match(probe, /GLTFExporter\.export_to_gltf/);
  assert.match(probe, /CONCLAVIA_WEB_BODY_PROBE: READY/);
  assert.match(rendererManifest, /export_official_body_motion_probe\.py/);
  assert.match(builder, /BodyROM\/mhc_body_rom_body/);
  assert.match(builder, /AS_MeetingCalmIdle_v1/);
  assert.match(builder, /AS_MeetingNod_Authored_v1/);
  assert.match(builder, /AS_MeetingTilt_Authored_v1/);
  assert.match(builder, /AS_MeetingEmphasis_Authored_v1/);
  assert.match(builder, /AS_MeetingSettle_Authored_v1/);
  assert.match(builder, /source_bases\[bone\]\.inversed\(\) \* authored\.rotation/);
  assert.match(builder, /anchors\[bone\]\.rotation \* restrained_delta/);
  assert.match(builder, /smooth_edge_envelope\(phase\)/);
  assert.match(builder, /FORBIDDEN_BONE_PREFIXES/);
  assert.doesNotMatch(builder, /add_bone_track\(["'](?:root|pelvis|thigh|calf|foot)/iu);
  assert.match(wrapper, /build_seated_idle\.py/);
  assert.match(wrapper, /build_meeting_attentive_idle\.py/);
  assert.match(wrapper, /build_web_authored_microgestures\.py/);
  assert.match(wrapper, /CONCLAVIA_WEB_MICROGESTURES: READY/);
  assert.match(exporter, /anim-nod\.glb/);
  assert.match(exporter, /anim-tilt\.glb/);
  assert.match(exporter, /anim-emphasis\.glb/);
  assert.match(exporter, /anim-settle\.glb/);
  assert.match(exporter, /"nod": "AS_MeetingNod_Authored_v1"/);
  assert.match(exporter, /"settle": "AS_MeetingSettle_Authored_v1"/);
  assert.match(rendererManifest, /build_web_authored_microgestures\.py/);
  assert.match(rendererManifest, /Build-WebAuthoredMicrogestures\.ps1/);
  assert.match(deployScript, /Build-WebAuthoredMicrogestures\.ps1/);
});

await test("samples every licensed mood and case-sensitive viseme", async () => {
  const [moduleSource, wrapper, visemeWrapper, rendererManifest] = await Promise.all([
    readFile(
      repositoryFile(
        "unreal/ConclaviaStudio/Source/ConclaviaStudio/Private/ConclaviaStudioModule.cpp",
      ),
      "utf8",
    ),
    readFile(
      repositoryFile("unreal/ConclaviaStudio/Scripts/Sample-WebFacialControls.ps1"),
      "utf8",
    ),
    readFile(
      repositoryFile("unreal/ConclaviaStudio/Scripts/Sample-WebVisemeControls.ps1"),
      "utf8",
    ),
    readFile(repositoryFile("unreal/renderer-manifest.json"), "utf8"),
  ]);
  assert.match(moduleSource, /\/authoring\/facial-controls/);
  assert.match(moduleSource, /HandleFacialControlsRead/);
  assert.match(moduleSource, /HandleFacialControlsWrite/);
  assert.match(moduleSource, /FeedAuthoringSilence/);
  assert.match(moduleSource, /Silence\.SetNumZeroed\(640\)/);
  assert.match(moduleSource, /Generator->ProcessAudioData\(MoveTemp\(Silence\), 16000, 1\)/);
  assert.match(moduleSource, /Payload->SetObjectField\(TEXT\("controls"\), Controls\)/);
  assert.match(wrapper, /happiness = 0\.38/);
  assert.match(wrapper, /confusion = 0\.32/);
  assert.match(wrapper, /commercialModelReady -eq \$true/);
  assert.match(wrapper, /silenceChunks = 8/);
  assert.match(wrapper, /Start-Sleep -Milliseconds 520/);
  assert.match(wrapper, /authoring\/facial-controls/);
  assert.match(visemeWrapper, /viseme = "S"; source = "sh\.pcm"/);
  assert.match(visemeWrapper, /viseme = "T"; source = "th\.pcm"/);
  assert.match(visemeWrapper, /viseme = "e"; source = "e-close\.pcm"/);
  assert.match(visemeWrapper, /viseme = "E"; source = "e-open\.pcm"/);
  assert.match(visemeWrapper, /\$captures\.Add/);
  assert.match(visemeWrapper, /commercialModelReady -eq \$true/);
  assert.doesNotMatch(visemeWrapper, /commercialControlsBound -eq \$true/);
  assert.match(visemeWrapper, /\$durationMs \+ 480/);
  assert.equal((visemeWrapper.match(/Wait-RendererReady \| Out-Null/g) ?? []).length, 2);
  assert.doesNotMatch(visemeWrapper, /\$visemes = \[ordered\]@/);
  assert.match(rendererManifest, /Sample-WebFacialControls\.ps1/);
  assert.match(rendererManifest, /Sample-WebVisemeControls\.ps1/);
  assert.doesNotMatch(rendererManifest, /sample_web_facial_controls\.py/);
});
