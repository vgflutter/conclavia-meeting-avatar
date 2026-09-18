# Animated 3D characters

At **Avatar → Voice & preview**, select **3D character · Animated** (Italian: **Personaggio 3D · Animato**), then Male or Female. Use the hand, expression and voice controls. Save only when you want the choice applied to meetings. Existing profile, voices, history and meeting permissions are preserved.

These are real skinned 3D characters, replacing the old capsule-based figures. They are **not identical 3D reconstructions of the approved portrait images**. The portrait remains available as a separate 2.5D trial. Visual acceptance still belongs to the user/client; successful animation tests do not establish that the design is approved.

## Browser previews

Actual browser renders, not generated promotional images:

| Male | Female |
| --- | --- |
| ![Male 3D character](images/avatar-rigged-male.png) | ![Female 3D character](images/avatar-rigged-female.png) |
| ![Male with articulated raised hand](images/avatar-rigged-male-hand.png) | ![Female with articulated raised hand](images/avatar-rigged-female-hand.png) |

## What actually moves

- One weighted body per character, with the same arm in every pose. A Blender-exported bone animation is sampled continuously for shoulder, elbow, wrist and fingers. It does not fade between photographs or replace the arm with another drawing.
- A subdivided face with separate vowel/consonant shapes, blink, gaze, brow and smile shapes. The existing PCM output clock and audio envelope drive the lips; no additional synthesis or image-generation call is made.
- Subtle head movement and breathing. Idle rotations are reapplied relative to a saved base each frame, so they cannot accumulate into a twisted neck.
- Reduced motion disables decorative movement/blinking and makes intentional hand changes immediate; expression and speech controls remain functional.

The hand is an avatar gesture, **not** the Teams toolbar raised-hand status. Speech still requires the existing named permission rules. The renderer does not change transcription, prompts, proactive checks, meeting lifecycle or the voice provider.

## Loading, performance and failure

The GLBs and their embedded WebP textures are served by this app. Three.js and the model load only for this style. Shader compilation precedes the ready state; a loading message is shown meanwhile. Lighting uses a local environment, one shadow map and capped pixel density. No new avatar subscription or per-frame cloud rendering is involved.

This adds an initial model download/GPU setup (8.1 MB male, 9.8 MB female, including textures) and a continuous GPU rendering workload, **not another request in the answer-generation pipeline**. It is not a promise of zero impact on slow devices. The illustrated option is lighter. Voice samples still consume Inworld credit unless a synthetic test fixture intercepts them.

Only `/avatars/rigged-v1/male.glb` and `/avatars/rigged-v1/female.glb` are allowed through the temporary tunnel. Management routes and source/build files remain blocked. On fetch failure or unavailable/lost WebGL, an explicit notice accompanies the 2D fallback, without modifying the selected/saved style.

## Asset provenance

Built locally with **Blender 4.5.9 LTS** and **MPFB 2.0.17**. The application does not depend on Blender or MPFB at runtime. MPFB's program is GPL; its bundled character assets and the selected packs are CC0. [MakeHuman license explanation](https://static.makehumancommunity.org/about/license.html) · [MPFB license](https://github.com/makehumancommunity/mpfb2/blob/v2.0.17/LICENSE.md).

Inputs:

- [MPFB 2.0.17 source](https://github.com/makehumancommunity/mpfb2/releases/tag/v2.0.17): base mesh, macro targets and Mixamo-compatible skeleton/weights.
- [System assets, CC0](https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html): middle-age male/female skin, high-poly eyes, teeth, tongue, eyebrows, eyelashes, `short01` male hair and `ponytail01` female hair.
- [Visemes 02](https://static.makehumancommunity.org/assets/assetpacks/visemes02.html) and [Face units 01](https://static.makehumancommunity.org/assets/assetpacks/faceunits01.html): speech and expression targets.
- [Suits 01, CC0](https://static.makehumancommunity.org/assets/assetpacks/suits01.html): MargaretToigo's `toigo_male_suit_3` and `toigo_female_suit`, with new fabric material assignments and subdivided surfaces.
- [Glasses 01, CC0](https://static.makehumancommunity.org/assets/assetpacks/glasses01.html): `spamrakuen_tbm_glasses_frames_01`, credited to spamrakuen / The Base Mesh in the pack metadata.

Character proportions, material treatment, gesture clip and runtime animation were adjusted for Conclavia. No noncommercial-only sample avatar is shipped. The TalkingHead CC0 MPFB sample was inspected as a technical reference, not included in the application.

### Rebuild

The app already includes ready-to-use GLBs; these steps are only for changing the models.

1. Install/run Blender 4.5.9 and extract MPFB tag `v2.0.17` into a build workspace.
2. Extract the five asset ZIPs (system, visemes02, faceunits01, suits01, glasses01) into `<workspace>/data`, preserving their `skins`, `hair`, `clothes`, `custom`, etc. directories.
3. Run from the repository, choosing a temporary output directory rather than the public directory:

```bash
blender --background --factory-startup --python scripts/build-rigged-avatars.py -- \
  --workspace /path/to/avatar-build \
  --mpfb-source /path/to/mpfb2-2.0.17 \
  --output /path/to/avatar-build/export
```

4. Inspect both `.blend` files and rest/mid-gesture/raised/speaking browser renders. Copy only the resulting `.glb` files to `public/avatars/rigged-v1/`, then run the checks below. Bump the asset version when changing already-deployed files.

The build uses a temporary MPFB configuration path; it does not save Blender user preferences. Its downloads and intermediate `.blend` files are not runtime dependencies or committed assets.

Source SHA-256 checksums for the build on 16 September 2026:

```text
mpfb v2.0.17 tar.gz  92409ef66fa1108fa13a9b842048e0568a5a7dec5983cc5ccb728e0696195bbe
system-assets.zip   b542127a8e25547c7c29c19f2d1d2adb9a664c80396ecd694095dbc8028a0107
visemes02.zip       a69ab6fb95ddd5f56f70acc7e859f5f9c6ae613c527d577ea1571eff2183d29e
faceunits01.zip     d113107bd7eb59f3af4df6fc0ec29bfcc593f496d0b336aec14f086a80ce7146
suits01.zip         2b1d8676f3863b188e9eea98c1d8f234543d54c440e791d92b819f8ee1861f19
glasses01.zip       f215c58e09e31b7ee568c814067cb47704cee6da1f6fc01cffb8e9fca37bafdd
```

## Verification

16 September 2026: **31 targeted tests passed**, along with TypeScript, lint and a separate production build. The final assets have 52 skeleton joints each and 21 retained face shapes on the body. The male model has about 85k exported vertices and the female about 114k, including clothing/accessories.

In local Chrome with synthetic PCM, the measured output-clock viseme drift across runs was **25–45 ms**, with **zero audio underruns**. The 95th percentile frame interval during playback was **16.7–16.8 ms**. A separate animation-gap metric did record a 116.6 ms peak during the female screenshot/gesture run (33.5 ms for both characters in the final focused rerun): these are measurements from this machine, not a claim that every frame or client GPU is guaranteed 60 FPS. The tests attach the detailed measurements.

```bash
npm run typecheck -- --incremental false
npm run lint
npm run test:e2e -- tests/e2e/avatar-rigged.spec.ts tests/e2e/avatar-styles.spec.ts \
  tests/e2e/avatar-portrait.spec.ts tests/e2e/avatar-illustrated.spec.ts \
  tests/e2e/female-avatar-motion.spec.ts
NEXT_DIST_DIR=.next-build-verify npm run build
```

Checks use isolated meeting/profile data, disabled analysis providers and synthetic PCM. They cover the **actual GLB** bone hierarchy/morphs, 128 pose combinations, intermediate wrist positions, bounded head movement, audio-clock alignment, silent mouth reset, save/reload, configuration polling, mobile layout, fetch/context failure and tunnel access restrictions.

These are local browser checks, **not received Teams video/audio validation**. They do not resolve the separate speech-recognition investigation or prove performance on all client GPUs.
