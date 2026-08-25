"""Bake a curve-driven MetaHuman expression onto the staged identity.

The Web renderer cannot execute MetaHuman Rig Logic. This probe follows Epic's
Sequencer bake workflow: it evaluates the curve-only meeting expression on the
actual Showcase Face component, records the resulting facial-bone transforms
into an Animation Sequence, and exports that sequence as a portable GLB.
"""

from __future__ import annotations

import os
from pathlib import Path

import unreal


LEVEL_PATH = "/Game/Conclavia/Meeting/L_MeetingAvatar_v19"
SOURCE_PATH = (
    "/Game/Conclavia/Meeting/Animations/"
    "AS_MeetingPositiveExpression_CurveOnly_v1"
)
TEMP_ROOT = "/Game/Conclavia/Meeting/WebExport"
TEMP_SEQUENCE_NAME = "LS_WebFacialProbe_v1"
TEMP_ANIMATION_NAME = "AS_WebFacialPositiveProbe_v1"
FPS = 30
OUTPUT_PATH = Path(
    os.environ.get(
        "CONCLAVIA_WEB_FACIAL_PROBE_OUTPUT",
        str(Path(unreal.Paths.project_saved_dir()) / "WebAvatarExport" / "facial-positive.glb"),
    )
)


def log(message: str) -> None:
    unreal.log_warning(f"CONCLAVIA_WEB_FACIAL_PROBE: {message}")


def recreate_asset(path: str, name: str, asset_class: type, factory: object):
    if unreal.EditorAssetLibrary.does_asset_exist(path):
        if not unreal.EditorAssetLibrary.delete_asset(path):
            raise RuntimeError(f"Could not replace temporary asset: {path}")
    asset = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        name, TEMP_ROOT, asset_class, factory
    )
    if asset is None:
        raise RuntimeError(f"Could not create temporary asset: {path}")
    return asset


def meeting_face() -> tuple[unreal.Actor, unreal.SkeletalMeshComponent]:
    actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem).get_all_level_actors()
    anchors = [
        actor
        for actor in actors
        if "MeetingAvatarAnchor" in {str(tag) for tag in actor.tags}
    ]
    if len(anchors) != 1:
        raise RuntimeError(f"Expected one MeetingAvatarAnchor, found {len(anchors)}")
    components = anchors[0].get_components_by_class(unreal.SkeletalMeshComponent)
    faces = [component for component in components if component.get_name() == "Face"]
    if len(faces) != 1:
        raise RuntimeError(f"Expected one Showcase Face component, found {len(faces)}")
    return anchors[0], faces[0]


def gltf_options() -> unreal.GLTFExportOptions:
    options = unreal.GLTFExportOptions()
    for name, value in {
        "export_vertex_skin_weights": True,
        "export_morph_targets": True,
        # The resident model already owns geometry, materials and textures.
        # Animation GLBs only need skeleton nodes and baked tracks; including
        # the preview mesh duplicated ~765 MB for every facial performance.
        "export_preview_mesh": False,
        "make_skinned_meshes_root": True,
        "export_cameras": False,
        "export_lights": False,
        "export_level_sequences": False,
    }.items():
        options.set_editor_property(name, value)
    return options


def main() -> None:
    if not unreal.EditorLoadingAndSavingUtils.load_map(LEVEL_PATH):
        raise RuntimeError(f"Could not load meeting level: {LEVEL_PATH}")
    source = unreal.load_asset(SOURCE_PATH)
    if not isinstance(source, unreal.AnimSequence):
        raise RuntimeError(f"Curve-only facial source is unavailable: {SOURCE_PATH}")
    actor, face = meeting_face()
    face_mesh = face.get_skeletal_mesh_asset()
    if not isinstance(face_mesh, unreal.SkeletalMesh):
        raise RuntimeError("Showcase Face has no Skeletal Mesh")
    skeleton = face_mesh.get_editor_property("skeleton")
    if not isinstance(skeleton, unreal.Skeleton):
        raise RuntimeError("Showcase Face mesh has no Skeleton")

    sequence_path = f"{TEMP_ROOT}/{TEMP_SEQUENCE_NAME}"
    animation_path = f"{TEMP_ROOT}/{TEMP_ANIMATION_NAME}"
    sequence = recreate_asset(
        sequence_path,
        TEMP_SEQUENCE_NAME,
        unreal.LevelSequence,
        unreal.LevelSequenceFactoryNew(),
    )
    frame_count = max(2, int(round(source.get_play_length() * FPS)))
    sequence.set_display_rate(unreal.FrameRate(FPS, 1))
    sequence.set_tick_resolution_directly(unreal.FrameRate(FPS, 1))
    sequence.set_playback_start(0)
    sequence.set_playback_end(frame_count)
    unreal.LevelSequenceEditorBlueprintLibrary.open_level_sequence(sequence)

    actor_binding = sequence.add_possessable(actor)
    face_binding = sequence.add_possessable(face)
    face_binding.set_parent(actor_binding)
    track = face_binding.add_track(unreal.MovieSceneSkeletalAnimationTrack)
    if track is None:
        raise RuntimeError("Could not create the facial Skeletal Animation track")
    section = track.add_section()
    section.set_range(0, frame_count)
    parameters = section.get_editor_property("params")
    parameters.set_editor_property("animation", source)
    section.set_editor_property("params", parameters)

    factory = unreal.AnimSequenceFactory()
    factory.target_skeleton = skeleton
    baked = recreate_asset(
        animation_path,
        TEMP_ANIMATION_NAME,
        unreal.AnimSequence,
        factory,
    )
    options = unreal.AnimSeqExportOption()
    options.export_transforms = True
    options.export_morph_targets = True
    options.evaluate_all_skeletal_mesh_components = True
    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    if not unreal.SequencerTools.export_anim_sequence(
        world, sequence, baked, options, face_binding, False
    ):
        raise RuntimeError("Sequencer could not bake the evaluated Showcase Face")
    unreal.EditorAssetLibrary.save_loaded_asset(baked, only_if_is_dirty=False)

    bone_tracks = list(unreal.AnimationLibrary.get_animation_track_names(baked))
    curve_names = list(
        unreal.AnimationLibrary.get_animation_curve_names(
            baked,
            unreal.RawCurveTrackTypes.RCT_FLOAT,
        )
    )
    if not bone_tracks:
        raise RuntimeError(
            "Facial bake produced no bone transforms; Rig Logic was not evaluated"
        )
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    if OUTPUT_PATH.exists():
        OUTPUT_PATH.unlink()
    exported = unreal.GLTFExporter.export_to_gltf(
        baked,
        str(OUTPUT_PATH),
        gltf_options(),
        set(),
    )
    if not OUTPUT_PATH.is_file() or OUTPUT_PATH.stat().st_size < 20:
        raise RuntimeError(f"Facial GLB export failed: {OUTPUT_PATH}")
    log(
        f"CONCLAVIA_WEB_FACIAL_PROBE_OK output={OUTPUT_PATH} "
        f"bytes={OUTPUT_PATH.stat().st_size} result={exported} "
        f"bones={len(bone_tracks)} curves={len(curve_names)} "
        f"face={face_mesh.get_path_name()}"
    )


if __name__ == "__main__":
    main()
