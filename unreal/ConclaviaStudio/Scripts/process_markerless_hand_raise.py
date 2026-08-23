"""Build a MetaHuman hand-raise AnimSequence from a mono video take.

This script uses the UE 5.8 Capture Manager and MetaHuman Animator APIs.  The
MetaHuman Animator Markerless Motion Capture plugin must be installed and
enabled.  Source footage is an external input and is never copied into Git.
"""

from __future__ import annotations

import argparse
import os
import sys

import unreal


DEFAULT_OUTPUT_PATH = "/Game/Conclavia/Meeting/Animations"
DEFAULT_ASSET_NAME = "AS_MeetingHandRaise_Markerless_v1"
DEFAULT_TARGET_MESH = (
    "/MetaHumanCharacter/Female/Medium/NormalWeight/Body/"
    "metahuman_base_skel.metahuman_base_skel"
)
DEFAULT_BODY_RETARGETER = (
    "/MetaHumanCharacter/Animation/Retargeting/"
    "RTG_MH_IKRig.RTG_MH_IKRig"
)


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

    params = unreal.CaptureManagerConversionParams()
    capture_data, error_message = (
        unreal.CaptureManagerIngestBlueprintLibrary.ingest_mono_video_sync(
            video_file_path=video_path,
            audio_file_path="",
            slate="conclavia_meeting_hand_raise",
            take_number=1,
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
    if not performance.contains_animation_data():
        raise RuntimeError("Markerless solve completed without animation data")

    unreal.log(
        "CONCLAVIA_MARKERLESS_SOLVE_OK: "
        f"frames={performance.get_number_of_processed_frames()}"
    )
    return performance


def export_body_animation(
    performance: unreal.MetaHumanPerformance,
    output_path: str,
    asset_name: str,
    target_mesh_path: str,
    retargeter_path: str,
    force: bool,
) -> unreal.AnimSequence:
    target_asset_path = f"{output_path}/{asset_name}"
    _delete_asset_if_requested(target_asset_path, force)

    target_mesh = unreal.load_asset(target_mesh_path)
    if not isinstance(target_mesh, unreal.SkeletalMesh):
        raise RuntimeError(f"Target MetaHuman body mesh is unavailable: {target_mesh_path}")

    retargeter = unreal.load_asset(retargeter_path)
    if not isinstance(retargeter, unreal.IKRetargeter):
        raise RuntimeError(f"MetaHuman body retargeter is unavailable: {retargeter_path}")

    settings = unreal.MetaHumanPerformanceExportAnimationSettings()
    settings.show_export_dialog = False
    settings.auto_save_anim_sequence = True
    settings.package_path = output_path
    settings.asset_name = asset_name
    settings.export_range = unreal.PerformanceExportRange.PROCESSING_RANGE
    settings.export_skeleton = unreal.PerformanceExportSkeleton.EXISTING_SKELETON
    settings.target_skeleton_or_skeletal_mesh = target_mesh
    settings.body_retargeter = retargeter
    settings.export_body = True
    settings.export_face = False
    settings.enable_head_movement = False
    settings.body_unsolved_behavior = unreal.BodyUnsolvedFrameBehavior.LAST_VALID_FRAME
    settings.curve_interpolation = unreal.RichCurveInterpMode.RCIM_CUBIC

    animation = unreal.MetaHumanPerformanceExportUtils.export_animation_sequence(
        performance,
        settings,
    )
    if not isinstance(animation, unreal.AnimSequence):
        raise RuntimeError("MetaHuman animation export returned no AnimSequence")

    unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
    unreal.log(
        "CONCLAVIA_MARKERLESS_EXPORT_OK: "
        f"asset={animation.get_path_name()} seconds={animation.get_play_length():.3f}"
    )
    return animation


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--video-path", required=True)
    parser.add_argument("--output-path", default=DEFAULT_OUTPUT_PATH)
    parser.add_argument("--asset-name", default=DEFAULT_ASSET_NAME)
    parser.add_argument("--target-mesh-path", default=DEFAULT_TARGET_MESH)
    parser.add_argument("--retargeter-path", default=DEFAULT_BODY_RETARGETER)
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
        export_body_animation(
            performance,
            args.output_path,
            args.asset_name,
            args.target_mesh_path,
            args.retargeter_path,
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
