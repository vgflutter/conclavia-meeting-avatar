"""Report source-model vertex topology used by the Web wardrobe exporter."""

from __future__ import annotations

import json
import os
from pathlib import Path

import unreal


WARDROBE = (
    "/Game/Conclavia/Meeting/WebMetaHumans/MHC_Showcase_WebHigh/"
    "MHC_Showcase_WebHigh/Clothing/MHC_Showcase_Outfits.MHC_Showcase_Outfits"
)

# UE glTF writes the Showcase wardrobe as shorts followed by shirt. Sampling
# both sides of that section boundary proves whether SkinWeightModifier and
# GeometryScript use the same render-vertex order as the exported primitives.
SAMPLE_VERTICES = (0, 1, 2, 7, 3608, 3609, 3610, 3611, 3612, 3613, 3614, 3615, 13890, 13891, 13892, 13893)


def _public_methods(value: object, fragments: tuple[str, ...] = ()) -> list[str]:
    names = [name for name in dir(value) if not name.startswith("_")]
    if fragments:
        names = [
            name
            for name in names
            if any(fragment in name.casefold() for fragment in fragments)
        ]
    return sorted(names)


def _doc(value: object) -> str:
    return str(getattr(value, "__doc__", "") or "")


def _member_doc(value: object, name: str) -> str:
    return _doc(getattr(value, name, None))


def _json_value(value: object) -> object:
    if hasattr(value, "x") and hasattr(value, "y") and hasattr(value, "z"):
        return [float(value.x), float(value.y), float(value.z)]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, (tuple, list)):
        return [_json_value(item) for item in value]
    return repr(value)


def main() -> None:
    mesh = unreal.load_asset(WARDROBE)
    if not isinstance(mesh, unreal.SkeletalMesh):
        raise RuntimeError(f"Showcase wardrobe is unavailable: {WARDROBE}")
    modifier = unreal.SkinWeightModifier()
    if not modifier.set_skeletal_mesh(mesh):
        raise RuntimeError("Could not read Showcase wardrobe weights")
    samples: list[dict[str, object]] = []
    vertex_count = int(modifier.get_num_vertices())
    for index in SAMPLE_VERTICES:
        if index < 0 or index >= vertex_count:
            continue
        samples.append(
            {
                "vertex": index,
                "weights": {
                    str(name): float(weight)
                    for name, weight in modifier.get_vertex_weights(index).items()
                },
            }
        )
    dynamic_mesh = unreal.DynamicMesh()
    dynamic_report: dict[str, object] = {}
    try:
        copy_result = unreal.GeometryScript_AssetUtils.copy_mesh_from_skeletal_mesh(
            mesh,
            dynamic_mesh,
            unreal.GeometryScriptCopyMeshFromAssetOptions(),
            unreal.GeometryScriptMeshReadLOD(),
        )
        dynamic_report["copyResult"] = _json_value(copy_result)
        dynamic_report["vertexCount"] = _json_value(dynamic_mesh.get_vertex_count())
        dynamic_report["triangleCount"] = _json_value(dynamic_mesh.get_triangle_count())
        dynamic_report["samples"] = [
            {
                "vertex": index,
                "position": _json_value(dynamic_mesh.get_vertex_position(index)),
                "weights": _json_value(dynamic_mesh.get_vertex_bone_weights(index)),
            }
            for index in SAMPLE_VERTICES
            if index < int(dynamic_mesh.get_vertex_count())
        ]
    except Exception as error:
        dynamic_report["error"] = repr(error)
    report = {
        "schema": "conclavia.wardrobe-vertex-diagnostic",
        "version": 3,
        "asset": mesh.get_path_name(),
        "skinWeightVertices": vertex_count,
        "samples": samples,
        "skeletalMeshMethods": _public_methods(
            mesh, ("mesh", "description", "vertex", "lod", "render", "import")
        ),
        "skinWeightModifierMethods": _public_methods(modifier),
        "skeletalMeshDescriptionMethods": _public_methods(
            unreal.SkeletalMeshDescription,
            ("mesh", "description", "vertex", "create", "copy", "bone", "skin"),
        ),
        "geometryScriptTypes": [
            name
            for name in dir(unreal)
            if "geometryscript" in name.casefold()
            and any(
                fragment in name.casefold()
                for fragment in ("asset", "mesh", "bone", "skin", "skeletal")
            )
        ],
        "geometryScriptDocs": {
            "copyMeshFromSkeletalMesh": _member_doc(
                unreal.GeometryScript_AssetUtils, "copy_mesh_from_skeletal_mesh"
            ),
            "getSkinWeights": _member_doc(
                unreal.GeometryScript_BoneWeights, "get_vertex_bone_weights"
            ),
            "getBoneInfo": _member_doc(
                unreal.GeometryScript_BoneWeights, "get_bone_info"
            ),
        },
        "dynamicMeshMethods": _public_methods(
            unreal.DynamicMesh(),
            ("vertex", "triangle", "attribute", "mesh", "bone", "skin"),
        ),
        "dynamicMesh": dynamic_report,
    }
    for type_name in report["geometryScriptTypes"]:
        candidate = getattr(unreal, str(type_name), None)
        if candidate is not None:
            report[f"methods:{type_name}"] = _public_methods(
                candidate,
                ("copy", "skeletal", "mesh", "vertex", "bone", "skin", "weight"),
            )
    output = Path(
        os.environ.get(
            "CONCLAVIA_WARDROBE_DIAGNOSTIC",
            r"C:\ConclaviaMeetingAvatar\Saved\WebAvatarAuthoring\wardrobe-vertices.json",
        )
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    unreal.log(f"CONCLAVIA_WARDROBE_VERTICES: {json.dumps(report)}")


main()
