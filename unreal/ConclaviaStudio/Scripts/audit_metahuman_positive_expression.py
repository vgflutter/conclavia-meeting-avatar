"""Audit Epic's UE 5.8 positive facial templates before runtime integration.

The meeting runtime must never play a template's bone tracks directly on a
different MetaHuman identity.  This audit records whether Epic's positive
assets contain bone transforms, animation curves, or pose data so the runtime
can select the curve-only/Pose Asset route documented for shared faces.
"""

from __future__ import annotations

import unreal


ASSET_PATHS = (
    "/MetaHumanCharacter/Optional/Animation/TemplateAnimations/Facial_Poses/Happy/mhc_mh002_fmn_f_gpf_happy_s001",
    "/MetaHumanCharacter/Optional/Animation/TemplateAnimations/Expression_Loops/HappyA/mhc_mh002_fmn_f_facialloop_happy_f_s001",
    "/MetaHumanCharacter/Optional/Animation/TemplateAnimations/Expression_Loops/HappyA/mhc_mh002_fmn_b_facialloop_happy_f_s001",
)


def log(message: str) -> None:
    unreal.log_warning(f"CONCLAVIA_POSITIVE_EXPRESSION_AUDIT: {message}")


def animation_curve_names(sequence: unreal.AnimSequence) -> list[str]:
    try:
        library = unreal.AnimationLibrary
        return sorted(
            str(name)
            for name in library.get_animation_curve_names(
                sequence,
                unreal.RawCurveTrackTypes.RCT_FLOAT,
            )
        )
    except Exception as error:
        log(f"curve_names_error asset={sequence.get_path_name()} error={error!r}")
        return []


def animation_bone_names(sequence: unreal.AnimSequence) -> list[str]:
    try:
        library = unreal.AnimationLibrary
        return sorted(str(name) for name in library.get_animation_track_names(sequence))
    except Exception as first_error:
        try:
            controller = sequence.get_controller()
            model = controller.get_model()
            return sorted(str(name) for name in model.get_bone_animation_track_names())
        except Exception as error:
            log(
                f"bone_names_error asset={sequence.get_path_name()} "
                f"legacy_error={first_error!r} model_error={error!r}"
            )
            return []


def main() -> None:
    log(
        "python_animation_libraries="
        + ",".join(
            sorted(
                name
                for name in dir(unreal)
                if "animation" in name.casefold() and "library" in name.casefold()
            )
        )
    )
    for path in ASSET_PATHS:
        asset = unreal.load_asset(path)
        if asset is None:
            log(f"missing path={path}")
            continue
        class_path = asset.get_class().get_path_name()
        details = [f"path={path}", f"class={class_path}"]
        if isinstance(asset, unreal.AnimSequence):
            data_model = asset.get_editor_property("data_model")
            log(
                f"sequence_methods path={path} methods="
                + ",".join(
                    name
                    for name in dir(asset)
                    if any(token in name.casefold() for token in ("curve", "track", "model"))
                )
            )
            log(
                f"data_model_methods path={path} methods="
                + ",".join(
                    name
                    for name in dir(data_model)
                    if any(token in name.casefold() for token in ("curve", "track", "bone"))
                )
            )
            curves = animation_curve_names(asset)
            bones = animation_bone_names(asset)
            positive_values = []
            for curve_name in curves:
                if any(
                    token in curve_name.casefold()
                    for token in (
                        "mouthcornerpull",
                        "mouthdimple",
                        "eyecheekraise",
                        "jawopen",
                        "browdown",
                        "browraise",
                    )
                ):
                    value = unreal.AnimationLibrary.get_float_value_at_time(
                        asset,
                        curve_name,
                        0.0,
                    )
                    positive_values.append(f"{curve_name}:{value:.4f}")
            skeleton = asset.get_editor_property("skeleton")
            details.extend(
                (
                    f"duration={asset.get_play_length():.3f}",
                    f"skeleton={skeleton.get_path_name() if skeleton else 'none'}",
                    f"curve_count={len(curves)}",
                    f"bone_track_count={len(bones)}",
                    f"curves={','.join(curves[:24])}",
                    f"positive_values={','.join(positive_values)}",
                    f"bones={','.join(bones[:24])}",
                )
            )
        elif isinstance(asset, unreal.PoseAsset):
            details.append("pose_asset=true")
        log(" ".join(details))
    log("READY")


if __name__ == "__main__":
    main()
