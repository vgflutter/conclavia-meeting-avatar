"""Build the homepage-inspired meeting identity at UE Cine fidelity.

Epic's homepage character is presented as a custom MetaHuman rather than a
named Core Data preset.  This reproducible profile therefore starts from the
closest installed identity family (Jelena), asks MetaHuman Creator for its
highest source-texture tier and assembles a new, separately named Cine asset.
It intentionally never mutates or mislabels the shipped Jelena preset.
"""

from __future__ import annotations

import unreal


PRESET_NAME = "Jelena"
CHARACTER_NAME = "MHC_Showcase"
PRESET_PATH = f"/MetaHumanCharacter/Optional/Presets/{PRESET_NAME}.{PRESET_NAME}"
CHARACTER_ROOT = "/Game/Conclavia/Meeting/Characters"
CHARACTER_PATH = f"{CHARACTER_ROOT}/{CHARACTER_NAME}"
GENERATED_ROOT = "/Game/Conclavia/Meeting/MetaHumans"
BUILD_ROOT = f"{GENERATED_ROOT}/{CHARACTER_NAME}"
COMMON_ROOT = f"{GENERATED_ROOT}/Common"


def log(message: str) -> None:
    unreal.log_warning(f"CONCLAVIA_SHOWCASE: {message}")


def assembled_blueprint() -> str | None:
    for object_path in unreal.EditorAssetLibrary.list_assets(
        BUILD_ROOT,
        recursive=True,
        include_folder=False,
    ):
        package_path = object_path.split(".", 1)[0]
        if unreal.EditorAssetLibrary.load_blueprint_class(package_path) is not None:
            return package_path
    return None


def fresh_character() -> unreal.MetaHumanCharacter:
    source = unreal.load_asset(PRESET_PATH)
    if not isinstance(source, unreal.MetaHumanCharacter):
        raise RuntimeError(f"Missing MetaHuman Core Data preset: {PRESET_PATH}")

    if unreal.EditorAssetLibrary.does_asset_exist(CHARACTER_PATH):
        unreal.EditorAssetLibrary.delete_asset(CHARACTER_PATH)
    character = unreal.AssetToolsHelpers.get_asset_tools().duplicate_asset(
        asset_name=CHARACTER_NAME,
        package_path=CHARACTER_ROOT,
        original_object=source,
    )
    if not isinstance(character, unreal.MetaHumanCharacter):
        raise RuntimeError(f"Could not duplicate {PRESET_NAME} as {CHARACTER_NAME}")
    unreal.EditorAssetLibrary.save_loaded_asset(character, only_if_is_dirty=False)
    return character


def request_cine_sources(
    subsystem: unreal.MetaHumanCharacterEditorSubsystem,
    character: unreal.MetaHumanCharacter,
) -> None:
    # Source resolution belongs to the character's skin settings in UE 5.8.
    # Set each map explicitly before the blocking request: the old meeting
    # Jelena inherited the 2K defaults even though her runtime used LOD 0.
    resolution_type = getattr(unreal, "RequestTextureResolution", None)
    face_resolution = getattr(resolution_type, "RES8K", None) if resolution_type else None
    body_resolution = getattr(resolution_type, "RES4K", None) if resolution_type else None
    if face_resolution is None or body_resolution is None:
        raise RuntimeError("UE 5.8 did not expose the Cine MetaHuman texture tiers")

    skin_settings = character.get_editor_property("skin_settings")
    resolutions = skin_settings.get_editor_property(
        "desired_texture_sources_resolutions"
    )
    for property_name in (
        "face_albedo",
        "face_normal",
        "face_cavity",
        "face_animated_maps",
    ):
        resolutions.set_editor_property(property_name, face_resolution)
    for property_name in (
        "body_albedo",
        "body_normal",
        "body_cavity",
        "body_masks",
    ):
        resolutions.set_editor_property(property_name, body_resolution)
    skin_settings.set_editor_property(
        "desired_texture_sources_resolutions",
        resolutions,
    )
    subsystem.commit_skin_settings(character=character, skin_settings=skin_settings)

    log("TEXTURES_START face=8K body=4K blocking=true")
    texture_request = unreal.MetaHumanCharacterTextureRequestParams()
    texture_request.blocking = True
    texture_request.report_progress = False
    subsystem.request_texture_sources(character=character, params=texture_request)


def build() -> None:
    existing = assembled_blueprint()
    if existing is not None:
        log(f"READY reused=true preset={PRESET_NAME} pipeline=Cinematic blueprint={existing}")
        return

    unreal.EditorAssetLibrary.make_directory(CHARACTER_ROOT)
    unreal.EditorAssetLibrary.make_directory(GENERATED_ROOT)
    character = fresh_character()
    subsystem = unreal.get_editor_subsystem(unreal.MetaHumanCharacterEditorSubsystem)
    if not subsystem.try_add_object_to_edit(character=character):
        raise RuntimeError(f"Could not open {CHARACTER_NAME} for editing")

    try:
        log(f"PREVIEW preset={PRESET_NAME} identity={CHARACTER_NAME}")
        subsystem.assemble_for_preview(character=character)

        rig_request = unreal.MetaHumanCharacterAutoRiggingRequestParams()
        rig_request.blocking = True
        rig_request.report_progress = False
        rig_request.rig_type = unreal.MetaHumanRigType.JOINTS_AND_BLEND_SHAPES
        log("AUTORIG_START rig=JointsAndBlendShapes")
        subsystem.request_auto_rigging(character=character, params=rig_request)

        request_cine_sources(subsystem, character)
        if not character.has_high_resolution_textures:
            raise RuntimeError("MetaHuman source textures were not returned")
        if not subsystem.can_build_meta_human(character=character):
            raise RuntimeError("Showcase identity is not ready for Cine assembly")

        params = unreal.MetaHumanCharacterEditorBuildParameters()
        params.pipeline_type = unreal.MetaHumanDefaultPipelineType.CINEMATIC
        params.absolute_build_path = BUILD_ROOT
        params.common_folder_path = COMMON_ROOT
        params.name_override = CHARACTER_NAME
        params.enable_wardrobe_item_validation = True
        log("ASSEMBLY_START pipeline=Cinematic")
        subsystem.build_meta_human(character=character, params=params)
    finally:
        if subsystem.is_object_added_for_editing(character=character):
            subsystem.remove_object_to_edit(character)

    unreal.EditorAssetLibrary.save_directory(
        "/Game/Conclavia/Meeting",
        only_if_is_dirty=False,
        recursive=True,
    )
    blueprint = assembled_blueprint()
    if blueprint is None:
        raise RuntimeError("Cine assembly produced no Showcase Blueprint")
    log(
        f"READY reused=false preset={PRESET_NAME} faceTextures=8K bodyTextures=4K "
        f"pipeline=Cinematic blueprint={blueprint}"
    )


if __name__ == "__main__":
    build()
