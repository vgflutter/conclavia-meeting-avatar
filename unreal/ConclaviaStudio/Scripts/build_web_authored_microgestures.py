"""Bake restrained meeting microgestures from Epic's authored BodyROM.

The installed MetaHuman package contains one broad technical BodyROM rather
than separate meeting nod, tilt, emphasis and settle clips.  Shipping that ROM
would make a seated participant swing through calibration poses.  This builder
samples four genuine authored passages, measures each passage relative to its
own first frame, and composes only the restrained upper-body delta on the
product's seated anchor.

No runtime bone animation is generated.  The result is four ordinary
Animation Sequences with a smooth neutral boundary, fixed root and no pelvis or
leg tracks.  Browser and Unreal runtimes can therefore crossfade the same
authored assets without changing the meeting camera.
"""

from __future__ import annotations

from dataclasses import dataclass

import unreal


SKELETON_PATH = (
    "/MetaHumanCharacter/Female/Medium/NormalWeight/Body/metahuman_base_skel"
)
BODY_ROM_PATH = (
    "/MetaHumanCharacter/Optional/Animation/TemplateAnimations/"
    "Technical_Loops/BodyROM/mhc_body_rom_body"
)
SEATED_ANCHOR_PATH = (
    "/Game/Conclavia/Meeting/Animations/AS_MeetingCalmIdle_v1"
)
OUTPUT_ROOT = "/Game/Conclavia/Meeting/Animations"
OUTPUT_FPS = 30
SAMPLE_RATE_HZ = 30.0


@dataclass(frozen=True)
class Microgesture:
    name: str
    asset_name: str
    source_start: float
    duration: float
    motion_scale: float
    bones: tuple[str, ...]


HEAD_BONES = (
    "spine_04",
    "spine_05",
    "neck_01",
    "neck_02",
    "head",
)
UPPER_BODY_BONES = (
    "spine_02",
    "spine_03",
    "spine_04",
    "spine_05",
    "neck_01",
    "neck_02",
    "head",
    "clavicle_l",
    "upperarm_l",
    "lowerarm_l",
    "hand_l",
    "clavicle_r",
    "upperarm_r",
    "lowerarm_r",
    "hand_r",
)

# The source windows were selected from a metadata-only and local transform
# audit of Epic's installed 28.23-second BodyROM.  The motion remains Epic's
# authored performance; scale only restrains a technical range-of-motion take
# to the amplitude of a seated webcam participant.
MICROGESTURES = (
    Microgesture(
        "nod",
        "AS_MeetingNod_Authored_v1",
        9.55,
        2.05,
        0.42,
        HEAD_BONES,
    ),
    Microgesture(
        "tilt",
        "AS_MeetingTilt_Authored_v1",
        7.05,
        2.45,
        0.34,
        HEAD_BONES,
    ),
    Microgesture(
        "emphasis",
        "AS_MeetingEmphasis_Authored_v1",
        13.10,
        2.70,
        0.16,
        UPPER_BODY_BONES,
    ),
    Microgesture(
        "settle",
        "AS_MeetingSettle_Authored_v1",
        20.45,
        2.20,
        0.12,
        UPPER_BODY_BONES,
    ),
)

# Reduce motion as it approaches the pelvis and preserve most of the selected
# head/hand passage.  These are attenuation weights, never authored poses.
BONE_WEIGHTS = {
    "spine_02": 0.22,
    "spine_03": 0.34,
    "spine_04": 0.48,
    "spine_05": 0.62,
    "neck_01": 0.78,
    "neck_02": 0.90,
    "head": 1.00,
    "clavicle_l": 0.62,
    "upperarm_l": 0.78,
    "lowerarm_l": 0.88,
    "hand_l": 0.92,
    "clavicle_r": 0.62,
    "upperarm_r": 0.78,
    "lowerarm_r": 0.88,
    "hand_r": 0.92,
}

FORBIDDEN_BONE_PREFIXES = (
    "root",
    "pelvis",
    "thigh_",
    "calf_",
    "foot_",
    "ball_",
    "ik_foot_",
)


def log(message: str) -> None:
    unreal.log_warning(f"CONCLAVIA_WEB_MICROGESTURES: {message}")


def copy_transform(value: unreal.Transform) -> unreal.Transform:
    result = unreal.Transform()
    result.translation = value.translation
    result.rotation = value.rotation
    result.scale3d = value.scale3d
    return result


def smooth_edge_envelope(phase: float) -> float:
    """Ease the baked clip from and back to the shared seated anchor."""
    edge = min(1.0, phase / 0.24, (1.0 - phase) / 0.24)
    edge = max(0.0, edge)
    return edge * edge * (3.0 - (2.0 * edge))


def weighted_delta(delta: unreal.Quat, weight: float) -> unreal.Quat:
    identity = unreal.Quat(0.0, 0.0, 0.0, 1.0)
    return identity.slerp_quat(delta, max(0.0, min(1.0, weight)))


def sample_microgesture(
    source: unreal.AnimSequence,
    seated_anchor: unreal.AnimSequence,
    gesture: Microgesture,
) -> dict[str, list[unreal.Transform]]:
    options = unreal.AnimPoseEvaluationOptions()
    options.set_editor_property("should_retarget", True)
    source_duration = float(source.get_play_length())
    if gesture.source_start < 0.0 or gesture.source_start + gesture.duration > source_duration:
        raise RuntimeError(
            f"{gesture.name} exceeds BodyROM: start={gesture.source_start:.2f} "
            f"duration={gesture.duration:.2f} source={source_duration:.2f}"
        )

    available_tracks = {
        str(name) for name in unreal.AnimationLibrary.get_animation_track_names(source)
    }
    missing = sorted(set(gesture.bones) - available_tracks)
    if missing:
        raise RuntimeError(f"{gesture.name} BodyROM tracks are missing: {missing}")
    forbidden = sorted(
        bone
        for bone in gesture.bones
        if bone.startswith(FORBIDDEN_BONE_PREFIXES)
    )
    if forbidden:
        raise RuntimeError(f"{gesture.name} contains forbidden meeting tracks: {forbidden}")

    anchor_pose = seated_anchor.get_anim_pose_at_time(0.0, options)
    source_base_pose = source.get_anim_pose_at_time(gesture.source_start, options)
    anchors = {
        bone: copy_transform(
            anchor_pose.get_bone_pose(bone, unreal.AnimPoseSpaces.LOCAL)
        )
        for bone in gesture.bones
    }
    source_bases = {
        bone: source_base_pose.get_bone_pose(bone, unreal.AnimPoseSpaces.LOCAL).rotation
        for bone in gesture.bones
    }
    key_count = max(2, int(round(gesture.duration * SAMPLE_RATE_HZ)) + 1)
    samples = {bone: [] for bone in gesture.bones}

    maximum_delta = 0.0
    for index in range(key_count):
        phase = index / (key_count - 1)
        pose = source.get_anim_pose_at_time(
            gesture.source_start + (gesture.duration * phase),
            options,
        )
        envelope = smooth_edge_envelope(phase)
        for bone in gesture.bones:
            authored = pose.get_bone_pose(bone, unreal.AnimPoseSpaces.LOCAL)
            authored_delta = source_bases[bone].inversed() * authored.rotation
            weight = gesture.motion_scale * BONE_WEIGHTS[bone] * envelope
            restrained_delta = weighted_delta(authored_delta, weight)
            transformed = copy_transform(anchors[bone])
            transformed.rotation = (
                anchors[bone].rotation * restrained_delta
            ).normalized()
            samples[bone].append(transformed)
            maximum_delta = max(
                maximum_delta,
                abs(restrained_delta.x)
                + abs(restrained_delta.y)
                + abs(restrained_delta.z),
            )

    if maximum_delta < 0.01:
        raise RuntimeError(
            f"{gesture.name} produced no meaningful authored motion: {maximum_delta:.5f}"
        )
    log(
        f"SAMPLED gesture={gesture.name} source={BODY_ROM_PATH} "
        f"start={gesture.source_start:.2f} duration={gesture.duration:.2f} "
        f"keys={key_count} tracks={len(gesture.bones)} "
        f"motion_scale={gesture.motion_scale:.2f} max_delta={maximum_delta:.5f}"
    )
    return samples


def build_animation(
    skeleton: unreal.Skeleton,
    gesture: Microgesture,
    samples: dict[str, list[unreal.Transform]],
) -> unreal.AnimSequence:
    asset_path = f"{OUTPUT_ROOT}/{gesture.asset_name}"
    unreal.EditorAssetLibrary.make_directory(OUTPUT_ROOT)
    if unreal.EditorAssetLibrary.does_asset_exist(asset_path):
        if not unreal.EditorAssetLibrary.delete_asset(asset_path):
            raise RuntimeError(f"Could not replace {asset_path}")

    factory = unreal.AnimSequenceFactory()
    factory.target_skeleton = skeleton
    animation = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        gesture.asset_name,
        OUTPUT_ROOT,
        unreal.AnimSequence,
        factory,
    )
    if not isinstance(animation, unreal.AnimSequence):
        raise RuntimeError(f"Could not create {asset_path}")

    frame_count = max(1, int(round(gesture.duration * OUTPUT_FPS)))
    controller = animation.controller
    controller.open_bracket(f"Bake authored Web microgesture {gesture.name}")
    try:
        controller.set_frame_rate(unreal.FrameRate(OUTPUT_FPS, 1), False)
        controller.set_number_of_frames(unreal.FrameNumber(frame_count), False)
        for bone, keys in samples.items():
            controller.add_bone_track(bone, False)
            controller.set_bone_track_keys(
                bone,
                [key.translation for key in keys],
                [key.rotation for key in keys],
                [key.scale3d for key in keys],
                False,
            )
    finally:
        controller.close_bracket(False)

    baked_tracks = {
        str(name) for name in unreal.AnimationLibrary.get_animation_track_names(animation)
    }
    if baked_tracks != set(gesture.bones):
        unreal.EditorAssetLibrary.delete_asset(asset_path)
        raise RuntimeError(
            f"{gesture.name} baked unsafe track set: {sorted(baked_tracks)}"
        )
    unreal.EditorAssetLibrary.save_loaded_asset(animation, only_if_is_dirty=False)
    return animation


def main() -> None:
    skeleton = unreal.load_asset(SKELETON_PATH)
    source = unreal.load_asset(BODY_ROM_PATH)
    seated_anchor = unreal.load_asset(SEATED_ANCHOR_PATH)
    if not isinstance(skeleton, unreal.Skeleton):
        raise RuntimeError(f"Missing MetaHuman skeleton: {SKELETON_PATH}")
    if not isinstance(source, unreal.AnimSequence):
        raise RuntimeError(f"Missing official MetaHuman BodyROM: {BODY_ROM_PATH}")
    if not isinstance(seated_anchor, unreal.AnimSequence):
        raise RuntimeError(f"Missing seated anchor: {SEATED_ANCHOR_PATH}")

    built: list[str] = []
    for gesture in MICROGESTURES:
        animation = build_animation(
            skeleton,
            gesture,
            sample_microgesture(source, seated_anchor, gesture),
        )
        built.append(animation.get_path_name())

    log(
        f"READY count={len(built)} assets={','.join(built)} "
        "authored_source=Epic_BodyROM seated_anchor=True fixed_root=True "
        "runtime_procedural_motion=False"
    )


main()
