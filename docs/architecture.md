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
  - Polly speech synthesis
  - /api/unreal/* renderer gateway
          |
          v
private AWS GPU supervisor :8090
  - process lifecycle and PCM bridge
          |
          v
Unreal 5.8 + MetaHuman + Pixel Streaming 2
          |
          +--> OBS Virtual Camera --> meeting video
          +--> BlackHole 2ch ------> meeting microphone
```

The companion defaults `CONCLAVIA_RENDERER_URL` to its own HTTP origin. This
keeps one renderer contract for internal calls and allows a separately hosted
gateway later, without coupling the service to Next.js. `studio:3d:start`
refreshes the allow-listed client IP, watchdog, public player URL and protected
supervisor token in the ignored local `.env` file.

AWS source is deployed only from a clean commit. Unreal/Epic binaries and
licensed Marketplace content remain external prerequisites; every piece of
Conclavia-owned source and every generator needed to reconstruct its generated
assets lives in this repository.
