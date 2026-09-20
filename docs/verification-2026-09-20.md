# Pre-commit verification, 20 September 2026

This review covers the pending three-avatar refinement, shared silent animation, interface labels, documentation and visual artifacts. The application changes are described in [the visual refinement report](avatar-refinement-2026-09-19.md); its recordings remain the evidence for motion and appearance.

## Results

| Check | Result |
| --- | --- |
| ESLint | Passed globally; the two subsequently corrected test files also passed targeted lint |
| TypeScript | Passed again after the test corrections |
| Isolated script suite | 36 passed |
| Changed application regression files | 120 cases across 22 files: 119 passed initially; the remaining case passed in a complete 12-test rerun of `meeting-assistant.spec.ts` |
| Documentation capture | 1 passed; refreshed ten desktop screenshots with fictional records |
| Production build | Passed with `NEXT_DIST_DIR=.next-build-avatar` |
| Diff and documentation | No whitespace errors; local file links and heading anchors checked |
| Existing app | `/avatar/test` on port 3000 returned 200; the app was not restarted |

The expanded run found an outdated assertion in the single-meeting test: the existing public state API already includes `visualStyle`, but the test expected only `appearance`, `status` and `voice` and assumed an SVG renderer. The correction retains an exact public-field allowlist, checks the saved style and waits for the selected renderer. No production API change was made to satisfy the test. The other eleven cases in that file also passed on rerun.

The documentation workflow still selected the retired **Voice to preview** label. It now selects **Voice**, explicitly sets/restores the isolated visual style and waits for the rendered raised-hand position before capture. The refreshed female studio and meetings overview were visually inspected. Paid voice requests and external navigation remain blocked in this capture.

## Reproduction

Use only the temporary MongoDB at `127.0.0.1:27018`. These commands run sequentially; regression and documentation capture share port 3101 and `.next-e2e`.

```sh
npm run lint
npm run typecheck
npm run test:scripts
env MONGODB_URI=mongodb://127.0.0.1:27018 npm run test:e2e -- \
  avatar-animation-preview avatar-draft-workflow avatar-illustrated avatar-portrait \
  avatar-rate-settings avatar-rigged avatar-styles avatar-voice-pairing avatar-voices \
  avatar-workspace editorial-animation female-avatar-motion inworld-community-voices \
  meeting-assistant portrait-expression portrait-idle portrait-lips portrait-motion \
  portrait-posture portrait-visual rigged-avatar-motion streaming-only
env MONGODB_URI=mongodb://127.0.0.1:27018 npm run docs:screenshots
env NEXT_DIST_DIR=.next-build-avatar MONGODB_URI=mongodb://127.0.0.1:27018 \
  MONGODB_DB_NAME=conclavia_e2e_avatar_build MEETING_BOT_PROVIDER=preview \
  MEETING_AI_ENABLED=false INWORLD_API_KEY= npm run build
```

The actual regression run used a fresh `conclavia_e2e_precommit_*` database; the corrective rerun used the normal per-run test name, and documentation used `conclavia_e2e_docs_*`. The real SSH-connected database, saved preferences and `.env.local` were preserved. The pre-existing `.env.example` removal is retained, and fresh-installation instructions no longer try to copy that missing template.

README, the extended guide, avatar documentation, artwork provenance, asset notices and local test guidance now describe the current controls and evidence. The 14 September full-application totals remain explicitly historical. This check covers the changed regression files, not every test in the repository. Synthetic PCM, browser recordings and connectivity checks do not certify received Teams audio/video or resolve the separate recognition defect.

## Shoulder correction follow-up

This first symmetric correction was subsequently rejected by the user because both shoulders remained inflated. Its passing tests were insufficient to assess the shape. See the [second revision](#second-shoulder-revision) for current geometry and evidence.

The user identified a disproportionate viewer-left shoulder in the editorial avatar that the previous visual review had missed. The correction is in the shared `conclavia-avatar-kit`, now consumed by both applications. It gives both resting sleeves common proportions, preserves the original fully raised silhouette and makes the relaxed elbow contour continuous. The Meeting compatibility re-exports were preserved.

Final verification after the geometry correction:

| Check | Result |
| --- | --- |
| Editorial, illustrated and female-motion browser suites | 17 passed in the final run |
| Shared silent preview suite | All 7 cases passed in the earlier combined run; both editorial sequences were recorded again after the final correction |
| Rendered silhouette | Six heights checked for sleeve balance in both appearances; resting shoulder stays fixed during raising |
| Visual review | Male/female rest, raising, raised and lowering frames inspected; complete silent sequences recorded, zero browser errors and zero non-GET requests |
| Lint and TypeScript | Passed for Meeting and Onboarding; shared changed source also linted and typechecked |
| Production builds | Both Meeting and Onboarding passed with `NEXT_DIST_DIR=.next-build-shoulder` after the final source change |
| Onboarding isolated unit tests | 11 passed |
| App reachability | `http://localhost:3000/avatar/test` returned 200; existing server left running |

The initial 24-case combined run passed 23 cases and exposed a proportion assertion that required excessively wide sleeves. The updated illustration test checks a relaxed sleeve span of roughly 2.1–2.5 head widths, resets the pose before measurement and resolves nested SVG transforms when checking shoulder continuity. The shoulder probe excludes the raised forearm, whose upward outline is intentional. Board captures now preserve and namespace gradient references, including inherited gradients. The final 17-case rerun above includes these corrections; the new silhouette regression separately catches left/right imbalance.

Current evidence: [before/after poses and recordings](avatar-editorial-2d.md#shoulder-proportions-correction-20-september-2026), [capture report](images/editorial-shoulder/review.json). Earlier recordings retain the old shoulder and are historical. The recordings used the existing local app with non-GET requests blocked. Regression writes and both builds used only `mongodb://127.0.0.1:27018` with `conclavia_e2e_*` database names; the real database, saved settings and `.env.local` were preserved. Synthetic PCM checks remain browser-level evidence, not Teams acceptance.

```sh
env MONGODB_URI=mongodb://127.0.0.1:27018 npm run test:e2e -- \
  tests/e2e/editorial-animation.spec.ts tests/e2e/avatar-illustrated.spec.ts \
  tests/e2e/female-avatar-motion.spec.ts
node scripts/review-avatar-articulation.mjs --url http://127.0.0.1:3000 \
  --styles editorial --output /tmp/conclavia-shoulder-review
```

## Second shoulder revision

The second user screenshot showed that equal-width sleeves still produced a rounded, bulky silhouette. The shared renderer now uses a defined shoulder cap, straighter and slimmer upper sleeves, resting joints closer to the body and a narrower jacket. Seams and pocket follow the revised body. Both identities were reviewed at rest, through lifting/lowering and with the hand raised. A first drawing pass exposed thin gaps at the sleeve/body join; the overlap was corrected before the final captures.

The new test checks below-shoulder expansion in addition to symmetry. A browser comparison using the previous kit revision `08c3062` measured **35 SVG units of outward growth** between y=540 and y=620; the current shape measures **13**. The 18-unit limit rejects the previous shape and passes the current one. Resting silhouette samples also reject gaps. This is a geometric regression, not a claim that numerical symmetry proves visual quality. [Measured comparison](images/editorial-tailoring/silhouette-comparison.json), [actual before/after browser frames](images/editorial-tailoring/comparison.png), [both identities and motion](avatar-editorial-2d.md#shoulder-proportions-correction-20-september-2026).

Final verification: **17 browser tests passed** across `editorial-animation`, `avatar-illustrated` and `female-avatar-motion`; Meeting lint/typecheck and shared source lint/typecheck passed; both Meeting and Onboarding production builds passed with `.next-build-shoulder`. The initial run passed 16/17: the old shoulder probe also sampled the space under the lifted arm, which is intentionally visible with the narrower jacket. The corrected probe covers the sleeve attachment; the final complete rerun passed. Both nine-second browser sequences completed with no errors and no non-GET requests. Existing mouth, silence, waiting, gesture and mobile checks passed.

Tests/builds used only temporary MongoDB at `127.0.0.1:27018` with `conclavia_e2e_*` database names; browser captures blocked writes. The app on port 3000, real database, saved settings and `.env.local` were preserved. No paid speech or Teams validation was performed.

## Coordinated repository alignment

The shared kit, both Conclavia consumers and the AIHat adapter were aligned for publication. A fresh 62-case Meeting avatar/player run passed, together with 11 Onboarding unit cases, 5 AIHat contract cases, 5 Onboarding browser cases and 2 cross-frontend handoff cases. Production builds passed for Meeting, Onboarding and AIHat. The standalone Meeting server returned both GLBs byte-for-byte from the shared kit. See [workspace alignment](https://github.com/vgflutter/conclavia-onboarding-avatar/blob/main/docs/workspace-alignment.md) for the source fingerprint, reproducible sharing check, repository workflow and Docker verification limit.
