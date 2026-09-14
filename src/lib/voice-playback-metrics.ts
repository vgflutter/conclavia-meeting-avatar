// Browser observations, not proof that another Teams participant heard the audio.
export type VoicePlaybackMetrics = {
  firstAudioMs: number;
  totalMs: number;
  audioChunks: number;
  underruns: number;
  gapMs: number;
  maxAnimationGapMs: number;
};

export function parseVoicePlaybackMetrics(value: unknown): VoicePlaybackMetrics | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const record = value as Record<string, unknown>;
  const keys = ["firstAudioMs", "totalMs", "audioChunks", "underruns", "gapMs", "maxAnimationGapMs"] as const;
  if (Object.keys(record).length !== keys.length || keys.some(key =>
    typeof record[key] !== "number" || !Number.isFinite(record[key]) || record[key] < 0 || record[key] > 900_000)) return;
  const metrics = Object.fromEntries(keys.map(key => [key, record[key]])) as VoicePlaybackMetrics;
  if (!Number.isInteger(metrics.audioChunks) || metrics.audioChunks < 1 || metrics.audioChunks > 100_000 ||
      !Number.isInteger(metrics.underruns) || metrics.underruns >= metrics.audioChunks ||
      metrics.firstAudioMs > metrics.totalMs || metrics.gapMs > metrics.totalMs ||
      metrics.maxAnimationGapMs > metrics.totalMs) return;
  return metrics;
}
