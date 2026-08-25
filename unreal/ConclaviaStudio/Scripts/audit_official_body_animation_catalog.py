"""Inventory installed Epic MetaHuman body animations for meeting microgestures.

Portable nod, tilt, emphasis and settle clips must come from authored motion,
not procedural bone guesses or aliases to the same idle loop. This audit keeps
licensed assets on the authoring machine and records only paths and metadata
needed to select safe seated upper-body sources.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import unreal


ROOTS = (
    "/MetaHumanCharacter/Optional/Animation/TemplateAnimations",
    "/MetaHumans/Common",
    "/Game/MetaHumans",
)
KEYWORDS = (
    "agree",
    "attentive",
    "body",
    "emphasis",
    "gesture",
    "head",
    "idle",
    "listen",
    "nod",
    "react",
    "settle",
    "talk",
    "tilt",
)
OUTPUT_PATH = Path(
    os.environ.get(
        "CONCLAVIA_WEB_BODY_CATALOG_OUTPUT",
        str(
            Path(unreal.Paths.project_saved_dir())
            / "WebAvatarExport"
            / "official-body-animation-catalog.json"
        ),
    )
)


def log(message: str) -> None:
    unreal.log_warning(f"CONCLAVIA_WEB_BODY_CATALOG: {message}")


def package_path(asset_data: unreal.AssetData) -> str:
    return str(asset_data.package_name)


def skeleton_path(sequence: unreal.AnimSequence) -> str | None:
    skeleton = sequence.get_editor_property("skeleton")
    return skeleton.get_path_name() if isinstance(skeleton, unreal.Skeleton) else None


def main() -> None:
    registry = unreal.AssetRegistryHelpers.get_asset_registry()
    assets: dict[str, unreal.AssetData] = {}
    root_counts: dict[str, int] = {}
    for root in ROOTS:
        found = list(registry.get_assets_by_path(root, recursive=True))
        root_counts[root] = len(found)
        for asset_data in found:
            path = package_path(asset_data)
            searchable = path.casefold()
            if any(keyword in searchable for keyword in KEYWORDS):
                assets[path] = asset_data

    entries: list[dict[str, object]] = []
    for path in sorted(assets):
        asset = assets[path].get_asset()
        if not isinstance(asset, unreal.AnimSequence):
            continue
        tracks = [
            str(name)
            for name in unreal.AnimationLibrary.get_animation_track_names(asset)
        ]
        duration = float(asset.get_play_length())
        if duration <= 0.05 or len(tracks) < 3:
            continue
        entries.append(
            {
                "path": path,
                "name": asset.get_name(),
                "durationSeconds": round(duration, 6),
                "skeleton": skeleton_path(asset),
                "boneTrackCount": len(tracks),
                "hasRootTrack": any(name.casefold() == "root" for name in tracks),
                "hasHeadTrack": any("head" in name.casefold() for name in tracks),
                "hasArmTracks": any(
                    any(token in name.casefold() for token in ("arm", "hand", "clavicle"))
                    for name in tracks
                ),
            }
        )

    if not entries:
        raise RuntimeError("No installed Epic MetaHuman body AnimSequence candidate was found")
    report = {
        "schema": "conclavia.metahuman-body-animation-catalog",
        "version": 1,
        "engineVersion": unreal.SystemLibrary.get_engine_version(),
        "roots": ROOTS,
        "rootAssetCounts": root_counts,
        "keywords": KEYWORDS,
        "candidateCount": len(entries),
        "assets": entries,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    log(f"READY path={OUTPUT_PATH} candidates={len(entries)}")


if __name__ == "__main__":
    main()
