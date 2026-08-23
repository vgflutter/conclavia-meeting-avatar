"""Build a small authored seated-idle repertoire for meeting avatars.

Epic currently ships one compatible 45-second MetaHuman technical body idle in
this installation. A single slowed loop is still visibly periodic in a fixed
webcam crop, so this builder extracts four different passages and bakes them as
product-owned seated clips. Every clip eases from and back to the same authored
seated anchor, which lets the runtime change clip without synthesising bone
motion or introducing a pose pop.
"""

from __future__ import annotations

from dataclasses import dataclass

import unreal


SKELETON_PATH = (
    "/MetaHumanCharacter/Female/Medium/NormalWeight/Body/metahuman_base_skel"
)
SOURCE_IDLE_PATH = (
    "/Game/Conclavia/Studio/Animations/AS_Conclavia_SeatedIdle"
)
OUTPUT_ROOT = "/Game/Conclavia/Meeting/Animations"
OUTPUT_FPS = 30
SAMPLE_RATE_HZ = 6.0


@dataclass(frozen=True)
class IdleVariant:
    asset_name: str
    source_start: float
    duration: float
    motion_scale: float


IDLE_VARIANTS = (
    IdleVariant("AS_MeetingCalmIdle_v1", 0.0, 11.6, 0.48),
    IdleVariant("AS_MeetingAttentiveIdle_v1", 10.8, 10.4, 0.68),
    IdleVariant("AS_MeetingEngagedIdle_v1", 21.4, 11.2, 0.78),
    IdleVariant("AS_MeetingReflectiveIdle_v1", 33.1, 11.7, 0.56),
)

# Motion is measured relative to the authored first frame, not the skeleton
# reference pose. The relaxed arm-down silhouette is therefore preserved while
# broad technical-review sways are attenuated for a webcam shot.
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
    # Preserve the authored seated leg pose without introducing motion below
    # the webcam crop.
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


def smooth_edge_envelope(phase: float) -> float:
    """Return a smooth 0..1..0 envelope with a long authored middle."""
    edge = min(1.0, phase / 0.18, (1.0 - phase) / 0.18)
    edge = max(0.0, edge)
    return edge * edge * (3.0 - (2.0 * edge))


def sample_variant(
    source: unreal.AnimSequence,
    variant: IdleVariant,
) -> dict[str, list[unreal.Transform]]:
    options = unreal.AnimPoseEvaluationOptions()
    options.set_editor_property("should_retarget", True)
    source_duration = max(0.001, float(source.get_play_length()))
    key_count = max(2, int(round(variant.duration * SAMPLE_RATE_HZ)) + 1)
    base_pose = source.get_anim_pose_at_time(0.0, options)
    bases = {
        bone: copy_transform(
            base_pose.get_bone_pose(bone, unreal.AnimPoseSpaces.LOCAL)
        )
        for bone in TRACKED_BONES
    }
    samples = {bone: [] for bone in TRACKED_BONES}

    for index in range(key_count):
        phase = index / (key_count - 1)
        source_time = min(
            source_duration,
            variant.source_start + (variant.duration * phase),
        )
        pose = source.get_anim_pose_at_time(source_time, options)
        envelope = smooth_edge_envelope(phase)
        for bone, base_weight in MOTION_WEIGHTS.items():
            base = bases[bone]
            authored = pose.get_bone_pose(bone, unreal.AnimPoseSpaces.LOCAL)
            restrained = copy_transform(base)
            restrained.rotation = base.rotation.slerp_quat(
                authored.rotation,
                base_weight * variant.motion_scale * envelope,
            )
            samples[bone].append(restrained)

    log(
        f"SAMPLED asset={variant.asset_name} start={variant.source_start:.2f} "
        f"duration={variant.duration:.2f} keys={key_count} "
        f"motion_scale={variant.motion_scale:.2f}"
    )
    return samples


def build_animation(
    skeleton: unreal.Skeleton,
    variant: IdleVariant,
    samples: dict[str, list[unreal.Transform]],
) -> unreal.AnimSequence:
    asset_path = f"{OUTPUT_ROOT}/{variant.asset_name}"
    unreal.EditorAssetLibrary.make_directory(OUTPUT_ROOT)
    if unreal.EditorAssetLibrary.does_asset_exist(asset_path):
        if not unreal.EditorAssetLibrary.delete_asset(asset_path):
            raise RuntimeError(f"Could not replace {asset_path}")

    factory = unreal.AnimSequenceFactory()
    factory.target_skeleton = skeleton
    animation = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        variant.asset_name,
        OUTPUT_ROOT,
        unreal.AnimSequence,
        factory,
    )
    if not isinstance(animation, unreal.AnimSequence):
        raise RuntimeError(f"Could not create {asset_path}")

    controller = animation.controller
    controller.open_bracket(f"Build meeting idle {variant.asset_name}")
    try:
        frame_count = max(1, int(round(variant.duration * OUTPUT_FPS)))
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

    built: list[str] = []
    for variant in IDLE_VARIANTS:
        animation = build_animation(
            skeleton,
            variant,
            sample_variant(source, variant),
        )
        built.append(animation.get_path_name())

    log(
        f"READY variants={len(built)} assets={','.join(built)} "
        "seated=True authored_source=True runtime_procedural_motion=False "
        "shared_anchor=True immediate_repeat=False"
    )


main()
