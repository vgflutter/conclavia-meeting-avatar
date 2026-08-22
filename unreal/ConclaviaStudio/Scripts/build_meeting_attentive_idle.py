"""Build a restrained standing idle for the video-meeting renderer.

Epic's technical MetaHuman idle is useful source motion, but its broad spine
and shoulder shifts read as fast rocking in a fixed webcam crop.  This builder
keeps the authored relaxed pose and timing while retaining only a small share
of the motion around that pose.  It never rotates bones procedurally at
runtime; the result is one deterministic AnimSequence owned by the meeting
product rather than by the podcast studio.
"""

from __future__ import annotations

import unreal


SKELETON_PATH = (
    "/MetaHumanCharacter/Female/Medium/NormalWeight/Body/metahuman_base_skel"
)
SOURCE_IDLE_PATH = (
    "/MetaHumanCharacter/Optional/Animation/TemplateAnimations/"
    "Technical_Loops/Idle/mhc_mh001_fmn_b_idle"
)
OUTPUT_ROOT = "/Game/Conclavia/Meeting/Animations"
ASSET_NAME = "AS_MeetingAttentiveIdle_v1"
ASSET_PATH = f"{OUTPUT_ROOT}/{ASSET_NAME}"
OUTPUT_FPS = 30
SAMPLE_RATE_HZ = 2.0

# Motion is measured relative to the authored first frame, not the skeleton
# reference pose.  The relaxed arm-down silhouette is therefore preserved
# while the large animation-review sways are attenuated for a webcam shot.
MOTION_WEIGHTS = {
    "spine_01": 0.06,
    "spine_02": 0.08,
    "spine_03": 0.10,
    "spine_04": 0.12,
    "spine_05": 0.10,
    "neck_01": 0.06,
    "clavicle_l": 0.10,
    "clavicle_r": 0.10,
    "upperarm_l": 0.08,
    "lowerarm_l": 0.08,
    "hand_l": 0.06,
    "upperarm_r": 0.08,
    "lowerarm_r": 0.08,
    "hand_r": 0.06,
    # Keep the authored standing base but remove visible weight shifting below
    # the webcam crop. This also guarantees the meeting asset is not seated.
    "thigh_l": 0.0,
    "calf_l": 0.0,
    "foot_l": 0.0,
    "thigh_r": 0.0,
    "calf_r": 0.0,
    "foot_r": 0.0,
}
TRACKED_BONES = tuple(MOTION_WEIGHTS)


def log(message: str) -> None:
    unreal.log_warning(f"CONCLAVIA_MEETING_IDLE: {message}")


def copy_transform(value: unreal.Transform) -> unreal.Transform:
    result = unreal.Transform()
    result.translation = value.translation
    result.rotation = value.rotation
    result.scale3d = value.scale3d
    return result


def sample_source(
    source: unreal.AnimSequence,
) -> tuple[dict[str, list[unreal.Transform]], float]:
    options = unreal.AnimPoseEvaluationOptions()
    options.set_editor_property("should_retarget", True)
    duration = max(0.001, float(source.get_play_length()))
    key_count = max(2, int(round(duration * SAMPLE_RATE_HZ)) + 1)
    base_pose = source.get_anim_pose_at_time(0.0, options)
    bases = {
        bone: copy_transform(
            base_pose.get_bone_pose(bone, unreal.AnimPoseSpaces.LOCAL)
        )
        for bone in TRACKED_BONES
    }
    samples = {bone: [] for bone in TRACKED_BONES}

    for index in range(key_count):
        source_time = duration * index / (key_count - 1)
        pose = source.get_anim_pose_at_time(source_time, options)
        for bone, weight in MOTION_WEIGHTS.items():
            base = bases[bone]
            authored = pose.get_bone_pose(bone, unreal.AnimPoseSpaces.LOCAL)
            restrained = copy_transform(base)
            restrained.rotation = base.rotation.slerp_quat(
                authored.rotation,
                weight,
            )
            samples[bone].append(restrained)

    log(
        f"SAMPLED source={SOURCE_IDLE_PATH} duration={duration:.3f} "
        f"keys={key_count} max_motion_weight={max(MOTION_WEIGHTS.values()):.2f}"
    )
    return samples, duration


def build_animation(
    skeleton: unreal.Skeleton,
    samples: dict[str, list[unreal.Transform]],
    duration: float,
) -> unreal.AnimSequence:
    unreal.EditorAssetLibrary.make_directory(OUTPUT_ROOT)
    if unreal.EditorAssetLibrary.does_asset_exist(ASSET_PATH):
        if not unreal.EditorAssetLibrary.delete_asset(ASSET_PATH):
            raise RuntimeError(f"Could not replace {ASSET_PATH}")

    factory = unreal.AnimSequenceFactory()
    factory.target_skeleton = skeleton
    animation = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        ASSET_NAME,
        OUTPUT_ROOT,
        unreal.AnimSequence,
        factory,
    )
    if not isinstance(animation, unreal.AnimSequence):
        raise RuntimeError(f"Could not create {ASSET_PATH}")

    controller = animation.controller
    controller.open_bracket("Build meeting attentive idle")
    try:
        frame_count = max(1, int(round(duration * OUTPUT_FPS)))
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

    unreal.EditorAssetLibrary.save_loaded_asset(animation, only_if_is_dirty=False)
    return animation


def main() -> None:
    skeleton = unreal.load_asset(SKELETON_PATH)
    if not isinstance(skeleton, unreal.Skeleton):
        raise RuntimeError(f"Missing MetaHuman skeleton: {SKELETON_PATH}")
    source = unreal.load_asset(SOURCE_IDLE_PATH)
    if not isinstance(source, unreal.AnimSequence):
        raise RuntimeError(f"Missing authored MetaHuman idle: {SOURCE_IDLE_PATH}")
    samples, duration = sample_source(source)
    animation = build_animation(skeleton, samples, duration)
    log(
        f"READY asset={animation.get_path_name()} duration={duration:.3f} "
        "standing=True authored_source=True runtime_procedural_motion=False"
    )


main()
