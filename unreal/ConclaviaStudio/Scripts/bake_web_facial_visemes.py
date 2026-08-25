"""Bake licensed speech controls into portable identity-safe viseme clips.

The licensed runtime solver remains an authoring dependency only. Its sampled
MetaHuman controls are aligned to Polly speech marks outside Unreal, then this
pass evaluates each case-sensitive pose on the installed Showcase identity and
exports compact skeletal animation GLBs for the browser performer.
"""

from __future__ import annotations

import json
import math
import os
import sys
from pathlib import Path
from typing import Any

import unreal

SCRIPT_DIRECTORY = Path(__file__).resolve().parent
if str(SCRIPT_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIRECTORY))

from bake_web_facial_moods import (
    FPS,
    LEVEL_PATH,
    TEMP_ROOT,
    gltf_options,
    meeting_face,
    recreate_asset,
)


DURATION_SECONDS = 0.30
KEY_TIMES = [0.0, 0.04, 0.08, 0.22, 0.26, 0.30]
KEY_WEIGHTS = [0.0, 0.65, 1.0, 1.0, 0.65, 0.0]
SOURCE_POSE = (
    "/MetaHumanCharacter/Optional/Animation/TemplateAnimations/Facial_Poses/"
    "Happy/mhc_mh002_fmn_f_gpf_happy_s001"
)
INPUT_PATH = Path(
    os.environ.get(
        "CONCLAVIA_WEB_VISEME_CONTROLS_PATH",
        str(
            Path(unreal.Paths.project_saved_dir())
            / "WebAvatarAuthoring"
            / "selected-viseme-controls.json"
        ),
    )
)
OUTPUT_DIRECTORY = Path(
    os.environ.get(
        "CONCLAVIA_WEB_FACIAL_VISEMES_OUTPUT_DIR",
        str(Path(unreal.Paths.project_saved_dir()) / "WebAvatarExport" / "showcase"),
    )
)
VISEMES = (
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


def log(message: str) -> None:
    unreal.log_warning(f"CONCLAVIA_WEB_FACIAL_VISEMES: {message}")


def load_samples() -> tuple[dict[str, dict[str, float]], dict[str, Any]]:
    if not INPUT_PATH.is_file():
        raise RuntimeError(f"Selected viseme controls are unavailable: {INPUT_PATH}")
    payload = json.loads(INPUT_PATH.read_text(encoding="utf-8-sig"))
    if (
        not isinstance(payload, dict)
        or payload.get("schema") != "conclavia.web-visemes"
        or payload.get("version") != 1
        or not isinstance(payload.get("samples"), list)
    ):
        raise RuntimeError("Selected viseme control report has an invalid schema")
    samples: dict[str, dict[str, float]] = {}
    for raw_sample in payload["samples"]:
        if not isinstance(raw_sample, dict):
            raise RuntimeError("Selected viseme report contains an invalid sample")
        viseme = raw_sample.get("viseme")
        raw_controls = raw_sample.get("controls")
        if not isinstance(viseme, str) or not isinstance(raw_controls, dict):
            raise RuntimeError("Selected viseme report contains an invalid pose")
        controls: dict[str, float] = {}
        for name, raw_value in raw_controls.items():
            if (
                not isinstance(name, str)
                or not name.startswith("CTRL_")
                or not isinstance(raw_value, (int, float))
                or not math.isfinite(float(raw_value))
                or abs(float(raw_value)) > 2.0
            ):
                raise RuntimeError(f"Viseme {viseme} contains an invalid control")
            controls[name] = float(raw_value)
        if len(controls) < 20:
            raise RuntimeError(f"Viseme {viseme} has an incomplete control vocabulary")
        if viseme in samples:
            raise RuntimeError(f"Duplicate case-sensitive viseme: {viseme}")
        samples[viseme] = controls
    expected = {viseme for viseme, _, _ in VISEMES}
    if set(samples) != expected:
        raise RuntimeError(
            "Selected viseme report does not contain the exact case-sensitive vocabulary"
        )
    return samples, payload


def source_skeleton() -> unreal.Skeleton:
    source = unreal.load_asset(SOURCE_POSE)
    if not isinstance(source, unreal.AnimSequence):
        raise RuntimeError(f"Official MetaHuman pose is unavailable: {SOURCE_POSE}")
    skeleton = source.get_editor_property("skeleton")
    if not isinstance(skeleton, unreal.Skeleton):
        raise RuntimeError(f"Official MetaHuman pose has no skeleton: {SOURCE_POSE}")
    return skeleton


def build_curve_source(
    viseme: str,
    label: str,
    controls: dict[str, float],
    skeleton: unreal.Skeleton,
) -> unreal.AnimSequence:
    name = f"AS_WebViseme{label}_CurveOnly_v1"
    factory = unreal.AnimSequenceFactory()
    factory.target_skeleton = skeleton
    animation = recreate_asset(
        f"{TEMP_ROOT}/{name}",
        name,
        unreal.AnimSequence,
        factory,
    )
    controller = animation.controller
    controller.open_bracket(f"Build portable {viseme} viseme curves")
    try:
        controller.set_frame_rate(unreal.FrameRate(FPS, 1), False)
        controller.set_number_of_frames(
            unreal.FrameNumber(round(DURATION_SECONDS * FPS)),
            False,
        )
    finally:
        controller.close_bracket(False)
    for curve_name, value in controls.items():
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
    curve_names = unreal.AnimationLibrary.get_animation_curve_names(
        animation,
        unreal.RawCurveTrackTypes.RCT_FLOAT,
    )
    if len(curve_names) != len(controls):
        raise RuntimeError(
            f"Viseme {viseme} retained {len(curve_names)} of {len(controls)} curves"
        )
    return animation


def bake_and_export(
    viseme: str,
    alias: str,
    label: str,
    source: unreal.AnimSequence,
    actor: unreal.Actor,
    face: unreal.SkeletalMeshComponent,
    face_skeleton: unreal.Skeleton,
    control_count: int,
) -> dict[str, object]:
    sequence_name = f"LS_WebViseme{label}_v1"
    baked_name = f"AS_WebViseme{label}_v1"
    sequence = recreate_asset(
        f"{TEMP_ROOT}/{sequence_name}",
        sequence_name,
        unreal.LevelSequence,
        unreal.LevelSequenceFactoryNew(),
    )
    frame_count = max(2, int(round(source.get_play_length() * FPS)))
    sequence.set_display_rate(unreal.FrameRate(FPS, 1))
    sequence.set_tick_resolution_directly(unreal.FrameRate(FPS, 1))
    sequence.set_playback_start(0)
    sequence.set_playback_end(frame_count)
    unreal.LevelSequenceEditorBlueprintLibrary.open_level_sequence(sequence)
    actor_binding = sequence.add_possessable(actor)
    face_binding = sequence.add_possessable(face)
    face_binding.set_parent(actor_binding)
    track = face_binding.add_track(unreal.MovieSceneSkeletalAnimationTrack)
    if track is None:
        raise RuntimeError(f"Could not create facial track for viseme {viseme}")
    section = track.add_section()
    section.set_range(0, frame_count)
    parameters = section.get_editor_property("params")
    parameters.set_editor_property("animation", source)
    section.set_editor_property("params", parameters)

    factory = unreal.AnimSequenceFactory()
    factory.target_skeleton = face_skeleton
    baked = recreate_asset(
        f"{TEMP_ROOT}/{baked_name}",
        baked_name,
        unreal.AnimSequence,
        factory,
    )
    options = unreal.AnimSeqExportOption()
    options.export_transforms = True
    options.export_morph_targets = True
    options.evaluate_all_skeletal_mesh_components = True
    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    if not unreal.SequencerTools.export_anim_sequence(
        world, sequence, baked, options, face_binding, False
    ):
        raise RuntimeError(f"Sequencer could not bake Showcase viseme {viseme}")
    unreal.EditorAssetLibrary.save_loaded_asset(baked, only_if_is_dirty=False)
    bone_tracks = list(unreal.AnimationLibrary.get_animation_track_names(baked))
    if not bone_tracks:
        raise RuntimeError(f"Showcase viseme {viseme} produced no facial-bone transforms")

    output = OUTPUT_DIRECTORY / f"anim-viseme-{alias}.glb"
    if output.exists():
        output.unlink()
    exported = unreal.GLTFExporter.export_to_gltf(
        baked,
        str(output),
        gltf_options(),
        set(),
    )
    unreal.LevelSequenceEditorBlueprintLibrary.close_level_sequence()
    if not output.is_file() or output.stat().st_size < 20:
        raise RuntimeError(f"Facial GLB export failed for viseme {viseme}: {output}")
    return {
        "viseme": viseme,
        "alias": alias,
        "file": output.name,
        "clip": baked_name,
        "bytes": output.stat().st_size,
        "boneTracks": len(bone_tracks),
        "curveCount": control_count,
        "exported": bool(exported),
    }


def main() -> None:
    samples, input_report = load_samples()
    if not unreal.EditorLoadingAndSavingUtils.load_map(LEVEL_PATH):
        raise RuntimeError(f"Could not load meeting level: {LEVEL_PATH}")
    actor, face = meeting_face()
    face_mesh = face.get_skeletal_mesh_asset()
    if not isinstance(face_mesh, unreal.SkeletalMesh):
        raise RuntimeError("Showcase Face has no Skeletal Mesh")
    face_skeleton = face_mesh.get_editor_property("skeleton")
    if not isinstance(face_skeleton, unreal.Skeleton):
        raise RuntimeError("Showcase Face mesh has no Skeleton")
    curve_skeleton = source_skeleton()
    OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)

    exports = []
    for viseme, alias, label in VISEMES:
        controls = samples[viseme]
        source = build_curve_source(viseme, label, controls, curve_skeleton)
        result = bake_and_export(
            viseme,
            alias,
            label,
            source,
            actor,
            face,
            face_skeleton,
            len(controls),
        )
        exports.append(result)
        log(
            f"VISEME viseme={viseme} alias={alias} file={result['file']} "
            f"bytes={result['bytes']} bones={result['boneTracks']} "
            f"curves={result['curveCount']}"
        )
    report = {
        "schema": "conclavia.web-facial-visemes",
        "version": 1,
        "engineVersion": unreal.SystemLibrary.get_engine_version(),
        "identity": face_mesh.get_path_name(),
        "sourceRuntimeRevision": input_report.get("runtimeRevision", "unknown"),
        "sourceQuality": input_report.get("quality", {}),
        "visemes": exports,
    }
    report_path = OUTPUT_DIRECTORY / "facial-visemes.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    log(
        f"READY directory={OUTPUT_DIRECTORY} visemes={len(exports)} "
        f"bytes={sum(int(item['bytes']) for item in exports)}"
    )


if __name__ == "__main__":
    main()
