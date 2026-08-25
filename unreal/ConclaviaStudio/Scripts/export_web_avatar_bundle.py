"""Export the meeting MetaHuman and authored body performances as Web GLBs.

The base scene owns geometry, skin weights, materials and facial morph targets.
Body Animation Sequences are intentionally exported into separate GLBs: this
keeps the Web performance contract independent from Pixel Streaming and lets
the browser bind every authored clip to the one resident MetaHuman skeleton.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import unreal


LEVEL_PATH = os.environ.get(
    "CONCLAVIA_WEB_AVATAR_LEVEL",
    "/Game/Conclavia/Meeting/L_MeetingAvatar_v19",
)
PROFILE_ID = os.environ.get("CONCLAVIA_WEB_AVATAR_ID", "showcase")
OUTPUT_DIRECTORY = Path(
    os.environ.get(
        "CONCLAVIA_WEB_AVATAR_EXPORT_DIR",
        str(Path(unreal.Paths.project_saved_dir()) / "WebAvatarExport" / PROFILE_ID),
    )
)

ANIMATION_EXPORTS = (
    (
        "/Game/Conclavia/Meeting/Animations/AS_MeetingCalmIdle_v1",
        "anim-calm-idle.glb",
    ),
    (
        "/Game/Conclavia/Meeting/Animations/AS_MeetingAttentiveIdle_v1",
        "anim-attentive-idle.glb",
    ),
    (
        "/Game/Conclavia/Meeting/Animations/AS_MeetingEngagedIdle_v1",
        "anim-engaged-idle.glb",
    ),
    (
        "/Game/Conclavia/Meeting/Animations/AS_MeetingReflectiveIdle_v1",
        "anim-reflective-idle.glb",
    ),
    (
        "/Game/Conclavia/Meeting/Animations/AS_MeetingHandRaise_SeatedMarkerless_v1",
        "anim-hand-raise.glb",
    ),
    (
        "/Game/Conclavia/Meeting/Animations/AS_MeetingApplause_SeatedMarkerless_v1",
        "anim-applause.glb",
    ),
)


def log(message: str) -> None:
    unreal.log_warning(f"CONCLAVIA_WEB_AVATAR_EXPORT: {message}")


def configure_options(*, preview_mesh: bool) -> unreal.GLTFExportOptions:
    options = unreal.GLTFExportOptions()
    required = {
        "export_vertex_skin_weights": True,
        # MetaHuman's 858 identity/corrective targets add ~742 MB to this
        # Showcase export. Web facial performances are baked to the identity's
        # 875-bone Face rig, so the neutral mesh does not need those deltas.
        "export_morph_targets": False,
        "export_preview_mesh": preview_mesh,
        "make_skinned_meshes_root": True,
    }
    optional = {
        "export_cameras": False,
        "export_lights": False,
        "export_level_sequences": False,
        "export_hidden_in_game": False,
        "export_vertex_colors": False,
    }
    for name, value in required.items():
        try:
            options.set_editor_property(name, value)
        except Exception as error:
            raise RuntimeError(f"Required glTF option is unavailable: {name}: {error}") from error
    for name, value in optional.items():
        try:
            options.set_editor_property(name, value)
        except Exception as error:
            log(f"OPTION_SKIPPED name={name} reason={error}")
    return options


def assert_export(path: Path) -> None:
    if not path.is_file() or path.stat().st_size < 20:
        raise RuntimeError(f"glTF exporter did not produce a valid file: {path}")


def export_object(
    obj: unreal.Object,
    path: Path,
    options: unreal.GLTFExportOptions,
    selected_actors: set[unreal.Actor] | None = None,
) -> None:
    result = unreal.GLTFExporter.export_to_gltf(
        obj,
        str(path),
        options,
        selected_actors or set(),
    )
    assert_export(path)
    log(f"ASSET file={path.name} bytes={path.stat().st_size} result={result}")


def meeting_anchor() -> unreal.Actor:
    actors = unreal.get_editor_subsystem(
        unreal.EditorActorSubsystem
    ).get_all_level_actors()
    anchors = [
        actor
        for actor in actors
        if "MeetingAvatarAnchor" in {str(tag) for tag in actor.tags}
    ]
    if len(anchors) != 1:
        raise RuntimeError(f"Expected one MeetingAvatarAnchor, found {len(anchors)}")
    return anchors[0]


def write_bundle_inventory(animation_files: list[str]) -> None:
    payload = {
        "schema": "conclavia.web-avatar-export",
        "version": 1,
        "id": PROFILE_ID,
        "level": LEVEL_PATH,
        "model": "model.glb",
        "animationModels": animation_files,
        "clips": {
            "idle": [
                "AS_MeetingCalmIdle_v1",
                "AS_MeetingEngagedIdle_v1",
            ],
            "listening": [
                "AS_MeetingAttentiveIdle_v1",
                "AS_MeetingReflectiveIdle_v1",
            ],
            "gestures": {
                "raise-hand": {
                    "clip": "AS_MeetingHandRaise_SeatedMarkerless_v1",
                    "startSeconds": 1.75,
                    "endSeconds": 3.25,
                },
                "lower-hand": {
                    "clip": "AS_MeetingHandRaise_SeatedMarkerless_v1",
                    "startSeconds": 5.75,
                    "endSeconds": 7.5,
                },
                "applause": {
                    "clip": "AS_MeetingApplause_SeatedMarkerless_v1",
                    "startSeconds": 3.25,
                    "endSeconds": 6.75,
                    "loop": True,
                },
            },
        },
    }
    inventory_path = OUTPUT_DIRECTORY / "export.json"
    inventory_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    if OUTPUT_DIRECTORY.exists() and any(OUTPUT_DIRECTORY.iterdir()):
        raise RuntimeError(f"Export directory must be empty: {OUTPUT_DIRECTORY}")
    OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)
    if not unreal.EditorLoadingAndSavingUtils.load_map(LEVEL_PATH):
        raise RuntimeError(f"Could not load meeting level: {LEVEL_PATH}")
    anchor = meeting_anchor()
    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    export_object(
        world,
        OUTPUT_DIRECTORY / "model.glb",
        configure_options(preview_mesh=False),
        {anchor},
    )

    animation_files: list[str] = []
    for asset_path, filename in ANIMATION_EXPORTS:
        animation = unreal.load_asset(asset_path)
        if not isinstance(animation, unreal.AnimSequence):
            raise RuntimeError(f"Required Animation Sequence is unavailable: {asset_path}")
        export_object(
            animation,
            OUTPUT_DIRECTORY / filename,
            # The base GLB already owns the MetaHuman mesh and textures. Keep
            # body performances as compact skeleton-plus-track assets.
            configure_options(preview_mesh=False),
        )
        animation_files.append(filename)

    write_bundle_inventory(animation_files)
    log(
        f"CONCLAVIA_WEB_AVATAR_EXPORT_OK directory={OUTPUT_DIRECTORY} "
        f"animations={len(animation_files)}"
    )


if __name__ == "__main__":
    main()
