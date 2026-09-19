"use client";

import dynamic from "next/dynamic";
import { useId, type CSSProperties } from "react";

import type { AssistantAppearance, AssistantVisualStyle } from "@/types/assistant-profile";
import type { AvatarViseme } from "@/lib/avatar-visemes";

import styles from "./BusinessAvatar.module.css";
import { PortraitAvatar } from "./PortraitAvatar";
import { useEditorialMotion } from "./useEditorialMotion";
import { editorialMouthPaths, editorialMouthTarget, editorialPalmPath, editorialArmPose, editorialFacePath } from "@/lib/editorial-motion";

export type AvatarMood = "neutral" | "friendly" | "focused" | "confident";
export type AvatarGesture = "rest" | "hand_raise";

export type BusinessAvatarProps = {
  appearance?: AssistantAppearance; visualStyle?: AssistantVisualStyle;
  viseme?: AvatarViseme; mood?: AvatarMood; gesture?: AvatarGesture;
  voiceLevel?: number; ariaLabel?: string;
};

// Three.js stays out of the 2D path and is loaded only when explicitly selected.
const StylizedAvatar3D = dynamic(() => import("./StylizedAvatar3D"), { ssr: false });

export function BusinessAvatar(props: BusinessAvatarProps) {
  if (props.visualStyle === "portrait_2_5d") {
    return <PortraitAvatar {...props} fallback={<EditorialAvatar {...props} />} />;
  }
  return props.visualStyle === "stylized_3d"
    ? <StylizedAvatar3D {...props} fallback={<EditorialAvatar {...props} />} />
    : <EditorialAvatar {...props} />;
}

/** Adult editorial portraits, drawn around the existing audio-clock rig. */
function EditorialAvatar({
  appearance = "business_clay", viseme = "rest", mood = "neutral", gesture = "rest", voiceLevel,
  ariaLabel = "Avatar del collega digitale in abito business",
}: BusinessAvatarProps) {
  // Persisted appearance IDs and voice pairing stay compatible with old meetings.
  const female = appearance === "business_clay_female";
  const faceClip = `avatar-face-${useId().replace(/:/gu, "")}`;
  const facePath = editorialFacePath(female);
  const root = useEditorialMotion({ appearance, viseme, mood, gesture, voiceLevel });
  const restingArm = editorialArmPose(0);
  const mouthClip = `${faceClip}-mouth`;
  const mouth = editorialMouthPaths(editorialMouthTarget("rest", 0));

  return (
    <svg ref={root} className={styles.businessAvatar} data-design="editorial-comic"
      data-appearance={appearance} data-viseme={viseme} data-mood={mood} data-gesture={gesture}
      data-audio-driven={voiceLevel !== undefined ? "true" : undefined}
      style={{ "--suit-paint": `url(#${faceClip}-suit)`, "--hair-paint": `url(#${faceClip}-hair)` } as CSSProperties}
      viewBox="0 0 680 760" role="img" aria-label={ariaLabel}>
      <defs>
        <clipPath id={`${faceClip}-frame`}><rect width="680" height="760" /></clipPath>
        <clipPath id={faceClip} data-avatar-face-clip><path d={facePath} /></clipPath>
        <clipPath id={mouthClip}><path data-mouth-part="clip" d={mouth.cavity} /></clipPath>
        <linearGradient id={`${faceClip}-skin`} x1="0" y1="0" x2="1" y2=".8">
          <stop stopColor={female ? "#f0c9ae" : "#e9bd9c"} /><stop offset=".58" stopColor={female ? "#eac0a4" : "#deb08e"} /><stop offset="1" stopColor={female ? "#dbaa90" : "#ca9778"} />
        </linearGradient>
        <linearGradient id={`${faceClip}-beard`} gradientUnits="userSpaceOnUse" x1="0" y1="319" x2="0" y2="408">
          <stop stopColor="#71675d" stopOpacity="0" /><stop offset=".7" stopColor="#71675d" stopOpacity=".10" /><stop offset="1" stopColor="#71675d" stopOpacity=".06" />
        </linearGradient>
        <linearGradient id={`${faceClip}-suit`} gradientUnits="userSpaceOnUse" x1="155" y1="455" x2="610" y2="735">
          <stop stopColor={female ? "#997466" : "#4b616e"} /><stop offset=".5" stopColor={female ? "#8c6658" : "#415764"} /><stop offset="1" stopColor={female ? "#79594f" : "#384d59"} />
        </linearGradient>
        <linearGradient id={`${faceClip}-hair`} gradientUnits="userSpaceOnUse" x1="220" y1="100" x2="455" y2="335">
          <stop stopColor={female ? "#49413e" : "#42474a"} /><stop offset=".55" stopColor={female ? "#302e2d" : "#2d353a"} /><stop offset="1" stopColor={female ? "#252828" : "#263034"} />
        </linearGradient>
      </defs>
      <g className={styles.avatarBody} data-rig="body" clipPath={`url(#${faceClip}-frame)`}>
        {female && <g className={styles.hairBack} data-rig="hair" data-testid="female-hair-back">
          <path d="M199 226c-8-93 40-145 141-145 104 0 151 58 143 150l-5 159 13 43c-34 13-60 7-92-9H276c-25 11-58 13-87 4l9-39 1-163Z" />
        </g>}
        {/* Sleeve caps continue the shoulder slope. Their inner closure stays
            behind the torso, so neither pose exposes a detached shoulder cap. */}
        <path className={styles.leftArm} d="M204 480c-41 17-91 33-114 61-17 21-22 47-27 85L43 756h109l18-211 48-55-14-10Z" />
        <g className={styles.restingArm} aria-hidden="true" data-testid="avatar-resting-arm">
          <path data-rig="upper-arm" className={styles.rightArm} d="M478 480c41 17 80 34 98 67 13 24 23 76 19 113l-73 3-12-118-46-55 14-10Z" />
        </g>
        <path className={styles.suitBack} d="m134 756 10-214c0-32 19-45 60-62l68-32h138l68 32c41 17 60 30 60 62l8 214H134Z" />
        <path className={styles.avatarNeck} d="M292 370h99v86q-49 48-99 0v-86Z" />
        <path className={styles.neckShadow} d="M293 389q49 29 97 0v23l-97 24v-47Z" />
        {female ? <g data-testid="female-blouse" data-rig="collar">
          <path className={styles.blouse} d="m286 451 7-4q48 39 97 0l9 4 36 305H247l39-305Z" />
          <path className={styles.necklace} d="M297 463q44 55 87 0" />
          <path className={styles.jewellery} d="m341 496 5 8-5 8-5-8 5-8Z" />
        </g> : <g data-rig="collar">
          <path className={styles.shirtFront} d="m284 449 9-5q48 42 97 0l9 5 36 307H247l37-307Z" />
          <path className={styles.shirtCollar} d="M288 452q53 57 107 0l4 14q-58 57-115 0l4-14Z" />
          <path className={styles.shirtSeam} d="M285 566v130m112-130v130" />
        </g>}
        <path className={styles.leftLapel} d="m278 444-41 12-19 64 30 24-21 25 82 187h22l-53-312Z" />
        <path className={styles.rightLapel} d="m404 444 41 12 19 64-30 24 21 25-82 187h-22l53-312Z" />
        <path className={styles.lapelLight} d="m277 451 45 278m82-278-43 278" />

        <path className={styles.clothFold} d="m175 578-9 80m318-91 20 23m-314 86 9 22m262-55-9 31" />
        <path className={styles.suitSeam} d="M168 574 152 746m360-172 16 172" />
        <path className={styles.pocket} d="m454 605 55-3v10l-55 3v-10Z" />
        <path className={styles.lapelPin} d="m441 502 7 7-7 7-7-7 7-7Z" />
        <g data-rig="arm" data-testid="editorial-articulated-arm"  aria-hidden="true">
          <path data-rig="forearm" className={styles.raisedSleeve} style={{ stroke: "none" }} d={restingArm.forearm} />
          <path data-rig="forearm-outline" className={styles.suitSeam} d={restingArm.outline} />
          <g data-rig="wrist" transform={`translate(${restingArm.wrist.x - 612} ${restingArm.wrist.y - 432}) rotate(${restingArm.angle} 612 432)`}>
            <path className={styles.raisedCuff} d="m585 448 8-31 59 10-5 32-62-11Z" />
            <path data-rig="palm" className={styles.raisedPalm} style={{ fill: `url(#${faceClip}-skin)` }} d={editorialPalmPath(0)} />
            <path data-rig="hand-detail" className={styles.handDetail} d="M584 373q14 8 17 27m20-42-2 39m21-34-6 35" />
          </g>
        </g>
        <g data-rig="head">
        <path className={styles.leftEar} d="M235 258c-24-19-29 6-23 32 4 18 12 31 25 22l-2-54Z" />
        <path className={styles.rightEar} d="M447 258c24-19 29 6 23 32-4 18-12 31-25 22l2-54Z" />
        <path className={styles.earDetail} d="M226 268q-9 3 0 24m230-24q9 3 0 24" />
        <path data-rig="face-outline" className={styles.avatarHead} style={{ fill: `url(#${faceClip}-skin)` }} d={facePath} />
        <g clipPath={`url(#${faceClip})`}>
          <path className={styles.facePlane} d="M226 174h22l4 122q4 33 21 47l-6 36-34-26-7-179Z" />
          <path className={styles.templePlane} d="M427 200q19 44 10 97l-17 26-11 50 24-23 21-50-2-92-25-8Z" />

          <path className={styles.jawPlane} d="M267 339q20 30 40 35 37 11 70-1 24-8 42-37l-9 36-35 33q-36 23-68 0l-35-29-5-37Z" />
          {!female && <path style={{ fill: `url(#${faceClip}-beard)` }} d="M260 316q26 16 55 8 28-6 55 1 27 8 56-11l-10 58-41 36q-34 18-67-1l-39-35-9-56Z" />}

        </g>
        {female ? <g data-testid="female-hair">
          <path className={styles.avatarHair} d="M217 339c-15-35-17-71-14-122 2-84 45-126 132-126 92 0 143 48 143 132l-5 121-26 45-1-152c-40-15-72-46-92-92-20 49-58 81-111 101l-3 124-23-31Z" />
          <path className={styles.hairPlane} d="M217 222q12-77 104-101-58 32-77 116l-3 131-15-25-9-121Zm183-72q52 30 55 85l-3 140 14-27 4-121q-7-50-70-77Z" />
          <path className={styles.hairSweep} d="M224 210q22-63 94-93m58 20q26 56 77 80" />
          <path className={styles.hairStrand} d="M233 226q13-60 71-93m-77 129 4 75m176-168q36 29 47 63l-3 90m-13-102q-13-31-42-54" />
          <path className={styles.hairEdge} d="M222 269v77m241-80-2 83" />
          <path className={styles.earring} d="M241 315c-19-5-20 28-2 28m204-28c19-5 20 28 2 28" />
        </g> : <g>
          <path className={styles.avatarHair} d="M227 271c-11-28-15-66-11-103 3-29 20-52 49-65 41-25 110-30 149-13 38 12 56 44 50 85l-10 74-10 22-6-78c-25-1-47-12-62-28-34 28-88 39-132 32l-8 74h-9Z" />
          <path className={styles.hairPlane} d="M236 167q43-61 117-59-30 11-55 27-34 26-62 32Zm157-50q39 9 50 37-30-7-50-37Z" />
          <path className={styles.hairSweep} d="M250 174q73-1 120-46m29 4q18 26 44 29" />
          <path className={styles.hairStrand} d="M245 155q38-35 85-40m-68 43q51-12 76-29m-73 55q59-7 94-33m47-5 22 18m-195 46 4-25m210 18 1 32" />
          <path className={styles.hairEdge} d="m229 207 5-31m214 15 1 39" />
        </g>}
        <g className={styles.avatarBrows}>
          <path className={styles.leftBrow} d={female ? "M264 230q22-10 45-1" : "m263 229 22-6 24 4"} />
          <path className={styles.rightBrow} d={female ? "M374 229q22-9 44 1" : "m374 227 24-4 21 6"} />
        </g>
        <g className={styles.avatarEyes} data-rig="eyes"><g className={styles.eyesExpression}>
          <path className={styles.eyeWhite} d="M263 254q22-18 46 0-23 13-46 0Zm110 0q23-18 46 0-23 13-46 0Z" />
          <g className={styles.pupils} data-rig="pupils">
            <circle className={styles.iris} cx="287" cy="252" r="7.2" /><circle className={styles.eye} cx="287" cy="252" r="3.8" />
            <circle className={styles.iris} cx="395" cy="252" r="7.2" /><circle className={styles.eye} cx="395" cy="252" r="3.8" />
            <circle className={styles.eyeSpark} cx="289" cy="250" r="1.5" />
            <circle className={styles.eyeSpark} cx="397" cy="250" r="1.5" />
          </g>
          <path className={styles.eyeLid} d="M263 254q22-18 46 0m64 0q23-18 46 0" />
          <path className={styles.lowerLid} d="M266 259q21 10 40-1m70 1q20 9 39-1" />
        </g></g>
        {!female && <g className={styles.glasses} aria-hidden="true">
          <path d="M254 240q31-7 64 0l-3 23q-2 12-16 12h-25q-15-1-17-14l-3-21Zm110 0q32-7 64 0l-3 21q-2 14-17 14h-25q-14 0-16-12l-3-23Z" />
          <path d="M319 247q22-9 44 0m-132-4 20 4m180 0 15-5" />
        </g>}
        <path className={styles.nosePlane} d="m337 260-7 34q6 8 18 6l-8 8-17-8 14-40Z" />
        <path className={styles.avatarNose} d="m337 266-9 34q6 9 21 3m6-5 5 4" />
        <g className={styles.faceExpressions} aria-hidden="true">
          <path className={styles.focusedEyeLines} d="M277 278q11 3 22 0m85 0q11 3 22 0" />
          <path className={styles.confidentEyeLine} d="M384 278q11 3 22 0" />
        </g>
        <path className={styles.chinContour} data-rig="chin" d="M318 388q23 7 47-1" />
        <g className={styles.mouthRig} data-testid="editorial-mouth">
          <path className={styles.mouthCavity} data-mouth-part="cavity" d={mouth.cavity} opacity="0" />
          <g clipPath={`url(#${mouthClip})`}>
            <path className={styles.teeth} data-mouth-part="teeth" d={mouth.teeth} opacity="0" />
            <path className={styles.tongue} data-mouth-part="tongue" d={mouth.tongue} opacity="0" />
          </g>
          <path className={styles.upperLipVolume} data-mouth-part="upperLip" d={mouth.upperLip} />
          <path className={styles.lowerLipVolume} data-mouth-part="lowerLip" d={mouth.lowerLip} />
          <path className={styles.lipLower} data-mouth-part="lower" d={mouth.lower} />
          <path className={styles.lipLine} data-mouth-part="upper" d={mouth.upper} />
        </g>
        <g className={styles.moodMouthLines} aria-hidden="true">
          <path className={styles.friendlySmileLines} d="M306 353q-3-4 0-8m72 8q3-4 0-8" />
          <path className={styles.focusedMouthLine} d="M331 378q10 2 20 0" />
          <path className={styles.confidentSmileLine} d="M378 353q4-5 1-10" />
        </g>
        </g>
      </g>
    </svg>
  );
}
