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

### Visual comparison in the application

Open **Podcast → Stili e scenari** (`/podcast/styles`) to compare ten animated art directions: Linea pulita, Volume morbido, Serie animata, Anime luminoso, Fumetto realistico, Anime serale, Commedia animata, Noir d’inchiesta, Teatro di carta, and Frequenza digitale. Each pairs its illustration treatment with an environment. Three casts (`original`, `contemporary`, `expressive`) change drawn identities independently from style and voices. Four compositions (`studio`, `speaker`, `table`, `lounge`) adapt to two avatars or an optional guest video.

Preview, episode editor, two-host rehearsal and gallery share one visual-settings component, with three numbered choices: **Stile grafico** (drawing treatment and setting), **Personaggi** (hosts’ appearance), and **Composizione** (participant arrangement). Style has one picture chooser, replacing the duplicate dropdown and “Anteprime degli stili” list. Outside the gallery it starts with the selected thumbnail and **Cambia stile**; choosing a card closes the list and returns keyboard focus to the chooser button. Characters and composition each have one labelled selector. Guest staging is grouped with composition, while facial reactions and program text remain direction controls. The gallery keeps its stage visible beside the same controls, and the eight combined suggestions are optional under **Vuoi partire da una proposta?** Saved fields, voices and run snapshots keep the existing contract.

The three original proposals now use their own canonical animated renderers in the main picker; the original static assets remain available for provenance. Guest staging is explicit: `auto` shows a panel only for an invited human, `reserve` reserves a space even without a human participant, and `hidden` draws only avatars. The gallery and two-AI rehearsal start without a reserved guest. **Prepara ingresso ospite** opens a private preparation dialog; camera access and bringing its video or avatar on air are separate explicit actions. Choosing **Usa nella prova a due** or **Usa in nuova puntata** carries style, composition, cast, and guest mode into that flow. Input validation, Mongoose storage, serialization, and immutable run snapshots preserve all four choices. Legacy records default to the original cast and automatic guest presence. Browsing styles starts no conversation, synthesis, camera, or microphone.

### Variety audit and visual formats

A side-by-side comparison found that the first seven directions cover adult illustration, anime and caricature; several share human proportions and desk staging. The three additional directions deliberately change character construction and materials: angular monochrome ink faces for investigation, layered die-cut paper for explanations and stories, and non-human robotic display faces for technology and gaming. They are original procedural renderers, not palette filters. Digital cast labels describe domes, geometric visors and asymmetric shells instead of claiming human hairstyles.

`studio-formats.ts` maps all ten styles into six visual families and eight starting combinations: interview, debate, explainers, investigation, technology/gaming, entertainment, culture/stories and listening/wellbeing. The gallery’s optional suggestion cards apply only artwork, cast, composition and guest staging. Topic, character instructions, models, voices and dialogue remain the user’s existing choices. All four visual values travel into rehearsal/new-episode links and normal saved settings; no separate unsaved format state is required. The selected style’s family and suggested uses are descriptive information below the comparison.

### Sentence-level acting

New AI turns use one structured generation for spoken sentences and acting metadata. Each sentence carries `text`, one of the eight canonical `mood` values, `intensity`, `listenerMood`, and `listenerIntensity`. Spoken content is rebuilt from the validated sentence text; raw JSON never reaches captions or speech. The schema is bounded to 24 sentences and 2,000 total characters. Invalid, incomplete, or refused generation fails without a retry or unannotated speech. The existing [OpenAI structured output contract](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses) is reused through the server adapter. Clean SSE text now follows complete structured validation rather than streaming unvalidated provider tokens.

Messages and prepared turns persist `performance: { version: 1, source: 'ai', sentences }`. Earlier AI messages receive visibly labelled neutral `source: 'legacy'` direction without changing their original content. Human messages never receive inferred moods. Editorial intent remains a compatibility fallback; current annotated speech follows its own sentence moods and a separate listening reaction.

The canonical Kokoro adapter synthesizes annotated sentences sequentially within one browser response and emits exact sentence boundaries measured from PCM samples. The canonical player reports the actual output clock, holding during gaps; Stop cancels audio and further local sentence synthesis. The rehearsal retains the last heard acting cue during pauses and cancellation, even when one later AI turn has already been prepared. Streams without sentence cues use an explicitly estimated text-duration progression. This fallback is not word alignment, and the unchanged Kokoro voices are not emotion-conditioned TTS.

The gallery includes an eight-line, silent visual acting lab with transport, seek, paired mood labels, and independent manual controls. AI preview mouths stay at rest. A local camera remains explicit and video-only; remote guest transport, microphone recognition and public streaming still require separate integration.

### Private guest preparation and camera-driven avatar

In the studio, select **Prepara ingresso ospite**, then **Video reale** or **Avatar animato**. Opening preparation never asks for camera permission. **Accendi videocamera per la prova** requests video only (`audio: false`); the private preview stays outside the program canvas and its recording. Avatar mode offers its own three casts and two appearances, following the current episode’s art direction. **Centra la posizione della testa** calibrates a relaxed head position. Only **Porta in scena** applies draft appearance, presentation and calibration to the live stage. Cancel keeps an already published guest unchanged; cancelling an unpublished preview stops its camera, including late permission results.

The canonical kit runs the pinned MediaPipe Tasks Vision 1.1.1 CPU worker and Face Landmarker float16 v1, served entirely from `/podcast/tracking-assets/[asset]`. The initial SIMD runtime and model download is about 17 MB; the bundled non-SIMD fallback is loaded only when needed. No frame or measured face geometry is uploaded, saved in Mongo/local storage, or sent through BroadcastChannel. [Asset attribution and hashes](https://github.com/vgflutter/conclavia-avatar-kit/blob/feat/podcast-studio/assets/podcast-face-tracking/ATTRIBUTION.md) are maintained with the kit. The route is a thin re-export with an explicit seven-file allowlist, HEAD/ETag support and standalone output tracing.

Face measurements drive mouth opening and lip shape, shared eye aperture, brows, gaze and head inclination, with short pose interpolation. They are geometric expression controls, not semantic emotion labels or voice detection. The avatar uses the same live renderer as the two AI hosts across all ten directions, with no synthetic blinking or invented hand gestures. Lost or stale measurements (500 ms) return a neutral avatar; inference failure never reveals the raw camera. A private raw-camera monitor is optional and starts hidden.

Published tracking survives **Vista programma** within the same window. Stopping the camera or leaving the studio releases tracks and worker. The separate `/broadcast` window still follows direction and text only: guest transport and audio have not been connected there. Graphical recording includes the published video/avatar, without preflight, microphone audio or HTML captions. This first prototype presents the guest in the existing guest panel; a tracked third character physically seated at the desk is a later composition change. Actual remote guest audio, transcription and live publishing remain separate work.

### Verification on 16 October 2026

- 49 canonical kit tests, 84 Meeting script tests, and 82 Onboarding unit tests passed without paid providers. New kit cases cover measured-face mapping, stale/invalid samples, calibration, one-in-flight capture, worker stop/abort, model provenance and asset delivery.
- 43 distinct browser cases passed on temporary MongoDB: all ten animated styles, three casts and four compositions, mood/phase controls, real canvas differences, PCM-driven sentence and listening reactions, Stop, persistence, IT/EN and mobile widths, plus the existing voice synchronization regressions. Control-room and separate-output tests also cover the final mood after audio ends, manual intensity takeover, captions from the utterance actually played, direct saved-scene restoration, and cleanup when leaving the control room. Three new preflight cases cover private drafts, video/avatar publishing, calibration, neutral face loss, inference failure, program view, cancellation and camera/worker release; only these lifecycle cases stub the worker protocol.
- A fourth new browser case runs the actual pinned model, WASM and worker over the existing licensed local welcome clip, simulating only the camera source. It verifies changing measured jaw values, continued tracking in program view, no external requests or persistence, and track release. This passes inference integration; it does not certify real-webcam tracking quality, likeness, facial accuracy or performance on other hardware. Separate native QA covers 120 guest-avatar combinations (ten styles × three casts × four compositions), and confirms that changing a supplied raw-camera frame never affects avatar output, including during face loss.
- Both consumer builds, typechecking, lint, and canonical ownership checks passed. Native renderer QA rendered 240 style/cast/composition/guest combinations and 240 mood samples (ten directions × three casts × eight moods), checking live guest frames throughout scene transitions. Visual review corrected original-character portrait crops and the two-host lounge table; rapid scene retargeting preserves the fade instead of flashing the previous set. The original cast remains pixel-identical across 32 frames of the four existing directions.
- Actual local synthesis checks used two prepared sentences per voice: Nicola 7.000 seconds (1.165 seconds generation) and Sara 7.725 seconds (0.261 seconds generation), with exact PCM boundaries and no clipping. These checks do not establish perceived prosody quality or a live model-to-human conversation. No OpenAI/Inworld requests were made for verification.

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

## Dialogo rapido — 17 ottobre 2026

La prova a due riprende il principio del vecchio runner: generazione e sintesi della replica durante il parlato corrente. Il client mantiene al massimo un turno anticipato e due voci udibili. Il caricamento della pagina e la preparazione rimangono senza generazione; Avvia avvia la conversazione limitata a otto interventi e due minuti di parlato stimato.

`/next/stream` emette `speech_stored` soltanto dopo aver validato e salvato risposta e mood. La sintesi del turno può così iniziare durante la revisione editoriale; la lease resta occupata fino alla conclusione della revisione, prima di pianificare il turno seguente con il contesto aggiornato. Il vecchio contratto JSON mantiene il suo comportamento. La disconnessione SSE propaga la cancellazione e non avvia preparazione speculativa aggiuntiva sul server.

Il ritmo Naturale usa pause brevi adattive; Vivace consente un ingresso sul finale PCM del turno precedente (finestra massima di 420 ms), con mood di confronto o un'interruzione pianificata. Sono esclusi ospiti umani, chiusure, stessa voce e sovrapposizioni consecutive. Il mixer canonico bilancia i due canali e riporta al volume normale la voce che continua. Ogni bocca, espressione e sottotitolo segue la propria voce effettivamente in riproduzione. Stop annulla audio, generazione e voce anticipata; il cursore di ripresa avanza solo dopo una voce ascoltata completamente.

Ogni personaggio può ereditare il modello della puntata oppure selezionare OpenAI o Claude nelle opzioni avanzate. La scelta si salva nello snapshot. Claude richiede `ANTHROPIC_API_KEY` e `PODCAST_CLAUDE_MODEL` nel normale ambiente server; la disponibilità è comunicata solo come flag. Il catalogo Gemini esistente resta compatibile. Tutti i servizi ricevono carattere del singolo personaggio, contesto della puntata, memoria editoriale e interventi recenti; una sola generazione strutturata produce testo e mood per frase.

Contratti API verificati sulle documentazioni ufficiali: [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [ottimizzazione della latenza](https://developers.openai.com/api/docs/guides/latency-optimization), [Claude Structured Outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) e [Claude Messages](https://platform.claude.com/docs/en/api/overview). La trasformazione dello schema Claude rimuove vincoli non supportati; la validazione locale originale resta obbligatoria. Nessun fallback vocale, retry a pagamento o sostituzione del modello avviene automaticamente.

Le prove automatiche usano API e PCM simulati; verificano anche due sorgenti Web Audio contemporanee, due labiali e mood indipendenti, annullamento nel fotogramma di sovrapposizione, conservazione del contesto e lease. Queste misure isolano il comportamento del player: la latenza e la qualità conversazionale dei servizi reali richiedono ascolto nella prova interattiva.

### Verifica del 17 ottobre

- 59 test script Podcast, 56 test del kit e 82 test unitari Onboarding superati; controlli di proprietà del kit, lint, tipi e build di entrambi i consumer superati.
- 26 casi browser superati: sovrapposizione di due sorgenti Web Audio, due bocche/mood indipendenti, Stop durante la sovrapposizione, conversazione sequenziale, annullamento, stream tronchi, salvataggio della scelta Claude in IT/EN e regressioni del player Meeting. AI e PCM sono simulati in questi test.
- Due sintesi locali contemporanee con due frasi ciascuna: primo PCM Nicola 151 ms, Sara 217 ms; sintesi completa 321/418 ms per 4,625/4,450 secondi di audio. Questi campioni verificano la coda locale, non la latenza della generazione AI.
- Controllo manuale distinto con esattamente due richieste reali OpenAI, su una puntata fittizia nel database temporaneo: Riccardo 3.743 ms per risposta salvata, due frasi con mood, primo PCM locale dopo altri 516 ms, 17,600 secondi di audio; Sofia 2.975 ms, tre frasi con mood, primo PCM 218 ms, 19,850 secondi di audio. Verificata la conservazione del primo intervento nel secondo contesto di sessione. La seconda generazione è stata eseguita in parallelo alla sintesi della prima voce. Non è stato riprodotto audio sugli altoparlanti; la puntata di verifica è stata eliminata. Sono misure su due campioni, non una garanzia di latenza o una valutazione soggettiva della conversazione.

## Argomento breve nell’uscita video

Il controllo condiviso **Argomento in video** offre argomento puntata (predefinito), tema dinamico, testo personalizzato di massimo 80 caratteri e nascosto. La fascia è disegnata nel canvas canonico, quindi compare anche nelle registrazioni. Usa al massimo due righe, rimane nell’area centrale di un ritaglio 9:16 e adatta la palette allo stile; questo non converte la composizione orizzontale in un formato verticale.

La modalità dinamica segue il `threadLabel` dell’intervento effettivamente riprodotto. La generazione anticipata dell’intervento successivo non anticipa il suo titolo sul video. Usa i metadati già esistenti, senza altre chiamate AI. Cambi tema con dissolvenza, oppure immediati con movimento ridotto. Anteprima, galleria, editor, prova a due, regia e uscita broadcast condividono il controllo. Il salvataggio e gli snapshot di sessione conservano le scelte, e i collegamenti fra le pagine trasferiscono anche l’eventuale testo personalizzato.

Verifica grafica: 40 fotogrammi reali del canvas (10 stili × 4 disposizioni, ospite alternato), controllo visivo dei fogli di confronto e del ritaglio centrale. Verificati nascondi/ripristina con confronto pixel, persistenza e snapshot immutabili, sincronizzazione del tema alla voce con generazione anticipata. Superati 60 test script Podcast, 58 test del kit, 82 unitari Onboarding, lint/tipi, proprietà del kit e build di entrambi i consumer. Nei browser, 20 casi di prova/galleria/argomento superati nella verifica finale, oltre alle regressioni workspace e player Meeting della prima esecuzione; la misura di due rettangoli durante il resize è ora atomica per evitare che lo scorrimento del browser falsi il controllo della didascalia. Nessuna chiamata a provider a pagamento per questa modifica grafica.
