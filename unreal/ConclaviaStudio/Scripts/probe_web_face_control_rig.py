"""Prove the official MetaHuman face Control Rig portable bake path.

The previous Sequencer export sampled the Face component before MetaHuman Rig
Logic had converted animation curves into skeletal motion.  This probe uses
Epic's Face_ControlBoard_CtrlRig and its Backwards Solve path explicitly, then
exports two semantically different source clips.  The result is accepted only
when the two baked facial poses have distinct bone payloads.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import sys

import unreal


SCRIPT_DIRECTORY = Path(__file__).resolve().parent
if str(SCRIPT_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIRECTORY))

from bake_web_facial_moods import (  # noqa: E402
    FPS,
    LEVEL_PATH,
    TEMP_ROOT,
    gltf_options,
    meeting_face,
    recreate_asset,
)
from bake_web_facial_visemes import (  # noqa: E402
    KEY_TIMES as VISEME_KEY_TIMES,
    KEY_WEIGHTS as VISEME_KEY_WEIGHTS,
    load_samples,
)


CONTROL_RIG_PATH = "/MetaHumanCharacter/Face/Face_ControlBoard_CtrlRig"
SOURCES = {
    "amused": "/Game/Conclavia/Meeting/WebExport/AS_WebMoodAmused_CurveOnly_v1",
    "o-open": "/Game/Conclavia/Meeting/WebExport/AS_WebVisemeOOpen_CurveOnly_v1",
}
OUTPUT_DIRECTORY = Path(
    os.environ.get(
        "CONCLAVIA_WEB_FACE_CONTROL_RIG_PROBE_DIR",
        str(Path(unreal.Paths.project_saved_dir()) / "WebFaceControlRigProbe"),
    )
)


def log(message: str) -> None:
    unreal.log_warning(f"CONCLAVIA_WEB_FACE_CONTROL_RIG_PROBE: {message}")


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


def replace_channel_key(channel, at: int, value: float) -> None:
    for existing in channel.get_keys():
        if existing.get_time().frame_number.value == at:
            existing.set_value(value)
            return
    channel.add_key(unreal.FrameNumber(at), value)


def key_viseme_controls(
    sequence: unreal.LevelSequence,
    rig: unreal.ControlRig,
    section,
    controls: dict[str, float],
) -> dict[str, object]:
    hierarchy = rig.get_hierarchy()
    grouped: dict[str, dict[str, float]] = {}
    for control_path, value in controls.items():
        control_name, component = control_path.rsplit(".", 1)
        grouped.setdefault(control_name, {})[component] = float(value)

    control_types: dict[str, str] = {}
    channels = {str(channel.get_name()): channel for channel in section.get_all_channels()}
    raw_keyed = 0
    for control_name, components in grouped.items():
        key = unreal.RigElementKey(
            type=unreal.RigElementType.CONTROL,
            name=control_name,
        )
        settings = hierarchy.get_control_settings(key)
        control_type = settings.control_type
        control_types[control_name] = str(control_type)
        for time_seconds, weight in zip(VISEME_KEY_TIMES, VISEME_KEY_WEIGHTS):
            at = unreal.FrameNumber(round(time_seconds * FPS))
            if control_type == unreal.RigControlType.VECTOR2D:
                unreal.ControlRigSequencerLibrary.set_local_control_rig_vector2d(
                    sequence,
                    rig,
                    control_name,
                    at,
                    unreal.Vector2D(
                        components.get("tx", 0.0) * weight,
                        components.get("ty", 0.0) * weight,
                    ),
                )
            elif control_type == unreal.RigControlType.FLOAT:
                value = components.get("ty", components.get("tx", 0.0))
                unreal.ControlRigSequencerLibrary.set_local_control_rig_float(
                    sequence,
                    rig,
                    control_name,
                    at,
                    value * weight,
                )
            else:
                raise RuntimeError(
                    f"Unsupported face control type {control_type} for {control_name}"
                )
    missing_channels = []
    for control_path, value in controls.items():
        channel = matching_channel(channels, control_path)
        if channel is None:
            missing_channels.append(control_path)
            continue
        for time_seconds, weight in zip(VISEME_KEY_TIMES, VISEME_KEY_WEIGHTS):
            replace_channel_key(
                channel,
                round(time_seconds * FPS),
                float(value) * float(weight),
            )
        raw_keyed += 1
    if missing_channels:
        raise RuntimeError(
            "Missing raw face Control Rig channels: " + ", ".join(missing_channels)
        )
    midpoint = unreal.FrameNumber(round(VISEME_KEY_TIMES[2] * FPS))
    jaw_value = unreal.ControlRigSequencerLibrary.get_local_control_rig_vector2d(
        sequence,
        rig,
        "CTRL_C_jaw",
        midpoint,
    )
    funnel_value = unreal.ControlRigSequencerLibrary.get_local_control_rig_float(
        sequence,
        rig,
        "CTRL_L_mouth_funnelU",
        midpoint,
    )
    return {
        "sampledChannels": len(controls),
        "rigControls": len(grouped),
        "controlTypes": control_types,
        "rawKeyedChannels": raw_keyed,
        "midpointJaw": [jaw_value.x, jaw_value.y],
        "midpointLeftFunnelUpper": float(funnel_value),
    }


def bake_source(
    label: str,
    source: unreal.AnimSequence,
    face_mesh: unreal.SkeletalMesh,
    face_skeleton: unreal.Skeleton,
    rig_asset: object,
) -> dict[str, object]:
    actor_subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    temporary_actor = actor_subsystem.spawn_actor_from_class(
        unreal.SkeletalMeshActor,
        unreal.Vector(0.0, 0.0, 0.0),
        unreal.Rotator(0.0, 0.0, 0.0),
    )
    if not isinstance(temporary_actor, unreal.SkeletalMeshActor):
        raise RuntimeError("Could not spawn the face Control Rig authoring actor")
    temporary_actor.set_actor_label(f"TMP_WebFaceControlRig_{label}")
    component = temporary_actor.skeletal_mesh_component
    component.set_skeletal_mesh(face_mesh)

    safe_label = "".join(part.capitalize() for part in label.split("-"))
    sequence_name = f"LS_WebFaceControlRigProbe{safe_label}_v1"
    sequence = recreate_asset(
        f"{TEMP_ROOT}/{sequence_name}",
        sequence_name,
        unreal.LevelSequence,
        unreal.LevelSequenceFactoryNew(),
    )
    frame_count = max(2, int(round(source.get_play_length() * FPS)))
    sequence.set_display_rate(unreal.FrameRate(FPS, 1))
    sequence.set_tick_resolution_directly(unreal.FrameRate(FPS, 1))
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
        raise RuntimeError(f"Could not create the face Control Rig track for {label}")
    proxies = unreal.ControlRigSequencerLibrary.get_control_rigs(sequence)
    if not proxies:
        raise RuntimeError(f"Face Control Rig did not initialize for {label}")
    rig = proxies[0].control_rig
    section = track.get_section_to_key()
    channel_names = sorted(str(channel.get_name()) for channel in section.get_all_channels())
    diagnostic_channels = [
        name
        for name in channel_names
        if any(
            token in name
            for token in (
                "CTRL_C_jaw",
                "CTRL_C_mouth",
                "CTRL_L_mouth_funnelU",
                "CTRL_R_mouth_funnelU",
            )
        )
    ]
    diagnostic_controls = {}
    hierarchy = rig.get_hierarchy()
    for control_name in (
        "CTRL_C_jaw",
        "CTRL_C_mouth",
        "CTRL_L_mouth_funnelU",
        "CTRL_R_mouth_funnelU",
    ):
        key = unreal.RigElementKey(
            type=unreal.RigElementType.CONTROL,
            name=control_name,
        )
        try:
            settings = hierarchy.get_control_settings(key)
            diagnostic_controls[control_name] = str(settings.control_type)
        except Exception as error:
            diagnostic_controls[control_name] = f"ERROR:{type(error).__name__}:{error}"
    direct_control_report: dict[str, object] = {}
    if label == "o-open":
        samples, _ = load_samples()
        direct_control_report = key_viseme_controls(
            sequence,
            rig,
            section,
            samples["O"],
        )
        unreal.LevelSequenceEditorBlueprintLibrary.set_current_time(
            round(VISEME_KEY_TIMES[2] * FPS)
        )
        unreal.LevelSequenceEditorBlueprintLibrary.refresh_current_level_sequence()
    else:
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

    output_name = f"AS_WebFaceControlRigProbe{safe_label}_v1"
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
        raise RuntimeError(f"Could not export face Control Rig probe {label}")
    unreal.EditorAssetLibrary.save_loaded_asset(output, only_if_is_dirty=False)

    output_file = OUTPUT_DIRECTORY / f"face-control-rig-{label}.glb"
    if output_file.exists():
        output_file.unlink()
    exported = unreal.GLTFExporter.export_to_gltf(
        output,
        str(output_file),
        gltf_options(),
        set(),
    )
    result = {
        "label": label,
        "source": source.get_path_name(),
        "durationSeconds": float(output.get_play_length()),
        "boneTracks": len(unreal.AnimationLibrary.get_animation_track_names(output)),
        "startDigest": pose_digest(output, 0.0),
        "midpointDigest": pose_digest(output, float(output.get_play_length()) * 0.5),
        "endDigest": pose_digest(output, float(output.get_play_length())),
        "file": output_file.name,
        "bytes": output_file.stat().st_size if output_file.exists() else 0,
        "exported": bool(exported),
        "diagnosticChannels": diagnostic_channels,
        "diagnosticControls": diagnostic_controls,
        "directControlReport": direct_control_report,
    }
    unreal.LevelSequenceEditorBlueprintLibrary.close_level_sequence()
    actor_subsystem.destroy_actor(temporary_actor)
    return result


def main() -> None:
    if not unreal.EditorLoadingAndSavingUtils.load_map(LEVEL_PATH):
        raise RuntimeError(f"Could not load map: {LEVEL_PATH}")
    _, meeting_face_component = meeting_face()
    face_mesh = meeting_face_component.get_skeletal_mesh_asset()
    if not isinstance(face_mesh, unreal.SkeletalMesh):
        raise RuntimeError("Showcase Face has no Skeletal Mesh")
    face_skeleton = face_mesh.get_editor_property("skeleton")
    if not isinstance(face_skeleton, unreal.Skeleton):
        raise RuntimeError("Showcase Face has no Skeleton")
    rig_asset = unreal.load_asset(CONTROL_RIG_PATH)
    if rig_asset is None or not hasattr(rig_asset, "get_control_rig_class"):
        raise RuntimeError(f"Missing MetaHuman face Control Rig: {CONTROL_RIG_PATH}")
    OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)

    results = []
    for label, path in SOURCES.items():
        source = unreal.load_asset(path)
        if not isinstance(source, unreal.AnimSequence):
            raise RuntimeError(f"Missing face probe source: {path}")
        results.append(bake_source(label, source, face_mesh, face_skeleton, rig_asset))

    midpoint_digests = {result["midpointDigest"] for result in results}
    time_varying = all(
        result["startDigest"] != result["midpointDigest"]
        and result["midpointDigest"] != result["endDigest"]
        for result in results
    )
    report = {
        "schema": "conclavia.web-face-control-rig-probe",
        "version": 1,
        "engineVersion": unreal.SystemLibrary.get_engine_version(),
        "identity": face_mesh.get_path_name(),
        "controlRig": CONTROL_RIG_PATH,
        "distinctMidpointPoses": len(midpoint_digests) == len(results),
        "timeVarying": time_varying,
        "results": results,
    }
    report_path = OUTPUT_DIRECTORY / "report.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    if not report["distinctMidpointPoses"] or not report["timeVarying"]:
        raise RuntimeError(
            "Face Control Rig probe still produced neutral or identical animation"
        )
    log(
        f"READY output={OUTPUT_DIRECTORY} identity={report['identity']} "
        f"clips={len(results)}"
    )


if __name__ == "__main__":
    main()
