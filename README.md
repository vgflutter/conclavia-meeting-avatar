# Conclavia Meeting Avatar

An open-source local companion that brings a configurable Conclavia MetaHuman into a Microsoft Teams meeting as an interactive participant.

This first implementation does not create a separate Teams bot identity. The host joins with their normal account and Teams receives:

- MetaHuman video through OBS Virtual Camera;
- the avatar voice through a dedicated virtual audio device;
- meeting audio through a separate capture device, preventing the avatar from hearing itself.

![Mary, the Conclavia MetaHuman, participating in Microsoft Teams through OBS Virtual Camera](docs/images/mary-in-microsoft-teams.jpg)

_Mary in the first end-to-end Microsoft Teams test: Conclavia MetaHuman, Pixel Streaming, OBS Virtual Camera, and virtual audio routing._

## Current capabilities

- Continuous Teams audio capture from BlackHole 16ch using ffmpeg and OpenAI Realtime transcription.
- Persistent meeting memory: every final utterance is retained and included in the LLM context when a turn is evaluated.
- Configurable avatar name, which is also the direct voice trigger.
- Natural follow-up dialogue, so the trigger does not need to be repeated for every sentence.
- Conservative participation control that keeps the avatar silent for fillers, incomplete remarks, and conversations between human participants.
- `request-to-speak` autonomy: the avatar may prepare a useful contribution and raise a visible hand, but it cannot speak until a participant grants the floor.
- Floor approval from the web console or by saying phrases such as `Mary, go ahead` or `Go ahead, Mary`.
- Optional live web search for direct questions that require current or external information.
- Configurable OpenAI response model, API key, purpose, personality, and system prompt.
- Structured LLM output with one mood and one intensity level for every sentence.
- Conclavia speech synthesis, lip-sync, and sentence-level Unreal performance cues.
- Embedded Pixel Streaming preview and a clean OBS output page.
- macOS preflight checks for ffmpeg, OBS Studio, and virtual audio devices.
- Browser microphone and text simulation modes for testing without Teams.

## Participation model

The avatar has three possible actions for each evaluated turn:

1. `silence`: retain the utterance as context and do not interrupt.
2. `speak`: answer immediately when addressed directly or during an active follow-up dialogue.
3. `request-to-speak`: prepare a concise answer, show a hand-raise indicator in the OBS output, and wait for approval.

A pending request expires after 45 seconds. Granting the floor uses the already prepared response, reducing perceived latency. Dismissing it produces no speech. The Unreal control contract currently represents the raised hand with an expressive request cue while the OBS output displays the literal `✋` indicator.

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
      "level": 3
    },
    {
      "text": "I would still verify the audio feedback path.",
      "mood": "concerned",
      "level": 2
    }
  ]
}
```

`level` ranges from `1` (barely perceptible) to `5` (strong). Levels 2 and 3 are the normal range; higher values are reserved for content that genuinely warrants a stronger expression. The renderer maps every mood and level to a timed Unreal performance beat, allowing Mary to change expression naturally within a single answer.

Supported moods are:

```text
neutral, attentive, curious, amused, confident, skeptical,
concerned, surprised, empathetic, assertive, frustrated, reflective
```

## Architecture

```text
Microsoft Teams
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
      └──► Teams microphone                  └──► OBS Virtual Camera ──► Teams
```

The companion and Unreal renderer are separate processes. The renderer can therefore run locally or on a cloud GPU without changing the Teams integration.

## Requirements

- macOS
- Node.js 22 or later
- ffmpeg
- OBS Studio with Virtual Camera enabled
- two separate virtual audio paths, recommended:
  - BlackHole 16ch for capturing meeting audio;
  - BlackHole 2ch for routing the avatar voice into the Teams microphone;
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

The web application can configure the avatar profile, name/trigger, model, voice style, API key, purpose, personality, system prompt, web search, and autonomous requests to speak. Saving applies the new configuration without restarting the companion; if the Teams listener was active, it is restarted automatically.

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
CONCLAVIA_DIALOGUE_TIMEOUT_MS=120000
CONCLAVIA_CONFIG_PATH=.conclavia/avatar-config.json
CONCLAVIA_RENDERER_URL=http://127.0.0.1:3000
CONCLAVIA_TEAMS_AUDIO_DEVICE=BlackHole 16ch
CONCLAVIA_TEAMS_SPEAKER_NAME=Teams participant
OPENAI_RESPONSE_MODEL=gpt-5.4-mini
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
OPENAI_REALTIME_TRANSCRIPTION_MODEL=gpt-live-transcribe
```

Start the Conclavia frontend separately:

```bash
cd ../conclavia-frontend
npm run dev
```

## Teams and OBS setup

1. Route the Teams speaker output to a multi-output device that includes BlackHole 16ch.
2. In the companion console, select **Start Teams listening** and verify that the BlackHole device is resolved.
3. Open the clean MetaHuman output page from the renderer section and add it to OBS as a browser source.
4. Start OBS Virtual Camera and select it as the camera in Teams.
5. Route the MetaHuman/Pixel Streaming audio to BlackHole 2ch and select BlackHole 2ch as the Teams microphone.
6. Start the MetaHuman from the companion console.

The current realtime transcript uses the configured generic Teams speaker name; it does not yet identify individual participants automatically. This does not affect transcript memory.

## Suggested end-to-end test

1. Say a normal sentence without the avatar name. It must appear in memory without an immediate answer.
2. Ask `Mary, what was said before?`. Mary should answer with the retained context.
3. Continue with `And what do you suggest?` without repeating the name. The active dialogue should allow the follow-up.
4. Ask for a current fact. With web search enabled, the turn result should report web usage and expose its sources in the console.
5. Continue a human-only discussion with a substantial point. If Mary has a genuinely useful contribution, the `✋` request appears without audio.
6. Approve it in the console or say `Mary, go ahead`; only then should speech and animation start.
7. Say `Thank you, Mary` to close the dialogue before its timeout.
8. Inspect the turn JSON: every spoken sentence must include its own `mood` and `level`.

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
- Add a native full-body Unreal hand-raise animation in addition to the current OBS indicator and expression cue.
- Improve participant attribution using Teams captions or dedicated diarization.
- Separate and expose transcription, participation, LLM, web search, TTS, and renderer latency metrics.
- Evolve from the host-account POC to an optional Teams bot with a separate participant identity.

## License

MIT
