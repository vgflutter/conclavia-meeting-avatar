"""Build a seated MetaHuman gesture AnimSequence from a mono video take.

This script uses the UE 5.8 Capture Manager and MetaHuman Animator APIs.  The
MetaHuman Animator Markerless Motion Capture plugin must be installed and
enabled.  Source footage is an external input and is never copied into Git.
"""

from __future__ import annotations

import argparse
import os
import sys
import time

import unreal


DEFAULT_OUTPUT_PATH = "/Game/Conclavia/Meeting/Animations"
DEFAULT_ASSET_NAME = "AS_MeetingHandRaise_SeatedMarkerless_v1"
DEFAULT_TARGET_MESH = (
    "/Game/Conclavia/Meeting/MetaHumans/MHC_Showcase/MHC_Showcase/Body/"
    "SKM_MHC_Showcase_BodyMesh.SKM_MHC_Showcase_BodyMesh"
)
SEATED_IDLE_SOURCE_PATH = (
    "/Game/Conclavia/Studio/Animations/AS_Conclavia_SeatedIdle"
)
OUTPUT_FRAME_RATE = 30
MEETING_STABILIZATION_TIME_SECONDS = 1.75
SEATED_BASE_TRACKS = {
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
}


def copy_transform(value: unreal.Transform) -> unreal.Transform:
    result = unreal.Transform()
    result.translation = value.translation
    result.rotation = value.rotation
    result.scale3d = value.scale3d
    return result


def _delete_asset_if_requested(asset_path: str, force: bool) -> None:
    if not unreal.EditorAssetLibrary.does_asset_exist(asset_path):
        return
    if not force:
        raise RuntimeError(
            f"Asset already exists: {asset_path}. Pass --force to replace it."
        )
    if not unreal.EditorAssetLibrary.delete_asset(asset_path):
        raise RuntimeError(f"Could not delete existing asset: {asset_path}")


def ingest_video(video_path: str, slate: str) -> unreal.FootageCaptureData:
    if not os.path.isfile(video_path):
        raise RuntimeError(f"Capture video does not exist: {video_path}")

    # Capture Manager refuses to overwrite an imported take and keeps deleted
    # packages alive until the editor exits. Give every solve a fresh take ID;
    # --force remains reserved for the stable performance/output assets.
    take_number = int(time.time())

    params = unreal.CaptureManagerConversionParams()
    capture_data, error_message = (
        unreal.CaptureManagerIngestBlueprintLibrary.ingest_mono_video_sync(
            video_file_path=video_path,
            audio_file_path="",
            slate=slate,
            take_number=take_number,
            params=params,
        )
    )
    if not capture_data:
        raise RuntimeError(f"Capture Manager ingest failed: {error_message}")

    unreal.log(
        "CONCLAVIA_MARKERLESS_INGEST_OK: " + capture_data.get_path_name()
    )
    return capture_data


def create_and_process_performance(
    capture_data: unreal.FootageCaptureData,
    output_path: str,
    performance_name: str,
    force: bool,
) -> unreal.MetaHumanPerformance:
    performance_path = f"{output_path}/{performance_name}"
    existing_performance = unreal.load_asset(performance_path)
    if (
        isinstance(existing_performance, unreal.MetaHumanPerformance)
        and existing_performance.contains_animation_data_type(
            unreal.FrameAnimationDataType.BODY
        )
    ):
        unreal.log(
            "CONCLAVIA_MARKERLESS_SOLVE_REUSED: "
            + existing_performance.get_path_name()
        )
        return existing_performance
    _delete_asset_if_requested(performance_path, force)

    performance = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        asset_name=performance_name,
        package_path=output_path,
        asset_class=unreal.MetaHumanPerformance,
        factory=unreal.MetaHumanPerformanceFactoryNew(),
    )
    if not performance:
        raise RuntimeError("Could not create the MetaHuman Performance asset")

    performance.set_editor_property("input_type", unreal.DataInputType.MONO_FOOTAGE)
    performance.set_editor_property("footage_capture_data", capture_data)
    performance.set_editor_property("face_tracking", False)
    performance.set_editor_property("body_tracking", True)
    performance.set_editor_property("auto_body_height", True)
    performance.set_editor_property("enable_foot_locking", True)
    performance.set_editor_property("solve_type", unreal.SolveType.STANDARD)
    performance.set_blocking_processing(True)

    diagnostics = performance.diagnostics_indicates_processing_issue()
    if diagnostics:
        unreal.log_warning(f"Markerless preflight diagnostics: {diagnostics}")

    unreal.log("CONCLAVIA_MARKERLESS_SOLVE_STARTED")
    start_error = performance.start_pipeline()
    if start_error != unreal.StartPipelineErrorType.NONE:
        raise RuntimeError(f"Markerless solve failed to start: {start_error}")

    # UE 5.8 split the old animation-data predicate by channel.  The legacy
    # contains_animation_data() call only checks the face channel, so it is
    # false for our deliberately body-only solve even when all five body
    # stages completed successfully.
    if not performance.contains_animation_data_type(
        unreal.FrameAnimationDataType.BODY
    ):
        raise RuntimeError("Markerless solve completed without body animation data")

    unreal.log(
        "CONCLAVIA_MARKERLESS_SOLVE_OK: "
        f"frames={performance.get_number_of_processed_frames()}"
    )
    unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
    return performance


def bake_body_animation(
    performance: unreal.MetaHumanPerformance,
    output_path: str,
    asset_name: str,
    target_mesh_path: str,
    required_tracks: set[str],
    motion_tracks: set[str],
    minimum_motion_delta: float,
    force: bool,
) -> unreal.AnimSequence:
    target_asset_path = f"{output_path}/{asset_name}"
    _delete_asset_if_requested(target_asset_path, force)

    target_mesh = unreal.load_asset(target_mesh_path)
    # UE 5.8's body export path requires a SkeletalMesh even though the shared
    # property also accepts Skeleton assets for face-only export. Supplying
    # metahuman_base_skel produces a valid-looking sequence with duration but
    # no body tracks, so fail closed before creating another silent asset.
    if not isinstance(target_mesh, unreal.SkeletalMesh):
        raise RuntimeError(
            f"Target MetaHuman body mesh is unavailable: {target_mesh_path}"
        )
    target_skeleton = target_mesh.get_editor_property("skeleton")
    if not isinstance(target_skeleton, unreal.Skeleton):
        raise RuntimeError(f"Target MetaHuman skeleton is unavailable: {target_mesh_path}")

    seated_idle = unreal.load_asset(SEATED_IDLE_SOURCE_PATH)
    if not isinstance(seated_idle, unreal.AnimSequence):
        raise RuntimeError(
            f"Seated MetaHuman base is unavailable: {SEATED_IDLE_SOURCE_PATH}"
        )
    pose_options = unreal.AnimPoseEvaluationOptions()
    pose_options.set_editor_property("should_retarget", True)
    seated_pose = seated_idle.get_anim_pose_at_time(0.0, pose_options)
    reference_pose = target_skeleton.get_reference_pose()

    # The 5.8 performance already exposes solver output on the complete
    # MetaHuman body hierarchy. Its ExistingSkeleton export path currently
    # returns a root-only sequence in scripted/offscreen runs, even though the
    # 278 solved frames are present. Bake those native solved transforms onto
    # the target MetaHuman skeleton directly; this is still markerless output,
    # with no hand-authored or procedural bone rotations.
    solved_frames = performance.get_animation_data()
    if len(solved_frames) < 2:
        raise RuntimeError("Markerless performance contains fewer than two frames")
    body_frames = [
        dict(frame.get_editor_property("body_animation_data"))
        for frame in solved_frames
    ]
    track_names = set(body_frames[0])
    for frame in body_frames[1:]:
        track_names.intersection_update(frame)
    required_arm_tracks = required_tracks
    missing_source_tracks = sorted(required_arm_tracks - track_names)
    if missing_source_tracks or len(track_names) < 20:
        raise RuntimeError(
            "Markerless performance contains no usable body motion: "
            f"tracks={len(track_names)} missing={missing_source_tracks}"
        )

    missing_motion_tracks = sorted(motion_tracks - track_names)
    if missing_motion_tracks:
        raise RuntimeError(
            "Markerless performance is missing motion-validation tracks: "
            f"missing={missing_motion_tracks}"
        )
    motion_rotation_deltas = {}
    for track_name in sorted(motion_tracks):
        first_rotation = body_frames[0][track_name].rotation
        motion_rotation_deltas[track_name] = max(
            abs(transform.rotation.x - first_rotation.x)
            + abs(transform.rotation.y - first_rotation.y)
            + abs(transform.rotation.z - first_rotation.z)
            + abs(transform.rotation.w - first_rotation.w)
            for transform in (frame[track_name] for frame in body_frames)
        )
    insufficient_motion_tracks = {
        track_name: delta
        for track_name, delta in motion_rotation_deltas.items()
        if delta < minimum_motion_delta
    }
    if insufficient_motion_tracks:
        raise RuntimeError(
            "Markerless performance has insufficient authored arm movement: "
            f"tracks={insufficient_motion_tracks}"
        )
    minimum_observed_motion_delta = min(motion_rotation_deltas.values())

    factory = unreal.AnimSequenceFactory()
    factory.target_skeleton = target_skeleton
    animation = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        asset_name,
        output_path,
        unreal.AnimSequence,
        factory,
    )
    if not isinstance(animation, unreal.AnimSequence):
        raise RuntimeError("Could not create the markerless AnimSequence")

    controller = animation.controller
    stabilization_frame = min(
        len(body_frames) - 1,
        int(round(MEETING_STABILIZATION_TIME_SECONDS * OUTPUT_FRAME_RATE)),
    )
    seated_base_transforms = {
        bone_name: seated_pose.get_bone_pose(
            bone_name,
            unreal.AnimPoseSpaces.LOCAL,
        )
        for bone_name in SEATED_BASE_TRACKS
        if bone_name in track_names
    }
    reference_transforms = {
        bone_name: reference_pose.get_bone_pose(
            bone_name,
            unreal.AnimPoseSpaces.LOCAL,
        )
        for bone_name in track_names
        if bone_name not in seated_base_transforms
    }
    captured_thigh = body_frames[stabilization_frame]["thigh_r"].rotation
    seated_thigh = seated_base_transforms["thigh_r"].rotation
    seated_leg_delta = (
        abs(seated_thigh.x - captured_thigh.x)
        + abs(seated_thigh.y - captured_thigh.y)
        + abs(seated_thigh.z - captured_thigh.z)
        + abs(seated_thigh.w - captured_thigh.w)
    )
    if seated_leg_delta < 0.15:
        raise RuntimeError(
            "Seated base did not produce a meaningful leg pose: "
            f"rotation_delta={seated_leg_delta:.4f}"
        )
    controller.open_bracket("Bake markerless MetaHuman body solve")
    try:
        controller.set_frame_rate(unreal.FrameRate(OUTPUT_FRAME_RATE, 1), False)
        controller.set_number_of_frames(
            unreal.FrameNumber(len(body_frames) - 1),
            False,
        )
        for bone_name in sorted(track_names):
            if bone_name in seated_base_transforms:
                # Match Epic's Layered Blend Per Bone architecture offline:
                # the seated asset owns root, pelvis and legs while the native
                # markerless solve owns the complete upper-body performance.
                # No shoulder, elbow, wrist or finger rotation is synthesized.
                seated_transform = seated_base_transforms[bone_name]
                transforms = [copy_transform(seated_transform) for _ in body_frames]
            else:
                # Markerless local translations contain calibration offsets
                # from the captured performer. Baking those offsets verbatim
                # makes the MetaHuman torso stretch and rise inside a fixed
                # webcam frame. Keep the target MetaHuman's authored bone
                # lengths and scale while preserving every captured rotation,
                # including spine, shoulder, elbow, wrist and finger motion.
                base_transform = reference_transforms[bone_name]
                transforms = []
                for frame in body_frames:
                    transformed = copy_transform(base_transform)
                    transformed.rotation = frame[bone_name].rotation
                    transforms.append(transformed)
            controller.add_bone_track(bone_name, False)
            controller.set_bone_track_keys(
                bone_name,
                [transform.translation for transform in transforms],
                [transform.rotation for transform in transforms],
                [transform.scale3d for transform in transforms],
                False,
            )
    finally:
        controller.close_bracket(False)

    baked_track_names = {
        str(track_name)
        for track_name in unreal.AnimationLibrary.get_animation_track_names(animation)
    }
    missing_arm_tracks = sorted(required_arm_tracks - baked_track_names)
    if missing_arm_tracks or len(baked_track_names) < 20:
        unreal.EditorAssetLibrary.delete_asset(target_asset_path)
        raise RuntimeError(
            "Markerless bake contains no usable body motion: "
            f"tracks={len(baked_track_names)} missing={missing_arm_tracks}"
        )

    unreal.EditorAssetLibrary.save_loaded_asset(animation, only_if_is_dirty=False)
    unreal.log(
        "CONCLAVIA_MARKERLESS_BAKE_OK: "
        f"asset={animation.get_path_name()} seconds={animation.get_play_length():.3f} "
        f"frames={len(body_frames)} tracks={len(baked_track_names)} "
        f"minimum_arm_delta={minimum_observed_motion_delta:.4f} "
        f"motion_tracks={sorted(motion_rotation_deltas)} "
        f"seated_base_tracks={len(seated_base_transforms)} "
        f"rotation_only_tracks={len(reference_transforms)} "
        f"seated_leg_delta={seated_leg_delta:.4f}"
    )
    return animation


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--video-path", required=True)
    parser.add_argument("--output-path", default=DEFAULT_OUTPUT_PATH)
    parser.add_argument("--asset-name", default=DEFAULT_ASSET_NAME)
    parser.add_argument("--target-mesh-path", default=DEFAULT_TARGET_MESH)
    parser.add_argument("--slate", default="conclavia_meeting_hand_raise")
    parser.add_argument(
        "--performance-name",
        default="MHP_MeetingHandRaise_Markerless_v1",
    )
    parser.add_argument(
        "--required-tracks",
        default="upperarm_r,lowerarm_r,hand_r",
    )
    parser.add_argument("--motion-tracks", default="upperarm_r")
    parser.add_argument("--minimum-motion-delta", type=float, default=0.15)
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def run() -> None:
    args = parse_args()
    try:
        required_tracks = {
            value.strip() for value in args.required_tracks.split(",") if value.strip()
        }
        motion_tracks = {
            value.strip() for value in args.motion_tracks.split(",") if value.strip()
        }
        if not required_tracks or not motion_tracks:
            raise RuntimeError("Required and motion track lists cannot be empty")
        capture_data = ingest_video(os.path.abspath(args.video_path), args.slate)
        performance = create_and_process_performance(
            capture_data,
            args.output_path,
            args.performance_name,
            args.force,
        )
        bake_body_animation(
            performance,
            args.output_path,
            args.asset_name,
            args.target_mesh_path,
            required_tracks,
            motion_tracks,
            args.minimum_motion_delta,
            args.force,
        )
        unreal.log("CONCLAVIA_MARKERLESS_PIPELINE_OK")
    except Exception as exception:
        unreal.log_error(f"CONCLAVIA_MARKERLESS_PIPELINE_FAILED: {exception}")
        raise


if __name__ == "__main__":
    try:
        run()
    except Exception:
        sys.exit(1)
