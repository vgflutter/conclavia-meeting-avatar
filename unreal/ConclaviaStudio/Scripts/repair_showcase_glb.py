"""Repair MetaHuman facial material slots in an Unreal-exported GLB.

UE 5.8's glTF exporter serializes the Optimized MetaHuman Face primitives in
their LOD section order, but resolves the component's material array in a
different order.  The result is structurally valid glTF with the teeth
material on the skin and every following slot shifted. Keep this repair
deliberately narrow and fail closed if Epic changes a verified Optimized face
layout.
"""

from __future__ import annotations

import json
from pathlib import Path
import struct
import sys


GLB_MAGIC = 0x46546C67
GLB_VERSION = 2
JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942


_COMPONENT_FORMATS = {
    5121: ("B", 1, 255),
    5123: ("H", 2, 65535),
    5125: ("I", 4, 4294967295),
    5126: ("f", 4, None),
}


def _material_index(
    materials: list[dict[str, object]],
    fragment: str,
    *,
    excluding: tuple[str, ...] = (),
) -> int:
    matches = [
        index
        for index, material in enumerate(materials)
        if fragment in str(material.get("name", "")).casefold()
        and not any(
            excluded in str(material.get("name", "")).casefold()
            for excluded in excluding
        )
    ]
    if len(matches) != 1:
        raise RuntimeError(
            f"Expected one GLB material containing {fragment!r}, found {matches}"
        )
    return matches[0]


def _accessor_layout(
    document: dict[str, object], accessor_index: int
) -> tuple[dict[str, object], int, int, str, int, int | None]:
    accessors = document.get("accessors")
    views = document.get("bufferViews")
    if not isinstance(accessors, list) or not isinstance(views, list):
        raise RuntimeError("GLB is missing accessors or buffer views")
    accessor = accessors[accessor_index]
    if not isinstance(accessor, dict) or accessor.get("type") != "VEC4":
        raise RuntimeError(f"Skin accessor {accessor_index} is not VEC4")
    view = views[int(accessor["bufferView"])]
    if not isinstance(view, dict) or int(view.get("buffer", 0)) != 0:
        raise RuntimeError(f"Skin accessor {accessor_index} is not in buffer 0")
    component_type = int(accessor["componentType"])
    if component_type not in _COMPONENT_FORMATS:
        raise RuntimeError(
            f"Unsupported skin component type {component_type} in accessor {accessor_index}"
        )
    code, component_size, normalized_max = _COMPONENT_FORMATS[component_type]
    item_size = component_size * 4
    stride = int(view.get("byteStride", item_size))
    offset = int(view.get("byteOffset", 0)) + int(accessor.get("byteOffset", 0))
    return accessor, offset, stride, code, component_size, normalized_max


def _quantized_weights(weights: list[float], maximum: int | None) -> list[float | int]:
    total = sum(weights)
    if total <= 0:
        weights = [1.0, 0.0, 0.0, 0.0]
        total = 1.0
    normalized = [weight / total for weight in weights]
    if maximum is None:
        return normalized
    scaled = [weight * maximum for weight in normalized]
    values = [int(value) for value in scaled]
    for index in sorted(
        range(4), key=lambda item: scaled[item] - values[item], reverse=True
    )[: maximum - sum(values)]:
        values[index] += 1
    return values


def _compact_skin_influences(
    document: dict[str, object], chunks: list[tuple[int, bytes]]
) -> int:
    binary_indices = [
        index for index, (chunk_type, _) in enumerate(chunks) if chunk_type == BIN_CHUNK
    ]
    if len(binary_indices) != 1:
        raise RuntimeError(f"Expected one GLB binary chunk, found {len(binary_indices)}")
    binary_index = binary_indices[0]
    binary = bytearray(chunks[binary_index][1])
    meshes = document.get("meshes")
    if not isinstance(meshes, list):
        raise RuntimeError("GLB is missing meshes")
    processed: set[tuple[int, int]] = set()
    compacted_vertices = 0
    for mesh in meshes:
        if not isinstance(mesh, dict):
            continue
        primitives = mesh.get("primitives")
        if not isinstance(primitives, list):
            continue
        for primitive in primitives:
            if not isinstance(primitive, dict):
                continue
            attributes = primitive.get("attributes")
            if not isinstance(attributes, dict):
                continue
            if "JOINTS_0" not in attributes or "WEIGHTS_0" not in attributes:
                continue
            extra_sets = [
                set_index
                for set_index in range(1, 4)
                if f"JOINTS_{set_index}" in attributes
                and f"WEIGHTS_{set_index}" in attributes
            ]
            if not extra_sets:
                continue
            joint_zero = int(attributes["JOINTS_0"])
            weight_zero = int(attributes["WEIGHTS_0"])
            accessor_key = (joint_zero, weight_zero)
            if accessor_key not in processed:
                joint_layouts = [
                    _accessor_layout(document, int(attributes[f"JOINTS_{set_index}"]))
                    for set_index in (0, *extra_sets)
                ]
                weight_layouts = [
                    _accessor_layout(document, int(attributes[f"WEIGHTS_{set_index}"]))
                    for set_index in (0, *extra_sets)
                ]
                count = int(joint_layouts[0][0]["count"])
                if any(int(layout[0]["count"]) != count for layout in (*joint_layouts, *weight_layouts)):
                    raise RuntimeError("Skin influence accessors have mismatched counts")
                joint_target = joint_layouts[0]
                weight_target = weight_layouts[0]
                for vertex in range(count):
                    influences: list[tuple[float, int]] = []
                    for joint_layout, weight_layout in zip(
                        joint_layouts, weight_layouts, strict=True
                    ):
                        _, joint_offset, joint_stride, joint_code, _, _ = joint_layout
                        _, weight_offset, weight_stride, weight_code, _, weight_max = weight_layout
                        joints = struct.unpack_from(
                            "<" + joint_code * 4,
                            binary,
                            joint_offset + vertex * joint_stride,
                        )
                        raw_weights = struct.unpack_from(
                            "<" + weight_code * 4,
                            binary,
                            weight_offset + vertex * weight_stride,
                        )
                        weights = [
                            float(value) / weight_max if weight_max is not None else float(value)
                            for value in raw_weights
                        ]
                        influences.extend(zip(weights, (int(joint) for joint in joints)))
                    strongest = sorted(influences, reverse=True)[:4]
                    while len(strongest) < 4:
                        strongest.append((0.0, 0))
                    top_weights = _quantized_weights(
                        [weight for weight, _ in strongest], weight_target[5]
                    )
                    struct.pack_into(
                        "<" + joint_target[3] * 4,
                        binary,
                        joint_target[1] + vertex * joint_target[2],
                        *(joint for _, joint in strongest),
                    )
                    struct.pack_into(
                        "<" + weight_target[3] * 4,
                        binary,
                        weight_target[1] + vertex * weight_target[2],
                        *top_weights,
                    )
                compacted_vertices += count
                processed.add(accessor_key)
            for set_index in extra_sets:
                attributes.pop(f"JOINTS_{set_index}", None)
                attributes.pop(f"WEIGHTS_{set_index}", None)
    chunks[binary_index] = (BIN_CHUNK, bytes(binary))
    return compacted_vertices


def repair_showcase_face_materials(path: Path) -> tuple[str, ...]:
    payload = path.read_bytes()
    if len(payload) < 20:
        raise RuntimeError(f"GLB is too small: {path}")
    magic, version, declared_length = struct.unpack_from("<III", payload, 0)
    if magic != GLB_MAGIC or version != GLB_VERSION or declared_length != len(payload):
        raise RuntimeError(f"Invalid GLB header: {path}")

    chunks: list[tuple[int, bytes]] = []
    cursor = 12
    document: dict[str, object] | None = None
    json_chunk_index: int | None = None
    while cursor < len(payload):
        chunk_length, chunk_type = struct.unpack_from("<II", payload, cursor)
        cursor += 8
        chunk = payload[cursor : cursor + chunk_length]
        cursor += chunk_length
        if len(chunk) != chunk_length:
            raise RuntimeError(f"Truncated GLB chunk: {path}")
        if chunk_type == JSON_CHUNK:
            if document is not None:
                raise RuntimeError(f"GLB contains multiple JSON chunks: {path}")
            document = json.loads(chunk.rstrip(b" \t\r\n\x00").decode("utf-8"))
            json_chunk_index = len(chunks)
        chunks.append((chunk_type, chunk))
    if document is None or json_chunk_index is None:
        raise RuntimeError(f"GLB has no JSON document: {path}")

    meshes = document.get("meshes")
    materials = document.get("materials")
    if not isinstance(meshes, list) or not isinstance(materials, list):
        raise RuntimeError("GLB is missing meshes or materials")
    faces = [
        mesh
        for mesh in meshes
        if isinstance(mesh, dict)
        and (
            mesh.get("name") == "Face"
            or str(mesh.get("name", "")).casefold().endswith("facemesh")
        )
    ]
    if len(faces) != 1:
        raise RuntimeError(f"Expected one Face mesh, found {len(faces)}")
    primitives = faces[0].get("primitives")
    if not isinstance(primitives, list) or len(primitives) not in (4, 9):
        count = len(primitives) if isinstance(primitives, list) else 0
        raise RuntimeError(
            f"Expected a verified Optimized Face layout (4 or 9 sections), found {count}"
        )

    if len(primitives) == 4:
        # Optimized Low Face section order.
        intended = (
            _material_index(materials, "face_skin"),
            _material_index(materials, "teeth"),
            _material_index(materials, "eyel"),
            _material_index(materials, "eyer"),
        )
    else:
        # Optimized High LOD1 Face section order, verified against the actual
        # Showcase assembly. The extra surfaces preserve eye wetness and
        # high-LOD lashes in a close webcam framing.
        intended = (
            _material_index(materials, "face_skin_baked_lod1"),
            _material_index(materials, "teeth_baked"),
            _material_index(materials, "m_hide"),
            _material_index(materials, "eyel_baked"),
            _material_index(materials, "eyer_baked"),
            _material_index(materials, "face_eyeshell"),
            _material_index(materials, "face_eyelashes", excluding=("hilods",)),
            _material_index(materials, "face_lacrimalfluid"),
            _material_index(materials, "face_eyelasheshilods"),
        )
    for primitive, material_index in zip(primitives, intended, strict=True):
        if not isinstance(primitive, dict):
            raise RuntimeError("Face primitive is not an object")
        primitive["material"] = material_index
    if len(primitives) == 9:
        # EyeShell, lacrimal fluid and the high-LOD lash shaders depend on
        # Unreal's custom translucent shading. The stock glTF conversion turns
        # them into dark opaque masks over the eyes. The baked skin already
        # contains brows/lash color; retain portable skin, teeth and both eye
        # balls and omit the Unreal-only overlays (plus the invisible M_Hide
        # section) from the Web mesh.
        faces[0]["primitives"] = [primitives[index] for index in (0, 1, 3, 4)]

    _compact_skin_influences(document, chunks)

    repaired_json = json.dumps(document, separators=(",", ":"), ensure_ascii=False).encode(
        "utf-8"
    )
    repaired_json += b" " * ((4 - len(repaired_json) % 4) % 4)
    chunks[json_chunk_index] = (JSON_CHUNK, repaired_json)
    body = b"".join(
        struct.pack("<II", len(chunk), chunk_type) + chunk
        for chunk_type, chunk in chunks
    )
    path.write_bytes(struct.pack("<III", GLB_MAGIC, GLB_VERSION, 12 + len(body)) + body)
    return tuple(str(materials[index].get("name", "")) for index in intended)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: repair_showcase_glb.py /path/to/model.glb")
    repaired = repair_showcase_face_materials(Path(sys.argv[1]))
    print("Repaired Showcase Face materials: " + ", ".join(repaired))
