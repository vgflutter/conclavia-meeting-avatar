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


def _vector(value: object) -> list[float]:
    return [float(value.x), float(value.y), float(value.z)]


def main() -> None:
    mesh = unreal.load_asset(WARDROBE)
    if not isinstance(mesh, unreal.SkeletalMesh):
        raise RuntimeError(f"Showcase wardrobe is unavailable: {WARDROBE}")
    modifier = unreal.SkinWeightModifier()
    if not modifier.set_skeletal_mesh(mesh):
        raise RuntimeError("Could not read Showcase wardrobe weights")
    mesh_description = mesh.get_mesh_description(0)
    if mesh_description is None:
        raise RuntimeError("Showcase wardrobe has no imported LOD 0 MeshDescription")
    vertex_count = int(mesh_description.get_vertex_count())
    vertex_instance_count = int(mesh_description.get_vertex_instance_count())
    samples: list[dict[str, object]] = []
    for index in range(min(vertex_count, 24)):
        vertex_id = unreal.VertexID(index)
        samples.append(
            {
                "vertex": index,
                "position": _vector(mesh_description.get_vertex_position(vertex_id)),
                "instanceCount": len(
                    mesh_description.get_vertex_vertex_instances(vertex_id)
                ),
                "weights": {
                    str(name): float(weight)
                    for name, weight in modifier.get_vertex_weights(index).items()
                },
            }
        )
    report = {
        "schema": "conclavia.wardrobe-vertex-diagnostic",
        "version": 1,
        "asset": mesh.get_path_name(),
        "skinWeightVertices": int(modifier.get_num_vertices()),
        "meshDescriptionVertices": vertex_count,
        "meshDescriptionVertexInstances": vertex_instance_count,
        "samples": samples,
    }
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
