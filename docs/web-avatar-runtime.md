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
    model.glb
    anim-calm-idle.glb
    anim-attentive-idle.glb
    anim-nod.glb
    anim-tilt.glb
    anim-emphasis.glb
    anim-settle.glb
    anim-hand-raise.glb
    anim-applause.glb
    anim-face-attentive.glb
    ...
    anim-viseme-a.glb
    ...
```

Start from [web-avatar-manifest.example.json](web-avatar-manifest.example.json).
The `id` must match the directory and the configured avatar profile. The model
filename must be local to that directory. The server never exposes arbitrary
paths.

Before writing the mappings, inspect the exported binary directly:

```bash
npm run studio:web:avatar:probe -- /absolute/path/to/export/showcase.glb
```

The probe prints the glTF version, rig and geometry counts, embedded versus
external images, and the exact node, morph-target and animation-clip names.
Use those names verbatim in the manifest. This step is read-only and does not
require the companion, Unreal or a GPU.

To create a conservative manifest scaffold beside the GLB, run:

```bash
npm run studio:web:avatar:scaffold -- /absolute/path/to/export/showcase.glb showcase
```

For a generic DCC model, the command fills only exact node names and clearly
named idle, listening and gesture clips. It deliberately leaves ambiguous
viseme and mood weights unresolved for review against the exported face rig.
The UE bundle scaffold is stronger: its generated inventory carries the exact
identity-baked facial clips and authored gesture ranges, so the current export
resolves the complete meeting vocabulary automatically. Neither command
overwrites an existing `manifest.json`.

For a finished DCC export, prefer the atomic installer over manually copying
the directory:

```bash
npm run studio:web:avatar:install -- /absolute/path/to/export/manifest.json
```

Every source GLB must sit beside that manifest. The installer validates the
full meeting vocabulary first, copies the complete bundle into a private
temporary directory and then renames it into place. Existing avatar IDs are
never overwritten.

The GLB must contain:

- a skinned upper-body character;
- every morph target referenced by a morph map, or identity-baked skeletal
  facial clips for the same viseme and mood;
- every idle, listening and gesture clip named in the manifest, either in the
  base model or one of the declared `animationModels`;
- embedded images and buffers, with no external texture URLs;
- seated hand-raise, lower-hand and applause clips whose root remains fixed.

Meeting readiness additionally requires mappings for all 17 Polly visemes, all
12 semantic moods, every supported physical gesture, and at least two distinct
idle plus two listening clips. Neutral and silence may intentionally map to no
morph or clip; every other mood and viseme must affect at least one morph target
or a declared facial clip.

Gesture values may be a clip name or an authored segment with `clip`,
`startSeconds`, `endSeconds` and `loop`. The production hand-raise take uses one
segment for raising and holding and a later segment for lowering, so the Web
runtime never replays the preparation or stands the body up between states.

The base model becomes visible as soon as it loads; the declared animation GLBs
preload concurrently in the background. A gesture requested during that short
window remains retryable instead of being discarded.

The runtime layers mood and viseme morphs or identity-baked skeletal clips,
drives optional head and eye nodes, crossfades authored body clips and varies
the listening/idle repertoire instead of repeating one short loop.
For multi-sentence speech, each sentence arrives as an ordered chunk in one
delivery. The first chunk starts as soon as its audio and speech marks are
ready; subsequent chunks remain queued against the WebAudio master clock and
an interrupt clears the whole delivery.

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

## Reproducible UE 5.8 export

The Unreal project enables Epic's glTF Exporter and includes one unattended
bundle command:

```powershell
& C:\ConclaviaMeetingAvatar\Scripts\Export-WebAvatarBundle.ps1
```

It loads the isolated `L_MeetingAvatar_v19` map, selects only the actor tagged
`MeetingAvatarAnchor`, and exports a self-contained base `model.glb` with skin
weights. It exports the four seated ambient sequences; authored `nod`, `tilt`,
`emphasis`, and `settle` BodyROM excerpts; the markerless hand-raise; and the
production seated applause into separate GLBs. It then evaluates eleven
non-neutral moods and sixteen case-sensitive visemes on the Showcase identity,
exports each baked face skeleton, and writes `export.json` plus a ZIP. No
podcast scene, Pixel Streaming frame, or runtime GPU state enters the bundle.

After expanding the ZIP locally:

```bash
npm run studio:web:avatar:scaffold-bundle -- /absolute/path/export.json
```

The inventory supplies the exact Unreal clip names, reviewed gesture windows,
facial-clip mappings, display name, and asset version. A current Showcase
bundle should scaffold with zero unresolved nodes, visemes, moods, gestures, or
ambient clips; the readiness audit refuses to serve any incomplete bundle.

## Export target

Use the MetaHuman DCC Export package as the character source. Assemble a Web
LOD with hair cards, a 2K baked face material, upper-body geometry and a full
face rig. Keep the base GLB and authored animation GLBs self-contained. Keep the
model's root motion at zero; framing belongs to the manifest camera and must not
be baked into individual clips.

This repository does not commit Epic character binaries or private DCC output.
They remain local assets and can be regenerated from the documented source
character and animation pipeline.
