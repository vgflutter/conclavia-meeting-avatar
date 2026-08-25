"""Inventory exportable hair geometry on Cine and Web Showcase assemblies."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import unreal


LEVEL_PATH = "/Game/Conclavia/Meeting/L_MeetingAvatar_v19"
ASSEMBLY_ROOTS = {
    "cine": "/Game/Conclavia/Meeting/MetaHumans/MHC_Showcase",
    "webLow": "/Game/Conclavia/Meeting/WebMetaHumans/MHC_Showcase_WebLow",
}
OUTPUT_PATH = Path(
    os.environ.get(
        "CONCLAVIA_SHOWCASE_HAIR_AUDIT_OUTPUT",
        str(
            Path(unreal.Paths.project_saved_dir())
            / "WebAvatarAuthoring"
            / "showcase-hair.json"
        ),
    )
)


def asset_path(value: Any) -> str | None:
    return value.get_path_name() if value is not None else None


def struct_property(value: Any, name: str) -> Any:
    try:
        return value.get_editor_property(name)
    except Exception:
        return getattr(value, name, None)


def vector(value: Any) -> list[float]:
    return [float(value.x), float(value.y), float(value.z)]


def rotator(value: Any) -> list[float]:
    return [float(value.roll), float(value.pitch), float(value.yaw)]


def find_blueprint_class(root: str) -> tuple[str, type]:
    candidates: list[tuple[str, type]] = []
    if unreal.EditorAssetLibrary.does_directory_exist(root):
        for object_path in unreal.EditorAssetLibrary.list_assets(
            root,
            recursive=True,
            include_folder=False,
        ):
            package_path = object_path.split(".", 1)[0]
            # MetaHuman roots contain many materials, meshes and animation
            # assets. Calling load_blueprint_class on each one is noisy and
            # can hide the useful Python failure in thousands of log lines.
            if not package_path.rsplit("/", 1)[-1].startswith("BP_MHC_Showcase"):
                continue
            blueprint_class = unreal.EditorAssetLibrary.load_blueprint_class(package_path)
            if blueprint_class is not None:
                candidates.append((package_path, blueprint_class))
    if len(candidates) != 1:
        raise RuntimeError(
            f"Expected one assembly Blueprint below {root}, found {len(candidates)}"
        )
    return candidates[0]


def source_entry(entry: Any) -> dict[str, Any]:
    imported_mesh = struct_property(entry, "imported_mesh")
    textures = struct_property(entry, "textures")
    texture_assets = struct_property(textures, "textures") if textures is not None else []
    return {
        "groupIndex": int(struct_property(entry, "group_index") or 0),
        "lodIndex": int(struct_property(entry, "lod_index") or -1),
        "materialSlotName": str(struct_property(entry, "material_slot_name") or ""),
        "importedMesh": asset_path(imported_mesh),
        "textures": [asset_path(texture) for texture in (texture_assets or [])],
    }


def component_inventory(component: unreal.SceneComponent) -> dict[str, Any]:
    parent = component.get_attach_parent()
    relative_location = component.get_editor_property("relative_location")
    relative_rotation = component.get_editor_property("relative_rotation")
    relative_scale = component.get_editor_property("relative_scale3d")
    payload: dict[str, Any] = {
        "name": component.get_name(),
        "class": component.get_class().get_path_name(),
        "parent": parent.get_name() if parent is not None else None,
        "socket": str(component.get_attach_socket_name()),
        "relativeLocation": vector(relative_location),
        "relativeRotation": rotator(relative_rotation),
        "relativeScale": vector(relative_scale),
    }
    if isinstance(component, unreal.SkeletalMeshComponent):
        payload["skeletalMesh"] = asset_path(component.get_skeletal_mesh_asset())
    if isinstance(component, unreal.StaticMeshComponent):
        payload["staticMesh"] = asset_path(component.get_editor_property("static_mesh"))
    return payload


def inspect_assembly(label: str, root: str, offset: float) -> dict[str, Any]:
    blueprint_path, blueprint_class = find_blueprint_class(root)
    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    actor = subsystem.spawn_actor_from_class(
        blueprint_class,
        unreal.Vector(offset, 0.0, 0.0),
        unreal.Rotator(),
    )
    if actor is None:
        raise RuntimeError(f"Could not spawn {label} assembly")
    grooms: list[dict[str, Any]] = []
    for component in actor.get_components_by_class(unreal.GroomComponent):
        groom = component.get_editor_property("groom_asset")
        if groom is None:
            continue
        # UE 5.8 declares Blueprint getters for these arrays but does not
        # generate their Python methods. The reflected editor properties are
        # available and return the same source-description structs.
        cards = groom.get_editor_property("hair_groups_cards")
        meshes = groom.get_editor_property("hair_groups_meshes")
        grooms.append(
            {
                **component_inventory(component),
                "groomAsset": asset_path(groom),
                "bindingAsset": asset_path(
                    component.get_editor_property("binding_asset")
                ),
                "cards": [source_entry(entry) for entry in cards],
                "meshes": [source_entry(entry) for entry in meshes],
            }
        )
    components = [
        component_inventory(component)
        for component in actor.get_components_by_class(unreal.SceneComponent)
        if isinstance(component, (unreal.SkeletalMeshComponent, unreal.StaticMeshComponent))
    ]
    subsystem.destroy_actor(actor)
    return {
        "label": label,
        "root": root,
        "blueprint": blueprint_path,
        "grooms": grooms,
        "renderableComponents": components,
        "exportableHairMeshes": sorted(
            {
                entry["importedMesh"]
                for groom in grooms
                for kind in ("cards", "meshes")
                for entry in groom[kind]
                if entry["importedMesh"]
            }
        ),
    }


def main() -> None:
    if not unreal.EditorLoadingAndSavingUtils.load_map(LEVEL_PATH):
        raise RuntimeError(f"Could not load meeting level: {LEVEL_PATH}")
    assemblies = [
        inspect_assembly(label, root, float(index * 200))
        for index, (label, root) in enumerate(ASSEMBLY_ROOTS.items())
    ]
    payload = {
        "schema": "conclavia.showcase-hair-audit",
        "version": 1,
        "engineVersion": unreal.SystemLibrary.get_engine_version(),
        "assemblies": assemblies,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    counts = ",".join(
        f"{assembly['label']}:{len(assembly['exportableHairMeshes'])}"
        for assembly in assemblies
    )
    unreal.log_warning(
        f"CONCLAVIA_SHOWCASE_HAIR_AUDIT_OK output={OUTPUT_PATH} meshes={counts}"
    )


if __name__ == "__main__":
    main()
