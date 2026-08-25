"""Repair MetaHuman facial material slots in an Unreal-exported GLB.

UE 5.8's glTF exporter serializes the Optimized MetaHuman Face primitives in
their LOD section order, but resolves the component's material array in a
different order.  The result is structurally valid glTF with the teeth
material on the skin, an eye material on the teeth and the skin material on an
eye.  Keep this repair deliberately narrow and fail closed if Epic changes the
four-section Optimized face layout.
"""

from __future__ import annotations

import json
from pathlib import Path
import struct
import sys


GLB_MAGIC = 0x46546C67
GLB_VERSION = 2
JSON_CHUNK = 0x4E4F534A


def _material_index(materials: list[dict[str, object]], fragment: str) -> int:
    matches = [
        index
        for index, material in enumerate(materials)
        if fragment in str(material.get("name", "")).casefold()
    ]
    if len(matches) != 1:
        raise RuntimeError(
            f"Expected one GLB material containing {fragment!r}, found {matches}"
        )
    return matches[0]


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
    faces = [mesh for mesh in meshes if isinstance(mesh, dict) and mesh.get("name") == "Face"]
    if len(faces) != 1:
        raise RuntimeError(f"Expected one Face mesh, found {len(faces)}")
    primitives = faces[0].get("primitives")
    if not isinstance(primitives, list) or len(primitives) != 4:
        count = len(primitives) if isinstance(primitives, list) else 0
        raise RuntimeError(f"Expected the Optimized four-section Face mesh, found {count}")

    # Optimized MetaHuman Face LOD section order: skin, teeth, left eye, right eye.
    intended = (
        _material_index(materials, "face_skin"),
        _material_index(materials, "teeth"),
        _material_index(materials, "eyel"),
        _material_index(materials, "eyer"),
    )
    for primitive, material_index in zip(primitives, intended, strict=True):
        if not isinstance(primitive, dict):
            raise RuntimeError("Face primitive is not an object")
        primitive["material"] = material_index

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
