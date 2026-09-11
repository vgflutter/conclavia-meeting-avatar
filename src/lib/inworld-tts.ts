import { meetingTtsConfig, type InworldModel } from "./meeting-tts-config";
import { inworldFrame, readSpeechLines, SPEECH_SAMPLE_RATE, type SpeechFrame } from "./streaming-speech";

export class SpeechServiceError extends Error {
  constructor(public status = 503) { super("Voice service unavailable"); }
}

/** No SDK retries: replaying a partially heard answer would be misleading. */
export async function inworldSpeechResponse(options: {
  text: string; language: "it" | "en"; speakingRate: number; signal: AbortSignal;
  model?: InworldModel;
  voiceId?: string;
}, dependencies: { fetcher?: typeof fetch; config?: ReturnType<typeof meetingTtsConfig> } = {}): Promise<Response> {
  const config = dependencies.config || meetingTtsConfig();
  if (!config.ready || !config.apiKey) throw new SpeechServiceError();
  if (!options.text.trim() || options.text.length > 4_000) throw new SpeechServiceError(400);
  const controller = new AbortController();
  const signal = AbortSignal.any([options.signal, controller.signal, AbortSignal.timeout(90_000)]);
  const firstByteTimer = setTimeout(() => controller.abort(), 10_000);
  let upstream: Response;
  try {
    upstream = await (dependencies.fetcher || fetch)("https://api.inworld.ai/tts/v1/voice:stream", {
      method: "POST", redirect: "error", cache: "no-store", signal,
      headers: { Authorization: `Basic ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: options.text, voiceId: options.voiceId || (options.language === "it" ? config.italianVoiceId : config.voiceId), modelId: options.model || config.model,
        language: options.language === "it" ? "it-IT" : "en-US",
        audioConfig: { audioEncoding: "PCM", sampleRateHertz: SPEECH_SAMPLE_RATE,
          speakingRate: Math.max(0.8, Math.min(1.2, options.speakingRate || 1)) },
        timestampType: "WORD", timestampTransportStrategy: "SYNC",
      }),
    });
    if (!upstream.ok || !upstream.body) {
      await upstream.body?.cancel();
      throw new SpeechServiceError(upstream.status === 429 ? 429 : 503);
    }
  } catch (error) {
    clearTimeout(firstByteTimer);
    controller.abort();
    throw error instanceof SpeechServiceError ? error : new SpeechServiceError();
  }
  const encoder = new TextEncoder();
  const encode = (frame: SpeechFrame) => encoder.encode(`${JSON.stringify(frame)}\n`);
  const iterator = readSpeechLines(upstream.body!);
  let hasAudio = false;
  let bytes = 0;
  const body = new ReadableStream<Uint8Array>({
    async pull(output) {
      try {
        while (true) {
          const next = await iterator.next();
          if (next.done) {
            if (!hasAudio) throw new Error("Empty audio");
            clearTimeout(firstByteTimer);
            output.enqueue(encode({ done: true }));
            output.close();
            return;
          }
          const frame = inworldFrame(next.value);
          if (frame.audio) {
            hasAudio = true;
            clearTimeout(firstByteTimer);
            bytes += frame.audio.length;
            if (bytes > 20_000_000) throw new Error("Speech limit exceeded");
          }
          if (frame.audio || frame.phones?.length) { output.enqueue(encode(frame)); return; }
        }
      } catch {
        clearTimeout(firstByteTimer);
        controller.abort();
        await iterator.return(undefined).catch(() => undefined);
        // Raw provider messages can contain submitted text or credentials. Never relay them.
        if (!options.signal.aborted) { output.enqueue(encode({ error: "Voice service unavailable" })); output.close(); }
        else output.error(new Error("Speech cancelled"));
      }
    },
    async cancel() {
      clearTimeout(firstByteTimer);
      controller.abort();
      await iterator.return(undefined).catch(() => undefined);
    },
  });
  return new Response(body, { headers: {
    "Content-Type": "application/x-ndjson", "Cache-Control": "no-store, no-transform",
    "X-Accel-Buffering": "no", "X-Content-Type-Options": "nosniff",
  } });
}
