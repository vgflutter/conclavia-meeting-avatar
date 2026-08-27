import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const outputHtmlUrl = new URL("../../public/output.html", import.meta.url);
const outputScriptUrl = new URL("../../public/output.js", import.meta.url);
const managementScriptUrl = new URL("../../public/app.js", import.meta.url);
const managementHtmlUrl = new URL("../../public/index.html", import.meta.url);
const managementStylesUrl = new URL("../../public/styles.css", import.meta.url);
const webOutputHtmlUrl = new URL("../../public/web-output.html", import.meta.url);
const webOutputScriptUrl = new URL("../../public/web-output.js", import.meta.url);
const webTimelineUrl = new URL("../../public/web-performance-timeline.js", import.meta.url);
const webPerformerUrl = new URL("../../public/web-avatar-performer.js", import.meta.url);
const serverUrl = new URL("../server.ts", import.meta.url);

await test("keeps the OBS output free of meeting-console overlays", async () => {
  const [html, script, managementScript] = await Promise.all([
    readFile(outputHtmlUrl, "utf8"),
    readFile(outputScriptUrl, "utf8"),
    readFile(managementScriptUrl, "utf8"),
  ]);

  assert.doesNotMatch(html, /hand-request|IN ONDA|IN ASCOLTO|class="stage-badge"/i);
  assert.doesNotMatch(script, /api\/participation|handRequest/i);
  assert.match(script, /document\.createElement\("iframe"\)/);
  assert.match(script, /renderer\.streamId/);
  assert.match(script, /conclavia:frame-heartbeat/);
  assert.match(script, /FRAME_STALL_TIMEOUT_MS/);
  assert.match(script, /reconnectStalledPlayer/);
  assert.match(managementScript, /frame\.dataset\.stream !== streamId/);
  assert.match(managementScript, /status\.streamId \|\| ""/);
  assert.match(managementScript, /fallback fotografico/);
  assert.match(managementScript, /non supera l’audit/);
  assert.match(managementScript, /Web avatar 3D pronto/);
});

await test("publishes decoded-frame heartbeats from the clean Unreal player", async () => {
  const source = await readFile(
    new URL("../../unreal/ConclaviaStudio/Scripts/Start-ReviewStream.ps1", import.meta.url),
    "utf8",
  );

  assert.match(source, /requestVideoFrameCallback/);
  assert.match(source, /conclavia:frame-heartbeat/);
  assert.match(source, /presentedFrames/);
});

await test("uses the Conclavia brand system in the meeting console", async () => {
  const [html, styles, server] = await Promise.all([
    readFile(managementHtmlUrl, "utf8"),
    readFile(managementStylesUrl, "utf8"),
    readFile(serverUrl, "utf8"),
  ]);

  assert.match(html, /\/assets\/conclavia-logo\.png/);
  assert.match(html, /class="control-group/);
  assert.match(html, /<details class="command-dock">/);
  assert.doesNotMatch(html, /class="brand-mark"/);
  assert.match(styles, /--brand-navy:\s*#0b2d82/i);
  assert.match(styles, /--brand-blue:\s*#428cff/i);
  assert.match(server, /\/assets\/conclavia-logo\.png/);
});

await test("loads a rigged Web performer while retaining a diagnostic fallback", async () => {
  const [html, output, timeline, performer, server] = await Promise.all([
    readFile(webOutputHtmlUrl, "utf8"),
    readFile(webOutputScriptUrl, "utf8"),
    readFile(webTimelineUrl, "utf8"),
    readFile(webPerformerUrl, "utf8"),
    readFile(serverUrl, "utf8"),
  ]);

  assert.match(html, /type="importmap"/);
  assert.match(html, /\/vendor\/three\/build\/three\.module\.js/);
  assert.match(output, /loadThreeAvatarPerformer/);
  assert.match(output, /visemeBlendAt/);
  assert.match(output, /preloadAudio/);
  assert.match(output, /Number\.isFinite\(activeStartedAtAudio\)/);
  assert.match(timeline, /co-articulated pair of visemes/);
  assert.match(timeline, /gestureStateAt/);
  assert.match(output, /Fallback fotografico/);
  assert.match(output, /speechExpressionReleased/);
  assert.match(output, /queueContinuation/);
  assert.match(output, /playNextSpeechChunk/);
  assert.match(output, /packetDeliveryId !== activeDeliveryId/);
  assert.doesNotMatch(output, /packet\.sequence < latestSequence/);
  assert.match(output, /if \(!avatarPerformer\)/);
  assert.match(output, /outputMode === "obs" \? "clean" : "console"/);
  assert.match(html, /data-output="console"/);
  assert.match(performer, /new THREE\.AnimationMixer/);
  assert.match(performer, /new THREE\.PMREMGenerator/);
  assert.match(performer, /new RoomEnvironment/);
  assert.match(performer, /RectAreaLightUniformsLib\.init\(\)/);
  assert.match(performer, /new THREE\.RectAreaLight/);
  assert.match(performer, /this\.renderer\.setPixelRatio\(1\)/);
  assert.match(performer, /key\.shadow\.mapSize\.set\(4096, 4096\)/);
  assert.match(performer, /emissiveIntensity = 0\.075/);
  assert.match(performer, /addAnimationGltfs/);
  assert.match(performer, /manifest\.animationModels/);
  assert.match(performer, /const performer = new ThreeAvatarPerformer/);
  assert.match(performer, /gltfs = await Promise\.all/);
  assert.match(performer, /const \[gltf, \.\.\.animationGltfs\] = gltfs/);
  assert.match(performer, /THREE\.MathUtils\.clamp\(hairAlphaThreshold, 0\.01, 0\.5\)/);
  assert.match(performer, /conclaviaHairAlpha["']\) \|\| 0\.2/);
  assert.match(performer, /conclaviaEyebrowAlpha["']\) \|\| 0\.14/);
  assert.match(performer, /conclaviaEyebrowForward["']\) \|\| 0\.018/);
  assert.match(performer, /conclaviaHairCards["']\) \|\| ["']crown["']/);
  assert.match(performer, /function trimPortableHairCrown\(node\)/);
  assert.match(performer, /#advanceLifeLayer\(state, deltaSeconds\)/);
  assert.match(performer, /FACIAL_L_EyelidUpperA/);
  assert.match(performer, /conclaviaBlinkTest/);
  assert.match(performer, /conclaviaRestingLids/);
  assert.match(performer, /currentRestingLidWeight/);
  assert.match(performer, /ambientExpression \? "attentive" : state\.mood/);
  assert.match(performer, /conclaviaGroomCompactAttributes\.r/);
  assert.match(performer, /conclaviaGroomTangentTexture/);
  assert.match(performer, /conclaviaGroomTangentMap/);
  assert.match(performer, /conclaviaStrandFlow/);
  assert.match(performer, /enableExtendedSkinning/);
  assert.match(performer, /preserveExtendedWeights/);
  assert.match(performer, /attribute vec4 joints_\$\{setIndex\}/);
  assert.match(performer, /getBoneMatrix\(joints_\$\{setIndex\}/);
  assert.match(performer, /conclavia-skin-influences/);
  assert.match(output, /Math\.max\(window\.devicePixelRatio \|\| 1, 2\)/);
  assert.match(performer, /stabilizePortableHair\(this\.root\)/);
  assert.match(performer, /anchor\.attach\(group\)/);
  assert.match(performer, /WEB_ShowcaseHairHelmet/);
  assert.match(performer, /Epic's low groom LOD uses an opaque helmet/);
  assert.match(performer, /conclaviaHairHelmetAlpha/);
  assert.match(performer, /conclaviaWardrobeVariants/);
  assert.match(performer, /authoredInfluenceSets/);
  assert.match(performer, /material\.color = new THREE\.Color\(0x3f292d\)/);
  assert.match(performer, /conclaviaGroomCoverage = conclaviaGroomCompactAttributes\.r/);
  assert.match(performer, /material\.alphaToCoverage = false/);
  assert.match(performer, /transformed \+= objectNormal \* 0\.004/);
  assert.match(performer, /const wristGap = THREE\.MathUtils\.lerp\(0\.245, 0\.068, contact\)/);
  assert.match(performer, /Number\(state\.performanceElapsedMs\)/);
  assert.match(output, /performanceElapsedMs: elapsed/);
  assert.match(performer, /solveTwoBonePresentation/);
  assert.match(performer, /state\.gesture === "lower-hand"[\s\S]*1 - boundedWeight\(state\.gestureWeight\)/);
  assert.match(performer, /new THREE\.Vector3\(-0\.285, 0\.02, -0\.075\)/);
  assert.match(performer, /const cameraPalmNormal = new THREE\.Vector3\(0, 0, 1\)/);
  assert.match(performer, /middleFingerL/);
  assert.match(performer, /middleFingerR/);
  assert.match(performer, /retargetPortableClip/);
  assert.match(performer, /portableRigNodes/);
  assert.match(performer, /boneNames\.has\("upperarml"\)/);
  assert.match(performer, /boneNames\.has\("facialcfacialroot"\)/);
  assert.match(performer, /trackHasMotion/);
  assert.match(performer, /bodyCorrection/);
  assert.match(performer, /components\.bodyPositions/);
  assert.match(performer, /components\.bodyScales/);
  assert.match(performer, /bodyPositions\.push/);
  assert.match(performer, /bodyScales\.push/);
  assert.match(performer, /#applyApplauseContact/);
  assert.match(performer, /exactIndex\.get\(sourceName\)[\s\S]*normalizedIndex\.get/);
  assert.match(performer, /replace\(\/_\[1-9\]\$\/u, ""\)/);
  assert.match(performer, /this\.root\.getObjectByName\("SkeletalMesh"\)/);
  assert.match(performer, /this\.root\.getObjectByName\("Face"\)/);
  assert.match(performer, /excludedRoots\.has\(node\)/);
  assert.match(performer, /new Set\(\[faceComponent, duplicateBodyComponent\]\.filter\(Boolean\)\)/);
  assert.match(performer, /clone\.name = `\$\{node\.uuid\}\.\$\{property\}`/);
  assert.match(performer, /#enforceClipSegment/);
  assert.match(performer, /#applyFacialAnimation/);
  assert.match(performer, /manifest\.facialClips/);
  assert.match(performer, /#syncFacialLayer/);
  assert.match(performer, /viseme0/);
  assert.match(performer, /viseme1/);
  assert.match(performer, /this\.actionVariants/);
  assert.match(performer, /this\.#applyGaze\(state\.gaze, deltaSeconds\);/);
  assert.match(performer, /segment\.startSeconds/);
  assert.match(performer, /morphTargetInfluences/);
  assert.match(performer, /manifest\.framing\.rotationDegrees/);
  assert.match(performer, /THREE\.MathUtils\.degToRad/);
  assert.match(performer, /fadeIn\(transition\.fadeInSeconds \?\? 0\.46\)/);
  assert.match(performer, /gestureStartedAtMs/);
  assert.match(output, /conclaviaPlaybackDiagnostics/);
  assert.match(server, /RoomEnvironment\.js/);
  assert.match(server, /RectAreaLightUniformsLib\.js/);
  assert.match(server, /api\/performance\/avatar/);
  assert.match(server, /web-performance-timeline\.js/);
  assert.match(server, /model\/gltf-binary/);
  assert.match(server, /animationModels\.map/);
  assert.match(server, /animationModels\.indexOf\(requestedFilename\)/);
  assert.match(server, /failed its meeting-readiness audit/);
});

await test("removes all Web runtime overlays from the OBS feed", async () => {
  const [styles, output] = await Promise.all([
    readFile(new URL("../../public/web-output.css", import.meta.url), "utf8"),
    readFile(outputScriptUrl, "utf8"),
  ]);

  assert.match(output, /conclaviaOutput/);
  assert.match(styles, /data-output="clean"[^}]+runtime-badges/s);
  assert.match(styles, /data-output="clean"[^}]+runtime-card/s);
  assert.match(styles, /data-output="clean"[^}]+#diagnostics/s);
});
