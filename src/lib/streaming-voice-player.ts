import type { AvatarViseme } from "./avatar-visemes";
import { speechBlockStart, speechOutputTime } from "./speech-playback-clock";
import { decodeSpeechPcm, readSpeechLines, SPEECH_SAMPLE_RATE, speechFrameAt, type SpeechFrame, type SpeechPhone } from "./streaming-speech";

export type StreamingVoiceMetrics = {
  firstAudioMs: number; totalMs: number; audioChunks: number;
  underruns: number; gapMs: number; maxAnimationGapMs: number;
};

/** Schedule PCM directly on Web Audio's clock. No full-utterance Blob or TTS model in the browser. */
export async function playStreamingSpeech(options: {
  endpoint: string; payload: unknown; signal: AbortSignal;
  onFrame: (viseme: AvatarViseme, level: number) => void;
  onStart: (firstAudioMs: number) => void;
}): Promise<StreamingVoiceMetrics> {
  const started = performance.now();
  const context = new AudioContext({ sampleRate: SPEECH_SAMPLE_RATE, latencyHint: "interactive" });
  const sources = new Set<AudioBufferSourceNode>();
  const segments: Array<{ start: number; end: number; offset: number; samples: Float32Array }> = [];
  const phones: SpeechPhone[] = [];
  let animation: number | undefined;
  let active = true;
  let nextStart = 0;
  let sampleOffset = 0;
  let firstAudioMs: number | undefined;
  let lastFrame = 0;
  let cushion = 0.18;
  let audioChunks = 0;
  let underruns = 0;
  let gapMs = 0;
  let maxAnimationGapMs = 0;
  const cancel = () => {
    active = false;
    for (const source of sources) { try { source.stop(); } catch { /* Already ended. */ } }
    void context.close().catch(() => undefined);
  };
  options.signal.addEventListener("abort", cancel, { once: true });
  const animate = (now: number) => {
    if (!active) return;
    const time = speechOutputTime(context, now);
    while (segments.length && segments[0].end <= time) segments.shift();
    const current = segments.find((segment) => segment.start <= time && time < segment.end);
    if (now - lastFrame >= 25) {
      if (lastFrame) maxAnimationGapMs = Math.max(maxAnimationGapMs, now - lastFrame);
      const frame = current
        ? speechFrameAt(current.samples, time - current.start, phones, current.offset + time - current.start)
        : { viseme: "rest" as const, level: 0 };
      // Do not count a leading silent chunk as the start of the audible response.
      if (frame.level > 0 && firstAudioMs === undefined) {
        firstAudioMs = performance.now() - started;
        options.onStart(firstAudioMs);
      }
      options.onFrame(frame.viseme, frame.level);
      lastFrame = now;
    }
    animation = requestAnimationFrame(animate);
  };
  try {
    options.signal.throwIfAborted();
    await context.resume();
    if (context.state !== "running") throw new Error("Audio playback not available");
    const response = await fetch(options.endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options.payload), cache: "no-store", signal: options.signal,
    });
    if (!response.ok || !response.body) throw new Error("Voice service unavailable");
    animation = requestAnimationFrame(animate);
    let complete = false;
    for await (const value of readSpeechLines(response.body)) {
      options.signal.throwIfAborted();
      const frame = value as SpeechFrame;
      if (!frame || frame.error) throw new Error("Voice stream interrupted");
      if (frame.phones) phones.push(...frame.phones);
      if (frame.audio) {
        const samples = decodeSpeechPcm(frame.audio);
        if (sampleOffset + samples.length / SPEECH_SAMPLE_RATE > 300) throw new Error("Voice stream too long");
        const buffer = context.createBuffer(1, samples.length, SPEECH_SAMPLE_RATE);
        buffer.copyToChannel(samples, 0);
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        // Increase the cushion only after an underrun, bounded at 500 ms.
        // Keep contiguous chunks exact, preserving the phoneme/audio timeline.
        const now = context.currentTime;
        if (audioChunks && nextStart <= now + 0.005) cushion = Math.min(0.5, cushion + 0.1);
        const start = speechBlockStart(now, nextStart, cushion);
        if (audioChunks && start > nextStart) { underruns++; gapMs += (start - nextStart) * 1000; }
        audioChunks++;
        nextStart = start + buffer.duration;
        segments.push({ start, end: nextStart, offset: sampleOffset, samples });
        sampleOffset += buffer.duration;
        sources.add(source);
        source.onended = () => { sources.delete(source); source.disconnect(); };
        source.start(start);
      }
      if (frame.done) { complete = true; break; }
    }
    if (!complete || !sampleOffset) throw new Error("Incomplete voice stream");
    while (speechOutputTime(context, performance.now()) < nextStart) {
      options.signal.throwIfAborted();
      if (context.state !== "running") throw new Error("Audio playback suspended");
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    if (firstAudioMs === undefined) throw new Error("Audio start not observed");
    return { firstAudioMs, totalMs: performance.now() - started, audioChunks, underruns, gapMs, maxAnimationGapMs };
  } finally {
    active = false;
    options.signal.removeEventListener("abort", cancel);
    if (animation !== undefined) cancelAnimationFrame(animation);
    for (const source of sources) { try { source.stop(); } catch { /* Already ended. */ } source.disconnect(); }
    options.onFrame("rest", 0);
    await context.close().catch(() => undefined);
  }
}
