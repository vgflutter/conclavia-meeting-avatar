"""Build the dedicated single-participant video-call stage.

The meeting avatar must never inherit the podcast desk, microphones, broadcast
graphics or multi-camera direction from Conclavia's show renderer.  This
builder duplicates the proven MetaHuman-bearing studio map only as an asset
source, removes every broadcast actor, keeps one assembled production body as
the runtime anchor and authors a small deterministic video-call environment.
"""

from __future__ import annotations

import math

import unreal


SOURCE_LEVEL_PATH = "/Game/Conclavia/Studio/L_PremiumStudio"
STAGE_REVISION = "v4"
LEVEL_PATH = f"/Game/Conclavia/Meeting/L_MeetingAvatar_{STAGE_REVISION}"
CONTENT_ROOT = "/Game/Conclavia/Meeting"

CUBE = "/Engine/BasicShapes/Cube.Cube"


def log(message: str) -> None:
    unreal.log_warning(f"CONCLAVIA_MEETING_STAGE: {message}")


def actor_subsystem() -> unreal.EditorActorSubsystem:
    return unreal.get_editor_subsystem(unreal.EditorActorSubsystem)


def delete_asset(path: str) -> None:
    if unreal.EditorAssetLibrary.does_asset_exist(path):
        unreal.EditorAssetLibrary.delete_asset(path)


def make_material(
    name: str,
    color: unreal.LinearColor,
    *,
    roughness: float = 0.72,
) -> unreal.Material:
    path = f"{CONTENT_ROOT}/Materials/{name}"
    delete_asset(path)
    material = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        name,
        f"{CONTENT_ROOT}/Materials",
        unreal.Material,
        unreal.MaterialFactoryNew(),
    )
    if not isinstance(material, unreal.Material):
        raise RuntimeError(f"Could not create material: {path}")

    base = unreal.MaterialEditingLibrary.create_material_expression(
        material,
        unreal.MaterialExpressionConstant4Vector,
        -280,
        -30,
    )
    base.set_editor_property("constant", color)
    unreal.MaterialEditingLibrary.connect_material_property(
        base,
        "",
        unreal.MaterialProperty.MP_BASE_COLOR,
    )
    rough = unreal.MaterialEditingLibrary.create_material_expression(
        material,
        unreal.MaterialExpressionConstant,
        -280,
        80,
    )
    rough.set_editor_property("r", roughness)
    unreal.MaterialEditingLibrary.connect_material_property(
        rough,
        "",
        unreal.MaterialProperty.MP_ROUGHNESS,
    )
    unreal.MaterialEditingLibrary.recompile_material(material)
    unreal.EditorAssetLibrary.save_loaded_asset(material, only_if_is_dirty=False)
    return material


def spawn_actor(
    actor_class: type,
    location: unreal.Vector,
    label: str,
) -> unreal.Actor:
    actor = actor_subsystem().spawn_actor_from_class(actor_class, location)
    if actor is None:
        raise RuntimeError(f"Could not spawn actor: {label}")
    actor.set_actor_label(label)
    return actor


def add_panel(
    label: str,
    location: unreal.Vector,
    scale: unreal.Vector,
    material: unreal.Material,
) -> None:
    actor = spawn_actor(unreal.StaticMeshActor, location, label)
    component = actor.get_component_by_class(unreal.StaticMeshComponent)
    mesh = unreal.load_asset(CUBE)
    if not isinstance(mesh, unreal.StaticMesh) or component is None:
        raise RuntimeError("Engine cube mesh is unavailable")
    component.set_static_mesh(mesh)
    component.set_material(0, material)
    component.set_collision_enabled(unreal.CollisionEnabled.NO_COLLISION)
    component.set_cast_shadow(False)
    actor.set_actor_scale3d(scale)
    actor.tags = [unreal.Name("ConclaviaMeetingSet"), unreal.Name(label)]


def look_at(actor: unreal.Actor, target: unreal.Vector) -> None:
    actor.set_actor_rotation(
        unreal.MathLibrary.find_look_at_rotation(actor.get_actor_location(), target),
        False,
    )


def add_camera(
    label: str,
    location: unreal.Vector,
    target: unreal.Vector,
    focal_length: float,
) -> None:
    camera = spawn_actor(unreal.CineCameraActor, location, label)
    look_at(camera, target)
    component = camera.get_cine_camera_component()
    filmback = component.get_editor_property("filmback")
    filmback.set_editor_property("sensor_width", 36.0)
    filmback.set_editor_property("sensor_height", 20.25)
    component.set_editor_property("filmback", filmback)
    component.set_editor_property("current_focal_length", focal_length)
    component.set_editor_property("current_aperture", 4.0)
    focus = component.get_editor_property("focus_settings")
    focus.set_editor_property("focus_method", unreal.CameraFocusMethod.MANUAL)
    delta = unreal.MathLibrary.subtract_vector_vector(target, location)
    focus.set_editor_property(
        "manual_focus_distance",
        math.sqrt((delta.x * delta.x) + (delta.y * delta.y) + (delta.z * delta.z)),
    )
    component.set_editor_property("focus_settings", focus)
    camera.tags = [unreal.Name("ConclaviaMeetingCamera"), unreal.Name(label)]


def add_rect_light(
    label: str,
    location: unreal.Vector,
    target: unreal.Vector,
    color: unreal.LinearColor,
    intensity: float,
    width: float,
    height: float,
) -> None:
    light = spawn_actor(unreal.RectLight, location, label)
    look_at(light, target)
    component = light.get_component_by_class(unreal.RectLightComponent)
    component.set_editor_property("intensity", intensity)
    component.set_editor_property("light_color", color.to_color(True))
    component.set_editor_property("source_width", width)
    component.set_editor_property("source_height", height)
    component.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)
    light.tags = [unreal.Name("ConclaviaMeetingSet"), unreal.Name(label)]


def keep_single_avatar_anchor() -> unreal.Actor:
    anchor: unreal.Actor | None = None
    for actor in list(actor_subsystem().get_all_level_actors()):
        if actor.get_class().get_name() == "WorldSettings":
            continue
        tags = {str(tag) for tag in actor.tags}
        is_cast = "ConclaviaProductionCast" in tags
        if is_cast and "Seat1" in tags and anchor is None:
            anchor = actor
            continue
        actor_subsystem().destroy_actor(actor)

    if anchor is None:
        raise RuntimeError("The source map contains no Seat1 production MetaHuman")

    # Runtime avatar switching copies this transform. Centre the rendered
    # bounds rather than the Blueprint root because MetaHuman identities have
    # different internal component offsets.
    bounds_origin, _ = anchor.get_actor_bounds(False)
    correction = unreal.Vector(-bounds_origin.x, -bounds_origin.y, 0.0)
    anchor.set_actor_location(
        unreal.MathLibrary.add_vector_vector(anchor.get_actor_location(), correction),
        False,
        False,
    )
    anchor.tags = [
        unreal.Name("ConclaviaProductionCast"),
        unreal.Name("Seat1"),
        unreal.Name("MeetingAvatarAnchor"),
    ]
    anchor.set_actor_label("MEETING_AvatarAnchor")
    return anchor


def build() -> None:
    # Generated meeting revisions are immutable. Reusing the exact version is
    # both faster and safer than asking Unreal to delete a package that may be
    # configured as the editor startup map. Visual changes must bump
    # STAGE_REVISION and therefore produce a new asset path.
    if unreal.EditorAssetLibrary.does_asset_exist(LEVEL_PATH):
        log(
            f"READY map={LEVEL_PATH} reused=true cameras=2 "
            "podcast_assets=0 overlay=0"
        )
        return

    # The meeting level is also the project's editor/game default. On a warm
    # rebuild Unreal may therefore keep its package loaded even after opening a
    # transient blank map, causing delete_asset to fail and duplicate_asset to
    # preserve the stale scene. Load the immutable source level explicitly so
    # the destination package is fully released before replacement.
    if not unreal.EditorLoadingAndSavingUtils.load_map(SOURCE_LEVEL_PATH):
        raise RuntimeError(f"Could not load source map: {SOURCE_LEVEL_PATH}")
    if not unreal.EditorAssetLibrary.duplicate_asset(SOURCE_LEVEL_PATH, LEVEL_PATH):
        raise RuntimeError(f"Could not duplicate source map: {SOURCE_LEVEL_PATH}")
    if not unreal.EditorLoadingAndSavingUtils.load_map(LEVEL_PATH):
        raise RuntimeError(f"Could not load meeting map: {LEVEL_PATH}")

    unreal.EditorAssetLibrary.make_directory(f"{CONTENT_ROOT}/Materials")
    anchor = keep_single_avatar_anchor()
    materials = {
        "ink": make_material(
            f"M_MeetingInk_{STAGE_REVISION}",
            unreal.LinearColor(0.002, 0.004, 0.008, 1.0),
        ),
        "teal": make_material(
            f"M_MeetingTeal_{STAGE_REVISION}",
            unreal.LinearColor(0.004, 0.055, 0.052, 1.0),
        ),
        "jade": make_material(
            f"M_MeetingJade_{STAGE_REVISION}",
            unreal.LinearColor(0.008, 0.095, 0.082, 1.0),
        ),
    }

    # A restrained teal field deliberately belongs to the standalone meeting
    # product. It gives skin and hair a clean beauty-shot contrast without
    # reintroducing the red/amber podcast set or any broadcast furniture.
    add_panel(
        "MEETING_Background_Ink",
        unreal.Vector(330.0, -250.0, 210.0),
        unreal.Vector(0.35, 2.55, 4.2),
        materials["ink"],
    )
    add_panel(
        "MEETING_Background_Teal",
        unreal.Vector(334.0, 0.0, 210.0),
        unreal.Vector(0.35, 2.40, 4.2),
        materials["teal"],
    )
    add_panel(
        "MEETING_Background_Jade",
        unreal.Vector(330.0, 245.0, 210.0),
        unreal.Vector(0.35, 2.55, 4.2),
        materials["jade"],
    )

    face_target = unreal.Vector(0.0, 0.0, 162.0)
    add_camera(
        "CAM_Meeting_Portrait",
        unreal.Vector(-300.0, 0.0, 174.0),
        face_target,
        210.0,
    )
    add_camera(
        "CAM_Meeting_Gesture",
        unreal.Vector(-520.0, 0.0, 178.0),
        unreal.Vector(0.0, 0.0, 174.0),
        70.0,
    )

    add_rect_light(
        "MEETING_Key",
        unreal.Vector(-330.0, -360.0, 510.0),
        face_target,
        unreal.LinearColor(1.0, 0.91, 0.84, 1.0),
        345.0,
        520.0,
        300.0,
    )
    add_rect_light(
        "MEETING_Fill",
        unreal.Vector(-250.0, 490.0, 390.0),
        face_target,
        unreal.LinearColor(0.26, 0.64, 1.0, 1.0),
        105.0,
        440.0,
        260.0,
    )
    add_rect_light(
        "MEETING_Rim",
        unreal.Vector(330.0, -260.0, 440.0),
        face_target,
        unreal.LinearColor(1.0, 0.34, 0.15, 1.0),
        120.0,
        400.0,
        220.0,
    )
    skylight = spawn_actor(
        unreal.SkyLight,
        unreal.Vector(0.0, 0.0, 300.0),
        "MEETING_Ambient",
    )
    sky_component = skylight.get_component_by_class(unreal.SkyLightComponent)
    sky_component.set_editor_property("intensity", 0.16)
    sky_component.set_editor_property("real_time_capture", False)
    sky_component.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)
    skylight.tags = [unreal.Name("ConclaviaMeetingSet")]

    world = unreal.get_editor_subsystem(
        unreal.UnrealEditorSubsystem
    ).get_editor_world()
    if not unreal.EditorLoadingAndSavingUtils.save_map(world, LEVEL_PATH):
        raise RuntimeError(f"Could not save meeting map: {LEVEL_PATH}")
    unreal.EditorAssetLibrary.save_directory(
        CONTENT_ROOT,
        only_if_is_dirty=False,
        recursive=True,
    )
    log(
        f"READY map={LEVEL_PATH} avatar={anchor.get_actor_label()} "
        "cameras=2 podcast_assets=0 overlay=0"
    )


if __name__ == "__main__":
    build()
