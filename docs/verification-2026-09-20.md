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
