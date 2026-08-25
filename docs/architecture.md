# Standalone architecture

`conclavia-meeting-avatar` owns the complete meeting participant runtime. The
separate Conclavia frontend is optional and is not in the production request
path.

```text
Teams / Meet / test room
          |
          v
Conclavia companion :4310
  - transcript and chat adapters
  - OpenAI meeting intelligence
  - dialogue and floor controller
  - Polly speech synthesis and speech marks
  - PerformancePacket producer and event hub
          |
          +--> Web Performance Runtime
          |      - Three.js GLB performer or explicit photo fallback
          |      - canvas and WebAudio
          |      - audio-master scheduler
          |      - morph moods + visemes, gaze and authored body clips
          |      - combined MediaStream for a desktop adapter
          |
          +--> private AWS GPU supervisor :8090
                  |
                  v
               Unreal 5.8 + MetaHuman + Pixel Streaming 2
                         |
                         +--> OBS Virtual Camera --> meeting video
                         +--> BlackHole 2ch ------> meeting microphone
```

`CONCLAVIA_RENDERER_MODE=unreal` keeps the cinematic production path.
`CONCLAVIA_RENDERER_MODE=web` starts immediately without EC2 and returns the
local `/web-output` player. Both modes consume the same semantic meeting
decisions. The Web runtime receives `conclavia.performance` version 1 packets
through SSE, while the current Unreal adapter translates that shared plan to
its established cue and PCM endpoints. Speech uses the WAV asset as the only
master clock; visemes, sentence moods, gaze and gestures are relative timelines.
Listening and physical actions use a monotonic local timeline. Interruption is
an explicit priority-100 event that names the performance to cancel when one is
active.

The meeting-intelligence path is also lane-aware. Direct questions, silent
listening reactions, and autonomous participation decisions use separate
strict schemas and context budgets. The OpenAI request uses no reasoning,
low verbosity, prompt-cache routing and Fast processing. Web search is attached
only to explicit browsing requests, time-sensitive direct questions, or a
material autonomous verification; it is not offered to ordinary conversational
turns. Summary and agenda requests retain the larger meeting-history window.

Speech delivery is progressive at sentence boundaries. All sentence TTS work
starts in parallel, but the first completed sentence is published immediately
instead of waiting for the slowest one. Ordered packets share a delivery ID;
the browser queues them behind the active WebAudio source and applies each
sentence's local viseme, mood, gaze, and gesture timeline. A new delivery
replaces that queue and an interrupt invalidates pending synthesis results.

The in-memory event hub keeps a bounded replay window and removes audio when no
retained packet references it. Browser clients connect using the latest known
sequence, so a refresh cannot replay an answer that participants have already
heard. The output exposes its canvas video and WebAudio destination as one
`MediaStream`; a future desktop adapter can register that stream as a native
virtual camera and microphone without changing meeting intelligence.

Web performers are private, self-contained glTF 2.0 bundles installed under
`.conclavia/web-avatars`. The base GLB owns the MetaHuman skin, geometry,
materials and facial morphs; optional animation GLBs carry independently
exported Unreal sequences. A versioned manifest maps the engine-neutral packet
to asset-specific morph targets, gaze nodes, idle/listening clips, seated
gestures and authored clip ranges. The companion validates the complete bundle,
mappings and embedded dependencies before the asset is used. This keeps avatar
identity and renderer complexity out of dialogue, agenda, participation and TTS
code.

Validation is enforced by a metadata-keyed registry rather than trusted as an
operator convention. A failed or missing audit is visible through renderer and
performance status, the GLB endpoints refuse the asset, and the browser uses its
explicit fallback. This prevents a partial upload or stale DCC export from
silently reaching OBS during a meeting.

The companion defaults `CONCLAVIA_RENDERER_URL` to its own HTTP origin for the
Unreal gateway. `studio:3d:start` refreshes the allow-listed client IP,
watchdog, public player URL and protected supervisor token in the ignored local
`.env` file.

AWS source is deployed only from a clean commit. Unreal/Epic binaries and
licensed Marketplace content remain external prerequisites; every piece of
Conclavia-owned source and every generator needed to reconstruct its generated
assets lives in this repository.
