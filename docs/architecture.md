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

The in-memory event hub keeps a bounded replay window and removes audio when no
retained packet references it. Browser clients connect using the latest known
sequence, so a refresh cannot replay an answer that participants have already
heard. The output exposes its canvas video and WebAudio destination as one
`MediaStream`; a future desktop adapter can register that stream as a native
virtual camera and microphone without changing meeting intelligence.

Web performers are private, self-contained glTF 2.0 binaries installed under
`.conclavia/web-avatars`. A versioned manifest maps the engine-neutral packet to
asset-specific morph targets, gaze nodes, idle/listening clips and seated
gestures. The companion validates the rig, mappings and embedded dependencies
before the asset is used. This keeps avatar identity and renderer complexity
out of dialogue, agenda, participation and TTS code.

The companion defaults `CONCLAVIA_RENDERER_URL` to its own HTTP origin for the
Unreal gateway. `studio:3d:start` refreshes the allow-listed client IP,
watchdog, public player URL and protected supervisor token in the ignored local
`.env` file.

AWS source is deployed only from a clean commit. Unreal/Epic binaries and
licensed Marketplace content remain external prerequisites; every piece of
Conclavia-owned source and every generator needed to reconstruct its generated
assets lives in this repository.
