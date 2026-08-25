"""Resolve the one authoritative Showcase actor used by every Web bake.

The meeting level deliberately keeps a production actor as a runtime anchor.
That actor is not the Showcase identity: the native meeting renderer replaces
it at runtime after reading ``AvatarId``. Editor-only Web exports do not run
that replacement, so selecting the tagged level actor silently exported the
old Elena identity. This module mirrors the native replacement explicitly and
fails closed whenever the spawned Face or Body does not belong to Showcase.
"""

from __future__ import annotations

from dataclasses import dataclass

import unreal


MEETING_ANCHOR_TAG = "MeetingAvatarAnchor"
WEB_EXPORT_TAG = "ConclaviaWebShowcase"
SHOWCASE_CLASS_PATH = (
    "/Game/Conclavia/Meeting/MetaHumans/MHC_Showcase/MHC_Showcase/"
    "BP_MHC_Showcase.BP_MHC_Showcase_C"
)
SHOWCASE_ASSET_FRAGMENT = "/MHC_Showcase/"


@dataclass(frozen=True)
class ShowcaseActorGraph:
    actor: unreal.Actor
    face: unreal.SkeletalMeshComponent
    body: unreal.SkeletalMeshComponent
    face_mesh_path: str
    body_mesh_path: str
    groom_asset_paths: tuple[str, ...]


def _log(message: str) -> None:
    unreal.log_warning(f"CONCLAVIA_WEB_SHOWCASE: {message}")


def _asset_path(component: unreal.SkeletalMeshComponent) -> str:
    mesh = component.get_skeletal_mesh_asset()
    if not isinstance(mesh, unreal.SkeletalMesh):
        raise RuntimeError(f"{component.get_name()} has no Skeletal Mesh")
    return mesh.get_path_name()


def _single_skeletal_component(
    actor: unreal.Actor,
    name: str,
) -> unreal.SkeletalMeshComponent:
    matches = [
        component
        for component in actor.get_components_by_class(unreal.SkeletalMeshComponent)
        if component.get_name() == name
    ]
    if len(matches) != 1:
        raise RuntimeError(
            f"Expected one Showcase {name} component, found {len(matches)}"
        )
    return matches[0]


def _meeting_anchor() -> unreal.Actor:
    actors = unreal.get_editor_subsystem(
        unreal.EditorActorSubsystem
    ).get_all_level_actors()
    anchors = [
        actor
        for actor in actors
        if MEETING_ANCHOR_TAG in {str(tag) for tag in actor.tags}
    ]
    if len(anchors) != 1:
        raise RuntimeError(f"Expected one {MEETING_ANCHOR_TAG}, found {len(anchors)}")
    return anchors[0]


def _destroy_previous_web_exports() -> None:
    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    for actor in subsystem.get_all_level_actors():
        if WEB_EXPORT_TAG in {str(tag) for tag in actor.tags}:
            subsystem.destroy_actor(actor)


def _spawn_showcase(anchor: unreal.Actor) -> unreal.Actor:
    showcase_class = unreal.load_class(None, SHOWCASE_CLASS_PATH)
    if showcase_class is None:
        raise RuntimeError(f"Showcase Blueprint class is unavailable: {SHOWCASE_CLASS_PATH}")
    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    actor = subsystem.spawn_actor_from_class(
        showcase_class,
        anchor.get_actor_location(),
        anchor.get_actor_rotation(),
    )
    if actor is None:
        raise RuntimeError("Could not spawn the Showcase Web export actor")
    actor.set_actor_label("WEB_ShowcaseExportAnchor")
    actor.tags = [unreal.Name(WEB_EXPORT_TAG)]
    actor.set_actor_scale3d(anchor.get_actor_scale3d())
    actor.set_actor_hidden_in_game(False)
    return actor


def ensure_showcase_export_actor() -> ShowcaseActorGraph:
    """Spawn and validate the exact Showcase graph used by Web authoring."""

    anchor = _meeting_anchor()
    _destroy_previous_web_exports()
    actor = _spawn_showcase(anchor)
    face = _single_skeletal_component(actor, "Face")
    body = _single_skeletal_component(actor, "Body")
    face_mesh_path = _asset_path(face)
    body_mesh_path = _asset_path(body)
    for role, path in (("Face", face_mesh_path), ("Body", body_mesh_path)):
        if SHOWCASE_ASSET_FRAGMENT not in path:
            raise RuntimeError(
                f"Web {role} identity mismatch: expected {SHOWCASE_ASSET_FRAGMENT}, got {path}"
            )

    groom_paths: list[str] = []
    for component in actor.get_components_by_class(unreal.GroomComponent):
        groom = component.get_editor_property("groom_asset")
        if groom is not None:
            groom_paths.append(groom.get_path_name())
    if not groom_paths:
        raise RuntimeError("Showcase has no Groom components; refusing a bald Web export")

    for component in actor.get_components_by_class(unreal.SceneComponent):
        component.set_visibility(True, True)
        component.set_hidden_in_game(False, True)
    _log(
        "READY "
        f"class={actor.get_class().get_path_name()} "
        f"face={face_mesh_path} body={body_mesh_path} grooms={len(groom_paths)}"
    )
    return ShowcaseActorGraph(
        actor=actor,
        face=face,
        body=body,
        face_mesh_path=face_mesh_path,
        body_mesh_path=body_mesh_path,
        groom_asset_paths=tuple(sorted(groom_paths)),
    )

