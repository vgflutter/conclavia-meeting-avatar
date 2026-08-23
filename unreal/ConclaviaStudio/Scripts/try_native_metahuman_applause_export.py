"""Exercise UE 5.8's native MetaHuman body export without touching production."""

from __future__ import annotations

import unreal


PERFORMANCE_PATH = (
    "/Game/Conclavia/Meeting/Animations/MHP_MeetingApplause_Markerless_v1"
)
TARGET_MESH_PATH = (
    "/Game/Conclavia/Meeting/MetaHumans/MHC_Showcase/MHC_Showcase/Body/"
    "SKM_MHC_Showcase_BodyMesh.SKM_MHC_Showcase_BodyMesh"
)
RETARGETER_PATH = "/MetaHumanBodyTracker/RTG_SMPL_MH"
OUTPUT_PATH = "/Game/Conclavia/Meeting/Diagnostics"
ASSET_NAME = "AS_ApplauseNativeExportTrialSMPL"


def run() -> None:
    performance = unreal.load_asset(PERFORMANCE_PATH)
    target_mesh = unreal.load_asset(TARGET_MESH_PATH)
    retargeter = unreal.load_asset(RETARGETER_PATH)
    if not isinstance(performance, unreal.MetaHumanPerformance):
        raise RuntimeError(f"Missing performance: {PERFORMANCE_PATH}")
    if not isinstance(target_mesh, unreal.SkeletalMesh):
        raise RuntimeError(f"Missing target mesh: {TARGET_MESH_PATH}")
    if not isinstance(retargeter, unreal.IKRetargeter):
        raise RuntimeError(f"Missing native MetaHuman retargeter: {RETARGETER_PATH}")

    asset_path = f"{OUTPUT_PATH}/{ASSET_NAME}"
    if unreal.EditorAssetLibrary.does_asset_exist(asset_path):
        unreal.EditorAssetLibrary.delete_asset(asset_path)

    settings = (
        unreal.MetaHumanPerformanceExportUtils
        .get_export_animation_sequence_settings(performance)
    )
    settings.show_export_dialog = False
    settings.auto_save_anim_sequence = True
    settings.asset_name = ASSET_NAME
    settings.package_path = OUTPUT_PATH
    settings.export_body = True
    settings.export_face = False
    settings.enable_head_movement = False
    settings.export_skeleton = unreal.PerformanceExportSkeleton.EXISTING_SKELETON
    settings.target_skeleton_or_skeletal_mesh = target_mesh
    settings.body_retargeter = retargeter

    animation = (
        unreal.MetaHumanPerformanceExportUtils
        .export_animation_sequence(performance, settings)
    )
    if not isinstance(animation, unreal.AnimSequence):
        raise RuntimeError("Native MetaHuman export returned no AnimSequence")

    track_names = {
        str(name)
        for name in unreal.AnimationLibrary.get_animation_track_names(animation)
    }
    required = {
        "upperarm_l", "lowerarm_l", "hand_l",
        "upperarm_r", "lowerarm_r", "hand_r",
    }
    missing = sorted(required - track_names)
    if missing or len(track_names) < 20:
        raise RuntimeError(
            "Native MetaHuman export has no usable body tracks: "
            f"tracks={len(track_names)} missing={missing}"
        )
    unreal.EditorAssetLibrary.save_loaded_asset(animation, only_if_is_dirty=False)
    unreal.log_warning(
        "CONCLAVIA_NATIVE_BODY_EXPORT_OK: "
        f"asset={animation.get_path_name()} "
        f"duration={animation.get_play_length():.3f} tracks={len(track_names)}"
    )


if __name__ == "__main__":
    run()
