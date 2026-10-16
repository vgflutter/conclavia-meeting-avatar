import type { PodcastEmotion } from "@conclavia/avatar-kit/types/podcast";
import type { SpeechPlaybackProgress } from "@conclavia/avatar-kit/lib/streaming-voice-player";
import type { TalkRunMessageResponse, TalkRunSentencePerformance } from "@/types/podcast-run";
import { resolveMessagePerformance } from "./performance";

export interface PodcastPerformance {
  speakerIndex: number;
  mood: PodcastEmotion;
  intensity: number;
  listenerMood: PodcastEmotion;
  listenerIntensity: number;
  phase?: "anticipation" | "delivery" | "settle";
  progress?: number;
  cueId?: string;
}
export interface PodcastPerformanceFrame {
  cue: PodcastPerformance;
  sentence: TalkRunSentencePerformance;
  index: number;
  timing: "sentence-pcm" | "estimated";
}

/** Exact sentence PCM cues when available; bounded text timing for older/provider streams. */
export function podcastPerformanceFrame(message: TalkRunMessageResponse, progress?: SpeechPlaybackProgress): PodcastPerformanceFrame | undefined {
  if (message.origin !== "ai" || message.participantIndex === undefined) return;
  const performance = resolveMessagePerformance(message);
  if (!performance?.sentences.length) return;
  const sentences = performance.sentences;
  const aligned = progress?.sentenceIndex !== undefined && Number.isInteger(progress.sentenceIndex) &&
    progress.sentenceIndex >= 0 && progress.sentenceIndex < sentences.length;
  let index = aligned ? progress!.sentenceIndex! : 0;
  let fraction = aligned ? progress!.sentenceProgress ?? 0 : 0;
  if (!aligned && progress) {
    const duration = progress.complete && progress.bufferedSeconds > 0 ? progress.bufferedSeconds : Math.max(1, message.estimatedAirtimeSeconds - 2);
    const weights = sentences.map(item => Math.max(1, item.text.trim().split(/\s+/u).length));
    const total = weights.reduce((a, b) => a + b, 0);
    let cursor = Math.max(0, Math.min(1, progress.seconds / duration)) * total;
    for (let i = 0; i < weights.length; i++) {
      index = i;
      if (cursor < weights[i] || i === weights.length - 1) { fraction = cursor / weights[i]; break; }
      cursor -= weights[i];
    }
  }
  fraction = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
  const sentence = sentences[index];
  return { sentence, index, timing: aligned ? "sentence-pcm" : "estimated", cue: {
    speakerIndex: message.participantIndex, mood: sentence.mood, intensity: sentence.intensity,
    listenerMood: sentence.listenerMood, listenerIntensity: sentence.listenerIntensity,
    progress: fraction, phase: !progress || progress.seconds === 0 ? "anticipation" : fraction > .9 ? "settle" : "delivery",
    cueId: `${message.sequence}:${index}`,
  } };
}
