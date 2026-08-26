"""Shared MetaHuman Face Control Rig baker for portable Web performances."""

from __future__ import annotations

import hashlib

import unreal


CONTROL_RIG_PATH = "/MetaHumanCharacter/Face/Face_ControlBoard_CtrlRig"
TEMP_ROOT = "/Game/Conclavia/Meeting/WebExport"


def recreate_asset(path: str, name: str, asset_class: type, factory: object):
    if unreal.EditorAssetLibrary.does_asset_exist(path):
        if not unreal.EditorAssetLibrary.delete_asset(path):
            raise RuntimeError(f"Could not replace temporary asset: {path}")
    asset = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        name,
        TEMP_ROOT,
        asset_class,
        factory,
    )
    if asset is None:
        raise RuntimeError(f"Could not create temporary asset: {path}")
    return asset


def pose_digest(animation: unreal.AnimSequence, sample_time: float) -> str:
    values: list[str] = []
    for bone_name in sorted(
        str(name) for name in unreal.AnimationLibrary.get_animation_track_names(animation)
    ):
        transform = unreal.AnimationLibrary.get_bone_pose_for_time(
            animation,
            bone_name,
            sample_time,
            False,
        )
        translation = transform.translation
        rotation = transform.rotation
        scale = transform.scale3d
        values.append(
            ",".join(
                f"{value:.6f}"
                for value in (
                    translation.x,
                    translation.y,
                    translation.z,
                    rotation.x,
                    rotation.y,
                    rotation.z,
                    rotation.w,
                    scale.x,
                    scale.y,
                    scale.z,
                )
            )
        )
    return hashlib.sha256("|".join(values).encode("utf-8")).hexdigest()[:16]


def matching_channel(channels: dict[str, object], control_path: str):
    control_name, component = control_path.rsplit(".", 1)
    axis = {"tx": "X", "ty": "Y", "tz": "Z"}.get(component)
    prefixes = []
    if axis:
        prefixes.append(f"{control_name}.{axis}_")
    prefixes.append(f"{control_name}_")
    for prefix in prefixes:
        matches = [
            channel
            for name, channel in channels.items()
            if name.startswith(prefix)
        ]
        if len(matches) == 1:
            return matches[0]
    return None


def replace_channel_key(channel, frame_number: int, value: float) -> None:
    for existing in channel.get_keys():
        if existing.get_time().frame_number.value == frame_number:
            existing.set_value(value)
            return
    channel.add_key(unreal.FrameNumber(frame_number), value)


def key_direct_controls(
    section,
    controls: dict[str, float],
    key_times: list[float],
    key_weights: list[float],
    fps: int,
) -> int:
    channels = {str(channel.get_name()): channel for channel in section.get_all_channels()}
    missing = []
    for control_path, value in controls.items():
        channel = matching_channel(channels, control_path)
        if channel is None:
            missing.append(control_path)
            continue
        for time_seconds, weight in zip(key_times, key_weights):
            replace_channel_key(
                channel,
                round(time_seconds * fps),
                float(value) * float(weight),
            )
    if missing:
        raise RuntimeError(
            "Missing face Control Rig channels: " + ", ".join(sorted(missing))
        )
    return len(controls)


def bake_face_animation(
    *,
    label: str,
    source: unreal.AnimSequence,
    face_mesh: unreal.SkeletalMesh,
    face_skeleton: unreal.Skeleton,
    sequence_name: str,
    output_name: str,
    fps: int,
    direct_controls: dict[str, float] | None = None,
    key_times: list[float] | None = None,
    key_weights: list[float] | None = None,
) -> tuple[unreal.AnimSequence, dict[str, object]]:
    rig_asset = unreal.load_asset(CONTROL_RIG_PATH)
    if rig_asset is None or not hasattr(rig_asset, "get_control_rig_class"):
        raise RuntimeError(f"Missing MetaHuman face Control Rig: {CONTROL_RIG_PATH}")

    actor_subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    temporary_actor = actor_subsystem.spawn_actor_from_class(
        unreal.SkeletalMeshActor,
        unreal.Vector(0.0, 0.0, 0.0),
        unreal.Rotator(0.0, 0.0, 0.0),
    )
    if not isinstance(temporary_actor, unreal.SkeletalMeshActor):
        raise RuntimeError(f"Could not spawn face Control Rig actor for {label}")
    temporary_actor.set_actor_label(f"TMP_WebFaceControlRig_{label}")
    component = temporary_actor.skeletal_mesh_component
    component.set_skeletal_mesh(face_mesh)

    sequence = recreate_asset(
        f"{TEMP_ROOT}/{sequence_name}",
        sequence_name,
        unreal.LevelSequence,
        unreal.LevelSequenceFactoryNew(),
    )
    frame_count = max(2, int(round(source.get_play_length() * fps)))
    sequence.set_display_rate(unreal.FrameRate(fps, 1))
    sequence.set_tick_resolution_directly(unreal.FrameRate(fps, 1))
    sequence.set_playback_start(0)
    sequence.set_playback_end(frame_count)
    unreal.LevelSequenceEditorBlueprintLibrary.open_level_sequence(sequence)
    binding = sequence.add_possessable(temporary_actor)
    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    track = unreal.ControlRigSequencerLibrary.find_or_create_control_rig_track(
        world,
        sequence,
        rig_asset.get_control_rig_class(),
        binding,
        is_layered_control_rig=False,
    )
    if track is None:
        raise RuntimeError(f"Could not create face Control Rig track for {label}")
    proxies = unreal.ControlRigSequencerLibrary.get_control_rigs(sequence)
    if not proxies:
        raise RuntimeError(f"Face Control Rig did not initialize for {label}")
    section = track.get_section_to_key()

    direct_control_count = 0
    if direct_controls is None:
        loaded = (
            unreal.ControlRigSequencerLibrary.load_anim_sequence_into_control_rig_section(
                section,
                source,
                component,
                unreal.FrameNumber(0),
                reset_controls=True,
            )
        )
        if not loaded:
            raise RuntimeError(f"Face Backwards Solve could not load {label}")
    else:
        if key_times is None or key_weights is None or len(key_times) != len(key_weights):
            raise RuntimeError(f"Direct face controls have invalid timing for {label}")
        direct_control_count = key_direct_controls(
            section,
            direct_controls,
            key_times,
            key_weights,
            fps,
        )

    factory = unreal.AnimSequenceFactory()
    factory.target_skeleton = face_skeleton
    output = recreate_asset(
        f"{TEMP_ROOT}/{output_name}",
        output_name,
        unreal.AnimSequence,
        factory,
    )
    options = unreal.AnimSeqExportOption()
    options.export_transforms = True
    options.export_morph_targets = True
    options.evaluate_all_skeletal_mesh_components = True
    if not unreal.SequencerTools.export_anim_sequence(
        world,
        sequence,
        output,
        options,
        binding,
        False,
    ):
        raise RuntimeError(f"Could not export face Control Rig animation {label}")
    unreal.EditorAssetLibrary.save_loaded_asset(output, only_if_is_dirty=False)

    duration = float(output.get_play_length())
    start_digest = pose_digest(output, 0.0)
    midpoint_digest = pose_digest(output, duration * 0.5)
    end_digest = pose_digest(output, duration)
    if start_digest == midpoint_digest or midpoint_digest == end_digest:
        raise RuntimeError(f"Face Control Rig animation remained neutral for {label}")
    if start_digest != end_digest:
        raise RuntimeError(f"Face Control Rig animation did not return neutral for {label}")
    report = {
        "controlRig": CONTROL_RIG_PATH,
        "directControls": direct_control_count,
        "boneTracks": len(unreal.AnimationLibrary.get_animation_track_names(output)),
        "startDigest": start_digest,
        "midpointDigest": midpoint_digest,
        "endDigest": end_digest,
    }
    unreal.LevelSequenceEditorBlueprintLibrary.close_level_sequence()
    actor_subsystem.destroy_actor(temporary_actor)
    return output, report
