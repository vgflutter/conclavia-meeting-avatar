export type PortraitIdleFrame = { x: number; y: number; roll: number; shoulder: number };

// An adjustment has an onset, a held pose and a deliberate return. Between
// actions all four values are exactly zero: the seated portrait never sways.
function ease(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function adjustment(time: number, start: number, enter: number, hold: number, leave: number) {
  const t = time - start;
  if (t < 0 || t >= enter + hold + leave) return 0;
  return t < enter ? ease(t / enter) : t < enter + hold ? 1 : 1 - ease((t - enter - hold) / leave);
}

/** Distinct listening adjustments, separated by real stillness. This is not a
 * moving camera or a weight-shifting loop: only the head/neck can move, plus
 * one independent shoulder settling action. No synthetic gaze is inferred. */
export function portraitIdleFrame(seconds: number, activity: number, reduced: boolean): PortraitIdleFrame {
  if (reduced) return { x: 0, y: 0, roll: 0, shoulder: 0 };
  const time = Math.max(0, seconds) % 61;
  const attentive = adjustment(time, 3.2, .5, .75, .65);
  const settle = adjustment(time, 12.6, .32, .12, .56);
  const readjust = adjustment(time, 34.8, .6, .9, .75);
  const shoulder = adjustment(time, 23.4, .7, .25, 1.1);
  const gain = 1 - Math.max(0, Math.min(1, activity));
  if (gain === 0) return { x: 0, y: 0, roll: 0, shoulder: 0 };
  return {
    x: 0,
    y: (.002 * attentive + .0052 * settle) * gain,
    roll: (-.018 * attentive + .013 * readjust) * gain,
    shoulder: .006 * shoulder * gain,
  };
}

/** The head is rigid above the jaw. Only the neck blends the small adjustment
 * back to zero; shoulders, jacket, elbow and the seated waist remain fixed.
 * Keep this forward field in sync with idleOffset in the shader. */
export function portraitIdleOffset(x: number, y: number, frame: Pick<PortraitIdleFrame, 'x' | 'y' | 'roll'>): readonly [number, number] {
  const t = Math.max(0, Math.min(1, (y - .50) / .14));
  const weight = 1 - t * t * (3 - 2 * t);
  const dx = x - .5, dy = y - .55;
  const c = Math.cos(frame.roll), s = Math.sin(frame.roll);
  return [(frame.x + dx * (c - 1) - dy * s) * weight,
    (frame.y + dx * s + dy * (c - 1)) * weight];
}
