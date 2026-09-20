# Animated portrait 2.5D

Latest engineering check: [20 September pre-commit verification](verification-2026-09-20.md). Visual evidence and renderer limits are documented below.

The `portrait_2_5d` style animates the existing male and female portraits with a texture rig: coordinated lips/jaw, registered eyelids, a separate transparent arm and brief listening adjustments. It retains the original face and clothing throughout a gesture. It does not reconstruct a 3D person or generate talking-head video.

## Preview and save

1. Open `/avatar/test` (**Voice & movement / Voce e movimenti**) and choose **Portrait 2.5D / Ritratto 2.5D**.
2. **Play animation / Avvia animazione** runs a nine-second silent sequence of connected mouth shapes, pauses and a hand gesture. It makes no provider requests or saves, stops immediately on request and stops when the tab is hidden. This is a visual demonstration, not an audio-sync measurement.
3. Change appearance, raise/lower the hand or change expression. Brief listening actions and blinking also run automatically without starting the sequence, unless reduced motion is enabled. The identity page `/avatar` uses the same renderer.
4. **Listen to voice / Ascolta la voce** uses the configured Inworld service and can consume voice credit. Actual playback takes over from the silent sequence; the renderer follows its existing visemes and audio energy.
5. Save explicitly to apply the selected style to meetings. Preview changes do not save the profile, replace the voice or start a meeting bot.

## Runtime assets

| Asset | Current use |
| --- | --- |
| [`portraits-2-5d-adult-v3.png`](https://github.com/vgflutter/conclavia-avatar-kit/blob/main/src/assets/avatar/portraits-2-5d-adult-v3.png) | Resting male/female face and body, left atlas column |
| [`portraits-2-5d-adult-features-v3.png`](https://github.com/vgflutter/conclavia-avatar-kit/blob/main/src/assets/avatar/portraits-2-5d-adult-features-v3.png) | Registered closed eyelids, teeth and oral cavity; no replacement facial skin or lips |
| [`portraits-2-5d-arm-layers-v2.png`](https://github.com/vgflutter/conclavia-avatar-kit/blob/main/src/assets/avatar/portraits-2-5d-arm-layers-v2.png) | Transparent sleeve/cuff/hand, right atlas column |

Each character cell is 627 × 627 pixels. The shader clamps sampling to the selected cell and clips letterboxes, so adjacent portraits cannot bleed into tall/wide layouts. Next serves imported assets under `/_next/static/media/`; rendering does not fetch a generator output or require a profile migration.

These assets were produced with the built-in imagegen editing tool. The adult atlas prompts and selected outputs are recorded in [the artwork record](avatar-portrait-artwork-2026-09-19.md). The earlier `v1` atlases remain source history and are not the current portrait imports. The latest animation refinements change code, not artwork.

## Animation architecture

| Source | Responsibility |
| --- | --- |
| [`PortraitAvatar.tsx`](https://github.com/vgflutter/conclavia-avatar-kit/blob/main/src/components/PortraitAvatar.tsx) | Decode assets, load renderer on demand, expose current pose and select fallback |
| [`portrait-animation.ts`](https://github.com/vgflutter/conclavia-avatar-kit/blob/main/src/lib/portrait-animation.ts) | Viseme/audio targets, restrained mouth width, speech activity, blink and expression targets |
| [`portrait-motion.ts`](https://github.com/vgflutter/conclavia-avatar-kit/blob/main/src/lib/portrait-motion.ts) | Mouth interpolation, damped arm/shoulder/torso response, expression transitions and body deformation |
| [`portrait-idle.ts`](https://github.com/vgflutter/conclavia-avatar-kit/blob/main/src/lib/portrait-idle.ts) | Discrete listening actions and local head/neck field |
| [`portrait-renderer.ts`](https://github.com/vgflutter/conclavia-avatar-kit/blob/main/src/lib/portrait-renderer.ts) | Texture registration, lip/jaw/eyelid shader, articulated arm and render lifecycle |

### Mouth and expression

Both lips retain their original texture. A calibrated curved seam separates a small upper-lip lift, lower-lip travel and a broader mandibular response. The upper influence ends below the nose. Only the opening samples teeth/oral-cavity pixels from the feature atlas; there is no pasted-on lip/skin patch.

Opening and width follow bounded audio amplitude above the `.025` noise floor. O/U narrow the surface by at most 6%/10%, with less narrowing on quiet syllables; their internal aperture rounds without pulling the corners further inward. Progressive and lateral occlusion keep tiny openings from exposing a full bright dental strip. The teeth remain registered to the upper jaw instead of stretching with the lower lip.

Mouth coarticulation uses a **22 ms exponential time constant**, approximately 95% convergence in 66 ms, not a fixed 22 ms delay. New targets replace previous targets directly; there is no phoneme queue. Rest, M/B/P, silence and stop close the opening on the next rendered frame without a decay tail.

The friendly smile relaxes during a phrase. This response follows audio energy separately from aperture, so a closed M/B/P consonant does not flash back to a grin. Its 45 ms approach does not delay phonemes; silence/stop restores the resting expression immediately. User-selected mood changes have an independent 120 ms response and continue from the currently rendered expression when interrupted. Reduced motion applies the selected mood immediately while preserving speech articulation.

### Hand, shoulders and seated base

A subdivided planar mesh carries the transparent forearm, cuff and hand from the lap around the elbow, with wrist follow-through. The trajectory leads outside the face. The shoulder starts before the forearm; the torso settles afterward. Analytic damping preserves velocity on reversal and avoids oscillation at different frame rates.

The arm stays attached to its deformed elbow. Its geometry updates only as the gesture changes; a vertex transform carries its attachment between updates. The face uses the same resting portrait throughout, with no crossfade between poses. The waist and portrait crop remain anchored. Reduced motion makes intentional gesture/shoulder poses immediate.

### Waiting and eyelids

Waiting has complete stops, not continuous side-to-side sway or sinusoidal head/speech lean. A 61-second schedule contains a brief local inclination around 3.2 seconds, a short head-settling action around 12.6 seconds, a separate shoulder adjustment around 23.4 seconds and a smaller inclination around 34.8 seconds. Head actions occupy less than 9% of the schedule. Eyes, nose and lips move together; the neck blends back to zero displacement by normalized portrait height 0.64. A head action cannot rotate the forearm.

Minimal chest expansion remains, with a small sustained speech offset. Speech and gesture activity suppress waiting actions. No independent gaze or pupil warp is simulated.

A descending eyelid covers the iris progressively, avoiding a translucent open-eye/closed-eye crossfade. The irregular 47-second blink schedule includes one occasional double blink. Its envelope closes over 70 ms, holds 25 ms and reopens over 140 ms. Reduced motion disables automatic waiting, breathing and blinking.

### Lifecycle and fallback

Rendering caps device pixel ratio at 1.5. Hidden tabs stop drawing and do not accumulate missed posture time. On unmount or failure, textures, geometries, materials and WebGL resources are released. Missing artwork, shader failure or lost WebGL selects the illustrated fallback with a visible notice; it does not change the saved style. The related illustrated and skinned styles are documented in [Avatar styles](avatar-styles.md).

## Current visual evidence

The latest mouth review completed three modification/capture/critique cycles: separate lip/jaw motion, rounded aperture with progressive tooth occlusion, then phrase-level smile relaxation and lateral occlusion. These are actual renderer captures, not regenerated artwork:

- [Before/after faces at 100% source-pixel scale](images/portrait-motion/anatomy-face-100-percent.png), [four A-onset stages](images/portrait-motion/lip-onset-after.png), [full vowel sheet](images/portrait-motion/lips-contact-sheet.png) and [small syllables](images/portrait-motion/lips-small-openings.png). The onset guide marks sit outside the face and indicate the central upper/lower aperture margins.
- The same connected silent sequence, recorded at native 627-pixel resolution: [male before](images/portrait-motion/male-anatomy-before.webm), [male current](images/portrait-motion/male-anatomy-after.webm), [female before](images/portrait-motion/female-anatomy-before.webm), [female current](images/portrait-motion/female-anatomy-after.webm).
- Current discrete waiting behavior, recorded for 40 seconds: [male](images/portrait-motion/male-waiting.webm), [female](images/portrait-motion/female-waiting.webm) and [sampled actions/stops](images/portrait-motion/waiting-discrete-frames.png). These clips demonstrate the waiting model; they predate the latest mouth revision and contain no speech.
- [Eyelid progression](images/portrait-motion/eyes-contact-sheet.png) and the latest shared rehearsal on the isolated application: [male UI](images/portrait-motion/business_clay-anatomy-ui.png), [female UI](images/portrait-motion/business_clay_female-anatomy-ui.png).

Direct-renderer checks at native 627-pixel size and a 410-pixel canvas found approximately 1–2 pixels of upper-lip motion in the sampled A/U frames, no nose change, exact restoration after stop and selected O/U corner references within 1–3 pixels horizontally. On the isolated port-3103 application, both appearances rendered the shared rehearsal and stopped closed, without browser errors or mutation requests. Targeted lint and the owned-file diff check passed.

The coordinated application regression, final production recordings and build result are recorded in the [integrated refinement report](avatar-refinement-2026-09-19.md#integrated-checks-completed-20-september-2026). The bounded upper-lip, fixed-nose and exact-stop pixel checks passed for both appearances.

## Tests and reproduction

Current coverage checks rendered pixels as well as motion state:

| Test | Invariants |
| --- | --- |
| [`portrait-lips.spec.ts`](../tests/e2e/portrait-lips.spec.ts) | Two synthetic A levels produce useful upper-lip movement; original texture matches within 1–3 pixels upward; lower lip/jaw changes; nose stays fixed; stop restores pixels exactly |
| [`avatar-portrait.spec.ts`](../tests/e2e/avatar-portrait.spec.ts) | PCM/audio-clock behavior, vowels, cheek preservation, O/U corner travel bounded to five atlas pixels, silence, fallback, clipping, saved/draft isolation and meeting-renderer compatibility |
| [`portrait-motion.spec.ts`](../tests/e2e/portrait-motion.spec.ts) | Frame-rate agreement, reversal, reduced-motion gestures, quiet amplitude, conservative width, causal coarticulation, closed-consonant expression and silent preview isolation |
| [`portrait-posture.spec.ts`](../tests/e2e/portrait-posture.spec.ts) | Shoulder/forearm/torso ordering, stable face/waist, settling and non-folding body field |
| [`portrait-idle.spec.ts`](../tests/e2e/portrait-idle.spec.ts) | Real quiet intervals, zero lateral translation/idle torso lean, separate head/shoulder episodes, rigid facial distances, hidden-tab continuity and reduced-motion stillness |
| [`portrait-expression.spec.ts`](../tests/e2e/portrait-expression.spec.ts) | Irregular/asymmetric blinks, expression settling and interruption without triggering speech |
| [`portrait-visual.spec.ts`](../tests/e2e/portrait-visual.spec.ts) | Actual canvas recordings and stable-face gesture checks |

Use the temporary MongoDB at `127.0.0.1:27018`, never the SSH-connected application database. The Playwright configuration selects an isolated database, mocks voice calls and disables external bots/AI. Preserve `.env.local`, saved settings and the pre-existing `.env.example` deletion.

```sh
env MONGODB_URI=mongodb://127.0.0.1:27018 npm run test:e2e -- tests/e2e/avatar-portrait.spec.ts tests/e2e/portrait-motion.spec.ts tests/e2e/portrait-posture.spec.ts tests/e2e/portrait-idle.spec.ts tests/e2e/portrait-expression.spec.ts tests/e2e/portrait-lips.spec.ts tests/e2e/portrait-visual.spec.ts tests/e2e/streaming-playback.spec.ts
npm run lint
npm run typecheck
env NEXT_DIST_DIR=.next-build-avatar MONGODB_URI=mongodb://127.0.0.1:27018 MONGODB_DB_NAME=conclavia_e2e_portrait_build MEETING_BOT_PROVIDER=preview MEETING_AI_ENABLED=false npm run build
```

Silent canvas clips establish visual behavior only. Synthetic PCM tests exercise the browser player and renderer; they do not establish microphone transcription, Teams admission, participant reception or a universal latency guarantee. The separate [speech-recognition report](caption-recognition-2026-09-13.md) remains outside this work.

## Limits and superseded approaches

This calibrated texture rig cannot reproduce forward lip protrusion, volumetric tongue/teeth motion, independent fingers or a full talking head. O/U remain restrained approximations. Regression results protect behavior; they do not substitute for visual acceptance or certify every GPU/device.

Earlier iterations are retained only as comparisons:

- Whole-patch mouth replacement caused visible seams. [Earlier small openings](images/portrait-motion/lips-small-openings-before.png) and [the later hinge baseline](images/portrait-motion/anatomy-baseline.png) show superseded mappings. **An exactly pinned upper lip is no longer an invariant**: it reinforced the hinge effect. Current tests require bounded articulation instead.
- Strong O/U compression pinched the corners; [the width comparison](images/portrait-motion/lips-width-comparison.png) records that correction. The 6%/10% width bounds remain current, while its older aperture/jaw motion has since changed.
- [First anatomy cycle](images/portrait-motion/anatomy-cycle1.png) and [second cycle](images/portrait-motion/anatomy-cycle2.png) document intermediate results, before the current phrase-level smile relaxation.
- Continuous waiting sway and eye crossfades were replaced. [Previous eyelids](images/portrait-motion/eyes-before.png) and the earlier [presence-review report](avatar-presence-review-2026-09-19.md) provide historical context, not current mouth acceptance or integrated test results.
