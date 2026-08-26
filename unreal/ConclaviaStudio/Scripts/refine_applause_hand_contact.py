"""Refine markerless applause contact through Epic's MetaHuman arm IK.

The markerless take remains the source of every body and hand rotation.  This
pass uses the MetaHuman Control Rig Backwards Solve, detects only naturally
close clap frames, and closes the remaining proportion-dependent wrist gap
symmetrically.  No pose, timing or camera motion is hand-authored.
"""

from __future__ import annotations

import math
import os
import sys

import unreal

# UnrealEditor-Cmd does not add the project Scripts directory to sys.path.
# Resolve sibling builders explicitly so this pass works both interactively
# and in the unattended AWS bake.
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from build_metahuman_hand_raise import (
    control_channels,
    frame,
    key_bool_channel,
    key_euler_channels,
)
from web_showcase_actor import ensure_showcase_export_actor


LEVEL_PATH = "/Game/Conclavia/Meeting/L_MeetingAvatar_v19"
SOURCE_PATH = "/Game/Conclavia/Meeting/Animations/AS_MeetingApplause_SeatedMarkerless_v1"
CONTROL_RIG_PATH = "/Game/Conclavia/Meeting/MetaHumans/Common/Common/MetaHuman_ControlRig"
OUTPUT_ROOT = "/Game/Conclavia/Meeting/Animations"
OUTPUT_NAME = "AS_MeetingApplause_SeatedContactIK_v3"
OUTPUT_PATH = f"{OUTPUT_ROOT}/{OUTPUT_NAME}"
TEMP_NAME = "LS_MeetingApplause_ContactIK_v3"
TEMP_PATH = f"{OUTPUT_ROOT}/{TEMP_NAME}"
FPS = 30
CONTACT_ENTRY_CM = 32.0
CONTACT_TARGET_CM = 8.0
STABLE_SEATED_BONES = (
    "root",
    "pelvis",
    "thigh_l",
    "calf_l",
    "foot_l",
    "ball_l",
    "thigh_r",
    "calf_r",
    "foot_r",
    "ball_r",
    "spine_01",
    "spine_02",
    "spine_03",
    "spine_04",
    "spine_05",
    "neck_01",
    "neck_02",
    "head",
)


def log(message: str) -> None:
    unreal.log_warning(f"CONCLAVIA_APPLAUSE_CONTACT_IK: {message}")


def recreate_asset(path: str, name: str, asset_class: type, factory: object):
    if unreal.EditorAssetLibrary.does_asset_exist(path):
        if not unreal.EditorAssetLibrary.delete_asset(path):
            raise RuntimeError(f"Could not replace {path}")
    asset = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        name, OUTPUT_ROOT, asset_class, factory
    )
    if asset is None:
        raise RuntimeError(f"Could not create {path}")
    return asset


def distance(left: unreal.Vector, right: unreal.Vector) -> float:
    dx = right.x - left.x
    dy = right.y - left.y
    dz = right.z - left.z
    return math.sqrt((dx * dx) + (dy * dy) + (dz * dz))


def corrected_pair(
    left: unreal.Transform,
    right: unreal.Transform,
) -> tuple[unreal.Transform, unreal.Transform, float]:
    separation = distance(left.translation, right.translation)
    if separation >= CONTACT_ENTRY_CM or separation <= 0.001:
        return left, right, separation
    # Ease on before contact so the IK constraint cannot create a visible snap.
    closeness = (CONTACT_ENTRY_CM - separation) / (
        CONTACT_ENTRY_CM - CONTACT_TARGET_CM
    )
    closeness = max(0.0, min(1.0, closeness))
    alpha = closeness * closeness * (3.0 - (2.0 * closeness))
    desired = separation + ((CONTACT_TARGET_CM - separation) * alpha)
    midpoint = unreal.Vector(
        (left.translation.x + right.translation.x) * 0.5,
        (left.translation.y + right.translation.y) * 0.5,
        (left.translation.z + right.translation.z) * 0.5,
    )
    half = desired * 0.5
    direction = unreal.Vector(
        (right.translation.x - left.translation.x) / separation,
        (right.translation.y - left.translation.y) / separation,
        (right.translation.z - left.translation.z) / separation,
    )
    new_left = unreal.Transform()
    new_left.translation = unreal.Vector(
        midpoint.x - (direction.x * half),
        midpoint.y - (direction.y * half),
        midpoint.z - (direction.z * half),
    )
    new_left.rotation = left.rotation
    new_left.scale3d = left.scale3d
    new_right = unreal.Transform()
    new_right.translation = unreal.Vector(
        midpoint.x + (direction.x * half),
        midpoint.y + (direction.y * half),
        midpoint.z + (direction.z * half),
    )
    new_right.rotation = right.rotation
    new_right.scale3d = right.scale3d
    return new_left, new_right, desired


def restore_seated_body(
    source: unreal.AnimSequence,
    output: unreal.AnimSequence,
    frame_count: int,
) -> int:
    """Keep the solver's arm result without accepting Full Body root pull.

    MetaHuman's arm IK can translate the root and pelvis to satisfy a hand
    target. That behaviour is useful for standing locomotion, but in a fixed
    webcam portrait it makes the participant appear to stand or makes the
    camera appear to jump. Reapply the exact markerless source transforms for
    the seated base and torso after the Backwards Solve. Arms, wrists, hands,
    fingers and timing remain the solver output.
    """

    track_names = {
        str(name)
        for name in unreal.AnimationLibrary.get_animation_track_names(output)
    }
    stable_bones = [bone for bone in STABLE_SEATED_BONES if bone in track_names]
    options = unreal.AnimPoseEvaluationOptions()
    options.set_editor_property("should_retarget", True)
    source_duration = max(0.001, float(source.get_play_length()))
    samples: dict[str, list[unreal.Transform]] = {
        bone: [] for bone in stable_bones
    }
    for at in range(frame_count + 1):
        pose = source.get_anim_pose_at_time(
            min(source_duration, at / FPS),
            options,
        )
        for bone in stable_bones:
            samples[bone].append(
                pose.get_bone_pose(bone, unreal.AnimPoseSpaces.LOCAL)
            )

    controller = output.controller
    controller.open_bracket("Restore markerless seated body after hand IK")
    try:
        for bone, transforms in samples.items():
            controller.set_bone_track_keys(
                bone,
                [value.translation for value in transforms],
                [value.rotation for value in transforms],
                [value.scale3d for value in transforms],
                False,
            )
    finally:
        controller.close_bracket(False)
    return len(stable_bones)


def build() -> None:
    if not unreal.EditorLoadingAndSavingUtils.load_map(LEVEL_PATH):
        raise RuntimeError(f"Could not load map: {LEVEL_PATH}")
    source = unreal.load_asset(SOURCE_PATH)
    rig_asset = unreal.load_asset(CONTROL_RIG_PATH)
    if not isinstance(source, unreal.AnimSequence):
        raise RuntimeError(f"Missing applause source: {SOURCE_PATH}")
    if rig_asset is None or not hasattr(rig_asset, "get_control_rig_class"):
        raise RuntimeError(f"Missing MetaHuman Control Rig: {CONTROL_RIG_PATH}")

    showcase = ensure_showcase_export_actor()
    body_mesh = showcase.body.get_skeletal_mesh_asset()
    actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    temporary_actor = actors.spawn_actor_from_class(
        unreal.SkeletalMeshActor,
        unreal.Vector(0.0, 0.0, 0.0),
        unreal.Rotator(0.0, 0.0, 0.0),
    )
    temporary_actor.set_actor_label("TMP_MeetingApplauseContactIK")
    temporary_actor.skeletal_mesh_component.set_skeletal_mesh(body_mesh)
    body_component = temporary_actor.skeletal_mesh_component

    sequence = recreate_asset(
        TEMP_PATH, TEMP_NAME, unreal.LevelSequence, unreal.LevelSequenceFactoryNew()
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
        raise RuntimeError("Could not create MetaHuman Control Rig track")
    proxies = unreal.ControlRigSequencerLibrary.get_control_rigs(sequence)
    if not proxies:
        raise RuntimeError("MetaHuman Control Rig did not initialize")
    rig = proxies[0].control_rig
    section = track.get_section_to_key()
    if not unreal.ControlRigSequencerLibrary.load_anim_sequence_into_control_rig_section(
        section, source, body_component, frame(0), reset_controls=True
    ):
        raise RuntimeError("MetaHuman Backwards Solve could not load applause")
    channels = control_channels(section)

    sides = ("l", "r")
    hand_controls = {side: f"hand_{side}_ik_ctrl" for side in sides}
    pole_controls = {side: f"arm_{side}_pv_ik_ctrl" for side in sides}
    switch_controls = {side: f"arm_{side}_fk_ik_switch" for side in sides}
    base_switches = {
        side: unreal.ControlRigSequencerLibrary.get_local_control_rig_bool(
            sequence, rig, switch_controls[side], frame(0)
        )
        for side in sides
    }
    poles = {
        side: [
            unreal.ControlRigSequencerLibrary.get_local_control_rig_euler_transform(
                sequence, rig, pole_controls[side], frame(at)
            )
            for at in range(frame_count + 1)
        ]
        for side in sides
    }
    hands = {
        side: [
            unreal.ControlRigSequencerLibrary.get_control_rig_world_transform(
                sequence, rig, hand_controls[side], frame(at)
            )
            for at in range(frame_count + 1)
        ]
        for side in sides
    }

    corrected_frames = 0
    source_min = float("inf")
    output_min = float("inf")
    for at in range(frame_count + 1):
        left, right, corrected_distance = corrected_pair(hands["l"][at], hands["r"][at])
        original_distance = distance(
            hands["l"][at].translation, hands["r"][at].translation
        )
        source_min = min(source_min, original_distance)
        output_min = min(output_min, corrected_distance)
        active = original_distance < CONTACT_ENTRY_CM
        if active:
            corrected_frames += 1
        for side, transform in (("l", left), ("r", right)):
            key_bool_channel(
                channels,
                switch_controls[side],
                at,
                (not base_switches[side]) if active else base_switches[side],
            )
            unreal.ControlRigSequencerLibrary.set_control_rig_world_transform(
                sequence, rig, hand_controls[side], frame(at), transform
            )
            key_euler_channels(channels, pole_controls[side], at, poles[side][at])

    factory = unreal.AnimSequenceFactory()
    factory.target_skeleton = source.get_editor_property("skeleton")
    output = recreate_asset(OUTPUT_PATH, OUTPUT_NAME, unreal.AnimSequence, factory)
    options = unreal.AnimSeqExportOption()
    options.export_transforms = True
    options.export_morph_targets = False
    options.evaluate_all_skeletal_mesh_components = True
    if not unreal.SequencerTools.export_anim_sequence(
        world, sequence, output, options, binding, False
    ):
        raise RuntimeError("Could not export contact-refined applause")
    stabilized_bones = restore_seated_body(source, output, frame_count)
    unreal.EditorAssetLibrary.save_loaded_asset(output, only_if_is_dirty=False)
    unreal.EditorAssetLibrary.save_loaded_asset(sequence, only_if_is_dirty=False)
    unreal.LevelSequenceEditorBlueprintLibrary.close_level_sequence()
    actors.destroy_actor(temporary_actor)
    log(
        f"READY output={output.get_path_name()} frames={frame_count + 1} "
        f"corrected={corrected_frames} source_min_cm={source_min:.3f} "
        f"target_min_cm={output_min:.3f} seated_bones={stabilized_bones}"
    )


if __name__ == "__main__":
    build()
