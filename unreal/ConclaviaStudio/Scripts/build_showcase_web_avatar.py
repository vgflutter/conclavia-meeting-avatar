"""Assemble a browser-oriented copy of Showcase without touching Cine.

The meeting renderer keeps using the Cinematic Showcase assembly.  This build
is a separate Optimized/Low representation whose hair is authored as cards,
which can be inspected and converted into ordinary glTF geometry.  Reusing the
same MetaHuman Character asset preserves Showcase's identity and wardrobe.
"""

from __future__ import annotations

import unreal


CHARACTER_PATH = "/Game/Conclavia/Meeting/Characters/MHC_Showcase"
BUILD_ROOT = "/Game/Conclavia/Meeting/WebMetaHumans/MHC_Showcase_WebLow"
COMMON_ROOT = "/Game/Conclavia/Meeting/WebMetaHumans/Common"
OUTPUT_NAME = "MHC_Showcase_WebLow"


def log(message: str) -> None:
    unreal.log_warning(f"CONCLAVIA_SHOWCASE_WEB_BUILD: {message}")


def assembled_blueprint() -> str | None:
    if not unreal.EditorAssetLibrary.does_directory_exist(BUILD_ROOT):
        return None
    for object_path in unreal.EditorAssetLibrary.list_assets(
        BUILD_ROOT,
        recursive=True,
        include_folder=False,
    ):
        package_path = object_path.split(".", 1)[0]
        if unreal.EditorAssetLibrary.load_blueprint_class(package_path) is not None:
            return package_path
    return None


def build() -> None:
    existing = assembled_blueprint()
    if existing is not None:
        log(f"READY reused=true quality=Low blueprint={existing}")
        return

    character = unreal.load_asset(CHARACTER_PATH)
    if not isinstance(character, unreal.MetaHumanCharacter):
        raise RuntimeError(
            "The canonical Showcase character is missing. Build Cine Showcase first: "
            f"{CHARACTER_PATH}"
        )

    subsystem = unreal.get_editor_subsystem(unreal.MetaHumanCharacterEditorSubsystem)
    if not subsystem.try_add_object_to_edit(character=character):
        raise RuntimeError("Could not open Showcase for the Web assembly")
    try:
        if not subsystem.can_build_meta_human(character=character):
            raise RuntimeError("Showcase is not ready for an Optimized assembly")
        params = unreal.MetaHumanCharacterEditorBuildParameters()
        params.pipeline_type = unreal.MetaHumanDefaultPipelineType.OPTIMIZED
        params.pipeline_quality = unreal.MetaHumanQualityLevel.LOW
        params.absolute_build_path = BUILD_ROOT
        params.common_folder_path = COMMON_ROOT
        params.name_override = OUTPUT_NAME
        params.enable_wardrobe_item_validation = True
        log("ASSEMBLY_START pipeline=Optimized quality=Low hair=cards")
        subsystem.build_meta_human(character=character, params=params)
    finally:
        if subsystem.is_object_added_for_editing(character=character):
            subsystem.remove_object_to_edit(character)

    unreal.EditorAssetLibrary.save_directory(
        "/Game/Conclavia/Meeting/WebMetaHumans",
        only_if_is_dirty=False,
        recursive=True,
    )
    blueprint = assembled_blueprint()
    if blueprint is None:
        raise RuntimeError("Optimized Showcase assembly produced no Blueprint")
    log(f"READY reused=false quality=Low blueprint={blueprint}")


if __name__ == "__main__":
    build()
