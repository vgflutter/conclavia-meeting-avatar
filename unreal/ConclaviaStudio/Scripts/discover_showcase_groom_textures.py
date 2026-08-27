"""Inventory generated MetaHuman groom textures used by the Showcase preset."""

from __future__ import annotations

import json
import os
from pathlib import Path

import unreal


ROOTS = (
    "/Game/Conclavia/Meeting/MetaHumans/Common/Optional/Grooms/GroomAssets/Hair/Hair_S_UpdoBraids",
    "/Game/Conclavia/Meeting/MetaHumans/Common/Optional/Grooms/GroomAssets/Eyebrows/Eyebrows_L_Shaded",
)


def asset_string(asset: unreal.AssetData, property_name: str) -> str:
    value = asset.get_editor_property(property_name)
    return str(value)


def main() -> None:
    registry = unreal.AssetRegistryHelpers.get_asset_registry()
    entries: list[dict[str, str]] = []
    for root in ROOTS:
        for asset in registry.get_assets_by_path(root, recursive=True):
            package_name = asset_string(asset, "package_name")
            asset_name = asset_string(asset, "asset_name")
            entries.append(
                {
                    "root": root,
                    "assetName": asset_name,
                    "assetClass": asset_string(asset, "asset_class_path"),
                    "packageName": package_name,
                    "objectPath": f"{package_name}.{asset_name}",
                }
            )
    output = Path(
        os.environ.get(
            "CONCLAVIA_GROOM_TEXTURE_DISCOVERY_OUTPUT",
            str(Path(unreal.Paths.project_saved_dir()) / "WebAvatarAuthoring" / "groom-textures.json"),
        )
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(
            {
                "schema": "conclavia.showcase-groom-textures",
                "version": 1,
                "roots": ROOTS,
                "assets": sorted(entries, key=lambda item: item["objectPath"]),
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    unreal.log_warning(
        f"CONCLAVIA_GROOM_TEXTURE_DISCOVERY_OK output={output} assets={len(entries)}"
    )


if __name__ == "__main__":
    main()
