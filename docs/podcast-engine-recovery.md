# Restored podcast engine

The podcast engine is recovered from `vgflutter/conclavia` commit
`5d4746f900a106defe1377131bce7ebbc5b69ca3` (2026-08-22,
“feat: add Unreal MetaHuman studio mode”). The original feature was removed from
the current application at `a0281daac4f5435131d2c3cfeaf1cb666e976652`
(2026-09-05, “feat: refocus Conclavia on Teams meeting assistant”).
The full historical checkout is retained separately in the avatar-kit local
recovery directory; recovery does not reset or revert Meeting history.

## Recovered behavior

- A configured episode has a topic, central question, editorial instructions,
  language, duration, pace, turn budget and cast of 2–5 participants.
- Each AI has its own perspective, goals, non-negotiables, speaking style,
  assertiveness, patience, interruptiveness and baseline tension. The selected
  speaker receives its own private character, plus the public transcript and
  shared editorial state. Other cast members' private prompts are excluded.
- The recovered director chooses speakers, addressees, intents and bounded word
  ranges. The editorial arc records positions, conflict, examination, synthesis
  and conclusion. Memory tracks claims, agreements, unanswered questions and
  changes of position instead of enforcing a fabricated consensus.
- Human turns are explicit input. The engine waits for a human plan, stores the
  submitted text with `origin: human`, then returns the floor. It never generates
  the human guest's speech or attributes generated dialogue to that guest.
- Run snapshots preserve the configuration that actually produced each episode.
  Subsequent edits to the source episode do not change old run history.

## Isolation and deliberate changes

All engine modules are under `src/lib/podcast`, API routes under
`/api/podcast`, and types under `src/types/podcast*.ts`.
Mongoose model names are `PodcastTalk`, `PodcastRun` and `PodcastAudienceRoom`,
with collections `podcast_talks`, `podcast_runs` and `podcast_audience_rooms`.
Existing Meeting records and models are not read or migrated by podcast code.
The existing Mongo connection configuration is reused; no replacement database
or empty configuration is created.

The five-seat assumptions were replaced with the actual cast length, including
speaker selection counts and next-seat modulo. The episode supports 1–60 minutes
and 1–50 participant turns. `videoMode` is `cartoon`; historical LiveAvatar and
Unreal transports are intentionally not restored. Voice identity is sourced
from the canonical shared avatar kit rather than a duplicated provider catalog.

Historical type/function names (`TalkInput`, `TalkRunResponse`, `chooseNextTurn`)
are retained inside the isolated namespace for recovery traceability.
`PodcastInput` and `PodcastResponse` are aliases for UI use.

## API contract

| Route | Method | Result / input |
| --- | --- | --- |
| `/api/podcast/talks` | GET | `{ talks }`, newest first |
| `/api/podcast/talks` | POST | Full validated `TalkInput`; returns `{ talk }` |
| `/api/podcast/talks/[id]` | GET | `{ talk }` |
| `/api/podcast/talks/[id]` | PATCH | Full validated `TalkInput`; returns `{ talk }` |
| `/api/podcast/talks/[id]` | DELETE | Deletes only this podcast and its namespaced runs/audience data; blocked during generation |
| `/api/podcast/talks/[id]/runs` | GET | `{ runs, run }`, latest 30 plus latest alias |
| `/api/podcast/talks/[id]/runs` | POST | Creates or resumes one active run; requires ready configuration; no generation |
| `/api/podcast/runs/[id]` | GET | `{ run }`; no writes during polling |
| `/api/podcast/runs/[id]/next` | POST | Operator advances exactly one planned turn; `{ run }` |
| `/api/podcast/runs/[id]/next/stream` | POST | Same operation as SSE; events `plan`, `delta`, `speech_ready`, `turn_complete`, `complete`, `error` |
| `/api/podcast/runs/[id]/human-turn` | POST | `{ content, intent?, targetParticipantIndex?, threadLabel? }`; returns `{ run }` |
| `/api/podcast/runs/[id]/stop` | POST | Completes a non-generating run and preserves history |
| `/api/podcast/config` | GET | Safe enabled/ready flags; no credential values |
| `/api/podcast/runs/[id]/speech` | POST | Explicit stored AI message `sequence`; canonical PCM stream |

Mutation requests reject cross-origin browser actions. JSON is bounded while
reading, configuration fields and cast scores are validated, and run operations
validate Mongo IDs before querying. The existing public meeting tunnel continues
to block podcast management routes; this feature does not open public access.

## Provider activation

Generation is **off by default**. Enabling `PODCAST_AI_ENABLED=true` is an explicit
operator configuration step; it does not by itself send a request. A generation
requires the operator to advance a turn. OpenAI uses the existing server-side
credential and `PODCAST_OPENAI_MODEL`, falling back to the existing
`OPENAI_MEETING_MODEL` / current Meeting default. Gemini is optional and requires
its server credential plus `PODCAST_GEMINI_MODEL`.

Public model selectors `openai-default` / `gemini-default` keep server model names
out of saved UI configuration. No model or pricing capability is promised by an
obsolete catalog entry from the recovered commit.

Speech has its own `PODCAST_SPEECH_ENABLED=true` switch and explicit operator
playback. Run creation, editing and graphic preview do not enable either paid
boundary. Speculative generation has been disabled in the restored streaming
route: a single action does not silently prepare another paid turn.

Generation uses a 110-second combined deadline, including off-air review, and
forwards cancellation. Stale leases are displayed as retryable without a write
on GET; the next operator action atomically claims the stale generation. Every
generation has an opaque UUID token; completion, cancellation and failure use
that token as a compare-and-set guard, so an older worker cannot clear a newer
worker’s lease. A normal turn returns directly after its atomic save and never
performs the historical unconditional second status update. Human
submission uses a status claim to prevent duplicate concurrent guest turns.

## Verification and remaining acceptance

`node --test tests/scripts/podcast-engine.test.mjs` executes the actual recovered
modules at pure boundaries. The suite covers flexible cast validation, obsolete
video rejection, duration/score/turn limits, fair speaker selection, word ranges,
private character isolation, central question and editorial directions, AI
closing, disabled-provider zero-network behavior, human attribution and duplicate
submission, correct modulo for a three-seat run, and deterministic newer-worker / stale
cancellation races.

The tests do not call providers, read the local environment, connect to the real
database or save fixtures. A separate temporary Mongo instance is required for
persistence integration tests. Passing local tests is not acceptance of a real
remote guest conversation, microphone recognition, public broadcast, voice
quality, model latency or live interruptions. Those require an explicitly run
end-to-end rehearsal after connection and provider configuration.


## Verifica locale del 15 ottobre 2026

- Il commit originale `5d4746f900a106defe1377131bce7ebbc5b69ca3` è conservato anche nel repository Meeting sul ramo locale `archive/podcast-20260822`, importato dal recupero locale. Il nuovo lavoro è sul ramo `feat/podcast-studio` di Meeting, avatar-kit e sito pubblico.
- 53 test degli script Meeting, inclusi 10 sul motore podcast e sette sulla sua integrazione/protezione; nessuna chiamata a provider a pagamento.
- 11 prove di accettazione podcast su MongoDB temporaneo `127.0.0.1:27018` e database `conclavia_e2e_*`: salvataggi IT/EN, caratteri e regia, snapshot, avvio concorrente, turni umani, storico, composizioni, espressioni, larghezze 320/768/1440, camera simulata e registrazione grafica.
- 25 regressioni Meeting di avatar illustrati, animazione editoriale, PCM streaming e sincronizzazione vocale superate. Due primi fallimenti dell’editor individuavano etichette implicite dei textarea; corretti con associazioni esplicite e descrizioni accessibili, poi tutti gli 11 test podcast sono passati.
- 13 test del kit, TypeScript, lint Meeting/Onboarding, build di entrambi i consumer e build statica IT/EN del sito. Verificata l’identità del kit condiviso senza implementazioni copiate.
- La registrazione scaricata dal browser è un MP4 H.264 reale a 1920×1080, verificato con ffprobe e ispezione del primo fotogramma. Nessuna traccia audio o sottotitolo HTML è inclusa nella registrazione grafica.

L’anteprima locale viene avviata sulla sola interfaccia `127.0.0.1:3105`, con `conclavia_e2e_podcast_preview` e AI/voce disattivate. `/podcast/preview` non richiede database; libreria e salvataggi dell’anteprima usano esclusivamente quel database locale. Non è una pubblicazione e non sposta i dati dell’applicazione abituale. I master grafici e i risultati di prova sono in avatar-kit `.local/podcast-production-qa`, esclusi dal deploy.
