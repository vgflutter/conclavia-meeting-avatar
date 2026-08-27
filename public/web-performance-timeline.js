const silentVisemes = new Set(["", "-", "sil", "silence"]);

const gestureDurationsMs = {
  nod: 900,
  tilt: 1_300,
  emphasis: 1_150,
  settle: 1_400,
};

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function smoothstep01(value) {
  const unit = clamp01(value);
  return unit * unit * (3 - 2 * unit);
}

function normalizedVisemeTrack(track) {
  const normalized = [];
  const ordered = (Array.isArray(track) ? track : [])
    .filter((candidate) => Number.isFinite(Number(candidate?.atMs)))
    .sort((left, right) => Number(left.atMs) - Number(right.atMs));
  for (const candidate of ordered) {
    const atMs = Number(candidate?.atMs);
    const value = String(candidate?.value || "");
    if (!Number.isFinite(atMs) || silentVisemes.has(value)) continue;
    const previous = normalized.at(-1);
    if (previous?.value === value) {
      previous.atMs = Math.min(previous.atMs, atMs);
      previous.weight = Math.max(previous.weight, clamp01(candidate?.weight));
      continue;
    }
    normalized.push({
      atMs: Math.max(0, atMs),
      value,
      weight: clamp01(candidate?.weight),
      sourceIndex: normalized.length,
    });
  }
  return normalized;
}

/**
 * Resolve a co-articulated pair of visemes around the audio clock.
 *
 * Polly speech marks identify phoneme onsets, not durations. Treating each
 * mark as a step leaves the mouth frozen during pauses and produces hard cuts
 * at every consonant. These overlapping asymmetric envelopes anticipate the
 * sound by a few milliseconds, peak just after its onset and return to rest
 * during real gaps. Adjacent phonemes cross-fade rather than snapping.
 */
export function visemeBlendAt(track, elapsedMs, visualLeadMs = 32) {
  const marks = normalizedVisemeTrack(track);
  if (!marks.length) return [];
  const visualTime = Math.max(0, Number(elapsedMs) + visualLeadMs);
  const weighted = [];
  for (let index = 0; index < marks.length; index += 1) {
    const mark = marks[index];
    const previous = marks[index - 1];
    const next = marks[index + 1];
    const previousGap = previous ? mark.atMs - previous.atMs : 80;
    const nextGap = next ? next.atMs - mark.atMs : 120;
    const attackMs = Math.max(28, Math.min(52, previousGap * 0.58));
    const releaseMs = Math.max(58, Math.min(132, nextGap * 0.82));
    const start = mark.atMs - attackMs;
    const peak = mark.atMs + Math.min(16, nextGap * 0.18);
    const end = mark.atMs + releaseMs;
    if (visualTime < start || visualTime > end) continue;
    const attack = visualTime <= peak
      ? smoothstep01((visualTime - start) / Math.max(1, peak - start))
      : 1;
    const release = visualTime > peak
      ? 1 - smoothstep01((visualTime - peak) / Math.max(1, end - peak))
      : 1;
    const weight = attack * release * mark.weight;
    if (weight <= 0.004) continue;
    weighted.push({
      value: mark.value,
      weight,
      slot: mark.sourceIndex % 2,
      atMs: mark.atMs,
    });
  }
  weighted.sort((left, right) => right.weight - left.weight);
  const selected = weighted.slice(0, 2);
  const total = selected.reduce((sum, candidate) => sum + candidate.weight, 0);
  const scale = total > 1 ? 1 / total : 1;
  return selected
    .map((candidate) => ({
      value: candidate.value,
      weight: candidate.weight * scale,
      slot: candidate.slot,
      atMs: candidate.atMs,
    }))
    .sort((left, right) => left.slot - right.slot);
}

/** Resolve a gesture and its authored blend envelope at the current clock. */
export function gestureStateAt(track, elapsedMs, packetDurationMs) {
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  const duration = Math.max(0, Number(packetDurationMs) || 0);
  const gestures = (Array.isArray(track) ? track : [])
    .filter((candidate) => Number.isFinite(Number(candidate?.atMs)) && candidate?.clip)
    .sort((left, right) => Number(left.atMs) - Number(right.atMs));
  let active = null;
  let activeIndex = -1;
  for (let index = 0; index < gestures.length; index += 1) {
    if (Number(gestures[index].atMs) > elapsed) break;
    active = gestures[index];
    activeIndex = index;
  }
  if (!active) return null;
  const start = Math.max(0, Number(active.atMs) || 0);
  const nextAt = Number(gestures[activeIndex + 1]?.atMs);
  const authoredDuration = gestureDurationsMs[active.clip];
  const end = Number.isFinite(nextAt)
    ? nextAt
    : authoredDuration
      ? Math.min(duration, start + authoredDuration)
      : duration;
  if (elapsed > end) return null;
  const blendInMs = Math.max(80, Number(active.blendInMs) || 320);
  const blendOutMs = Math.max(100, Number(active.blendOutMs) || 480);
  const inputWeight = clamp01(active.weight);
  const blendIn = smoothstep01((elapsed - start) / blendInMs);
  const shouldRelease = !new Set(["raise-hand", "lower-hand"]).has(active.clip);
  const blendOut = shouldRelease
    ? smoothstep01((end - elapsed) / blendOutMs)
    : 1;
  const weight = inputWeight * blendIn * blendOut;
  return weight > 0.002 ? {
    clip: active.clip,
    weight,
    blendInMs,
    blendOutMs,
    startMs: start,
    endMs: end,
  } : null;
}
