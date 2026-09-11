import type { AvatarViseme } from "./avatar-visemes";

export const SPEECH_SAMPLE_RATE = 24_000;
export type SpeechPhone = { start: number; end: number; viseme: AvatarViseme };
export type SpeechFrame = { audio?: string; phones?: SpeechPhone[]; done?: boolean; error?: string };

/** HTTP packets need not end on a JSON line or even a UTF-8 character. */
export async function* readSpeechLines(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = pending.indexOf("\n")) >= 0) {
        const line = pending.slice(0, newline).trim();
        pending = pending.slice(newline + 1);
        if (line.length > 2_000_000) throw new Error("Speech frame too large");
        if (line) yield JSON.parse(line);
      }
      if (pending.length > 2_000_000) throw new Error("Speech frame too large");
      if (done) {
        if (pending.trim()) yield JSON.parse(pending);
        break;
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export function inworldViseme(symbol: string, phone: string): AvatarViseme {
  if (phone === "[silence]") return "rest";
  if (symbol === "bmp") return "mbp";
  if (symbol === "fv") return "fv";
  if (symbol === "o") return "o";
  if (symbol === "qw") return "u";
  if (symbol === "ee") return "e";
  if (symbol === "aei") return /[eiɛɪ]/u.test(phone) ? "e" : "a";
  return "consonant";
}

export function inworldFrame(value: unknown): SpeechFrame {
  if (!value || typeof value !== "object") throw new Error("Invalid speech frame");
  const frame = value as { error?: unknown; result?: {
    audioContent?: unknown;
    timestampInfo?: { wordAlignment?: { phoneticDetails?: Array<{ phones?: Array<{
      phoneSymbol: string; startTimeSeconds: number; durationSeconds: number; visemeSymbol: string;
    }> }> } };
  } };
  if (frame.error || !frame.result) throw new Error("Speech provider failed");
  const audio = frame.result.audioContent;
  if (audio !== undefined && (typeof audio !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/u.test(audio))) {
    throw new Error("Invalid audio");
  }
  const phones: SpeechPhone[] = [];
  for (const word of frame.result.timestampInfo?.wordAlignment?.phoneticDetails || []) {
    for (const phone of word.phones || []) {
      const start = phone.startTimeSeconds;
      const end = start + phone.durationSeconds;
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || end > 300 ||
        typeof phone.phoneSymbol !== "string" || typeof phone.visemeSymbol !== "string") {
        throw new Error("Invalid speech alignment");
      }
      phones.push({ start, end, viseme: inworldViseme(phone.visemeSymbol, phone.phoneSymbol) });
    }
  }
  return { ...(typeof audio === "string" && audio ? { audio } : {}), ...(phones.length ? { phones } : {}) };
}

export function decodeSpeechPcm(base64: string): Float32Array<ArrayBuffer> {
  const binary = atob(base64);
  if (!binary.length || binary.length % 2) throw new Error("Invalid PCM frame");
  // PCM is explicitly requested: RIFF headers must never be played as samples.
  if (binary.startsWith("RIFF")) throw new Error("Expected raw PCM, received WAV");
  const samples = new Float32Array(binary.length / 2);
  for (let i = 0; i < samples.length; i++) {
    const unsigned = binary.charCodeAt(i * 2) | (binary.charCodeAt(i * 2 + 1) << 8);
    samples[i] = (unsigned >= 32768 ? unsigned - 65536 : unsigned) / 32768;
  }
  return samples;
}

export function speechFrameAt(samples: Float32Array, time: number, phones: SpeechPhone[], synthesisTime: number) {
  const index = Math.floor(time * SPEECH_SAMPLE_RATE);
  let energy = 0;
  let count = 0;
  for (let i = index; i < Math.min(index + 240, samples.length); i++) {
    if (i >= 0) { energy += samples[i] ** 2; count++; }
  }
  const rms = count ? Math.sqrt(energy / count) : 0;
  if (rms < 0.003) return { viseme: "rest" as AvatarViseme, level: 0 };
  const phone = phones.find((item) => synthesisTime >= item.start && synthesisTime < item.end);
  // If alignment is absent, keep the mouth neutral rather than inventing phonemes.
  return { viseme: phone?.viseme || "rest", level: Math.min(1, rms * 5) };
}
