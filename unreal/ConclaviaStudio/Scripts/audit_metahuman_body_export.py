"""Audit UE 5.8's native MetaHuman body-export and IK-retarget API.

This is intentionally read-only. It records the callable export surface and
installed IK Retargeter assets before the gesture pipeline chooses a native
retarget path; it never edits an animation or skeleton.
"""

from __future__ import annotations

import unreal


PERFORMANCE_PATH = (
    "/Game/Conclavia/Meeting/Animations/MHP_MeetingApplause_Markerless_v1"
)


def public_names(value: object) -> list[str]:
    return sorted(name for name in dir(value) if not name.startswith("_"))


def run() -> None:
    performance = unreal.load_asset(PERFORMANCE_PATH)
    if not isinstance(performance, unreal.MetaHumanPerformance):
        raise RuntimeError(f"Missing applause performance: {PERFORMANCE_PATH}")

    registry = unreal.AssetRegistryHelpers.get_asset_registry()
    retarget_assets = registry.get_assets_by_class(
        unreal.TopLevelAssetPath("/Script/IKRig", "IKRetargeter"),
        True,
    )
    retarget_paths = sorted(str(asset.package_name) for asset in retarget_assets)

    unreal.log_warning(
        "CONCLAVIA_BODY_EXPORT_API: "
        + ",".join(public_names(unreal.MetaHumanPerformanceExportUtils))
    )
    unreal.log_warning(
        "CONCLAVIA_BODY_EXPORT_CALL: "
        + str(unreal.MetaHumanPerformanceExportUtils.export_animation_sequence.__doc__)
    )
    unreal.log_warning(
        "CONCLAVIA_BODY_EXPORT_SETTINGS: "
        + ",".join(public_names(unreal.MetaHumanPerformanceExportAnimationSettings))
    )
    unreal.log_warning(
        "CONCLAVIA_BODY_EXPORT_SKELETON_ENUM: "
        + ",".join(public_names(unreal.PerformanceExportSkeleton))
    )
    unreal.log_warning(
        "CONCLAVIA_BODY_RETARGETERS: " + "|".join(retarget_paths)
    )
    unreal.log_warning(
        "CONCLAVIA_BODY_PERFORMANCE: "
        f"frames={performance.get_number_of_processed_frames()} "
        f"can_export={performance.can_export_animation()} "
        "body="
        f"{performance.contains_animation_data_type(unreal.FrameAnimationDataType.BODY)}"
    )
    settings = (
        unreal.MetaHumanPerformanceExportUtils
        .get_export_animation_sequence_settings(performance)
    )
    unreal.log_warning(
        "CONCLAVIA_BODY_EXPORT_DEFAULTS: "
        f"skeleton={settings.export_skeleton} "
        f"retargeter={settings.body_retargeter} "
        f"target={settings.target_skeleton_or_skeletal_mesh} "
        f"export_body={settings.export_body} export_face={settings.export_face}"
    )


if __name__ == "__main__":
    run()
