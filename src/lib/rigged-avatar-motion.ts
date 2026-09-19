/** Frame-rate independent motion shared by the two skinned characters. */
export type RiggedSpring = { position: number; velocity: number };
export const RIGGED_VISEMES = { rest: '', mbp: 'viseme_PP', fv: 'viseme_FF', a: 'viseme_aa',
  e: 'viseme_E', o: 'viseme_O', u: 'viseme_U', consonant: 'viseme_DD' } as const;
export type RiggedViseme = keyof typeof RIGGED_VISEMES;
export type RiggedMouth = Record<Exclude<RiggedViseme, 'rest'>, number>;
export const emptyRiggedMouth = (): RiggedMouth => ({ mbp: 0, fv: 0, a: 0, e: 0, o: 0, u: 0, consonant: 0 });
const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
export const riggedEnergy = (level = .65) => Number.isFinite(level) ? clamp((level - .025) / .325) : 0;

export function advanceRiggedSpring(state: RiggedSpring, target: number, dt: number, frequency = 10, snap = false): RiggedSpring {
  if (snap) return { position: target, velocity: 0 };
  const time = clamp(Number.isFinite(dt) ? dt : 0, 0, .1);
  const delta = state.position - target;
  const drive = state.velocity + frequency * delta;
  const decay = Math.exp(-frequency * time);
  const position = target + (delta + drive * time) * decay;
  const velocity = (state.velocity - frequency * drive * time) * decay;
  return Math.abs(position - target) < .0005 && Math.abs(velocity) < .004
    ? { position: target, velocity: 0 } : { position, velocity };
}

/** Coarticulate actual mesh targets in 22ms; silence and lip seals are hard stops. */
export function advanceRiggedMouth(current: RiggedMouth, viseme: RiggedViseme, level: number | undefined, dt: number): RiggedMouth {
  const energy = riggedEnergy(level);
  if (viseme === 'rest' || !energy) return emptyRiggedMouth();
  if (viseme === 'mbp') return { ...emptyRiggedMouth(), mbp: .72 * Math.sqrt(energy) };
  const blend = 1 - Math.exp(-clamp(Number.isFinite(dt) ? dt : 0, 0, .1) / .022);
  const result = emptyRiggedMouth();
  // Keep the source target's jaw and teeth registration; amplitude follows the
  // PCM envelope rather than a permanent minimum opening on quiet syllables.
  const weight = .78 * Math.sqrt(energy);
  for (const shape of Object.keys(result) as Array<keyof RiggedMouth>) {
    result[shape] = current[shape] + ((shape === viseme ? weight : 0) - current[shape]) * blend;
  }
  return result;
}

const ease = (x: number) => { const t = clamp(x); return t * t * t * (t * (t * 6 - 15) + 10); };
function action(t: number, start: number, attack: number, hold: number, release: number) {
  return ease((t - start) / attack) * (1 - ease((t - start - attack - hold) / release));
}

/** A seated, attentive person: distinct actions with real stillness between them.
 * There is deliberately no idle torso rotation, head roll, or speech oscillator.
 */
export function riggedIdle(seconds: number, speech: number, raised: number, reducedMotion: boolean) {
  const still = { headPitch: 0, headYaw: 0, headRoll: 0, torsoRoll: 0, torsoYaw: 0,
    breath: 0, gaze: 0, gazeDown: 0, shoulderSettle: 0, blink: 0, action: 'still' };
  if (reducedMotion) return still;
  const t = ((seconds % 43) + 43) % 43;
  const restraint = (1 - ease(clamp(speech))) * (1 - ease(clamp(raised)));
  const rightEyes = action(t, 4.2, .18, .95, .38);
  const rightHead = action(t, 4.38, .36, .55, .5);
  const downEyes = action(t, 13.8, .2, .65, .4);
  const downHead = action(t, 13.96, .32, .35, .48);
  const shoulder = action(t, 22.6, .5, .25, .65);
  const leftEyes = action(t, 32.1, .18, .78, .4);
  const leftHead = action(t, 32.28, .34, .44, .52);
  let blink = 0;
  for (const [start, duration] of [[0, .19], [3.85, .17], [7.9, .19], [12.6, .17], [17.4, .2],
    [21.4, .18], [26.2, .19], [30.8, .17], [35.6, .19], [40.7, .18]]) {
    const phase = (t - start) / duration;
    if (phase > 0 && phase < 1) blink = Math.sin(phase * Math.PI);
  }
  return {
    ...still,
    headPitch: downHead * .032 * restraint,
    headYaw: (rightHead * .043 - leftHead * .038) * restraint,
    gaze: (rightEyes * .19 - leftEyes * .17) * restraint,
    gazeDown: downEyes * restraint,
    shoulderSettle: shoulder * restraint,
    // Millimetres of local chest expansion, never a bend of the spine.
    breath: (1 - Math.cos(seconds * Math.PI * 2 / 5.7)) * .0005,
    blink,
    action: !restraint ? 'still' : rightEyes || rightHead ? 'glance-right' : downEyes || downHead
      ? 'glance-down' : shoulder ? 'shoulder-settle' : leftEyes || leftHead ? 'glance-left' : 'still',
  };
}
