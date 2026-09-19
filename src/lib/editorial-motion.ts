import type { AvatarViseme } from "./avatar-visemes";

export type EditorialMouth = { open: number; width: number; round: number };
const shapes: Record<AvatarViseme, EditorialMouth> = {
  rest: { open: 0, width: 1, round: 0 }, mbp: { open: 0, width: .94, round: 0 },
  a: { open: 1, width: 1, round: .2 }, e: { open: .5, width: 1.12, round: 0 },
  o: { open: .83, width: .69, round: 1 }, u: { open: .55, width: .58, round: 1 },
  fv: { open: .19, width: .95, round: 0 }, consonant: { open: .35, width: .98, round: .1 },
};
export function editorialMouthTarget(viseme: AvatarViseme, energy?: number): EditorialMouth {
  const amplitude = energy === undefined ? 1 : Number.isFinite(energy)
    ? Math.sqrt(Math.max(0, Math.min(1, (energy - .025) / .325))) : 0;
  return { ...shapes[viseme], open: shapes[viseme].open * amplitude };
}
export function advanceEditorialMouth(current: EditorialMouth, target: EditorialMouth, dt: number): EditorialMouth {
  const blend = 1 - Math.exp(-Math.max(0, dt) / .022);
  return { open: target.open === 0 ? 0 : current.open + (target.open - current.open) * blend,
    width: current.width + (target.width - current.width) * blend,
    round: current.round + (target.round - current.round) * blend };
}
/** Facial outline follows a small jaw displacement without moving the eyes or nose. */
export function editorialFacePath(female: boolean, jaw = 0) {
  return female
    ? `M231 209C231 146 270 115 340 115C413 115 450 152 450 216L443 304C440 ${336 + jaw * .25} 425 ${361 + jaw * .6} 405 ${380 + jaw * .8}L367 ${409 + jaw}Q340 ${425 + jaw} 315 ${409 + jaw}L277 ${380 + jaw * .8}C255 ${359 + jaw * .6} 240 ${332 + jaw * .25} 237 302L231 209Z`
    : `M231 209C229 148 265 116 340 116C414 116 451 147 451 213L446 311C444 ${337 + jaw * .25} 430 ${356 + jaw * .6} 412 ${374 + jaw * .8}L373 ${406 + jaw}Q340 ${424 + jaw} 309 ${406 + jaw}L268 ${374 + jaw * .8}C248 ${358 + jaw * .6} 236 ${338 + jaw * .25} 234 311L231 209Z`;
}
/** A continuous contour gives the upper lip bounded, coordinated mobility. */
export function editorialMouthPaths(mouth: EditorialMouth) {
  const half = 29 * mouth.width, left = 341 - half, right = 341 + half;
  const top = 352 - mouth.open * .7, depth = 1 + mouth.open * (25 + mouth.round * 4), corner = 351.2 - mouth.open * .1;
  const lower = top + depth;
  // The upper border arches for rounded vowels and moves less than one SVG
  // unit with opening. Most displacement stays in the lower lip and jaw.
  const crest = top - 2 - mouth.round * 3;
  const upper = `M${left} ${corner} Q${341 - half * .42} ${crest} 341 ${top - mouth.round * 1.5} Q${341 + half * .42} ${crest} ${right} ${corner}`;
  const bend = half * (.08 + mouth.round * .12);
  const cavity = `${upper} C${right - bend} ${lower} ${left + bend} ${lower} ${left} ${corner}Z`;
  return { cavity, upper,
    upperLip: `${upper} Q${341 + half * .44} ${crest - 3} 341 ${top - 3.2 - mouth.round * 1.5} Q${341 - half * .44} ${crest - 3} ${left} ${corner}Z`,
    lowerLip: `M${left} ${corner} C${left + bend} ${lower} ${right - bend} ${lower} ${right} ${corner} C${right - bend} ${lower + 3.3} ${left + bend} ${lower + 3.3} ${left} ${corner}Z`,
    lower: `M${left + half * .38} ${top + depth * .73 + 1.5} Q341 ${top + depth * .84 + 2.6} ${right - half * .38} ${top + depth * .73 + 1.5}`,
    teeth: `M${left + 3} ${top - 4} H${right - 3} V${top + Math.min(4, depth * .22)} Q341 ${top + Math.min(5.5, depth * .28)} ${left + 3} ${top + Math.min(4, depth * .22)}Z`,
    tongue: `M${left + 7} ${lower - 3} Q341 ${lower - 9} ${right - 7} ${lower - 3} V${lower + 4} H${left + 7}Z`,
  };
}
export type EditorialSpring = { value: number; velocity: number };
export function advanceEditorialSpring(state: EditorialSpring, target: number, dt: number, reduced: boolean, frequency = 10): EditorialSpring {
  if (reduced) return { value: target, velocity: 0 };
  const elapsed = Math.max(0, Math.min(.1, dt));
  const offset = state.value - target, rate = state.velocity + frequency * offset, decay = Math.exp(-frequency * elapsed);
  const value = target + (offset + rate * elapsed) * decay;
  const velocity = (state.velocity - frequency * rate * elapsed) * decay;
  return Math.abs(value - target) < .0005 && Math.abs(velocity) < .004
    ? { value: target, velocity: 0 } : { value, velocity };
}
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
/** Independent, finite actions leave long intervals of an exactly stable pose. */
const action = (time: number, start: number, arrive: number, hold: number, leave: number) =>
  smooth((time - start) / arrive) * (1 - smooth((time - start - arrive - hold) / leave));
export function editorialPresence(seconds: number, speaking: number, raised: number, reduced: boolean) {
  const t = seconds % 43.7;
  const available = reduced ? 0 : (1 - .85 * speaking) * (1 - raised);
  // The eyes acquire a point before the head follows. These are isolated looks,
  // not two ends of an oscillator; they return to sustained camera contact.
  const gaze = (2.6 * action(t, 3.2, .14, 1.1, .24) - 2.1 * action(t, 12.3, .12, 1.3, .28)) * available;
  const head = (1.4 * action(t, 3.48, .42, .72, .58) - 1.1 * action(t, 12.58, .46, .8, .64)) * available;
  const nod = action(t, 26.8, .32, .12, .52) * available;
  const settle = action(t, 20.1, .65, .8, .95) * available;
  // A sub-pixel local collar expansion, with an exhaled pause. The torso and
  // head never inherit breathing as translation or rotation.
  const breath = reduced ? 0 : action(seconds % 5.8, .3, 1.6, .1, 2.5) * .0012;
  const blinkTime = seconds % 11.9;
  const blink = reduced ? 1 : 1 - .94 * Math.max(
    action(blinkTime, 5.1, .07, .03, .12), action(blinkTime, 10.2, .07, .02, .11));
  return { body: 0, head, gaze, nod, settle, shoulder: raised * 3, blink, breath };
}

export function editorialArmPose(raise: number, settle = 0) {
  const r = Math.max(0, Math.min(1, raise));
  const arc = 4 * r * (1 - r);
  const elbow = { x: 558 + 16 * r, y: 655 - 59 * r + 35 * arc - settle * 2 };
  const wrist = { x: 574 + 38 * r - 50 * arc + settle * 1.5, y: 785 - 353 * r - settle * 3 };
  const angle = 170 * (1 - smooth(r / .72)) - 4 * r;
  const dx = wrist.x - elbow.x, dy = wrist.y - elbow.y;
  const length = Math.max(1, Math.hypot(dx, dy)), nx = -dy / length, ny = dx / length;
  const ex = elbow.x, ey = elbow.y, wx = wrist.x, wy = wrist.y;
  const forearm = `M${ex + nx * 35} ${ey + ny * 35}Q${ex - dx * .2 + nx * 38} ${ey - dy * .2 + ny * 38} ${ex - nx * 35} ${ey - ny * 35}L${wx - nx * 27} ${wy - ny * 27}Q${wx + dx * .035} ${wy + dy * .035} ${wx + nx * 27} ${wy + ny * 27}Z`;
  const upper = `M478 480C519 ${497 - 2.5 * r} 552 ${522 - 2.5 * r} ${ex + 15} ${ey - 52}L${ex + 36} ${ey}Q${ex + 38} ${ey + 35} ${ex} ${ey + 36}Q${ex - 38} ${ey + 34} ${ex - 37} ${ey}L510 545 464 490Z`;
  const outline = `M${ex - nx * 35} ${ey - ny * 35}L${wx - nx * 27} ${wy - ny * 27}Q${wx + dx * .035} ${wy + dy * .035} ${wx + nx * 27} ${wy + ny * 27}L${ex + nx * 35} ${ey + ny * 35}`;
  return { elbow, wrist, angle, forearm, upper, outline };
}

const raisedPalm = "M590 425q-14-11-17-29l-16-25q-8-12 0-18 8-7 17 6l10 14-5-60q-1-13 8-13 9-1 10 11l3 39 1-59q0-12 9-12 9 0 10 12l1 59 6-46q2-12 10-10 9 2 8 14l-6 51 8-31q3-11 11-8 9 3 6 14l-12 63q-7 29-30 36-21 4-32-13Z";
const relaxedPalm = "M590 425q-14-11-17-29l-10-13q-8-12 0-18 8-7 17 6l4 10-2-26q-1-10 8-10 9-1 10 9l3 14 1-30q0-10 9-10 9 0 10 10l1 30 5-23q2-10 10-8 9 2 8 12l-5 29 6-16q3-9 10-6 8 3 5 12l-14 39q-7 29-30 36-21 4-32-13Z";
const coordinate = /-?\d+(?:\.\d+)?/gu;
const relaxedCoordinates = [...relaxedPalm.matchAll(coordinate)].map(match => Number(match[0]));
export function editorialPalmPath(raise: number): string {
  const amount = Math.max(0, Math.min(1, raise));
  let index = 0;
  // Spaces are significant when a formerly negative coordinate becomes positive.
  return raisedPalm.replace(coordinate, value => ` ${relaxedCoordinates[index] + (Number(value) - relaxedCoordinates[index++]) * amount} `);
}
