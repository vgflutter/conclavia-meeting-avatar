"""Export the installed Epic BodyROM as an analysis-only animation GLB.

The probe is never shipped as a meeting gesture. It lets the portable authoring
pipeline select genuinely authored nod, tilt, emphasis and settle passages
before baking only safe seated upper-body deltas into product-owned clips.
"""

from __future__ import annotations

import os
from pathlib import Path

import unreal


SOURCE_PATH = os.environ.get(
    "CONCLAVIA_WEB_BODY_PROBE_SOURCE",
    "/MetaHumanCharacter/Optional/Animation/TemplateAnimations/Technical_Loops/"
    "BodyROM/mhc_body_rom_body",
)
OUTPUT_PATH = Path(
    os.environ.get(
        "CONCLAVIA_WEB_BODY_PROBE_OUTPUT",
        str(
            Path(unreal.Paths.project_saved_dir())
            / "WebAvatarExport"
            / "official-body-rom.glb"
        ),
    )
)


def main() -> None:
    source = unreal.load_asset(SOURCE_PATH)
    if not isinstance(source, unreal.AnimSequence):
        raise RuntimeError(f"Official MetaHuman body motion is unavailable: {SOURCE_PATH}")
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
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    if OUTPUT_PATH.exists():
        OUTPUT_PATH.unlink()
    exported = unreal.GLTFExporter.export_to_gltf(
        source,
        str(OUTPUT_PATH),
        options,
        set(),
    )
    if not OUTPUT_PATH.is_file() or OUTPUT_PATH.stat().st_size < 20:
        raise RuntimeError(f"Official BodyROM GLB export failed: {OUTPUT_PATH}")
    unreal.log_warning(
        "CONCLAVIA_WEB_BODY_PROBE: READY "
        f"source={SOURCE_PATH} output={OUTPUT_PATH} bytes={OUTPUT_PATH.stat().st_size} "
        f"tracks={len(unreal.AnimationLibrary.get_animation_track_names(source))} "
        f"duration={float(source.get_play_length()):.6f} exported={bool(exported)}"
    )


if __name__ == "__main__":
    main()
