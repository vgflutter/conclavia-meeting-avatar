/** Bounded jitter cushion, without delays between blocks that are already on time. */
export function speechBlockStart(now: number, previousEnd: number, cushion: number): number {
  return previousEnd > now + 0.005 ? previousEnd : now + cushion;
}

/** Output-device clock, not the render thread running ahead of it. Teams delay is separate. */
export function speechOutputTime(context: Pick<AudioContext, "currentTime" | "getOutputTimestamp" | "outputLatency" | "baseLatency">, now: number): number {
  const stamp = context.getOutputTimestamp?.();
  if (stamp && typeof stamp.contextTime === "number" && Number.isFinite(stamp.contextTime)
      && typeof stamp.performanceTime === "number" && Number.isFinite(stamp.performanceTime)
      && stamp.performanceTime > 0 && stamp.performanceTime <= now && now - stamp.performanceTime < 1000) {
    return Math.max(0, Math.min(context.currentTime, stamp.contextTime + (now - stamp.performanceTime) / 1000));
  }
  return Math.max(0, context.currentTime - (context.outputLatency || 0) - (context.baseLatency || 0));
}
