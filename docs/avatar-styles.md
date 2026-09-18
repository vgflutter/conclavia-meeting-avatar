# Avatar styles

At `/avatar` or `/avatar/test`, choose **Avatar style** (editorial 2D / portrait 2.5D trial / **3D character · Animated**) separately from **Avatar appearance** (male / female). Changes stay in the shared draft between both tabs. **Save avatar** applies them to the meeting renderer; **Discard changes** restores the saved choices. Switching style alone does not change the name or either language's voice. Existing profiles and clients default to 2D and omitted style fields do not overwrite a saved choice.

16 September: the primitive procedural 3D figures have been replaced with **actual rigged male/female meshes**. [Current previews, build/provenance and checks](avatar-rigged-3d.md). The original portrait is retained as a separate image-based trial; it is not the source of a claimed photorealistic 3D reconstruction.

## Approved-look portrait trial (16 September 2026)

**Portrait 2.5D · Preview** preserves the approved male/female artwork with a local texture rig: gentle breathing/head motion, blinking, subtle brow/smile expressions and simplified visemes driven by the existing audio clock. The expression control is available again. The hand blends between registered resting/raised portraits over 280 ms; it is **not** an articulated 3D arm or generated video. Voice playback remains unchanged.

The original portrait atlas plus a registered mouth/closed-eye texture load from bundled static assets, including through the restricted meeting tunnel. Only small feathered facial regions use the new texture. No image-generation service is contacted at runtime. WebGL loads on demand; reduced motion disables idle movement/blinking and makes the hand transition immediate, while speech and expression controls still work. Missing assets or unavailable/lost WebGL display an explicit notice with the existing animated 2D fallback, without changing the saved selection. [Artwork provenance, prompt and implementation scope](avatar-portrait-2-5d.md).

## Animated 2D and 3D options

The 2D artwork separates the resting arm from the torso; raising the hand replaces that arm at the shoulder instead of adding an arm over the chest. The current 3D version loads two local GLB models, with weighted meshes and a continuous shoulder/elbow/wrist/finger animation. Both use the existing PCM-clock visemes and envelope; the renderer adds no synthesis call, wake-name change or speech-permission rule.

3D loads on demand and requires WebGL 2. The pixel ratio is capped at 1.75 and geometry/materials/textures/render loops are disposed when switching away. Breathing/blinks respect reduced motion; intentional gestures and speech still work. If a model cannot load, WebGL is unavailable or its context is lost, a visible notice accompanies the animated 2D fallback without silently changing the saved style. The 2D default remains the lighter option. No additional avatar provider or recurring service fee is introduced; actual voice previews still consume Inworld credit.

## Verification boundaries

15 September 2026: **65 targeted regression tests passed**, plus lint, TypeScript and a production build. A read-only browser check also rendered 3D on the existing local server with no page errors, no save and no voice playback.

Isolated browser tests cover all four style/appearance combinations, attached arms, expression/viseme combinations, synthetic PCM playback, draft/save/reload, old clients, invalid styles, live renderer configuration polling, mobile layout and loss of the WebGL context. These tests do **not** certify the design's client acceptance, GPU performance on every device, or received audio/video/lip sync in Teams. A real Teams run is still needed for 3D reception and performance.

Renderer reference: [Three.js WebGLRenderer lifecycle and capabilities](https://threejs.org/docs/pages/WebGLRenderer.html).

## Separate dependency follow-up

The installation audit on 15 September 2026 also reports existing findings in Next.js 16.3.0, sharp 0.35.3 and js-yaml 4.3.1. Those versions were already present before the avatar changes; Three.js and its types are not flagged by this audit. No unrelated framework upgrade was applied during this design change. Schedule a dedicated dependency upgrade and regression check before exposing a production pilot.
