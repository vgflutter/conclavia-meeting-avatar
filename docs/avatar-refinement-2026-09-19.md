# Avatar articulation and visual refinement

The user's rejection identified two distinct problems: the 2.5D mouth opened mainly through the lower lip, and the illustrated/3D treatment still looked artificial. Three separate implementation tasks reviewed actual rendered sequences, then revised the first results instead of treating passing motion tests as visual approval.

## Current changes

- **Portrait 2.5D:** the original upper lip, lower lip and jaw now move by different, coordinated amounts. The upper influence ends below the nose. O/U change the internal aperture while preserving the restrained corner travel; teeth appear progressively and the resting smile relaxes during a phrase. M/B/P closures preserve that speech expression; silence and stop restore the original mouth immediately. [Renderer, tests and before/after recordings](avatar-portrait-2-5d.md).
- **Editorial 2D:** revised contour weights, hair, glasses and tailoring; filled lip volumes and distinct A/E/O/U shapes. The upper lip and actual face/clip outline follow speech with bounded movement. The first cheek highlights, beard mask and rectangular sleeve shadows were rejected during review and removed. The torso stays fixed and the hand rests below the waist. [Illustration, recordings and tests](avatar-editorial-2d.md).
- **3D character:** relaxed finger curvature and an oblique palm replace the flat, fully spread hand. Surface and lighting revisions address bright hair pinholes, protruding eyelash strips, reflective glasses and excessive cloth patterning. The source meshes remain stylized; material changes do not create a captured or photorealistic person. [Rig, materials and evidence](avatar-rigged-3d.md).

The shared nine-second **Avvia animazione / Play animation** sequence now connects phonemes into three phrases with two actual pauses. The earlier roughly 30 ms silent gaps after every phoneme exaggerated the hinged appearance. This is a silent visual sequence; the real PCM-driven speech clock is unchanged, and no voice-provider calls or saves occur.

## Reproduce the review

Open `/avatar/test`, choose each of the three styles and either appearance, then start the animation. Inspect the approach to the raised hand, small and larger mouth openings, return to rest and immediate closure on manual stop. Leave the avatar at rest to observe separate waiting actions with holds between them. Changes remain in the existing draft until explicitly saved.

`scripts/review-avatar-articulation.mjs` records this actual product sequence for all six variants. It enlarges only the preview wrapper to 720 × 720 for inspection, retaining the real component, controls and timing. It records native browser video, sampled frames and renderer diagnostics, blocks mutation requests, and checks the final idle state and browser errors. Use an isolated local application configured with temporary MongoDB at `127.0.0.1:27018` and a `conclavia_e2e_*` database:

```sh
node scripts/review-avatar-articulation.mjs --url http://127.0.0.1:3102 \
  --output /tmp/conclavia-articulation-after
```

These browser checks establish local rendering behaviour, not Teams reception, speech recognition or artistic acceptance. The 2.5D texture rig cannot recreate forward lip protrusion or volumetric teeth/tongue anatomy, and the 3D source model remains a visible quality boundary.

## Final production recordings

The following clips capture the final standalone build, with both appearances following the real product sequence. The browser recording includes the initial page setup before the enlarged preview appears. The [gesture comparison](images/avatar-refinement/gesture-before-after.png) uses the prior standalone build as its baseline, captured before rebuilding. For the portrait's mouth specifically, use the matched native-size before/after recordings in the [portrait review](avatar-portrait-2-5d.md).

| Style | Male | Female | Sampled sequence |
| --- | --- | --- | --- |
| Editorial 2D | [Video](images/avatar-refinement/editorial-business_clay.webm) | [Video](images/avatar-refinement/editorial-business_clay_female.webm) | [Frames](images/avatar-refinement/editorial-sequence.png) |
| 3D character | [Video](images/avatar-refinement/stylized_3d-business_clay.webm) | [Video](images/avatar-refinement/stylized_3d-business_clay_female.webm) | [Frames](images/avatar-refinement/stylized_3d-sequence.png) |
| Portrait 2.5D | [Video](images/avatar-refinement/portrait_2_5d-business_clay.webm) | [Video](images/avatar-refinement/portrait_2_5d-business_clay_female.webm) | [Frames](images/avatar-refinement/portrait_2_5d-sequence.png) |

All six recordings ended in the idle state with no JavaScript errors or mutation requests: [capture report](images/avatar-refinement/review.json). Separate longer observations are linked in each renderer's document; these include waiting holds, glances, blinks and gesture reversals.

## Integrated checks, completed 20 September 2026

The subsequent [pre-commit verification](verification-2026-09-20.md) expands coverage to all changed regression files and refreshes the README screenshot workflow. The results below record the earlier visual-refinement run.

The coordinated suite covered **90 distinct tests**. **89 passed on the initial run**; the remaining 2D waiting test installed Playwright's clock after the renderer had already queued a native animation frame. Installing and pausing the clock before navigation fixes that test boundary. The corrected test passed **three consecutive runs**, retaining head, gaze, blink, fixed torso and live reduced-motion assertions, and adding a check of local collar breathing. No renderer change or relaxed motion assertion was needed for this failure.

The final code passed lint, TypeScript, the production build with `NEXT_DIST_DIR=.next-build-avatar`, and `git diff --check`. Tests/build and the isolated standalone server used only temporary MongoDB at `127.0.0.1:27018`, with `conclavia_e2e_*` databases. The original port-3000 app, `.env.local`, saved preferences and pre-existing `.env.example` deletion were preserved.

Synthetic PCM measurements in this run were approximately **38–41 ms for 2.5D**, **41–43 ms for 3D**, and **17–18 ms for the tested female 2D renderer**, relative to the browser output clock. All five captured playback reports had zero underruns; maximum player animation intervals were about 33.4–33.5 ms. These are local measurements from this machine, not Teams acceptance or a guarantee for other GPUs.

The final standalone smoke check also exercised every appearance through the real desktop controls, verified immediate closure on manual stop, and fitted all three styles into a 390 × 844 viewport. JavaScript errors and mutation requests were empty. `/avatar/test`, `/api/avatar`, `/context` and `/api/meetings` returned 404 with the public proxy host. [Production smoke report](images/avatar-refinement/production-smoke.json).

`localhost:3000/avatar/test` returned 200. The existing tunnel passed its public health and management-route checks without restarting either it or the app. Owned temporary review servers were stopped. No Teams participant or provider-generated audio was part of these checks.
