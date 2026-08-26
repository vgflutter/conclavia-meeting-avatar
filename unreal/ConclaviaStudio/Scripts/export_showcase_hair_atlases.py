"""Export the authored MetaHuman groom-card atlases without material baking.

The stock glTF exporter cannot evaluate the Hair Attributes material node on
its Simple bake quad.  It consequently emits a flat burgundy texture whose
alpha contains no usable strand coverage.  The generated card meshes already
carry the correct UV0/UV1 coordinates, so the Web pipeline can consume Epic's
source tangent and attribute atlases directly.
"""

from __future__ import annotations

import os
from pathlib import Path

import unreal


ATLAS_ASSETS = {
    "hair-cards-tangent.png": (
        "/Game/Conclavia/Meeting/MetaHumans/Common/Optional/Grooms/GroomAssets/"
        "Hair/Hair_S_UpdoBraids/Hair_S_UpdoBraids_CardsAtlas_Tangent."
        "Hair_S_UpdoBraids_CardsAtlas_Tangent"
    ),
    "hair-cards-attribute.png": (
        "/Game/Conclavia/Meeting/MetaHumans/Common/Optional/Grooms/GroomAssets/"
        "Hair/Hair_S_UpdoBraids/Hair_S_UpdoBraids_CardsAtlas_Attribute."
        "Hair_S_UpdoBraids_CardsAtlas_Attribute"
    ),
    "eyebrows-cards-tangent.png": (
        "/Game/Conclavia/Meeting/MetaHumans/Common/Optional/Grooms/GroomAssets/"
        "Eyebrows/Eyebrows_L_Shaded/Eyebrows_L_Shaded_CardsAtlas_Tangent."
        "Eyebrows_L_Shaded_CardsAtlas_Tangent"
    ),
    "eyebrows-cards-attribute.png": (
        "/Game/Conclavia/Meeting/MetaHumans/Common/Optional/Grooms/GroomAssets/"
        "Eyebrows/Eyebrows_L_Shaded/Eyebrows_L_Shaded_CardsAtlas_Attribute."
        "Eyebrows_L_Shaded_CardsAtlas_Attribute"
    ),
}


def log(message: str) -> None:
    unreal.log_warning(f"CONCLAVIA_WEB_HAIR_ATLAS: {message}")


def export_atlases(output_directory: Path) -> tuple[str, ...]:
    output_directory.mkdir(parents=True, exist_ok=True)
    exported: list[str] = []
    for filename, asset_path in ATLAS_ASSETS.items():
        texture = unreal.load_asset(asset_path)
        if not isinstance(texture, unreal.Texture2D):
            raise RuntimeError(f"MetaHuman groom atlas is unavailable: {asset_path}")
        output_path = output_directory / filename
        task = unreal.AssetExportTask()
        task.set_editor_property("object", texture)
        task.set_editor_property("filename", str(output_path))
        task.set_editor_property("automated", True)
        task.set_editor_property("prompt", False)
        task.set_editor_property("replace_identical", True)
        task.set_editor_property("exporter", unreal.TextureExporterPNG())
        if not unreal.Exporter.run_asset_export_task(task):
            raise RuntimeError(f"Could not export MetaHuman groom atlas: {asset_path}")
        if not output_path.is_file() or output_path.stat().st_size < 64:
            raise RuntimeError(f"MetaHuman groom atlas export is empty: {output_path}")
        exported.append(filename)
        log(
            f"ASSET file={filename} bytes={output_path.stat().st_size} "
            f"source={asset_path}"
        )
    return tuple(exported)


if __name__ == "__main__":
    destination = Path(
        os.environ.get(
            "CONCLAVIA_WEB_HAIR_ATLAS_OUTPUT_DIR",
            str(Path(unreal.Paths.project_saved_dir()) / "WebAvatarHairAtlases"),
        )
    )
    filenames = export_atlases(destination)
    log(f"READY directory={destination} files={','.join(filenames)}")
