# Editorial avatar 2D

Latest engineering check: [20 September pre-commit verification](verification-2026-09-20.md). Visual evidence and renderer limits are documented below.

The existing male and female SVG portraits now use one articulated animation rig. Their saved appearance IDs, voice pairing and lightweight fallback role are unchanged. The palette uses muted blue and terracotta tailoring, a restrained hierarchy of contour weights, coherent cloth and hair shading, and a subtle skin gradient; no external raster assets or WebGL are required.

## Motion and speech

- A single mouth contour interpolates width, rounding and audio-proportional opening with a 22 ms time constant. The upper lip moves by less than one SVG unit, coordinated with opening; most movement stays in the lower lip and jaw. Rounded O/U vowels reshape the upper border and withdraw the teeth instead of displaying a narrower smiling A. Teeth remain clipped to the cavity. The jaw deforms both the face outline and its clip by up to 2.8 SVG units, while eyes and nose keep their positions. Silence, stop and closed consonants close the cavity in the same layout update, without waiting for a CSS fade.
- The resting arm hangs vertically beside the body. Its wrist sits below the bottom of the portrait, so the hand cannot rest on the chest or abdomen. The same forearm rises along the outside of the body; a projected elbow/wrist trajectory keeps the intermediate sleeve readable. Its fill overlaps the upper sleeve without a transverse elbow outline. Fingers relax at rest and open continuously during the raise; there is no opacity swap between arm drawings.
- The torso stays fixed: there is no whole-body rotation, breathing translation or speech-driven head sinusoid. Independent finite actions provide presence: eyes acquire a point before the head follows, then return to sustained camera contact; a rare small nod and a separate forearm adjustment occur between long quiet intervals. Breathing affects only a sub-pixel collar expansion. Speech and hand raising attenuate these idle actions. Reduced motion suppresses idle movement and snaps explicit gestures while preserving speech articulation. Hidden tabs pause the local animation clock; unmount cancels the animation frame.

Implementation: `BusinessAvatar.tsx`, `BusinessAvatar.module.css`, `useEditorialMotion.ts` and `editorial-motion.ts` in the shared [`conclavia-avatar-kit`](https://github.com/vgflutter/conclavia-avatar-kit/blob/main/README.md). The Meeting files are compatibility re-exports. The public component API is unchanged; 2.5D and 3D still use the editorial renderer as their fallback.

## Review and verification

Open `/avatar/test`, select the editorial 2D style and either appearance. **Play animation / Avvia animazione** runs the shared nine-second silent rehearsal without voice credits or saving preferences. For idle movement, leave the preview at rest for several seconds. Real voice playback is a separate action.

Focused regression command, using only the temporary test database:

```sh
env MONGODB_URI=mongodb://127.0.0.1:27018 npm run test:e2e -- tests/e2e/editorial-animation.spec.ts tests/e2e/avatar-illustrated.spec.ts tests/e2e/female-avatar-motion.spec.ts
```

Coverage includes frame-rate independence, gesture reversals, invalid/silent energy, immediate mouth closure, bounded upper-lip movement, real UI pose controls, clipped mouth geometry, both appearances, responsive fitting and live reduced-motion changes. Forty-second browser observations measure the actual rendered torso bounds and hand position relative to the waist, and verify sustained held poses between independent head/gaze actions. Synthetic PCM checks measure browser playback and visual articulation only; they do not validate a Teams conversation.

The renderer remains an editorial SVG illustration: hand contour changes are stylized and the phoneme rig approximates speech, rather than simulating facial anatomy.

Current production-browser recordings: [male](images/editorial-motion/male.webm), [female](images/editorial-motion/female.webm). These include the real SVG and product controls, without voice requests or saves. [Combined three-style validation and mobile captures](avatar-styles.md).

Sampled recording frames: [male](images/editorial-motion/male-contact-sheet.png), [female](images/editorial-motion/female-contact-sheet.png).

## Long visual observations

The revised rest pose and motion timing are recorded from the actual local browser, without saving preferences or requesting speech:

- [Male, identity view, 40 seconds](images/editorial-motion-v2/business_clay-40s.webm)
- [Female, voice and movements view, 40 seconds](images/editorial-motion-v2/business_clay_female-40s.webm)

The JSON observations alongside the clips record the rendered body transform and hand/waist positions. These recordings complement the initial, intermediate and raised gesture screenshots; static screenshots alone cannot establish that idle movement has meaningful pauses.

## Illustration and articulation refinement

Two completed visual review cycles, followed by a final correction, are preserved under `docs/images/editorial-refinement/`:

1. `cycle-1/`: thinner and differentiated contours, hair strands, revised glasses, iris/pupil detail, cloth shading and initial face planes. The review rejected the oval cheek highlights and a geometric beard mask, and found excessive teeth visibility on rounded vowels.
2. `cycle-2/`: removed those cheek patches and the beard mask; replaced the latter with a faint continuous jaw tint. Added filled upper/lower lip volumes and distinct rounding for O/U, with progressively hidden teeth.
3. `final/`: removed rectangular cloth shadow patches and reduced the lighting contrast between sleeve and jacket. The upper lip now has bounded movement coordinated with the jaw, rather than being rigidly pinned. The actual face outline and clip follow the lower jaw. The raised wrist has a small inward inclination and the sleeve cap follows the gesture locally; the torso remains fixed.

Both identities have actual browser screenshots for rest, A/E/O/U, close-ups, raised hand and gesture reversals. Final `*-presence-gesture.webm` clips contain 32 seconds of undisturbed waiting followed by raising, lowering, reversal and return. The matching JSON files record actual torso bounds and hand position. These are synthetic browser rendering checks, not provider voice or Teams acceptance.

The final browser regression additionally checks all four vowel contours, lip containment within the face, tooth withdrawal during rounded vowels, coordinated face/clip deformation and exact closure on stop. Existing tests retain arm-at-side and stable-torso regressions.

## Shoulder proportions correction, 20 September 2026

The previous visual review missed an oversized viewer-left shoulder and sleeve. Its separately drawn contour flared beyond the relaxed articulated arm on the opposite side. This was particularly conspicuous with the hand raised; the earlier recordings above retain that defect.

Both relaxed sleeves now use the same upper-arm and forearm proportions, reflected around the torso centre. The shading is reflected back so the jacket lighting remains continuous. The upper sleeve curves into the elbow, and raising the other arm leaves the corrected resting shoulder unchanged. Both male and female illustrations use this correction, including the editorial fallback.

The new browser regression samples the filled jacket silhouette at six heights, accounting for nested SVG transforms. At rest, the two sides must differ by no more than four SVG units; the viewer-left contour must stay fixed during the hand raise. It complements the existing mouth, reverse-gesture, reduced-motion and mobile checks.

Current browser evidence from `/avatar/test`, with non-GET requests blocked:

| Appearance | Previous raised pose | Corrected rest | Corrected raised pose | Complete silent sequence |
| --- | --- | --- | --- | --- |
| Male | [Before](images/editorial-shoulder/business_clay-before.png) | [Rest](images/editorial-shoulder/business_clay-rest.png) | [Raised](images/editorial-shoulder/business_clay-raised.png) | [Motion](images/editorial-shoulder/business_clay-motion.webm) |
| Female | [Before](images/editorial-shoulder/business_clay_female-before.png) | [Rest](images/editorial-shoulder/business_clay_female-rest.png) | [Raised](images/editorial-shoulder/business_clay_female-raised.png) | [Motion](images/editorial-shoulder/business_clay_female-motion.webm) |

These captures supersede the older silhouette evidence. They involve no voice-provider requests or saved preferences. Verification results are recorded in the [20 September report](verification-2026-09-20.md#shoulder-correction-follow-up).
