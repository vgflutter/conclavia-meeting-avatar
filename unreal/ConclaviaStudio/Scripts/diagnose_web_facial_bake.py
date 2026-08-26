"""Diagnose whether MetaHuman facial curves become portable bone motion.

This unattended probe compares Epic's licensed source poses, the curve-only
meeting sources, and the identity-baked outputs at several times. It also
exports two official reference clips without a preview mesh so their bone
payload can be compared with the generated Web clips outside Unreal.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import unreal


OUTPUT_DIRECTORY = Path(
    os.environ.get(
        "CONCLAVIA_WEB_FACIAL_DIAGNOSTIC_DIR",
        str(Path(unreal.Paths.project_saved_dir()) / "WebFacialDiagnostic"),
    )
)
POSE_ROOT = "/MetaHumanCharacter/Optional/Animation/TemplateAnimations/Facial_Poses"
ASSETS = {
    "official-happy": f"{POSE_ROOT}/Happy/mhc_mh002_fmn_f_gpf_happy_s001",
    "official-surprise": f"{POSE_ROOT}/Surprise/mhc_mh002_fmn_f_gpf_surprise_s001",
    "curve-amused": "/Game/Conclavia/Meeting/WebExport/AS_WebMoodAmused_CurveOnly_v1",
    "baked-amused": "/Game/Conclavia/Meeting/WebExport/AS_WebMoodAmused_v1",
    "curve-o-open": "/Game/Conclavia/Meeting/WebExport/AS_WebVisemeOOpen_CurveOnly_v1",
    "baked-o-open": "/Game/Conclavia/Meeting/WebExport/AS_WebVisemeOOpen_v1",
}
SAMPLE_BONES = (
    "FACIAL_C_Jaw",
    "FACIAL_C_LipUpper",
    "FACIAL_C_LipLower",
    "FACIAL_L_LipCorner",
    "FACIAL_R_LipCorner",
    "FACIAL_L_BrowInner",
    "FACIAL_R_BrowInner",
)


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


def transform_payload(transform: unreal.Transform) -> dict[str, list[float]]:
    translation = transform.translation
    rotation = transform.rotation
    scale = transform.scale3d
    return {
        "translation": [translation.x, translation.y, translation.z],
        "rotation": [rotation.x, rotation.y, rotation.z, rotation.w],
        "scale": [scale.x, scale.y, scale.z],
    }


def inspect_sequence(label: str, path: str) -> dict[str, object]:
    sequence = unreal.load_asset(path)
    if not isinstance(sequence, unreal.AnimSequence):
        return {"label": label, "path": path, "available": False}
    duration = float(sequence.get_play_length())
    sample_times = sorted({0.0, duration * 0.25, duration * 0.5, duration * 0.75, duration})
    curve_names = list(
        unreal.AnimationLibrary.get_animation_curve_names(
            sequence,
            unreal.RawCurveTrackTypes.RCT_FLOAT,
        )
    )
    curves = []
    for curve_name in curve_names:
        values = [
            float(
                unreal.AnimationLibrary.get_float_value_at_time(
                    sequence,
                    curve_name,
                    sample_time,
                )
            )
            for sample_time in sample_times
        ]
        if max(abs(value) for value in values) >= 0.001:
            curves.append({"name": str(curve_name), "values": values})
    track_names = {str(name) for name in unreal.AnimationLibrary.get_animation_track_names(sequence)}
    bones = {}
    for bone_name in SAMPLE_BONES:
        if bone_name not in track_names:
            continue
        bones[bone_name] = [
            transform_payload(
                unreal.AnimationLibrary.get_bone_pose_for_time(
                    sequence,
                    bone_name,
                    sample_time,
                    False,
                )
            )
            for sample_time in sample_times
        ]
    return {
        "label": label,
        "path": path,
        "available": True,
        "durationSeconds": duration,
        "sampleTimes": sample_times,
        "boneTrackCount": len(track_names),
        "curveCount": len(curve_names),
        "activeCurveCount": len(curves),
        "activeCurves": curves[:80],
        "bones": bones,
    }


def main() -> None:
    OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)
    sequences = [inspect_sequence(label, path) for label, path in ASSETS.items()]
    exports = []
    for label in ("official-happy", "official-surprise"):
        source = unreal.load_asset(ASSETS[label])
        if not isinstance(source, unreal.AnimSequence):
            continue
        output = OUTPUT_DIRECTORY / f"{label}.glb"
        if output.exists():
            output.unlink()
        result = unreal.GLTFExporter.export_to_gltf(
            source,
            str(output),
            gltf_options(),
            set(),
        )
        exports.append(
            {
                "label": label,
                "file": output.name,
                "bytes": output.stat().st_size if output.exists() else 0,
                "exported": bool(result),
            }
        )
    report = {
        "schema": "conclavia.web-facial-bake-diagnostic",
        "version": 1,
        "engineVersion": unreal.SystemLibrary.get_engine_version(),
        "sequences": sequences,
        "exports": exports,
    }
    report_path = OUTPUT_DIRECTORY / "report.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    unreal.log_warning(
        "CONCLAVIA_WEB_FACIAL_DIAGNOSTIC_OK "
        f"path={report_path} sequences={len(sequences)} exports={len(exports)}"
    )


if __name__ == "__main__":
    main()
