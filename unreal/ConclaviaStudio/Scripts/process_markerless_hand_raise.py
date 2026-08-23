"""Build a MetaHuman hand-raise AnimSequence from a mono video take.

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
DEFAULT_ASSET_NAME = "AS_MeetingHandRaise_Markerless_v1"
DEFAULT_TARGET_MESH = (
    "/Game/Conclavia/Meeting/MetaHumans/MHC_Showcase/MHC_Showcase/Body/"
    "SKM_MHC_Showcase_BodyMesh.SKM_MHC_Showcase_BodyMesh"
)
OUTPUT_FRAME_RATE = 30
MEETING_STABILIZATION_TIME_SECONDS = 1.75
STABILIZED_BODY_TRACKS = {
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


def _delete_asset_if_requested(asset_path: str, force: bool) -> None:
    if not unreal.EditorAssetLibrary.does_asset_exist(asset_path):
        return
    if not force:
        raise RuntimeError(
            f"Asset already exists: {asset_path}. Pass --force to replace it."
        )
    if not unreal.EditorAssetLibrary.delete_asset(asset_path):
        raise RuntimeError(f"Could not delete existing asset: {asset_path}")


def ingest_video(video_path: str) -> unreal.FootageCaptureData:
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
            slate="conclavia_meeting_hand_raise",
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
    force: bool,
) -> unreal.MetaHumanPerformance:
    performance_name = "MHP_MeetingHandRaise_Markerless_v1"
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
    required_arm_tracks = {"upperarm_r", "lowerarm_r", "hand_r"}
    missing_source_tracks = sorted(required_arm_tracks - track_names)
    if missing_source_tracks or len(track_names) < 20:
        raise RuntimeError(
            "Markerless performance contains no usable body motion: "
            f"tracks={len(track_names)} missing={missing_source_tracks}"
        )

    first_rotation = body_frames[0]["upperarm_r"].rotation
    maximum_rotation_delta = max(
        abs(transform.rotation.x - first_rotation.x)
        + abs(transform.rotation.y - first_rotation.y)
        + abs(transform.rotation.z - first_rotation.z)
        + abs(transform.rotation.w - first_rotation.w)
        for transform in (frame["upperarm_r"] for frame in body_frames)
    )
    if maximum_rotation_delta < 0.15:
        raise RuntimeError(
            "Markerless performance has no meaningful right-arm movement: "
            f"rotation_delta={maximum_rotation_delta:.4f}"
        )

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
    controller.open_bracket("Bake markerless MetaHuman body solve")
    try:
        controller.set_frame_rate(unreal.FrameRate(OUTPUT_FRAME_RATE, 1), False)
        controller.set_number_of_frames(
            unreal.FrameNumber(len(body_frames) - 1),
            False,
        )
        for bone_name in sorted(track_names):
            transforms = [frame[bone_name] for frame in body_frames]
            if bone_name in STABILIZED_BODY_TRACKS:
                stable_transform = body_frames[stabilization_frame][bone_name]
                transforms = [stable_transform] * len(body_frames)
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
        f"arm_delta={maximum_rotation_delta:.4f} "
        f"stabilization_frame={stabilization_frame}"
    )
    return animation


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--video-path", required=True)
    parser.add_argument("--output-path", default=DEFAULT_OUTPUT_PATH)
    parser.add_argument("--asset-name", default=DEFAULT_ASSET_NAME)
    parser.add_argument("--target-mesh-path", default=DEFAULT_TARGET_MESH)
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def run() -> None:
    args = parse_args()
    try:
        capture_data = ingest_video(os.path.abspath(args.video_path))
        performance = create_and_process_performance(
            capture_data,
            args.output_path,
            args.force,
        )
        bake_body_animation(
            performance,
            args.output_path,
            args.asset_name,
            args.target_mesh_path,
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
