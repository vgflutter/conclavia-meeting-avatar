"""Sample the licensed MetaHuman mood model for portable Web authoring.

The output contains only transient numeric control values produced by the
installed generator.  It does not copy the licensed model or plugin.  Silent
chunks deliberately reveal the expression layer without tying the sample to a
particular spoken sentence.
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any

import unreal


OUTPUT_PATH = Path(
    os.environ.get(
        "CONCLAVIA_WEB_FACIAL_CONTROL_OUTPUT",
        str(
            Path(unreal.Paths.project_saved_dir())
            / "WebAvatarExport"
            / "facial-control-samples.json"
        ),
    )
)
SAMPLE_RATE = 16_000
CHUNK_SAMPLES = 640
MODEL_TIMEOUT_SECONDS = 60.0
MOOD_INTENSITIES = {
    "NEUTRAL": 0.0,
    "HAPPINESS": 0.38,
    "SADNESS": 0.38,
    "DISGUST": 0.38,
    "ANGER": 0.38,
    "SURPRISE": 0.32,
    "FEAR": 0.38,
    "CONFIDENCE": 0.40,
    "EXCITEMENT": 0.40,
    "BOREDOM": 0.34,
    "PLAYFULNESS": 0.38,
    "CONFUSION": 0.32,
}
SPEECH_TOKENS = ("mouth", "jaw", "tongue", "teeth", "neck", "throat")
UPPER_FACE_TOKENS = ("brow", "eye", "cheek", "nose")


def control_group(name: str) -> str:
    normalized = name.casefold()
    if any(token in normalized for token in SPEECH_TOKENS):
        return "speech"
    if any(token in normalized for token in UPPER_FACE_TOKENS):
        return "upperFace"
    return "other"


def normalized_controls(generator: Any) -> dict[str, float]:
    return {
        str(name): round(float(value), 7)
        for name, value in dict(generator.get_control_values()).items()
    }


def summarize(values: dict[str, float]) -> dict[str, Any]:
    groups: dict[str, list[tuple[str, float]]] = {
        "speech": [],
        "upperFace": [],
        "other": [],
    }
    for name, value in values.items():
        groups[control_group(name)].append((name, value))
    return {
        group: {
            "count": len(entries),
            "maxAbs": round(max((abs(value) for _, value in entries), default=0.0), 7),
            "top": [
                {"name": name, "value": value}
                for name, value in sorted(
                    entries,
                    key=lambda entry: abs(entry[1]),
                    reverse=True,
                )[:8]
            ],
        }
        for group, entries in groups.items()
    }


def feed_silence(generator: Any, chunk_count: int) -> list[dict[str, float]]:
    frames: list[dict[str, float]] = []
    for _ in range(chunk_count):
        generator.process_audio_data([0.0] * CHUNK_SAMPLES, SAMPLE_RATE, 1)
        # Inference runs off-thread. Give it one real-time chunk before reading
        # the reflected control map; no editor/game tick is required.
        time.sleep(CHUNK_SAMPLES / SAMPLE_RATE)
        frames.append(normalized_controls(generator))
    return frames


def wait_until_ready(generator: Any) -> tuple[float, str]:
    started_at = time.monotonic()
    state = str(generator.get_model_load_state())
    while time.monotonic() - started_at < MODEL_TIMEOUT_SECONDS:
        state = str(generator.get_model_load_state())
        if generator.is_model_ready():
            return time.monotonic() - started_at, state
        if "FAILED" in state.upper():
            raise RuntimeError(f"Licensed facial model failed to load: {state}")
        time.sleep(0.05)
    raise RuntimeError(f"Licensed facial model timed out: {state}")


def main() -> None:
    config = unreal.RealisticMetaHumanLipSyncMoodConfig()
    config.set_editor_property("intra_op_threads", 4)
    config.set_editor_property("inter_op_threads", 1)
    config.set_editor_property("lookahead_ms", 40)
    config.set_editor_property(
        "output_type",
        unreal.RealisticMetaHumanLipSyncOutputType.FULL_FACE,
    )
    generator = (
        unreal.RealisticMetaHumanLipSyncGenerator
        .create_realistic_meta_human_lip_sync_with_mood_generator(config)
    )
    if generator is None:
        raise RuntimeError("Licensed full-face mood generator creation failed")
    generator.set_editor_property("processing_chunk_size", CHUNK_SAMPLES)
    generator.set_mood(unreal.RealisticMetaHumanLipSyncMood.NEUTRAL)
    generator.set_mood_intensity(0.0)
    generator.set_output_type(
        unreal.RealisticMetaHumanLipSyncOutputType.FULL_FACE
    )
    load_seconds, model_state = wait_until_ready(generator)

    available_controls = [
        str(name)
        for name in unreal.RealisticMetaHumanLipSyncGenerator.get_control_names()
    ]
    samples: dict[str, Any] = {}
    for mood_name, intensity in MOOD_INTENSITIES.items():
        mood = getattr(unreal.RealisticMetaHumanLipSyncMood, mood_name)
        generator.set_mood(mood)
        generator.set_mood_intensity(intensity)
        frames = feed_silence(generator, 8)
        # The final frame follows 320 ms of stable input and is the closest to
        # the pose users see after the natural reaction transition.
        controls = frames[-1]
        samples[mood_name] = {
            "intensity": intensity,
            "frames": frames,
            "controls": controls,
            "summary": summarize(controls),
        }
        generator.set_mood(unreal.RealisticMetaHumanLipSyncMood.NEUTRAL)
        generator.set_mood_intensity(0.0)
        feed_silence(generator, 3)

    report = {
        "schemaVersion": 1,
        "engineVersion": unreal.SystemLibrary.get_engine_version(),
        "sampleRate": SAMPLE_RATE,
        "chunkSamples": CHUNK_SAMPLES,
        "modelLoadSeconds": round(load_seconds, 4),
        "modelState": model_state,
        "controlNames": available_controls,
        "samples": samples,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(report, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    non_empty = sum(
        1 for sample in samples.values() if sample["controls"]
    )
    unreal.log_warning(
        "CONCLAVIA_WEB_FACIAL_CONTROL_SAMPLE_OK "
        f"output={OUTPUT_PATH} moods={len(samples)} nonEmpty={non_empty} "
        f"controls={len(available_controls)} loadSeconds={load_seconds:.3f}"
    )


if __name__ == "__main__":
    main()
