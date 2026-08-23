"""Build a gentle, identity-safe MetaHuman applause expression.

Epic's optional happy pose contains both portable facial control curves and
875 baked facial-bone tracks.  Playing those bone tracks directly on another
MetaHuman identity changes the face shape and produced the tense grin observed
in the meeting renderer.  This build keeps only a restrained subset of the
official positive control curves and eases them in and out over the applause.
"""

from __future__ import annotations

import unreal


SOURCE_PATH = (
    "/MetaHumanCharacter/Optional/Animation/TemplateAnimations/Facial_Poses/"
    "Happy/mhc_mh002_fmn_f_gpf_happy_s001"
)
OUTPUT_PATH = "/Game/Conclavia/Meeting/Animations"
ASSET_NAME = "AS_MeetingPositiveExpression_CurveOnly_v1"
FRAME_RATE = 30
DURATION_SECONDS = 4.5

# These are sampled from Epic's official positive pose.  Brow-down, jaw-open,
# eye-look and all identity-specific bone tracks are deliberately excluded.
# The per-control gains turn the broad template expression into a warm,
# closed-mouth meeting smile.
CONTROL_GAINS = {
    "ctrl_expressions_mouthcornerpulll": 0.35,
    "ctrl_expressions_mouthcornerpullr": 0.35,
    "ctrl_expressions_mouthdimplel": 0.18,
    "ctrl_expressions_mouthdimpler": 0.18,
    "ctrl_expressions_eyecheekraisel": 0.24,
    "ctrl_expressions_eyecheekraiser": 0.24,
}


def build() -> None:
    source = unreal.load_asset(SOURCE_PATH)
    if not isinstance(source, unreal.AnimSequence):
        raise RuntimeError(f"Official MetaHuman positive pose missing: {SOURCE_PATH}")

    skeleton = source.get_editor_property("skeleton")
    if not isinstance(skeleton, unreal.Skeleton):
        raise RuntimeError("Official MetaHuman positive pose has no skeleton")

    asset_path = f"{OUTPUT_PATH}/{ASSET_NAME}"
    if unreal.EditorAssetLibrary.does_asset_exist(asset_path):
        if not unreal.EditorAssetLibrary.delete_asset(asset_path):
            raise RuntimeError(f"Could not replace {asset_path}")

    factory = unreal.AnimSequenceFactory()
    factory.target_skeleton = skeleton
    animation = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        ASSET_NAME,
        OUTPUT_PATH,
        unreal.AnimSequence,
        factory,
    )
    if not isinstance(animation, unreal.AnimSequence):
        raise RuntimeError("Could not create curve-only positive expression")

    controller = animation.controller
    controller.open_bracket("Build MetaHuman curve-only positive expression")
    try:
        controller.set_frame_rate(unreal.FrameRate(FRAME_RATE, 1), False)
        controller.set_number_of_frames(
            unreal.FrameNumber(round(DURATION_SECONDS * FRAME_RATE)),
            False,
        )
    finally:
        controller.close_bracket(False)

    source_curves = {
        str(name).casefold(): name
        for name in unreal.AnimationLibrary.get_animation_curve_names(
            source,
            unreal.RawCurveTrackTypes.RCT_FLOAT,
        )
    }
    missing = sorted(set(CONTROL_GAINS) - set(source_curves))
    if missing:
        unreal.EditorAssetLibrary.delete_asset(asset_path)
        raise RuntimeError(f"Official positive controls missing: {missing}")

    applied_values: list[str] = []
    for normalized_name, gain in CONTROL_GAINS.items():
        curve_name = source_curves[normalized_name]
        source_value = unreal.AnimationLibrary.get_float_value_at_time(
            source,
            curve_name,
            0.0,
        )
        value = max(-1.0, min(1.0, source_value * gain))
        unreal.AnimationLibrary.add_curve(
            animation,
            curve_name,
            unreal.RawCurveTrackTypes.RCT_FLOAT,
            False,
        )
        unreal.AnimationLibrary.add_float_curve_keys(
            animation,
            curve_name,
            [0.0, 0.45, 4.05, DURATION_SECONDS],
            [0.0, value, value, 0.0],
        )
        applied_values.append(f"{curve_name}:{value:.4f}")

    bone_tracks = unreal.AnimationLibrary.get_animation_track_names(animation)
    curve_names = unreal.AnimationLibrary.get_animation_curve_names(
        animation,
        unreal.RawCurveTrackTypes.RCT_FLOAT,
    )
    if bone_tracks or len(curve_names) != len(CONTROL_GAINS):
        unreal.EditorAssetLibrary.delete_asset(asset_path)
        raise RuntimeError(
            "Positive expression failed its curve-only gate: "
            f"bones={len(bone_tracks)} curves={len(curve_names)}"
        )

    unreal.EditorAssetLibrary.save_loaded_asset(animation, only_if_is_dirty=False)
    unreal.log_warning(
        "CONCLAVIA_POSITIVE_EXPRESSION_OK: "
        f"asset={asset_path} duration={animation.get_play_length():.3f} "
        f"curves={len(curve_names)} bones={len(bone_tracks)} "
        f"values={','.join(applied_values)}"
    )


if __name__ == "__main__":
    build()
