"""Export the meeting MetaHuman and authored performances as Web GLBs.

The base scene owns geometry, skin weights and materials. Identity-baked facial
performances and body Animation Sequences live in separate animation-only GLBs.
Body Animation Sequences are intentionally exported into separate GLBs: this
keeps the Web performance contract independent from Pixel Streaming and lets
the browser bind every authored clip to the one resident MetaHuman skeleton.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import sys

import unreal


SCRIPT_DIRECTORY = Path(__file__).resolve().parent
if str(SCRIPT_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIRECTORY))

from web_showcase_actor import ShowcaseActorGraph, ensure_showcase_export_actor
from export_showcase_hair_atlases import export_atlases
from repair_showcase_glb import repair_showcase_face_materials


LEVEL_PATH = os.environ.get(
    "CONCLAVIA_WEB_AVATAR_LEVEL",
    "/Game/Conclavia/Meeting/L_MeetingAvatar_v19",
)
PROFILE_ID = os.environ.get("CONCLAVIA_WEB_AVATAR_ID", "showcase")
ASSET_VERSION = os.environ.get(
    "CONCLAVIA_WEB_AVATAR_ASSET_VERSION",
    "ue58-v52-compact-groom-tangent-facial-life-hq",
)
MATERIAL_BAKE_SIZE = 2048
OUTPUT_DIRECTORY = Path(
    os.environ.get(
        "CONCLAVIA_WEB_AVATAR_EXPORT_DIR",
        str(Path(unreal.Paths.project_saved_dir()) / "WebAvatarExport" / PROFILE_ID),
    )
)

ANIMATION_EXPORTS = (
    (
        "/Game/Conclavia/Meeting/Animations/AS_MeetingCalmIdle_v1",
        "anim-calm-idle.glb",
    ),
    (
        "/Game/Conclavia/Meeting/Animations/AS_MeetingAttentiveIdle_v1",
        "anim-attentive-idle.glb",
    ),
    (
        "/Game/Conclavia/Meeting/Animations/AS_MeetingEngagedIdle_v1",
        "anim-engaged-idle.glb",
    ),
    (
        "/Game/Conclavia/Meeting/Animations/AS_MeetingReflectiveIdle_v1",
        "anim-reflective-idle.glb",
    ),
    (
        "/Game/Conclavia/Meeting/Animations/AS_MeetingHandRaise_ControlRig_v2",
        "anim-hand-raise.glb",
    ),
    (
        "/Game/Conclavia/Meeting/Animations/AS_MeetingApplause_SeatedContactIK_v3",
        "anim-applause.glb",
    ),
    (
        "/Game/Conclavia/Meeting/Animations/AS_MeetingNod_Authored_v1",
        "anim-nod.glb",
    ),
    (
        "/Game/Conclavia/Meeting/Animations/AS_MeetingTilt_Authored_v1",
        "anim-tilt.glb",
    ),
    (
        "/Game/Conclavia/Meeting/Animations/AS_MeetingEmphasis_Authored_v1",
        "anim-emphasis.glb",
    ),
    (
        "/Game/Conclavia/Meeting/Animations/AS_MeetingSettle_Authored_v1",
        "anim-settle.glb",
    ),
)
FACIAL_MOODS = (
    "attentive",
    "curious",
    "amused",
    "confident",
    "skeptical",
    "concerned",
    "surprised",
    "empathetic",
    "assertive",
    "frustrated",
    "reflective",
)
FACIAL_VISEMES = (
    ("p", "p", "P"),
    ("t", "t", "T"),
    ("S", "sh", "Sh"),
    ("T", "th", "Th"),
    ("f", "f", "F"),
    ("k", "k", "K"),
    ("i", "i", "I"),
    ("r", "r", "R"),
    ("s", "s", "S"),
    ("u", "u", "U"),
    ("@", "schwa", "Schwa"),
    ("a", "a", "A"),
    ("e", "e-close", "EClose"),
    ("E", "e-open", "EOpen"),
    ("o", "o-close", "OClose"),
    ("O", "o-open", "OOpen"),
)


def facial_clip_name(mood: str) -> str:
    label = "".join(part.capitalize() for part in mood.split("-"))
    return f"AS_WebMood{label}_v1"


def viseme_clip_name(label: str) -> str:
    return f"AS_WebViseme{label}_v1"


def log(message: str) -> None:
    unreal.log_warning(f"CONCLAVIA_WEB_AVATAR_EXPORT: {message}")


def configure_options(*, preview_mesh: bool) -> unreal.GLTFExportOptions:
    options = unreal.GLTFExportOptions()
    required = {
        "export_vertex_skin_weights": True,
        # MetaHuman's 858 identity/corrective targets add ~742 MB to this
        # Showcase export. Web facial performances are baked to the identity's
        # 875-bone Face rig, so the neutral mesh does not need those deltas.
        "export_morph_targets": False,
        "export_preview_mesh": preview_mesh,
        "make_skinned_meshes_root": True,
        # Optimized/High face materials contain mesh-dependent expressions but
        # their UV0 is not a non-overlapping lightmap. UE's UseMeshData bake
        # consequently produces a striped brown face atlas. Epic explicitly
        # recommends Simple for this case: bake on a quad and retain the
        # MetaHuman's authored texture coordinates.
        "bake_material_inputs": unreal.GLTFMaterialBakeMode.SIMPLE,
        # Epic's Optimized/High assembly owns 2K source textures, but the glTF
        # exporter defaults every baked input to 1K. Preserve the full real-time
        # tier so skin normals, eyes, hair cards and wardrobe survive a close
        # webcam crop.
        "default_material_bake_size": unreal.GLTFMaterialBakeSize(
            x=MATERIAL_BAKE_SIZE,
            y=MATERIAL_BAKE_SIZE,
            auto_detect=False,
        ),
    }
    optional = {
        "export_cameras": False,
        "export_lights": False,
        "export_level_sequences": False,
        "export_hidden_in_game": False,
        "export_vertex_colors": False,
    }
    for name, value in required.items():
        try:
            options.set_editor_property(name, value)
        except Exception as error:
            raise RuntimeError(f"Required glTF option is unavailable: {name}: {error}") from error
    for name, value in optional.items():
        try:
            options.set_editor_property(name, value)
        except Exception as error:
            log(f"OPTION_SKIPPED name={name} reason={error}")
    return options


def assert_export(path: Path) -> None:
    if not path.is_file() or path.stat().st_size < 20:
        raise RuntimeError(f"glTF exporter did not produce a valid file: {path}")


def export_object(
    obj: unreal.Object,
    path: Path,
    options: unreal.GLTFExportOptions,
    selected_actors: set[unreal.Actor] | None = None,
) -> None:
    result = unreal.GLTFExporter.export_to_gltf(
        obj,
        str(path),
        options,
        selected_actors or set(),
    )
    assert_export(path)
    log(f"ASSET file={path.name} bytes={path.stat().st_size} result={result}")


def wardrobe_skin_weights(
    graph: ShowcaseActorGraph,
) -> list[list[tuple[str, float]]]:
    """Read the wardrobe's authoritative editor skin before glTF flattens it."""

    if len(graph.outfits) != 1:
        raise RuntimeError(
            f"Expected one Showcase wardrobe component, found {len(graph.outfits)}"
        )
    mesh = graph.outfits[0].get_skeletal_mesh_asset()
    if not isinstance(mesh, unreal.SkeletalMesh):
        raise RuntimeError("Showcase wardrobe component has no Skeletal Mesh")
    modifier = unreal.SkinWeightModifier()
    if not modifier.set_skeletal_mesh(mesh):
        raise RuntimeError(f"Could not inspect Showcase wardrobe skin: {mesh.get_path_name()}")
    vertex_count = int(modifier.get_num_vertices())
    if vertex_count <= 0:
        raise RuntimeError("Showcase wardrobe skin has no vertices")
    result: list[list[tuple[str, float]]] = []
    maximum_influences = 0
    for vertex_index in range(vertex_count):
        weights = modifier.get_vertex_weights(vertex_index)
        influences = sorted(
            (
                (str(bone_name), float(weight))
                for bone_name, weight in weights.items()
                if float(weight) > 0
            ),
            key=lambda item: item[1],
            reverse=True,
        )
        total = sum(weight for _, weight in influences)
        if not influences or not 0.98 <= total <= 1.02 or len(influences) > 12:
            raise RuntimeError(
                "Invalid Showcase wardrobe source weights: "
                f"vertex={vertex_index} count={len(influences)} total={total:.6f}"
            )
        maximum_influences = max(maximum_influences, len(influences))
        result.append(influences)
    log(
        "WARDROBE_SOURCE_SKIN "
        f"vertices={vertex_count} maximumInfluences={maximum_influences}"
    )
    return result


def write_bundle_inventory(
    animation_files: list[str],
    graph: ShowcaseActorGraph,
) -> None:
    payload = {
        "schema": "conclavia.web-avatar-export",
        "version": 1,
        "id": PROFILE_ID,
        "displayName": "Showcase Web MetaHuman",
        "assetVersion": ASSET_VERSION,
        "level": LEVEL_PATH,
        "model": "model.glb",
        "appearance": {
            "sourceIdentity": "MHC_Showcase",
            "sourceActorClass": graph.actor.get_class().get_path_name(),
            "faceMesh": graph.face_mesh_path,
            "bodyMesh": graph.body_mesh_path,
            "outfitMeshes": list(graph.outfit_mesh_paths),
            # Keep the authored MetaHuman body and wardrobe sections independent.
            # Skeletal Mesh Merge preserves vertices but changes the material/UV
            # section relationship used by MI_Body_Baked, producing grey atlas
            # islands on exposed arms. The browser now consumes all 12 skin
            # influences, so the original garment no longer needs that workaround.
            "bodyOutfitMerge": "source-skin-weight-modifier-extended",
            "groomAssets": list(graph.groom_asset_paths),
            "webHairMeshes": list(graph.hair_mesh_paths),
            # The stock glTF exporter ignores Groom Components. The portable
            # graph combines the Optimized/High face and body with the Cine
            # assembly's denser LOD0 hair and eyebrow card geometry.
            "hairGeometry": "cards",
            "visualReview": "pending",
            # These are acceptance criteria, not marketing labels. The local
            # installer inspects the actual GLB and rejects an export when UE
            # has silently collapsed the MetaHuman skin to four weights or
            # downsampled critical skin/hair/wardrobe maps to 1K.
            "qualityTier": "meeting-hq",
            "minimumTextureSize": MATERIAL_BAKE_SIZE,
            "minimumSkinInfluenceSets": 2,
        },
        # UE's glTF scene keeps the meeting anchor facing Unreal +X. Three.js
        # cameras conventionally look down -Z, so the portable renderer must
        # apply this explicit asset-space correction instead of guessing.
        "rotationDegrees": [0, 90, 0],
        "animationModels": animation_files
        + [f"anim-face-{mood}.glb" for mood in FACIAL_MOODS]
        + [f"anim-viseme-{alias}.glb" for _, alias, _ in FACIAL_VISEMES],
        "facialClips": {
            "visemes": {
                viseme: {
                    "clip": viseme_clip_name(label),
                    "startSeconds": 0.08,
                    "endSeconds": 0.22,
                    "loop": True,
                }
                for viseme, _, label in FACIAL_VISEMES
            },
            "moods": {
                mood: {
                    "clip": facial_clip_name(mood),
                    "startSeconds": 0.68,
                    "endSeconds": 1.72,
                    "loop": True,
                }
                for mood in FACIAL_MOODS
            },
        },
        "clips": {
            "idle": [
                "AS_MeetingCalmIdle_v1",
                "AS_MeetingEngagedIdle_v1",
            ],
            "listening": [
                "AS_MeetingAttentiveIdle_v1",
                "AS_MeetingReflectiveIdle_v1",
            ],
            "gestures": {
                "nod": "AS_MeetingNod_Authored_v1",
                "tilt": "AS_MeetingTilt_Authored_v1",
                "emphasis": "AS_MeetingEmphasis_Authored_v1",
                "settle": "AS_MeetingSettle_Authored_v1",
                "raise-hand": {
                    "clip": "AS_MeetingHandRaise_ControlRig_v2",
                    "startSeconds": 0.4,
                    "endSeconds": 1.6,
                },
                "lower-hand": {
                    "clip": "AS_MeetingHandRaise_ControlRig_v2",
                    "startSeconds": 3.5,
                    "endSeconds": 4.7,
                },
                "applause": {
                    "clip": "AS_MeetingApplause_SeatedContactIK_v3",
                    "startSeconds": 4.35,
                    "endSeconds": 6.25,
                    "loop": False,
                },
            },
        },
    }
    inventory_path = OUTPUT_DIRECTORY / "export.json"
    inventory_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    if OUTPUT_DIRECTORY.exists() and any(OUTPUT_DIRECTORY.iterdir()):
        raise RuntimeError(f"Export directory must be empty: {OUTPUT_DIRECTORY}")
    OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)
    if not unreal.EditorLoadingAndSavingUtils.load_map(LEVEL_PATH):
        raise RuntimeError(f"Could not load meeting level: {LEVEL_PATH}")
    graph = ensure_showcase_export_actor()
    source_wardrobe_weights = wardrobe_skin_weights(graph)
    hair_atlases = export_atlases(OUTPUT_DIRECTORY)
    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    model_path = OUTPUT_DIRECTORY / "model.glb"
    export_object(
        world,
        model_path,
        configure_options(preview_mesh=False),
        {graph.actor, *graph.hair_actors},
    )
    if os.environ.get("CONCLAVIA_WEB_AVATAR_SKIP_FACE_REPAIR") == "1":
        log("FACE_MATERIALS_REPAIR_SKIPPED diagnostic=true")
    else:
        repaired_materials = repair_showcase_face_materials(
            model_path,
            OUTPUT_DIRECTORY / "hair-cards-tangent.png",
            OUTPUT_DIRECTORY / "hair-cards-attribute.png",
            OUTPUT_DIRECTORY / "eyebrows-cards-tangent.png",
            OUTPUT_DIRECTORY / "eyebrows-cards-attribute.png",
            source_wardrobe_weights,
        )
        log(f"FACE_MATERIALS_REPAIRED order={','.join(repaired_materials)}")

    animation_files: list[str] = []
    for asset_path, filename in ANIMATION_EXPORTS:
        animation = unreal.load_asset(asset_path)
        if not isinstance(animation, unreal.AnimSequence):
            raise RuntimeError(f"Required Animation Sequence is unavailable: {asset_path}")
        export_object(
            animation,
            OUTPUT_DIRECTORY / filename,
            # The base GLB already owns the MetaHuman mesh and textures. Keep
            # body performances as compact skeleton-plus-track assets.
            configure_options(preview_mesh=False),
        )
        animation_files.append(filename)

    write_bundle_inventory(animation_files, graph)
    log(
        f"CONCLAVIA_WEB_AVATAR_EXPORT_OK directory={OUTPUT_DIRECTORY} "
        f"animations={len(animation_files)} hairAtlases={','.join(hair_atlases)}"
    )


if __name__ == "__main__":
    main()
