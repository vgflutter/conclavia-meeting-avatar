# Animated portrait 2.5D

The user approved the adult, blue-blazer male and terracotta-blazer female concept on 16 September 2026 and selected an image-based trial. The old procedural 3D was not visually acceptable. This implementation does **not** claim to reconstruct the approved concept as a 3D mesh.

## Try it

1. Open `/avatar/test` and choose **Portrait 2.5D · Preview** / **Ritratto 2.5D · Prova**.
2. Switch between male/female and use **Raise / lower hand** and **Change expression**. Head motion and blinking run automatically unless reduced motion is enabled. These visual checks use no voice credit.
3. **Listen to voice** still uses Inworld credit. The mouth follows the existing visemes/audio envelope and closes on silence or stop. Rendering adds no synthesis/AI call.
4. Save explicitly to use this style in meetings. Merely opening or previewing it does not alter the saved profile, voice or active bot.

## What is and is not implemented

- The original atlas contains male-rest, male-raised, female-rest and female-raised. The new shader explicitly clips/clamps each cell: tall and wide viewports cannot reveal a neighbouring portrait, fixing the reported extra female head below the male preview.
- Local texture deformation provides breathing, gentle head tilt and subtle brow/smile expressions. Closed-eye texture patches provide blinking. These are image-based effects, not a reconstructed mesh or full facial motion capture; independent gaze tracking is not implemented.
- A registered speaking-mouth patch is reshaped for A/E/O/U/FV/consonants. Rest, M/B/P and silence keep the original closed mouth. Visemes are applied without a smoothing queue, following the existing PCM clock. It is simplified lip sync, not phoneme-perfect generated video or proof of reception in Teams.
- The hand transitions over 280 ms between two registered poses. It is a crossfade, not a jointed arm travelling through a physical trajectory. Reduced motion disables breathing/head/blink and makes this transition immediate; intentional expressions and speech remain active.
- The existing illustrated 2D and procedural 3D choices retain their current gestures and PCM-driven visemes.
- The renderer loads on demand, caps pixel ratio at 1.5, pauses drawing in hidden tabs and disposes GPU resources when unmounted. Missing artwork or unavailable/lost WebGL uses the animated illustrated fallback with an explicit notice. The selected style remains unchanged.

## Artwork and reproducibility

Runtime asset: [`src/assets/avatar/portraits-2-5d-v1.png`](../src/assets/avatar/portraits-2-5d-v1.png). The selected output is copied into the repository; runtime does not rely on the generator's local output folder. Next.js serves the imported asset under `/_next/static/media/`, already permitted by the public meeting proxy; no management route is opened.

Tool: built-in **imagegen**, image edit mode (no CLI/API-key fallback). Source: the approved square four-portrait concept generated in this conversation. The edit removes labels only, preserving the visual direction. Exact final edit prompt:

> Use case: precise-object-edit. Input image 1 is the edit target, a user-approved 2x2 avatar portrait sprite sheet. Change ONLY this: remove all four text labels completely, filling those small areas with their surrounding ivory background. Preserve every character's face, identity, hair, glasses, clothing, hands, pose, scale, lighting, framing and the exact 2-by-2 grid layout. Keep all four complete portraits in the SAME positions, male upper row, female lower row, resting left column, raised hand right column. Do NOT crop, rearrange, add new text, redraw the people, or change style. Keep image square with four equal square quadrants. No other modifications.

Animation texture: [`portraits-2-5d-features-v1.png`](../src/assets/avatar/portraits-2-5d-features-v1.png), generated with built-in imagegen, edit mode, from the original runtime atlas. Source output: `exec-6c92022c-756f-4a5b-8551-0f79a2dad9ca.png`. Only feathered eye/mouth regions are sampled, with per-pose landmark registration; its changed background is never used. The first mouth-only attempt timed out and was not incorporated. No CLI/API-key fallback was used. Exact successful prompt:

> Edit target: the provided 2x2 avatar sprite atlas. Preserve exact positions, sizes, identity, clothes, hands, background and framing of all four portraits. Change ONLY eyes and mouths: all four characters have eyes gently CLOSED (natural blink, keep glasses) and mouth moderately OPEN speaking AH with upper teeth and a dark cavity, relaxed not screaming. This is an animation texture; no other changes, no repositioning or cropping, same male top row and female bottom row, resting left and raised hand right, exact same 2x2 layout. No text.

## Verification boundary

16 September 2026: **25 targeted tests passed**, plus lint, TypeScript and a separate production build. The final synthetic PCM run measured rendered mouth changes approximately **18–35 ms** after the browser audio clock, with **zero buffer underruns**, on the local Chrome test environment. Both appearances/poses were visually inspected; O/U cheek deformation found during inspection was corrected and guarded by pixel comparisons with the original atlas. Saves occurred only in an isolated test database; no real bot or paid voice was started. Live Teams reception, other hardware and design approval remain separate checks.

`tests/e2e/avatar-portrait.spec.ts` covers the four poses, expressions, phonemes and silence, rendered visemes versus the audio output clock, draft isolation, save/reload/legacy fields, public meeting polling, tunnel-safe assets with management blocked, image/context failure, reduced motion/mobile layout and **pixel checks of tall/wide letterboxing**. Tests do not certify every GPU or microphone-to-Teams synchronization.
