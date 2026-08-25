# Web avatar asset pipeline

The Web Performance Runtime accepts a self-contained glTF 2.0 binary performer
without changing meeting intelligence or the `conclavia.performance` protocol.
If no compatible asset is installed, the output deliberately falls back to the
photographic synchronization diagnostic.

## Why this path

MetaHuman 5.8 provides two relevant official foundations:

- [DCC Export](https://dev.epicgames.com/documentation/metahuman/metahuman-creator-export-tool-in-unreal-engine)
  extracts head DNA, body DNA, geometry and textures for external character
  workflows.
- [OpenRigLogic](https://github.com/EpicGames/openriglogic) is Epic's
  MIT-licensed implementation of DNA and RigLogic for platforms outside Unreal
  Engine.

The first shipping Web LOD can use a conventional glTF skin, morph targets and
authored clips. OpenRigLogic can later replace the pre-baked morph layer with a
full DNA evaluator without changing the packet producer or browser scheduler.

## Asset contract

Place one directory per avatar under `CONCLAVIA_WEB_AVATAR_DIRECTORY`, which
defaults to `.conclavia/web-avatars`:

```text
.conclavia/web-avatars/
  showcase/
    manifest.json
    showcase.glb
```

Start from [web-avatar-manifest.example.json](web-avatar-manifest.example.json).
The `id` must match the directory and the configured avatar profile. The model
filename must be local to that directory. The server never exposes arbitrary
paths.

For a finished DCC export, prefer the atomic installer over manually copying
the directory:

```bash
npm run studio:web:avatar:install -- /absolute/path/to/export/manifest.json
```

The source GLB must sit beside that manifest. The installer validates the full
meeting vocabulary first, copies into a private temporary directory and then
renames it into place. Existing avatar IDs are never overwritten.

The GLB must contain:

- a skinned upper-body character;
- all morph targets referenced by the viseme and mood maps;
- every idle, listening and gesture clip named in the manifest;
- embedded images and buffers, with no external texture URLs;
- seated hand-raise, lower-hand and applause clips whose root remains fixed.

Meeting readiness additionally requires mappings for all 17 Polly visemes, all
12 semantic moods, every supported physical gesture, and at least two distinct
idle plus two listening clips. Neutral and silence may intentionally map to no
morph; every other mood and viseme must affect at least one target.

The runtime applies mood and viseme morphs simultaneously, smooths their
weights, drives optional head and eye nodes, crossfades authored body clips and
varies the listening/idle repertoire instead of repeating one short loop.

## Validation

Before starting the companion, run:

```bash
npm run studio:web:avatar:audit -- showcase
```

The command rejects a non-GLB file, an unskinned performer, missing nodes,
missing morph targets, missing animation clips and external image dependencies.
The companion performs the same cached audit before serving either the manifest
or model; an incomplete asset receives HTTP 422 and automatically falls back to
the photograph instead of entering a meeting. File size and modification time
invalidate the audit cache. Only an audit with `"valid": true` is served.

With the companion running, execute both presentation modes in Google Chrome:

```bash
npm run studio:web:runtime:audit
CONCLAVIA_WEB_RUNTIME_URL='http://127.0.0.1:4310/web-output?conclaviaOutput=obs' \
  npm run studio:web:runtime:audit
```

The browser audit checks LIVE state, WebGL/photo performer selection, canvas
rendering, one video track, one audio track, JavaScript exceptions and failed
resources. In clean-output mode it also verifies that badges, identity card and
diagnostics are hidden.

## Export target

Use the MetaHuman DCC Export package as the character source. Assemble a Web
LOD with hair cards, a 2K baked face material, upper-body geometry, a full face
rig and the seated meeting clips. Export one glTF 2.0 binary with morph targets,
skinning and animation enabled. Keep the model's root motion at zero; framing
belongs to the manifest camera and must not be baked into individual clips.

This repository does not commit Epic character binaries or private DCC output.
They remain local assets and can be regenerated from the documented source
character and animation pipeline.
