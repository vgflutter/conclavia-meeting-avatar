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


def _normalized_name(value: object) -> str:
    return "".join(character for character in str(value).casefold() if character.isalnum())


def _quantized_influences(
    weights: list[float], maximum: int | None
) -> list[float | int]:
    """Normalize one complete 12-weight vertex, not each VEC4 independently."""

    total = sum(weights)
    if total <= 0:
        raise RuntimeError("Wardrobe vertex has no positive skin weight")
    normalized = [weight / total for weight in weights]
    if maximum is None:
        return normalized
    scaled = [weight * maximum for weight in normalized]
    values = [int(value) for value in scaled]
    remainder = maximum - sum(values)
    for index in sorted(
        range(len(values)),
        key=lambda item: scaled[item] - values[item],
        reverse=True,
    )[:remainder]:
        values[index] += 1
    return values


def _repair_wardrobe_skin_weights(
    document: dict[str, object],
    chunks: list[tuple[int, bytes]],
    source_weights: list[list[tuple[str, float]]],
) -> int:
    """Replace Unreal glTF's invalid clothing weights with source skin weights.

    Epic's glTF exporter does not support Mesh Clothing Assets. Geometry and
    vertex order are retained, but the exported JOINTS_n/WEIGHTS_n payload is
    not the wardrobe's authored skin. ``SkinWeightModifier`` gives us those
    authoritative weights in editor Python, so write them back against the
    GLB skin's bone table before the bundle reaches a browser.
    """

    binary_indices = [
        index for index, (chunk_type, _) in enumerate(chunks) if chunk_type == BIN_CHUNK
    ]
    if len(binary_indices) != 1:
        raise RuntimeError(f"Expected one GLB binary chunk, found {len(binary_indices)}")
    binary_index = binary_indices[0]
    binary = bytearray(chunks[binary_index][1])
    meshes = document.get("meshes")
    materials = document.get("materials")
    nodes = document.get("nodes")
    skins = document.get("skins")
    if not all(isinstance(value, list) for value in (meshes, materials, nodes, skins)):
        raise RuntimeError("GLB is missing meshes, materials, nodes or skins")

    wardrobe_matches: list[tuple[int, dict[str, object]]] = []
    for mesh_index, mesh in enumerate(meshes):
        if not isinstance(mesh, dict):
            continue
        mesh_name = str(mesh.get("name", "")).casefold()
        if "outfit" in mesh_name or "wardrobe" in mesh_name:
            wardrobe_matches.append((mesh_index, mesh))
    if len(wardrobe_matches) != 1:
        raise RuntimeError(
            f"Expected one wardrobe mesh in GLB, found {[mesh.get('name') for _, mesh in wardrobe_matches]}"
        )
    wardrobe_mesh_index, wardrobe_mesh = wardrobe_matches[0]
    wardrobe_nodes = [
        node
        for node in nodes
        if isinstance(node, dict)
        and node.get("mesh") == wardrobe_mesh_index
        and isinstance(node.get("skin"), int)
    ]
    if len(wardrobe_nodes) != 1:
        raise RuntimeError(
            f"Expected one skinned wardrobe node, found {len(wardrobe_nodes)}"
        )
    skin_index = int(wardrobe_nodes[0]["skin"])
    if not 0 <= skin_index < len(skins) or not isinstance(skins[skin_index], dict):
        raise RuntimeError(f"Wardrobe references invalid skin {skin_index}")
    skin = skins[skin_index]
    joint_nodes = skin.get("joints")
    if not isinstance(joint_nodes, list):
        raise RuntimeError("Wardrobe skin has no joint table")
    joint_indices_by_name: dict[str, int] = {}
    for joint_index, node_index in enumerate(joint_nodes):
        if not isinstance(node_index, int) or not 0 <= node_index < len(nodes):
            raise RuntimeError("Wardrobe skin contains an invalid joint node")
        node = nodes[node_index]
        if not isinstance(node, dict):
            raise RuntimeError("Wardrobe joint node is not an object")
        normalized = _normalized_name(node.get("name", ""))
        if not normalized or normalized in joint_indices_by_name:
            raise RuntimeError(
                f"Wardrobe skin has an ambiguous joint name: {node.get('name', '')}"
            )
        joint_indices_by_name[normalized] = joint_index

    primitives = wardrobe_mesh.get("primitives")
    if not isinstance(primitives, list) or not primitives:
        raise RuntimeError("Wardrobe mesh has no primitives")
    primitive_counts: list[int] = []
    for primitive in primitives:
        if not isinstance(primitive, dict) or not isinstance(primitive.get("attributes"), dict):
            raise RuntimeError("Wardrobe primitive has no attributes")
        attributes = primitive["attributes"]
        required = [
            f"{kind}_{set_index}"
            for set_index in range(3)
            for kind in ("JOINTS", "WEIGHTS")
        ]
        missing = [name for name in required if name not in attributes]
        if missing:
            raise RuntimeError(
                f"Wardrobe primitive lost its 12-weight accessors: {missing}"
            )
        layouts = [
            _accessor_layout(document, int(attributes[name])) for name in required
        ]
        counts = {int(layout[0]["count"]) for layout in layouts}
        if len(counts) != 1:
            raise RuntimeError("Wardrobe skin accessors have mismatched counts")
        primitive_counts.append(counts.pop())
    if sum(primitive_counts) != len(source_weights):
        raise RuntimeError(
            "Wardrobe source/export vertex order is not compatible: "
            f"source={len(source_weights)} glb={sum(primitive_counts)}"
        )

    source_offset = 0
    maximum_source_influences = 0
    for primitive, count in zip(primitives, primitive_counts, strict=True):
        attributes = primitive["attributes"]
        joint_layouts = [
            _accessor_layout(document, int(attributes[f"JOINTS_{set_index}"]))
            for set_index in range(3)
        ]
        weight_layouts = [
            _accessor_layout(document, int(attributes[f"WEIGHTS_{set_index}"]))
            for set_index in range(3)
        ]
        weight_maxima = {layout[5] for layout in weight_layouts}
        if len(weight_maxima) != 1:
            raise RuntimeError("Wardrobe weight accessors use incompatible encodings")
        weight_maximum = weight_maxima.pop()
        for local_vertex in range(count):
            vertex_weights = [
                (name, float(weight))
                for name, weight in source_weights[source_offset + local_vertex]
                if float(weight) > 0
            ]
            vertex_weights.sort(key=lambda item: item[1], reverse=True)
            if not vertex_weights or len(vertex_weights) > 12:
                raise RuntimeError(
                    "Wardrobe source vertex has an unsupported influence count: "
                    f"vertex={source_offset + local_vertex} count={len(vertex_weights)}"
                )
            maximum_source_influences = max(maximum_source_influences, len(vertex_weights))
            influences: list[tuple[int, float]] = []
            for bone_name, weight in vertex_weights:
                joint_index = joint_indices_by_name.get(_normalized_name(bone_name))
                if joint_index is None:
                    raise RuntimeError(
                        f"Wardrobe source bone is absent from GLB skin: {bone_name}"
                    )
                influences.append((joint_index, weight))
            while len(influences) < 12:
                influences.append((0, 0.0))
            quantized = _quantized_influences(
                [weight for _, weight in influences], weight_maximum
            )
            for set_index, (joint_layout, weight_layout) in enumerate(
                zip(joint_layouts, weight_layouts, strict=True)
            ):
                begin = set_index * 4
                end = begin + 4
                joints = [joint for joint, _ in influences[begin:end]]
                if any(joint > int(joint_layout[5] or 0) for joint in joints):
                    raise RuntimeError("Wardrobe joint index exceeds accessor encoding")
                struct.pack_into(
                    "<" + joint_layout[3] * 4,
                    binary,
                    joint_layout[1] + local_vertex * joint_layout[2],
                    *joints,
                )
                struct.pack_into(
                    "<" + weight_layout[3] * 4,
                    binary,
                    weight_layout[1] + local_vertex * weight_layout[2],
                    *quantized[begin:end],
                )
        source_offset += count

    extras = wardrobe_mesh.setdefault("extras", {})
    if isinstance(extras, dict):
        extras["conclaviaWardrobeWeights"] = "source-skin-weight-modifier-v1"
        extras["conclaviaMaximumInfluences"] = maximum_source_influences
    chunks[binary_index] = (BIN_CHUNK, bytes(binary))
    return source_offset


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


def _validate_extended_skin_influences(document: dict[str, object]) -> int:
    """Keep Unreal's authored 4/8/12-weight skinning contract intact.

    The browser renderer consumes the additional JOINTS_n/WEIGHTS_n sets with
    an extended Three.js skinning shader. Reducing the MetaHuman wardrobe to
    four weights creates visible tears as soon as an idle or gesture moves the
    shoulders, so export must fail closed instead of silently discarding them.
    """
    meshes = document.get("meshes")
    materials = document.get("materials")
    if not isinstance(meshes, list) or not isinstance(materials, list):
        raise RuntimeError("GLB is missing meshes or materials")
    maximum_sets = 0
    deformation_critical_sets: list[int] = []
    for mesh in meshes:
        if not isinstance(mesh, dict):
            continue
        mesh_name = str(mesh.get("name", "")).casefold()
        primitives = mesh.get("primitives")
        if not isinstance(primitives, list):
            continue
        for primitive in primitives:
            if not isinstance(primitive, dict):
                continue
            attributes = primitive.get("attributes")
            if not isinstance(attributes, dict) or "JOINTS_0" not in attributes:
                continue
            set_count = 0
            for set_index in range(3):
                has_joints = f"JOINTS_{set_index}" in attributes
                has_weights = f"WEIGHTS_{set_index}" in attributes
                if has_joints != has_weights:
                    raise RuntimeError(
                        f"Skin influence set {set_index} is incomplete"
                    )
                if has_joints:
                    set_count += 1
            if set_count == 0:
                raise RuntimeError("Skinned primitive has no complete influence set")
            maximum_sets = max(maximum_sets, set_count)
            material_index = primitive.get("material")
            material_name = ""
            if isinstance(material_index, int) and 0 <= material_index < len(materials):
                material = materials[material_index]
                if isinstance(material, dict):
                    material_name = str(material.get("name", "")).casefold()
            identity = f"{mesh_name} {material_name}"
            if any(
                token in identity
                for token in ("bodymesh", "outfit", "garment", "bodyshape", "shirt", "short")
            ):
                deformation_critical_sets.append(set_count)
    if not deformation_critical_sets:
        raise RuntimeError("Showcase export has no deformation-critical body or outfit primitives")
    if min(deformation_critical_sets) < 2:
        raise RuntimeError(
            "Showcase body or outfit lost its extended MetaHuman skin influences"
        )
    return maximum_sets


def _embedded_png_texture(
    document: dict[str, object],
    chunks: list[tuple[int, bytes]],
    path: Path,
    name: str,
) -> int:
    """Embed a source groom atlas into the GLB and return its texture index."""

    png = path.read_bytes()
    if len(png) < 64 or not png.startswith(b"\x89PNG\r\n\x1a\n"):
        raise RuntimeError(f"Groom atlas is not a valid PNG: {path}")
    images = document.setdefault("images", [])
    textures = document.setdefault("textures", [])
    views = document.get("bufferViews")
    buffers = document.get("buffers")
    if not isinstance(images, list) or not isinstance(textures, list):
        raise RuntimeError("GLB images or textures are not arrays")
    if not isinstance(views, list) or not isinstance(buffers, list) or len(buffers) != 1:
        raise RuntimeError("GLB does not have one embeddable buffer")

    for texture_index, texture in enumerate(textures):
        if not isinstance(texture, dict):
            continue
        source = texture.get("source")
        if not isinstance(source, int) or not 0 <= source < len(images):
            continue
        image = images[source]
        if isinstance(image, dict) and image.get("name") == name:
            return texture_index

    binary_indices = [
        index for index, (chunk_type, _) in enumerate(chunks) if chunk_type == BIN_CHUNK
    ]
    if len(binary_indices) != 1:
        raise RuntimeError(f"Expected one GLB binary chunk, found {len(binary_indices)}")
    binary_index = binary_indices[0]
    binary = bytearray(chunks[binary_index][1])
    binary.extend(b"\x00" * ((4 - len(binary) % 4) % 4))
    offset = len(binary)
    binary.extend(png)
    binary.extend(b"\x00" * ((4 - len(binary) % 4) % 4))
    chunks[binary_index] = (BIN_CHUNK, bytes(binary))
    buffer = buffers[0]
    if not isinstance(buffer, dict):
        raise RuntimeError("GLB buffer is not an object")
    buffer["byteLength"] = len(binary)
    views.append(
        {
            "name": f"{name}_BufferView",
            "buffer": 0,
            "byteOffset": offset,
            "byteLength": len(png),
        }
    )
    images.append(
        {
            "name": name,
            "mimeType": "image/png",
            "bufferView": len(views) - 1,
        }
    )
    textures.append({"name": name, "source": len(images) - 1})
    return len(textures) - 1


def _repair_hair_cards_materials(
    document: dict[str, object],
    chunks: list[tuple[int, bytes]],
    hair_attribute_path: Path | None,
    eyebrow_attribute_path: Path | None,
) -> int:
    materials = document.get("materials")
    if not isinstance(materials, list):
        raise RuntimeError("GLB is missing materials")
    source_textures: dict[str, int] = {}
    if hair_attribute_path is not None:
        source_textures["hair"] = _embedded_png_texture(
            document,
            chunks,
            hair_attribute_path,
            "Conclavia_HairCards_Attribute",
        )
    if eyebrow_attribute_path is not None:
        source_textures["eyebrows"] = _embedded_png_texture(
            document,
            chunks,
            eyebrow_attribute_path,
            "Conclavia_EyebrowsCards_Attribute",
        )

    repaired = 0
    for material in materials:
        name = str(material.get("name", ""))
        normalized = name.casefold()
        role = ""
        if "hair_cards" in normalized:
            role = "hair"
        elif "eyebrows" in normalized and "hair" in normalized:
            role = "eyebrows"
        if not role:
            continue

        # Unreal's Simple glTF bake cannot evaluate the Hair Attributes node on
        # its quad and produces a flat burgundy card. Epic's source attribute
        # atlas stores per-strand coverage in red. Embed that data texture in
        # the GLB; the Web shader consumes only its red channel and retains a
        # deterministic opaque/depth-writing card silhouette.
        texture_index = source_textures.get(role)
        pbr = material.setdefault("pbrMetallicRoughness", {})
        if not isinstance(pbr, dict):
            raise RuntimeError(f"Hair material has invalid PBR data: {name}")
        if texture_index is not None:
            pbr["baseColorTexture"] = {"index": texture_index, "texCoord": 0}
        pbr["baseColorFactor"] = (
            [0.34, 0.075, 0.04, 1.0]
            if role == "hair"
            else [0.055, 0.012, 0.008, 1.0]
        )
        pbr["metallicFactor"] = 0.0
        pbr["roughnessFactor"] = 0.58
        material["alphaMode"] = "MASK"
        material["alphaCutoff"] = 0.065
        material["doubleSided"] = True
        extras = material.setdefault("extras", {})
        if isinstance(extras, dict):
            extras["conclaviaCoverageChannel"] = "red"
            extras["conclaviaGroomRole"] = role
        repaired += 1
    if repaired != 2:
        raise RuntimeError(
            f"Expected portable hair and eyebrow card materials, repaired {repaired}"
        )
    return repaired


def repair_showcase_face_materials(
    path: Path,
    hair_attribute_path: Path | None = None,
    eyebrow_attribute_path: Path | None = None,
    wardrobe_skin_weights: list[list[tuple[str, float]]] | None = None,
) -> tuple[str, ...]:
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
        high_skin_matches = [
            material
            for material in materials
            if "face_skin_baked_lod1" in str(material.get("name", "")).casefold()
        ]
        if len(high_skin_matches) == 1:
            # Idempotent pass over an already stripped High Web face.
            intended = (
                _material_index(materials, "face_skin_baked_lod1"),
                _material_index(materials, "teeth_baked"),
                _material_index(materials, "eyel_baked"),
                _material_index(materials, "eyer_baked"),
            )
        else:
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

    if wardrobe_skin_weights is not None:
        _repair_wardrobe_skin_weights(document, chunks, wardrobe_skin_weights)
    _validate_extended_skin_influences(document)
    _repair_hair_cards_materials(
        document,
        chunks,
        hair_attribute_path,
        eyebrow_attribute_path,
    )

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
    if len(sys.argv) not in (2, 4):
        raise SystemExit(
            "usage: repair_showcase_glb.py /path/to/model.glb "
            "[/path/to/hair-attribute.png /path/to/eyebrows-attribute.png]"
        )
    repaired = repair_showcase_face_materials(
        Path(sys.argv[1]),
        Path(sys.argv[2]) if len(sys.argv) == 4 else None,
        Path(sys.argv[3]) if len(sys.argv) == 4 else None,
    )
    print("Repaired Showcase Face materials: " + ", ".join(repaired))
