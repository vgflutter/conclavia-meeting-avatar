"""Inventory Epic's licensed MetaHuman facial templates for Web export.

The browser runtime cannot ship or execute Rig Logic.  It can, however, play
identity-baked skeletal clips created from Epic's curve-driven facial poses.
This audit finds the installed UE 5.8 templates, records their portable curve
signatures, and deliberately keeps the large identity-specific bone tracks out
of the semantic selection step.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import unreal


ROOTS = (
    "/MetaHumanCharacter/Optional/Animation/TemplateAnimations/Facial_Poses",
    "/MetaHumanCharacter/Optional/Animation/TemplateAnimations/Expression_Loops",
)
OUTPUT_PATH = Path(
    os.environ.get(
        "CONCLAVIA_WEB_FACIAL_CATALOG_OUTPUT",
        str(
            Path(unreal.Paths.project_saved_dir())
            / "WebAvatarExport"
            / "official-facial-pose-catalog.json"
        ),
    )
)


def log(message: str) -> None:
    unreal.log_warning(f"CONCLAVIA_WEB_FACIAL_CATALOG: {message}")


def package_path(asset_data: unreal.AssetData) -> str:
    return str(asset_data.package_name)


def normalized_curve_signature(sequence: unreal.AnimSequence) -> list[dict[str, object]]:
    duration = max(0.0, float(sequence.get_play_length()))
    sample_time = duration * 0.5 if duration > 0.04 else 0.0
    curves: list[dict[str, object]] = []
    for curve_name in unreal.AnimationLibrary.get_animation_curve_names(
        sequence,
        unreal.RawCurveTrackTypes.RCT_FLOAT,
    ):
        name = str(curve_name)
        value = float(
            unreal.AnimationLibrary.get_float_value_at_time(
                sequence,
                curve_name,
                sample_time,
            )
        )
        if abs(value) < 0.005:
            continue
        curves.append({"name": name, "value": round(value, 6)})
    curves.sort(key=lambda item: abs(float(item["value"])), reverse=True)
    return curves


def main() -> None:
    registry = unreal.AssetRegistryHelpers.get_asset_registry()
    assets: dict[str, unreal.AssetData] = {}
    for root in ROOTS:
        for asset_data in registry.get_assets_by_path(root, recursive=True):
            assets[package_path(asset_data)] = asset_data

    entries: list[dict[str, object]] = []
    category_counts: dict[str, int] = {}
    for path in sorted(assets):
        asset = assets[path].get_asset()
        if not isinstance(asset, unreal.AnimSequence):
            continue
        relative = next(
            (path[len(root) :].lstrip("/") for root in ROOTS if path.startswith(root)),
            path,
        )
        category = relative.split("/", 1)[0] if "/" in relative else "uncategorized"
        curves = normalized_curve_signature(asset)
        bones = list(unreal.AnimationLibrary.get_animation_track_names(asset))
        category_counts[category] = category_counts.get(category, 0) + 1
        entries.append(
            {
                "path": path,
                "category": category,
                "durationSeconds": round(float(asset.get_play_length()), 6),
                "curveCount": len(
                    unreal.AnimationLibrary.get_animation_curve_names(
                        asset,
                        unreal.RawCurveTrackTypes.RCT_FLOAT,
                    )
                ),
                "boneTrackCount": len(bones),
                "signature": curves[:24],
            }
        )

    if not entries:
        raise RuntimeError("No installed Epic MetaHuman facial AnimSequence was found")
    report = {
        "schema": "conclavia.metahuman-facial-catalog",
        "version": 1,
        "engineVersion": unreal.SystemLibrary.get_engine_version(),
        "roots": ROOTS,
        "assetCount": len(entries),
        "categoryCounts": dict(sorted(category_counts.items())),
        "assets": entries,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    log(
        "READY "
        f"path={OUTPUT_PATH} assets={len(entries)} "
        f"categories={','.join(f'{name}:{count}' for name, count in sorted(category_counts.items()))}"
    )


if __name__ == "__main__":
    main()
