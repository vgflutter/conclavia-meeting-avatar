import type { AvatarViseme } from "@/lib/avatar-visemes";
import { splitMeetingSpeech } from "@/lib/meeting-speech";
import type { MeetingCommandKind } from "@/types/meeting";
import { playStreamingSpeech } from "@/lib/streaming-voice-player";
import type { VoicePlaybackMetrics } from "@/lib/voice-playback-metrics";

export type MeetingSpeechCommand = { id: string; kind: MeetingCommandKind; response: string };
export type MeetingVoiceState = "ready" | "preparing" | "speaking" | "error";

/** One ordered streaming queue. No engine fallback or replay after partial failure. */
export function createMeetingVoicePlayer(options: {
  remote: { endpoint: string; attemptId: string };
  onCommand: (command: MeetingSpeechCommand) => void;
  onComplete: (id: string, metrics: VoicePlaybackMetrics) => void;
  onState: (state: MeetingVoiceState) => void;
  onFrame: (viseme: AvatarViseme, level: number) => void;
}) {
  let active = true;
  let running = false;
  const queue: MeetingSpeechCommand[] = [];
  const seen = new Set<string>();
  let remoteAbort: AbortController | undefined;

  async function drain() {
    if (!active || running) return;
    running = true;
    try {
      while (active && queue.length) {
        const command = queue[0];
        options.onCommand(command);
        options.onState("preparing");
        try {
          const chunks = splitMeetingSpeech(command.response, 3_800);
          if (!chunks.length) throw new Error("Empty speech command");
          remoteAbort = new AbortController();
          const started = performance.now();
          let metrics: VoicePlaybackMetrics | undefined;
          for (let chunk = 0; chunk < chunks.length && active; chunk++) {
            const part = await playStreamingSpeech({
              endpoint: options.remote.endpoint,
              payload: { attemptId: options.remote.attemptId, commandId: command.id, chunk },
              signal: remoteAbort.signal,
              onFrame: (viseme, level) => { if (active) options.onFrame(viseme, level); },
              onStart: () => { if (active) options.onState("speaking"); },
            });
            metrics = metrics ? {
              firstAudioMs: metrics.firstAudioMs,
              totalMs: performance.now() - started,
              audioChunks: metrics.audioChunks + part.audioChunks,
              underruns: metrics.underruns + part.underruns,
              gapMs: metrics.gapMs + part.gapMs,
              maxAnimationGapMs: Math.max(metrics.maxAnimationGapMs, part.maxAnimationGapMs),
            } : part;
          }
          if (!active) return;
          if (!metrics) throw new Error("No playback observed");
          queue.shift();
          options.onComplete(command.id, metrics);
          options.onState("ready");
        } catch {
          if (!active) return;
          options.onFrame("rest", 0);
          options.onState("error");
          queue.shift();
        }
      }
    } finally { running = false; }
  }

  return {
    enqueue(command: MeetingSpeechCommand) {
      if (!active || seen.has(command.id)) return;
      seen.add(command.id);
      if (seen.size > 100) seen.delete(seen.values().next().value!);
      queue.push(command);
      void drain();
    },
    dispose() {
      active = false;
      queue.length = 0;
      remoteAbort?.abort();
    },
  };
}
