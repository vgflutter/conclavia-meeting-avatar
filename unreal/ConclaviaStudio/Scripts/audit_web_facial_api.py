"""Audit the licensed facial generator surface exposed to Unreal Python.

The browser avatar library must be generated from reproducible controls, not
hand-authored guesses.  This script records the reflected classes, enum values,
configuration fields and callable generator methods without processing audio
or copying any licensed model data into the repository.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import unreal


OUTPUT_PATH = Path(
    os.environ.get(
        "CONCLAVIA_WEB_FACIAL_API_AUDIT_OUTPUT",
        str(
            Path(unreal.Paths.project_saved_dir())
            / "WebAvatarExport"
            / "facial-api-audit.json"
        ),
    )
)

TYPE_NAMES = (
    "RealisticMetaHumanLipSyncGenerator",
    "RealisticMetaHumanLipSyncMoodConfig",
    "RealisticMetaHumanLipSyncMood",
    "RealisticMetaHumanLipSyncOutputType",
    "LipSyncModelLoadState",
)

EXPECTED_GENERATOR_METHODS = (
    "create_realistic_meta_human_lip_sync_with_mood_generator",
    "create_realistic_meta_human_lip_sync_generator",
    "get_control_names",
    "get_control_values",
    "get_model_load_state",
    "is_model_ready",
    "process_audio_data",
    "set_mood",
    "set_mood_intensity",
    "set_output_type",
)

EXPECTED_CONFIG_PROPERTIES = (
    "intra_op_threads",
    "inter_op_threads",
    "lookahead_ms",
    "output_type",
)


def public_members(value: Any) -> list[str]:
    return sorted(name for name in dir(value) if not name.startswith("_"))


def safe_text(value: Any) -> str:
    try:
        return str(value)
    except Exception as error:  # pragma: no cover - defensive in UE reflection
        return f"<{type(error).__name__}>"


def enum_members(enum_type: Any) -> dict[str, str]:
    members: dict[str, str] = {}
    ignored = {
        "cast",
        "name",
        "static_enum",
        "to_tuple",
        "value",
    }
    for name in public_members(enum_type):
        if name.casefold() in ignored or not name.isupper():
            continue
        try:
            members[name] = safe_text(getattr(enum_type, name))
        except Exception as error:
            members[name] = f"ERROR:{type(error).__name__}:{error}"
    return members


def config_audit(config_type: Any) -> dict[str, Any]:
    if config_type is None:
        return {"constructible": False, "error": "type-not-exposed"}
    try:
        config = config_type()
    except Exception as error:
        return {
            "constructible": False,
            "error": f"{type(error).__name__}:{error}",
        }
    members = public_members(config)
    properties: dict[str, Any] = {}
    for name in EXPECTED_CONFIG_PROPERTIES:
        if name not in members:
            properties[name] = {"available": False}
            continue
        try:
            properties[name] = {
                "available": True,
                "value": safe_text(config.get_editor_property(name)),
            }
        except Exception as error:
            properties[name] = {
                "available": True,
                "error": f"{type(error).__name__}:{error}",
            }
    return {
        "constructible": True,
        "members": members,
        "properties": properties,
    }


def main() -> None:
    exposed_types = {name: getattr(unreal, name, None) for name in TYPE_NAMES}
    generator_type = exposed_types["RealisticMetaHumanLipSyncGenerator"]
    generator_members = public_members(generator_type) if generator_type else []
    method_audit = {
        name: {
            "available": name in generator_members,
            "callable": bool(
                name in generator_members
                and callable(getattr(generator_type, name, None))
            ),
        }
        for name in EXPECTED_GENERATOR_METHODS
    }

    report = {
        "schemaVersion": 1,
        "engineVersion": unreal.SystemLibrary.get_engine_version(),
        "types": {
            name: {
                "available": value is not None,
                "pythonType": type(value).__name__ if value is not None else None,
            }
            for name, value in exposed_types.items()
        },
        "generator": {
            "members": generator_members,
            "methods": method_audit,
        },
        "config": config_audit(
            exposed_types["RealisticMetaHumanLipSyncMoodConfig"]
        ),
        "moods": enum_members(exposed_types["RealisticMetaHumanLipSyncMood"])
        if exposed_types["RealisticMetaHumanLipSyncMood"]
        else {},
        "outputTypes": enum_members(
            exposed_types["RealisticMetaHumanLipSyncOutputType"]
        )
        if exposed_types["RealisticMetaHumanLipSyncOutputType"]
        else {},
        "modelStates": enum_members(exposed_types["LipSyncModelLoadState"])
        if exposed_types["LipSyncModelLoadState"]
        else {},
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(report, indent=2, sort_keys=True),
        encoding="utf-8",
    )

    missing_types = [
        name for name, value in exposed_types.items() if value is None
    ]
    available_methods = [
        name for name, state in method_audit.items() if state["available"]
    ]
    unreal.log_warning(
        "CONCLAVIA_WEB_FACIAL_API_AUDIT_OK "
        f"output={OUTPUT_PATH} missingTypes={','.join(missing_types) or 'none'} "
        f"methods={len(available_methods)} moods={len(report['moods'])}"
    )


if __name__ == "__main__":
    main()
