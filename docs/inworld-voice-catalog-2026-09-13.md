# Inworld Italian voice catalog verification — 13 September 2026

## Verified source

Read-only requests to the official `https://api.inworld.ai/voices/v1/voices` endpoint returned HTTP 200. Both queries used `pageSize=2000`, and both returned an empty `nextPageToken` (no omitted pages):

- `source = "SYSTEM" AND lang_code = "it"`: 2 voices.
- `community = "true" AND lang_code = "it"`: 4 voices.

A separate workspace query (`lang_code = "it"`) returned the same two System voices and no additional private Italian voices. No voice was cloned, designed, published, or deleted. Existing environment configuration and saved avatar preferences were preserved.

The English System query also returned all six existing choices: Alex, Dennis and Edward (`EN_US`, male), Alistair (`EN_GB`, male), and Eleanor and Olivia (`EN_GB`, female). Their gender metadata was explicit; no English voices were added to the Italian list.

| Display name | Inworld voice ID | Origin | Avatar filter | Gender evidence |
| --- | --- | --- | --- | --- |
| Gianni | `Gianni` | System | Male | Explicit API field |
| Orietta | `Orietta` | System | Female | Explicit API field |
| Capitano | `community-rxgdeftvn9dc` | Community | Male | Explicit API field |
| Ingegnere | `community-wogdp7fnk36a` | Community | Male | Published description says middle-aged man |
| Cuoco | `community-kvd4dbkrdpds` | Community | Male | Published description says old man |
| Voce Sistema | `community-detz4fjemm8q` | Community | Female | Published description says Italian woman |

All six returned `langCode: IT_IT`, `languageCode: it-IT`, and `promptLanguages: ["it-IT"]`. Community entries returned `source: TVD`; they are identified as Community because they came from the explicit community query, not because of their names. Missing gender metadata is not filled by inferring a person's gender from a name; these four curated additions use the explicit field or unambiguous voice descriptions. This does not justify automatically admitting future unclassified voices to a gender-filtered catalog.

Documentation: [List voices](https://docs.inworld.ai/api-reference/voiceAPI/voiceservice/list-voices), [free voice preview](https://docs.inworld.ai/api-reference/voiceAPI/voiceservice/get-voice-preview). Catalog membership is not an independent quality or licensing assessment for a company rollout.

## Free provider availability checks

Each new ID returned HTTP 200 and non-empty MP3 data from `GET /tts/v1/voice:preview`, with `model_id=inworld-tts-2-flash`:

| Voice | MP3 bytes |
| --- | ---: |
| Capitano | 30,528 |
| Ingegnere | 33,408 |
| Cuoco | 39,168 |
| Voce Sistema | 36,288 |

Inworld documents this fixed-text preview endpoint as unbilled. No API key or audio payload is included in this report.

## Real streaming previews through the GUI

Four short paid syntheses used the actual local preview page, the default Flash model, and a generic Italian sentence: “Buongiorno, sono il tuo assistente. Possiamo iniziare.” The previews did not join Teams or save an avatar profile.

| Voice | HTTP | Audio chunks | Phoneme entries | Browser audio start | Buffer underruns |
| --- | ---: | ---: | ---: | ---: | ---: |
| Capitano | 200 | 9 | 55 | 1.111 s | 0 |
| Ingegnere | 200 | 9 | 55 | 1.047 s | 0 |
| Cuoco | 200 | 9 | 56 | 0.814 s | 0 |
| Voce Sistema | 200 | 8 | 55 | 0.863 s | 0 |

All four streams completed, returned audio and phoneme timings, and played without reported buffer gaps or browser errors. Maximum animation intervals were 33.4–33.5 ms. An API comparison before and after confirmed that the saved avatar profile was unchanged. These are local browser measurements, not Teams latency or receiver-side lip-sync measurements. Voice naturalness still needs the client's listening comparison; no subjective quality claim follows from these checks.

## Implementation and automated checks

- Explicit Inworld provider label and separate System/Community groups in both GUI languages.
- Four male Italian choices and two female Italian choices; no English-native voices added to the Italian list.
- Readable names in preview and saved summaries; actual IDs used for synthesis and persistence.
- Existing choices remain unchanged until an explicit save.
- Provider/source metadata is separate; other TTS backends are not implemented or selectable yet.
- Unknown provider, unverified voice, and cross-language requests fail validation.

18 targeted automated tests passed on an isolated database, including each new voice's preview request, save/reload, and original male/female pairing regressions. Audio in those automated tests was deterministic, not real provider synthesis.

TypeScript, ESLint, and `git diff --check` passed. English desktop and mobile screenshots were refreshed; previewing the voices did not change the saved profile.

The complete regression run finished with **212 passed and 1 failed** (213 tests). The failure was the existing 2.5-second timing assertion for the meeting's “Remember” command: the expected confirmation appeared, but elapsed time was 8.856 seconds. Its command request returned HTTP 200 after 8.423 seconds; that command does not invoke speech synthesis. The same test then passed **three consecutive repetitions without changing its code or thresholds**. The cause of the outlier is not confirmed, and these repetitions do not establish that it is fixed. All new voice tests passed in the full run. This report therefore does not claim an entirely green full-suite run or a general latency guarantee.
