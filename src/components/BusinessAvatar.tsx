"use client";

import dynamic from "next/dynamic";
import { useId, type CSSProperties } from "react";

import type { AssistantAppearance, AssistantVisualStyle } from "@/types/assistant-profile";
import type { AvatarViseme } from "@/lib/avatar-visemes";

import styles from "./BusinessAvatar.module.css";
import { PortraitAvatar } from "./PortraitAvatar";

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
  const facePath = female
    ? "M231 209c0-63 39-94 109-94 73 0 110 37 110 101l-7 88c-3 32-18 57-38 76l-38 29q-27 16-52 0l-38-29c-22-21-37-48-40-78l-6-93Z"
    : "M231 209c-2-61 34-93 109-93 74 0 111 31 111 97l-5 98c-2 26-16 45-34 63l-39 32q-33 18-64 0l-41-32c-20-16-32-36-34-63l-3-102Z";
  const avatarStyle = voiceLevel === undefined ? undefined
    : ({ "--jaw-open": Math.max(0, Math.min(1, voiceLevel)) } as CSSProperties);

  return (
    <svg className={styles.businessAvatar} data-design="editorial-comic"
      data-appearance={appearance} data-viseme={viseme} data-mood={mood} data-gesture={gesture}
      data-audio-driven={voiceLevel !== undefined ? "true" : undefined}
      style={avatarStyle} viewBox="0 0 680 760" role="img" aria-label={ariaLabel}>
      <defs><clipPath id={faceClip} data-avatar-face-clip><path d={facePath} /></clipPath></defs>
      <g className={styles.avatarBody}>
        {female && <g className={styles.hairBack} data-testid="female-hair-back">
          <path d="M199 226c-8-93 40-145 141-145 104 0 151 58 143 150l-5 159 13 43c-34 13-60 7-92-9H276c-25 11-58 13-87 4l9-39 1-163Z" />
        </g>}
        {/* Sleeve caps continue the shoulder slope. Their inner closure stays
            behind the torso, so neither pose exposes a detached shoulder cap. */}
        <path className={styles.leftArm} d="M204 480c-41 17-91 33-114 61-17 21-22 47-27 85L43 756h109l18-211 48-55-14-10Z" />
        <g className={styles.restingArm} aria-hidden="true" data-testid="avatar-resting-arm">
          <path className={styles.rightArm} d="M478 480c41 17 89 33 112 61 17 21 22 47 27 85l20 130H528l-18-211-46-55 14-10Z" />
        </g>
        <g className={styles.raisedHand} aria-hidden="true" data-shoulder-anchor="529 510">
          <path className={styles.raisedSleeve} d="M478 480c41 17 69 34 94 65l45 54-15-160 49-7 18 148c4 33-11 55-33 59-23 3-39-12-55-35l-50-52-53-18v-54Z" />
          <path className={styles.raisedArmSeam} d="m606 607 29 13" />
          <path className={styles.raisedCuff} d="m588 449 8-41 58 7-4 43-62-9Z" />
          <path className={styles.raisedPalm} d="M586 419q-16-11-20-30l-18-24q-10-15 0-23 10-9 20 6l11 15-5-72q-1-15 10-15 11-2 12 13l3 46 1-69q0-14 11-14 11-1 12 14l1 69 7-54q2-14 12-11 11 2 9 16l-7 60 9-37q3-13 13-9 10 4 6 16l-13 74q-8 34-35 43-25 5-39-14Z" />
          <path className={styles.handDetail} d="M579 363q16 10 20 32m25-48-2 46m23-40-7 41" />
        </g>
        <path className={styles.suitBack} d="m134 756 10-214c0-32 19-45 60-62l68-32h138l68 32c41 17 60 30 60 62l8 214H134Z" />
        <path className={styles.avatarNeck} d="M292 370h99v86q-49 48-99 0v-86Z" />
        <path className={styles.neckShadow} d="M293 389q49 29 97 0v23l-97 24v-47Z" />
        {female ? <g data-testid="female-blouse">
          <path className={styles.blouse} d="m286 451 7-4q48 39 97 0l9 4 36 305H247l39-305Z" />
          <path className={styles.necklace} d="M297 463q44 55 87 0" />
          <path className={styles.jewellery} d="m341 496 5 8-5 8-5-8 5-8Z" />
        </g> : <g>
          <path className={styles.shirtFront} d="m284 449 9-5q48 42 97 0l9 5 36 307H247l37-307Z" />
          <path className={styles.shirtCollar} d="M288 452q53 57 107 0l4 14q-58 57-115 0l4-14Z" />
          <path className={styles.shirtSeam} d="M285 566v130m112-130v130" />
        </g>}
        <path className={styles.leftLapel} d="m278 444-41 12-19 64 30 24-21 25 82 187h22l-53-312Z" />
        <path className={styles.rightLapel} d="m404 444 41 12 19 64-30 24 21 25-82 187h-22l53-312Z" />
        <path className={styles.suitSeam} d="M168 574 152 746m360-172 16 172" />
        <path className={styles.pocket} d="m454 605 55-3v10l-55 3v-10Z" />
        <path className={styles.lapelPin} d="m441 502 7 7-7 7-7-7 7-7Z" />
        <path className={styles.leftEar} d="M235 258c-24-19-29 6-23 32 4 18 12 31 25 22l-2-54Z" />
        <path className={styles.rightEar} d="M447 258c24-19 29 6 23 32-4 18-12 31-25 22l2-54Z" />
        <path className={styles.earDetail} d="M226 268q-9 3 0 24m230-24q9 3 0 24" />
        <path className={styles.avatarHead} d={facePath} />
        <g clipPath={`url(#${faceClip})`}>
          <path className={styles.facePlane} d="M226 174h19l4 148q3 27 17 45l-33-14-7-179Z" />
        </g>
        {female ? <g data-testid="female-hair">
          <path className={styles.avatarHair} d="M217 339c-15-35-17-71-14-122 2-84 45-126 132-126 92 0 143 48 143 132l-5 121-26 45-1-152c-40-15-72-46-92-92-20 49-58 81-111 101l-3 124-23-31Z" />
          <path className={styles.hairSweep} d="M224 210q22-63 94-93m58 20q26 56 77 80" />
          <path className={styles.hairEdge} d="M222 269v77m241-80-2 83" />
          <path className={styles.earring} d="M241 315c-19-5-20 28-2 28m204-28c19-5 20 28 2 28" />
        </g> : <g>
          <path className={styles.avatarHair} d="m227 271-11-39 2-65c2-23 15-42 36-54l-7-17 34 1c35-32 102-30 137-8 42 13 52 44 47 88l-9 66-10 28-6-85c-26 1-46-11-62-27-34 28-90 41-134 34l-8 78h-9Z" />
          <path className={styles.hairSweep} d="M250 166q73 3 120-46m29 4q18 26 44 29" />
          <path className={styles.hairEdge} d="m229 207 5-31m214 15 1 39" />
        </g>}
        <g className={styles.avatarBrows}>
          <path className={styles.leftBrow} d={female ? "M264 230q22-10 45-1" : "m263 229 22-6 24 4"} />
          <path className={styles.rightBrow} d={female ? "M374 229q22-9 44 1" : "m374 227 24-4 21 6"} />
        </g>
        <g className={styles.avatarEyes}><g className={styles.eyesExpression}>
          <path className={styles.eyeWhite} d="M263 254q22-18 46 0-23 13-46 0Zm110 0q23-18 46 0-23 13-46 0Z" />
          <g className={styles.pupils}>
            <circle className={styles.eye} cx="287" cy="252" r="7" />
            <circle className={styles.eye} cx="395" cy="252" r="7" />
            <circle className={styles.eyeSpark} cx="289" cy="250" r="1.5" />
            <circle className={styles.eyeSpark} cx="397" cy="250" r="1.5" />
          </g>
          <path className={styles.eyeLid} d="M263 254q22-18 46 0m64 0q23-18 46 0" />
        </g></g>
        {!female && <g className={styles.glasses} aria-hidden="true">
          <path d="M251 238h68l-3 29q-1 9-12 9h-35q-13 0-15-10l-3-28Zm112 0h68l-3 28q-2 10-15 10h-35q-11 0-12-9l-3-29Z" />
          <path d="M319 247q22-9 44 0m-132-4 20 4m180 0 15-5" />
        </g>}
        <path className={styles.avatarNose} d="m337 266-9 34q6 9 21 3m6-5 5 4" />
        <g className={styles.faceExpressions} aria-hidden="true">
          <path className={styles.focusedEyeLines} d="M277 278q11 3 22 0m85 0q11 3 22 0" />
          <path className={styles.confidentEyeLine} d="M384 278q11 3 22 0" />
        </g>
        <g className={styles.lowerFace}><g className={styles.mouthRig}>
          <g className={`${styles.mouthShape} ${styles.mouthRest}`}>
            <path className={styles.lipLower} d="M311 408q31 9 61-4-27 23-61 4Z" />
            <path className={styles.lipLine} d="M306 405q35 13 70-3" />
          </g>
          <g className={`${styles.mouthShape} ${styles.mouthMbp}`}>
            <path className={styles.lipLower} d="M310 407q31 10 62 0-31 18-62 0Z" />
            <path className={styles.lipLine} d="M308 407q33 8 66 0" />
          </g>
          <g className={`${styles.mouthShape} ${styles.mouthFv}`}><path className={styles.mouthCavity} d="M303 404c23-14 54-14 78 0-11 24-67 24-78 0Z" /><path className={styles.teeth} d="M307 404c21-8 48-8 70 0-20 10-50 10-70 0Z" /><path className={styles.lipLower} d="M307 414c20-5 49-5 69 0-18 16-51 16-69 0Z" /></g>
          <g className={`${styles.mouthShape} ${styles.mouthA}`}><path className={styles.mouthCavity} d="M302 402c23-15 55-15 78 0 6 36-11 57-39 57-27 0-45-21-39-57Z" /><path className={styles.teeth} d="M307 402c20-8 48-8 68 0-18 12-50 12-68 0Z" /><path className={styles.tongue} d="M313 443c17-11 40-11 56 0-14 14-43 15-56 0Z" /><path className={styles.lipOutline} d="M302 402c23-15 55-15 78 0 6 36-11 57-39 57-27 0-45-21-39-57Z" /></g>
          <g className={`${styles.mouthShape} ${styles.mouthE}`}><path className={styles.mouthCavity} d="M295 407c27-18 65-18 92 0-22 29-70 29-92 0Z" /><path className={styles.teeth} d="M300 406c24-10 58-10 82 0-22 12-60 12-82 0Z" /><path className={styles.lipOutline} d="M295 407c27-18 65-18 92 0-22 29-70 29-92 0Z" /></g>
          <g className={`${styles.mouthShape} ${styles.mouthO}`}><ellipse className={styles.mouthCavity} cx="341" cy="421" rx="27" ry="34" /><ellipse className={styles.tongue} cx="341" cy="439" rx="15" ry="7" /><ellipse className={styles.lipOutline} cx="341" cy="421" rx="29" ry="36" /></g>
          <g className={`${styles.mouthShape} ${styles.mouthU}`}><ellipse className={styles.mouthCavity} cx="341" cy="418" rx="19" ry="25" /><ellipse className={styles.lipOutline} cx="341" cy="418" rx="24" ry="29" /></g>
          <g className={`${styles.mouthShape} ${styles.mouthConsonant}`}><path className={styles.mouthCavity} d="M302 405c23-15 55-15 78 0-12 25-66 25-78 0Z" /><path className={styles.teeth} d="M307 405c20-8 48-8 68 0-18 9-50 9-68 0Z" /><path className={styles.lipOutline} d="M302 405c23-15 55-15 78 0-12 25-66 25-78 0Z" /></g>
        </g><g className={styles.moodMouthLines} aria-hidden="true">
          <path className={styles.friendlySmileLines} d="M297 402q-3-5 0-10m87 10q3-5 0-10" />
          <path className={styles.focusedMouthLine} d="M326 431q15 2 30 0" />
          <path className={styles.confidentSmileLine} d="M384 402q4-6 1-12" />
        </g></g>
      </g>
    </svg>
  );
}
