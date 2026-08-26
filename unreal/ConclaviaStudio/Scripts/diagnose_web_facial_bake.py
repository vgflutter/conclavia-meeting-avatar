"""Diagnose whether MetaHuman facial curves become portable bone motion.

This unattended probe compares Epic's licensed source poses, the curve-only
meeting sources, and the identity-baked outputs at several times. It also
exports two official reference clips without a preview mesh so their bone
payload can be compared with the generated Web clips outside Unreal.
"""

from __future__ import annotations

import json
import hashlib
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


def transform_vector(transform: unreal.Transform) -> list[float]:
    payload = transform_payload(transform)
    return [
        *payload["translation"],
        *payload["rotation"],
        *payload["scale"],
    ]


def vector_digest(values: list[float]) -> str:
    normalized = ",".join(f"{value:.6f}" for value in values)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:16]


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
    track_names = {
        str(name) for name in unreal.AnimationLibrary.get_animation_track_names(sequence)
    }
    facial_track_names = sorted(
        name
        for name in track_names
        if any(token in name.casefold() for token in ("jaw", "lip", "brow", "eye"))
    )
    diagnostic_bone_names = list(SAMPLE_BONES)
    diagnostic_bone_names.extend(facial_track_names[:48])
    diagnostic_bone_names = list(dict.fromkeys(diagnostic_bone_names))
    bones = {}
    varying_bones = []
    midpoint_pose: list[float] = []
    for bone_name in sorted(track_names):
        midpoint_pose.extend(
            transform_vector(
                unreal.AnimationLibrary.get_bone_pose_for_time(
                    sequence,
                    bone_name,
                    sample_times[len(sample_times) // 2],
                    False,
                )
            )
        )
    for bone_name in diagnostic_bone_names:
        if bone_name not in track_names:
            continue
        samples = [
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
        bones[bone_name] = samples
        sample_digests = {
            vector_digest(
                [
                    *sample["translation"],
                    *sample["rotation"],
                    *sample["scale"],
                ]
            )
            for sample in samples
        }
        if len(sample_digests) > 1:
            varying_bones.append(bone_name)
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
        "facialTrackNames": facial_track_names[:80],
        "midpointPoseDigest": vector_digest(midpoint_pose),
        "varyingBoneCount": len(varying_bones),
        "varyingBones": varying_bones[:80],
        "bones": bones,
    }


def control_rig_audit() -> dict[str, object]:
    registry = unreal.AssetRegistryHelpers.get_asset_registry()
    candidates: dict[str, str] = {}
    for root in ("/MetaHumans", "/MetaHumanCharacter"):
        for asset_data in registry.get_assets_by_path(root, recursive=True):
            name = str(asset_data.asset_name)
            if "face_controlboard_ctrlrig" not in name.casefold():
                continue
            candidates[str(asset_data.package_name)] = str(asset_data.asset_class_path)
    members = sorted(
        name
        for name in dir(unreal.ControlRigSequencerLibrary)
        if not name.startswith("_")
    )
    return {
        "candidates": [
            {"path": path, "class": candidates[path]} for path in sorted(candidates)
        ],
        "sequencerLibraryMembers": members,
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
        "controlRig": control_rig_audit(),
    }
    report_path = OUTPUT_DIRECTORY / "report.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    unreal.log_warning(
        "CONCLAVIA_WEB_FACIAL_DIAGNOSTIC_OK "
        f"path={report_path} sequences={len(sequences)} exports={len(exports)}"
    )


if __name__ == "__main__":
    main()
