/** A critically damped gesture. Reversals preserve position and velocity. */
export type PortraitGestureMotion = { position: number; velocity: number };
export function advancePortraitGesture(state: PortraitGestureMotion, target: number, dt: number, reduced = false): PortraitGestureMotion {
  if (reduced) return { position: target, velocity: 0 };
  return advanceDampedMotion(state, target, dt, 10);
}

function advanceDampedMotion(state: PortraitGestureMotion, target: number, dt: number, omega: number): PortraitGestureMotion {
  // The analytic solution remains consistent even on a 15 Hz device. Bound
  // only long stalls; hidden-tab time is discarded by the renderer itself.
  const t = Math.max(0, Math.min(dt, .1));
  const displacement = state.position - target;
  const coefficient = state.velocity + omega * displacement;
  const decay = Math.exp(-omega * t);
  const position = target + (displacement + coefficient * t) * decay;
  const velocity = (state.velocity - omega * coefficient * t) * decay;
  if (Math.abs(position - target) < .0005 && Math.abs(velocity) < .004) return { position: target, velocity: 0 };
  return { position: Math.max(0, Math.min(1, position)), velocity };
}

export type PortraitPosture = {
  shoulder: PortraitGestureMotion;
  torso: PortraitGestureMotion;
  speech: number;
};
export type PortraitBodyFrame = { lean: number; shoulder: number; breath: number };

export function initialPortraitPosture(raised: number): PortraitPosture {
  return { shoulder: { position: raised, velocity: 0 }, torso: { position: raised, velocity: 0 }, speech: 0 };
}

/** The shoulder leads the forearm; the chest follows with a slower settling time.
 * Speech affects posture through a broad envelope, never individual phonemes. */
export function advancePortraitPosture(state: PortraitPosture, raised: number, voiceLevel: number, dt: number, reduced: boolean): PortraitPosture {
  if (reduced) return initialPortraitPosture(raised);
  const energy = Number.isFinite(voiceLevel) ? Math.max(0, Math.min(1, (voiceLevel - .025) / .325)) : 0;
  const blend = 1 - Math.exp(-Math.max(0, Math.min(dt, .1)) / (energy > state.speech ? .18 : .38));
  return {
    shoulder: advanceDampedMotion(state.shoulder, raised, dt, 13),
    torso: advanceDampedMotion(state.torso, raised, dt, 7),
    speech: state.speech + (energy - state.speech) * blend,
  };
}

export function portraitBodyFrame(state: PortraitPosture, _seconds: number, breath: number, reduced: boolean): PortraitBodyFrame {
  return {
    lean: .028 * state.torso.position,
    shoulder: .022 * state.shoulder.position,
    breath: reduced ? 0 : breath + .0005 * state.speech,
  };
}

/** Forward displacement in normalized atlas-cell coordinates. The face and
 * bottom edge are pinned; jacket, shoulders and chest share one smooth field.
 * Keep this field in sync with bodyOffset in portrait-renderer.ts. */
export function portraitBodyOffset(x: number, y: number, body: PortraitBodyFrame): readonly [number, number] {
  const weight = smooth(.55, .73, y) * (1 - smooth(.78, 1, y));
  const shoulder = Math.exp(-(((x - .22) / .34) ** 2 + ((y - .65) / .32) ** 2));
  return [
    (-(y - .97) * body.lean + (x - .5) * body.breath * 1.4) * weight,
    ((x - .5) * body.lean - body.shoulder * shoulder - body.breath) * weight,
  ];
}

export type PortraitExpression = { brow: number; smile: number };

/** Expressions settle independently from phonemes. Preserve the current face
 * when mood changes again, while accessibility mode applies it immediately. */
export function advancePortraitExpression(current: PortraitExpression, target: PortraitExpression, dt: number, reduced: boolean): PortraitExpression {
  if (reduced) return { brow: target.brow, smile: target.smile };
  const blend = 1 - Math.exp(-Math.max(0, Math.min(dt, .1)) / .12);
  const approach = (from: number, to: number) => Math.abs(to - from) < .000001 ? to : from + (to - from) * blend;
  return { brow: approach(current.brow, target.brow), smile: approach(current.smile, target.smile) };
}

/** Small causal coarticulation, never a delayed phoneme queue. Silence closes now. */
export function advancePortraitMouth(current: { open: number; width: number }, target: { mouthOpen: number; mouthWidth: number }, dt: number) {
  const blend = 1 - Math.exp(-Math.max(0, dt) / .022);
  return {
    open: target.mouthOpen === 0 ? 0 : current.open + (target.mouthOpen - current.open) * blend,
    width: current.width + (target.mouthWidth - current.width) * blend,
  };
}

function rotate(x: number, y: number, angle: number) {
  return [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)];
}
function smooth(a: number, b: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** The forearm pivots from the lap around the elbow, with a soft wrist follow-through. */
export function portraitArmPoint(x: number, y: number, raised: number, female: boolean) {
  const sourceElbow = female ? [142, 502] : [143, 502];
  const wrist = female ? [173, 349] : [176, 325];
  const elbow = female ? [85, 569] : [84, 571];
  const lowered = 1 - raised;
  const angle = 2.4 * lowered - .12;
  const arc = Math.sin(raised * Math.PI);
  const wristWeight = 1 - smooth(wrist[1] - 20, wrist[1] + 25, y);
  const hand = rotate(x - wrist[0], y - wrist[1], -.45 * arc * wristWeight);
  const point = rotate(wrist[0] + hand[0] - sourceElbow[0], wrist[1] + hand[1] - sourceElbow[1], angle);
  // Lead outside the face and lift from below the frame. The small outward
  // elbow excursion stays over the jacket; the wrist unfolds as it settles.
  return [elbow[0] + point[0] - 48 * arc, elbow[1] + point[1] + 100 * lowered + 60 * arc];
}
