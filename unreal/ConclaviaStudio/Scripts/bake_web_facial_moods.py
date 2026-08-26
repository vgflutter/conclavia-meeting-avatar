"""Bake identity-safe semantic mood clips for the portable Web MetaHuman.

Epic's facial pose templates contain reusable Rig Logic curves together with
identity-specific bone tracks.  This authoring pass copies only a restrained
set of official control curves, evaluates them on the installed Showcase face,
and exports the resulting identity-baked skeleton animation.  Speech anatomy
is excluded from every mood except the deliberately closed-mouth positive
micro-expressions, so Web visemes remain the sole owner of jaw and articulation.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
import sys

import unreal


SCRIPT_DIRECTORY = Path(__file__).resolve().parent
if str(SCRIPT_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIRECTORY))

from web_showcase_actor import ensure_showcase_export_actor
from web_face_control_rig_bake import bake_face_animation


LEVEL_PATH = "/Game/Conclavia/Meeting/L_MeetingAvatar_v19"
TEMP_ROOT = "/Game/Conclavia/Meeting/WebExport"
FPS = 30
DURATION_SECONDS = 2.4
KEY_TIMES = [0.0, 0.18, 0.36, 0.52, 0.68, 1.72, 1.88, 2.04, 2.22, 2.4]
KEY_WEIGHTS = [0.0, 0.08, 0.45, 0.82, 1.0, 1.0, 0.82, 0.45, 0.08, 0.0]
OUTPUT_DIRECTORY = Path(
    os.environ.get(
        "CONCLAVIA_WEB_FACIAL_MOODS_OUTPUT_DIR",
        str(Path(unreal.Paths.project_saved_dir()) / "WebAvatarExport" / "showcase"),
    )
)

POSE_ROOT = "/MetaHumanCharacter/Optional/Animation/TemplateAnimations/Facial_Poses"
POSES = {
    "happy": f"{POSE_ROOT}/Happy/mhc_mh002_fmn_f_gpf_happy_s001",
    "sad": f"{POSE_ROOT}/Sad/mhc_mh002_fmn_f_gpf_sad_s001",
    "anger": f"{POSE_ROOT}/Anger/mhc_mh002_fmn_f_gpf_anger_s001",
    "fear": f"{POSE_ROOT}/Fear/mhc_mh002_fmn_f_gpf_fear_s001",
    "surprise": f"{POSE_ROOT}/Surprise/mhc_mh002_fmn_f_gpf_surprise_s001",
}


@dataclass(frozen=True)
class MoodRecipe:
    source: str
    controls: dict[str, float]


def bilateral(name: str, left: float, right: float | None = None) -> dict[str, float]:
    return {
        f"ctrl_expressions_{name}l": left,
        f"ctrl_expressions_{name}r": left if right is None else right,
    }


RECIPES: dict[str, MoodRecipe] = {
    "attentive": MoodRecipe(
        "surprise",
        {
            **bilateral("browraisein", 0.055),
            **bilateral("browraiseouter", 0.045),
            **bilateral("eyewiden", 0.035),
        },
    ),
    "curious": MoodRecipe(
        "surprise",
        {
            **bilateral("browraisein", 0.13, 0.055),
            **bilateral("browraiseouter", 0.12, 0.045),
            **bilateral("eyewiden", 0.06, 0.025),
        },
    ),
    "amused": MoodRecipe(
        "happy",
        {
            **bilateral("mouthcornerpull", 0.27),
            **bilateral("mouthdimple", 0.11),
            **bilateral("eyecheekraise", 0.16),
        },
    ),
    "confident": MoodRecipe(
        "happy",
        {
            **bilateral("mouthcornerpull", 0.12),
            **bilateral("mouthdimple", 0.045),
            **bilateral("eyecheekraise", 0.075),
        },
    ),
    "skeptical": MoodRecipe(
        "anger",
        {
            **bilateral("browdown", 0.12, 0.045),
            **bilateral("eyesquintinner", 0.075, 0.025),
            **bilateral("nosewrinkle", 0.045, 0.015),
        },
    ),
    "concerned": MoodRecipe(
        "fear",
        {
            **bilateral("browraisein", 0.13),
            **bilateral("browraiseouter", 0.07),
            **bilateral("eyewiden", 0.045),
        },
    ),
    "surprised": MoodRecipe(
        "surprise",
        {
            **bilateral("browraisein", 0.20),
            **bilateral("browraiseouter", 0.18),
            **bilateral("eyewiden", 0.16),
        },
    ),
    "empathetic": MoodRecipe(
        "sad",
        {
            **bilateral("browraisein", 0.105),
            **bilateral("browlateral", 0.055),
            **bilateral("eyesquintinner", 0.035),
        },
    ),
    "assertive": MoodRecipe(
        "anger",
        {
            **bilateral("browdown", 0.10),
            **bilateral("eyesquintinner", 0.055),
            **bilateral("nosewrinkle", 0.025),
        },
    ),
    "frustrated": MoodRecipe(
        "anger",
        {
            **bilateral("browdown", 0.18),
            **bilateral("eyesquintinner", 0.105),
            **bilateral("nosewrinkle", 0.075),
            **bilateral("nosewrinkleupper", 0.045),
        },
    ),
    "reflective": MoodRecipe(
        "sad",
        {
            **bilateral("browraisein", 0.055, 0.035),
            **bilateral("browlateral", 0.035, 0.02),
            **bilateral("eyesquintinner", 0.025, 0.015),
        },
    ),
}


def log(message: str) -> None:
    unreal.log_warning(f"CONCLAVIA_WEB_FACIAL_MOODS: {message}")


def asset_label(mood: str) -> str:
    return "".join(part.capitalize() for part in mood.split("-"))


def recreate_asset(path: str, name: str, asset_class: type, factory: object):
    if unreal.EditorAssetLibrary.does_asset_exist(path):
        if not unreal.EditorAssetLibrary.delete_asset(path):
            raise RuntimeError(f"Could not replace temporary asset: {path}")
    asset = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        name, TEMP_ROOT, asset_class, factory
    )
    if asset is None:
        raise RuntimeError(f"Could not create temporary asset: {path}")
    return asset


def meeting_face() -> tuple[unreal.Actor, unreal.SkeletalMeshComponent]:
    graph = ensure_showcase_export_actor()
    return graph.actor, graph.face


def gltf_options() -> unreal.GLTFExportOptions:
    options = unreal.GLTFExportOptions()
    for name, value in {
        "export_vertex_skin_weights": True,
        "export_morph_targets": False,
        "export_preview_mesh": False,
        "make_skinned_meshes_root": True,
        "export_cameras": False,
        "export_lights": False,
        "export_level_sequences": False,
    }.items():
        options.set_editor_property(name, value)
    return options


def source_values(recipe: MoodRecipe) -> tuple[unreal.Skeleton, dict[str, tuple[object, float]]]:
    source = unreal.load_asset(POSES[recipe.source])
    if not isinstance(source, unreal.AnimSequence):
        raise RuntimeError(f"Official MetaHuman pose is unavailable: {POSES[recipe.source]}")
    skeleton = source.get_editor_property("skeleton")
    if not isinstance(skeleton, unreal.Skeleton):
        raise RuntimeError(f"Official MetaHuman pose has no skeleton: {POSES[recipe.source]}")
    source_curves = {
        str(name).casefold(): name
        for name in unreal.AnimationLibrary.get_animation_curve_names(
            source,
            unreal.RawCurveTrackTypes.RCT_FLOAT,
        )
    }
    missing = sorted(set(recipe.controls) - set(source_curves))
    if missing:
        raise RuntimeError(
            f"Official {recipe.source} pose is missing required controls: {missing}"
        )
    values = {
        name: (
            source_curves[name],
            max(
                -1.0,
                min(
                    1.0,
                    float(
                        unreal.AnimationLibrary.get_float_value_at_time(
                            source,
                            source_curves[name],
                            0.0,
                        )
                    )
                    * gain,
                ),
            ),
        )
        for name, gain in recipe.controls.items()
    }
    return skeleton, values


def build_curve_source(mood: str, recipe: MoodRecipe) -> unreal.AnimSequence:
    skeleton, values = source_values(recipe)
    label = asset_label(mood)
    name = f"AS_WebMood{label}_CurveOnly_v1"
    path = f"{TEMP_ROOT}/{name}"
    factory = unreal.AnimSequenceFactory()
    factory.target_skeleton = skeleton
    animation = recreate_asset(path, name, unreal.AnimSequence, factory)
    controller = animation.controller
    controller.open_bracket(f"Build portable {mood} facial curves")
    try:
        controller.set_frame_rate(unreal.FrameRate(FPS, 1), False)
        controller.set_number_of_frames(
            unreal.FrameNumber(round(DURATION_SECONDS * FPS)),
            False,
        )
    finally:
        controller.close_bracket(False)
    for _, (curve_name, value) in values.items():
        unreal.AnimationLibrary.add_curve(
            animation,
            curve_name,
            unreal.RawCurveTrackTypes.RCT_FLOAT,
            False,
        )
        unreal.AnimationLibrary.add_float_curve_keys(
            animation,
            curve_name,
            KEY_TIMES,
            [value * weight for weight in KEY_WEIGHTS],
        )
    unreal.EditorAssetLibrary.save_loaded_asset(animation, only_if_is_dirty=False)
    return animation


def bake_and_export(
    mood: str,
    source: unreal.AnimSequence,
    face_mesh: unreal.SkeletalMesh,
    face_skeleton: unreal.Skeleton,
) -> dict[str, object]:
    label = asset_label(mood)
    sequence_name = f"LS_WebMood{label}_v1"
    baked_name = f"AS_WebMood{label}_v1"
    baked, bake_report = bake_face_animation(
        label=f"mood-{mood}",
        source=source,
        face_mesh=face_mesh,
        face_skeleton=face_skeleton,
        sequence_name=sequence_name,
        output_name=baked_name,
        fps=FPS,
    )
    bone_tracks = list(unreal.AnimationLibrary.get_animation_track_names(baked))
    if not bone_tracks:
        raise RuntimeError(f"Showcase mood {mood} produced no facial-bone transforms")

    output = OUTPUT_DIRECTORY / f"anim-face-{mood}.glb"
    if output.exists():
        output.unlink()
    exported = unreal.GLTFExporter.export_to_gltf(
        baked,
        str(output),
        gltf_options(),
        set(),
    )
    if not output.is_file() or output.stat().st_size < 20:
        raise RuntimeError(f"Facial GLB export failed for {mood}: {output}")
    recipe_controls = RECIPES[mood].controls
    return {
        "mood": mood,
        "file": output.name,
        "clip": baked_name,
        "bytes": output.stat().st_size,
        "boneTracks": len(bone_tracks),
        "curveCount": len(recipe_controls),
        "controls": sorted(recipe_controls),
        "poseDigests": {
            "start": bake_report["startDigest"],
            "midpoint": bake_report["midpointDigest"],
            "end": bake_report["endDigest"],
        },
        "controlRig": bake_report["controlRig"],
        "exported": bool(exported),
    }


def main() -> None:
    if not unreal.EditorLoadingAndSavingUtils.load_map(LEVEL_PATH):
        raise RuntimeError(f"Could not load meeting level: {LEVEL_PATH}")
    _, face = meeting_face()
    face_mesh = face.get_skeletal_mesh_asset()
    if not isinstance(face_mesh, unreal.SkeletalMesh):
        raise RuntimeError("Showcase Face has no Skeletal Mesh")
    face_skeleton = face_mesh.get_editor_property("skeleton")
    if not isinstance(face_skeleton, unreal.Skeleton):
        raise RuntimeError("Showcase Face mesh has no Skeleton")
    OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)

    exports = []
    for mood, recipe in RECIPES.items():
        source = build_curve_source(mood, recipe)
        result = bake_and_export(mood, source, face_mesh, face_skeleton)
        exports.append(result)
        log(
            f"MOOD mood={mood} file={result['file']} bytes={result['bytes']} "
            f"bones={result['boneTracks']} curves={result['curveCount']}"
        )
    midpoint_digests = {item["poseDigests"]["midpoint"] for item in exports}
    if len(midpoint_digests) < len(exports):
        raise RuntimeError("Portable Web mood bake produced duplicate facial poses")
    report = {
        "schema": "conclavia.web-facial-moods",
        "version": 1,
        "engineVersion": unreal.SystemLibrary.get_engine_version(),
        "identity": face_mesh.get_path_name(),
        "moods": exports,
    }
    report_path = OUTPUT_DIRECTORY / "facial-moods.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    log(
        f"READY directory={OUTPUT_DIRECTORY} moods={len(exports)} "
        f"bytes={sum(int(item['bytes']) for item in exports)}"
    )


if __name__ == "__main__":
    main()
