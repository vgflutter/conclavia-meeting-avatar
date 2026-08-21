# Conclavia Meeting Avatar

An open-source local companion that brings a configurable Conclavia MetaHuman into Microsoft Teams, Google Meet, or another conferencing application as an interactive participant.

This first implementation does not create a separate bot identity. The host joins with their normal account and the meeting application receives:

- MetaHuman video through OBS Virtual Camera;
- the avatar voice through a dedicated virtual audio device;
- meeting audio through a separate capture device, preventing the avatar from hearing itself.

![Mary, the Conclavia MetaHuman, participating in Microsoft Teams through OBS Virtual Camera](docs/images/mary-in-microsoft-teams.jpg)

_Mary in the first end-to-end Microsoft Teams test: Conclavia MetaHuman, Pixel Streaming, OBS Virtual Camera, and virtual audio routing._

## Current capabilities

- Continuous meeting audio capture from BlackHole 16ch using ffmpeg and OpenAI Realtime transcription.
- Persistent meeting memory: every final utterance is retained and included in the LLM context when a turn is evaluated.
- Configurable avatar name, which is also the direct voice trigger.
- Natural follow-up dialogue, so the trigger does not need to be repeated for every sentence.
- Conservative participation control that keeps the avatar silent for fillers, incomplete remarks, and conversations between human participants.
- `request-to-speak` autonomy: the avatar may prepare a useful contribution and physically raise its hand, but it cannot speak until a participant grants the floor.
- Floor approval from the web console or by saying phrases such as `Mary, go ahead` or `Go ahead, Mary`.
- Optional live web search for direct questions that require current or external information.
- Configurable OpenAI response model, API key, purpose, personality, and system prompt.
- Structured LLM output with one mood and one intensity level for every sentence.
- Sentence-level language selection with separate native Italian and US English voices.
- Selectable MetaHuman identity, Italian voice, English voice, and delivery style.
- Conclavia speech synthesis, lip-sync, and sentence-level Unreal performance cues.
- Embedded Pixel Streaming preview and a clean OBS output page.
- macOS preflight checks for ffmpeg, OBS Studio, and virtual audio devices.
- Browser microphone and text simulation modes for testing without Teams.

## Participation model

The avatar has three possible actions for each evaluated turn:

1. `silence`: retain the utterance as context and do not interrupt.
2. `speak`: answer immediately when addressed directly or during an active follow-up dialogue.
3. `request-to-speak`: prepare a concise answer, raise the MetaHuman's right hand, show a matching output indicator, and wait for approval.

A pending request expires after 45 seconds. Granting the floor uses the already prepared response, reducing perceived latency. Dismissing it produces no speech and lowers the hand. The physical pose is implemented as an arm-only Unreal layer so it does not interfere with the face, head, or lip-sync animation clocks.

## Sentence-level performance contract

The LLM returns structured output for each spoken sentence:

```json
{
  "action": "speak",
  "reason": "Direct answer",
  "sentences": [
    {
      "text": "The connection is working correctly.",
      "mood": "confident",
      "level": 3,
      "language": "en-US"
    },
    {
      "text": "I would still verify the audio feedback path.",
      "mood": "concerned",
      "level": 2,
      "language": "en-US"
    }
  ]
}
```

`level` ranges from `1` (barely perceptible) to `5` (strong). Levels 2 and 3 are the normal range; higher values are reserved for content that genuinely warrants a stronger expression. `language` is `it-IT` or `en-US`. The renderer synthesizes up to two sentences in parallel with the selected native-language voices, concatenates their PCM streams, and maps every mood and level to an accurately timed Unreal performance beat.

Supported moods are:

```text
neutral, attentive, curious, amused, confident, skeptical,
concerned, surprised, empathetic, assertive, frustrated, reflective
```

## Architecture

```text
Teams / Google Meet / conferencing application
      │ meeting audio
      ▼
macOS companion ──► live STT ──► transcript memory ──► participation LLM
      ▲                                                    │
      │                         direct answer / hand raise  ▼
BlackHole 16ch                                    optional web search
                                                           │
                                                           ▼
                                              sentence mood + level
                                                           │
                                                           ▼
BlackHole 2ch ◄── Conclavia TTS ◄── Unreal / MetaHuman ◄── cues
      │                                      │
      └──► meeting microphone                └──► OBS Virtual Camera ──► meeting
```

The companion and Unreal renderer are separate processes. The renderer can therefore run locally or on a cloud GPU without changing the conferencing integration.

## Facial animation architecture

The current realtime face path uses the commercial Realistic MetaHuman LipSync plugin. It accepts the same streamed PCM used for playback and exposes realtime mood and intensity on the lip-sync clock. This is why the current `mood` values are not yet driven by Epic's native MetaHuman speech solver.

The body path is independent and native to Unreal/MetaHuman. Physical gestures such as `raise-hand` and `lower-hand` affect only the body skeleton. The intended architecture keeps the face backend selectable: the commercial solver remains the stable realtime default while the native MetaHuman Animator/Speech2Face path is benchmarked for latency, GPU cost, expression quality, and synchronization. The commercial dependency can be removed when the native realtime path meets those gates.

## Requirements

- macOS
- Node.js 22 or later
- ffmpeg
- OBS Studio with Virtual Camera enabled
- two separate virtual audio paths, recommended:
  - BlackHole 16ch for capturing meeting audio;
  - BlackHole 2ch for routing the avatar voice into the meeting microphone;
  - Loopback can be used instead for a more convenient routing UI.
- the Conclavia frontend/Unreal bridge available at `http://127.0.0.1:3000` by default

Keeping capture and avatar output on separate paths prevents feedback loops.

## Start locally

```bash
npm install
cp .env.example .env
npm run dev
```

Open [http://127.0.0.1:4310](http://127.0.0.1:4310).

The web application can configure the meeting platform, avatar profile, name/trigger, model, native Italian and English voices, delivery style, API key, purpose, personality, system prompt, web search, and autonomous requests to speak. Saving applies the new configuration without restarting the companion; if the meeting listener was active, it is restarted automatically. Changing the MetaHuman profile is applied the next time the renderer starts.

You can alternatively provide the API key through the environment:

```dotenv
OPENAI_API_KEY=your-key
```

When entered in the web application, the key is stored only in the local file configured by `CONCLAVIA_CONFIG_PATH`. Its directory and file are created with macOS permissions `0700` and `0600`, the key is never returned by the API, and `.conclavia/` is ignored by Git. The local console binds to `127.0.0.1` by default; do not expose it to an untrusted network.

Default settings:

```dotenv
PORT=4310
HOST=127.0.0.1
CONCLAVIA_WAKE_WORD=Mary
CONCLAVIA_DIALOGUE_TIMEOUT_MS=45000
CONCLAVIA_CONFIG_PATH=.conclavia/avatar-config.json
CONCLAVIA_RENDERER_URL=http://127.0.0.1:3000
CONCLAVIA_MEETING_AUDIO_DEVICE=BlackHole 16ch
CONCLAVIA_MEETING_SPEAKER_NAME=Meeting participant
OPENAI_RESPONSE_MODEL=gpt-5.4-mini
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
OPENAI_REALTIME_TRANSCRIPTION_MODEL=gpt-live-transcribe
```

Start the Conclavia frontend separately:

```bash
cd ../conclavia-frontend
npm run dev
```

## Teams, Google Meet, and OBS setup

1. Route the Teams or Google Meet speaker output to a multi-output device that includes BlackHole 16ch.
2. In the companion console, select **Start meeting listening** and verify that the BlackHole device is resolved.
3. Open the clean MetaHuman output page from the renderer section and add it to OBS as a browser source.
4. Start OBS Virtual Camera and select it as the camera in Teams or Google Meet.
5. Route the MetaHuman/Pixel Streaming audio to BlackHole 2ch and select BlackHole 2ch as the meeting microphone.
6. Start the MetaHuman from the companion console.

The current realtime transcript uses the configured generic speaker name; it does not yet identify individual participants automatically. This does not affect transcript memory. Teams and Google Meet use the same OS-level adapter: the companion does not depend on a vendor-specific meeting API.

## Suggested end-to-end test

1. Say a normal sentence without the avatar name. It must appear in memory without an immediate answer.
2. Ask `Mary, what was said before?`. Mary should answer with the retained context.
3. Continue with `And what do you suggest?` without repeating the name. One clearly directed natural follow-up is allowed during the short dialogue window.
4. Ask for a current fact. With web search enabled, the turn result should report web usage and expose its sources in the console.
5. Continue a human-only discussion with a substantial point. If Mary has a genuinely useful contribution, her right hand rises without audio.
6. Approve it in the console or say `Mary, go ahead`; only then should speech and animation start.
7. Say `Thank you, Mary` to close the dialogue early; otherwise it closes after the first follow-up or its timeout.
8. Inspect the turn JSON: every spoken sentence must include its own `mood`, `level`, and `language`.

The **Record** button performs the same flow through the browser microphone. The manual text field is the fastest option for deterministic protocol tests.

## Commands

Run the environment preflight:

```bash
npm run preflight
```

Test only the deterministic trigger gate:

```bash
npm run simulate -- "Mary, what do you think?"
```

Run all quality checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Privacy and security

Inform every participant before capturing or processing meeting audio. Transcript content and audio may contain confidential data. Never commit provider credentials, local configuration, recordings, or meeting transcripts.

## Roadmap

- Stream TTS generation and playback to reduce time to first audio further.
- Replace the first arm-layer hand pose with a polished authored AnimSequence or Control Rig gesture after visual calibration.
- Improve participant attribution using Teams captions or dedicated diarization.
- Separate and expose transcription, participation, LLM, web search, TTS, and renderer latency metrics.
- Evolve from the host-account POC to optional platform-specific bots with separate participant identities.

## License

MIT
