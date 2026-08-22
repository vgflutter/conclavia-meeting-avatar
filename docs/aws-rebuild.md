# Rebuilding the AWS Unreal studio

The Git repository is the source of truth. The EC2 disk is a disposable build
and render host; it must never contain the only copy of application source.

## What Git contains

- the companion, browser control room, Teams/Meet-neutral protocols and tests;
- the complete Unreal C++ module, project configuration and PowerShell/Python
  automation under `unreal/ConclaviaStudio`;
- the Roles Anywhere infrastructure and least-privilege device policy;
- versioned source deployment and AWS drift-audit scripts;
- source plates and builders for the generated level, cast and animations;
- `unreal/renderer-manifest.json`, which pins the engine, Pixel Streaming and
  external runtime requirements.

Git intentionally does not contain API keys, supervisor tokens, certificates,
Unreal build products, Epic-generated MetaHuman packages or the licensed
RuntimeMetaHumanLipSync plugin.

## Fresh host procedure

1. Launch a Windows Server 2022 GPU instance in `eu-central-1`. The validated
   baseline is `g6.2xlarge`, an encrypted 350 GB gp3 root volume, IMDSv2 required
   and an SSM-enabled instance profile. The current reusable AWS launch template
   is `lt-0a684c9f9c7051c2b`, version 2; change its instance type to `g6.2xlarge`.
2. Install the NVIDIA RTX Virtual Workstation driver and NICE DCV. The launch
   template performs this host bootstrap; do not put credentials in user data.
3. Install Unreal Engine 5.8.1 at `C:\Epic\UE_5.8`, including MetaHuman Creator
   Core Data, MetaHuman Character/SDK and Pixel Streaming 2.
4. Install the licensed RuntimeMetaHumanLipSync 1.0 package at
   `C:\ConclaviaMeetingAvatar\Plugins\RuntimeMetaHumanLipSync`. Obtain it from its
   licensed source; it is not redistributable through this repository.
5. Clone Epic's Pixel Streaming Infrastructure at the commit pinned in
   `unreal/renderer-manifest.json`, install its Node dependencies and place it at
   `C:\PixelStreamingInfrastructure`.
6. Bootstrap the local Roles Anywhere profile from `infra/roles-anywhere` and
   run `npm run studio:3d:start` so the instance, private ingress, watchdog and
   rotating supervisor connection are configured.
7. From a clean, pushed Git commit run `npm run studio:source:deploy`. The script
   uploads an archive addressed by the Git SHA, installs it through SSM, builds
   `ConclaviaStudioEditor`, records `Saved/source-revision.json` and executes the
   source audit.
8. The deploy copies the non-redistributable content and plugin from the legacy
   renderer only during the first migration, then builds the dedicated meeting
   level automatically. Validate with `Verify-SingleHeroReadiness.cjs`, the
   speech audit and a decoded browser run.

The scheduled task is `ConclaviaMeetingAvatarSupervisor`. The old
`ConclaviaStudioSupervisor` task is stopped and disabled during deployment so
the podcast and meeting renderers cannot contend for the GPU or shared Pixel
Streaming ports.

## Normal release discipline

`npm run studio:source:deploy` refuses a dirty working tree. Every AWS source
deployment therefore names one immutable Git commit and writes that revision to
the host. `npm run studio:source:audit` compares the host revision and hashes of
the runtime module and supervisor against the current local commit. A mismatch
is a release failure, not a state to repair manually on Windows.

Changes to Epic content or the private plugin must be expressed as a version
change in `unreal/renderer-manifest.json` plus a reproducible builder/migration
script. Temporary diagnostic edits on EC2 must be recovered into Git or
discarded before the next release.
