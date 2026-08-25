import {
  PollyClient,
  SynthesizeSpeechCommand,
} from "@aws-sdk/client-polly";
import { fromIni } from "@aws-sdk/credential-providers";

import {
  englishVoices,
  italianVoices,
  type EnglishVoiceId,
  type ItalianVoiceId,
} from "../config/avatar-config.js";
import type { SpeechMark } from "../performance/performance-packet.js";
import { getUnrealStudioConfig } from "./unreal-studio.js";

type SupportedVoice = ItalianVoiceId | EnglishVoiceId;
export type PollySpeechEngine = "neural" | "generative";

const neuralVoices = new Set<SupportedVoice>([
  "Bianca",
  "Danielle",
  "Joanna",
  "Ruth",
  "Salli",
  "Matthew",
  "Stephen",
]);

const pollyClients = new Map<string, PollyClient>();
const speechCache = new Map<string, {
  audio: Uint8Array;
  voice: SupportedVoice;
  languageCode: string;
  engine: PollySpeechEngine;
}>();
const speechMarksCache = new Map<string, SpeechMark[]>();
const maxCachedSpeechItems = 16;
const maxCachedSpeechBytesPerItem = 2 * 1024 * 1024;

function pollyClient(): PollyClient {
  const config = getUnrealStudioConfig();
  const key = `${config.awsRegion}:${config.awsProfile}`;
  let client = pollyClients.get(key);
  if (!client) {
    client = new PollyClient({
      region: config.awsRegion,
      credentials: fromIni({
        profile: config.awsProfile,
        clientConfig: { region: config.awsRegion },
      }),
      maxAttempts: 3,
    });
    pollyClients.set(key, client);
  }
  return client;
}

function isSupportedVoice(value: unknown): value is SupportedVoice {
  return typeof value === "string"
    && [...italianVoices, ...englishVoices].some((voice) => voice.id === value);
}

function voiceLanguage(voice: SupportedVoice): "it-IT" | "en-US" {
  return italianVoices.some((candidate) => candidate.id === voice)
    ? "it-IT"
    : "en-US";
}

export function preferredPollyEngine(voice: SupportedVoice): PollySpeechEngine {
  return neuralVoices.has(voice) ? "neural" : "generative";
}

function cleanText(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/[*_#]/gu, "").replace(/\s+/gu, " ").trim()
    : "";
}

function escapeSsml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

interface NormalizedSpeechRequest {
  text: string;
  voice: SupportedVoice;
  languageCode: "it-IT" | "en-US";
  engine: PollySpeechEngine;
  ssml: string;
  cacheKey: string;
}

function normalizeSpeechRequest(input: {
  text?: unknown;
  voice?: unknown;
  languageCode?: unknown;
  direction?: unknown;
}): NormalizedSpeechRequest {
  const text = cleanText(input.text);
  const voice = isSupportedVoice(input.voice) ? input.voice : "Bianca";
  const languageCode = voiceLanguage(voice);
  if (!text || text.length > 3_000) throw new Error("Invalid speech text");
  if (
    input.languageCode !== undefined
    && input.languageCode !== "it-IT"
    && input.languageCode !== "en-US"
  ) {
    throw new Error("Unsupported speech language");
  }
  if (input.languageCode !== undefined && input.languageCode !== languageCode) {
    throw new Error(`Voice ${voice} does not support ${String(input.languageCode)}`);
  }

  const direction = cleanText(input.direction);
  const rate = direction.includes("vivace")
    ? "114%"
    : direction.includes("autorevole")
      ? "110%"
      : "112%";
  return {
    text,
    voice,
    languageCode,
    engine: preferredPollyEngine(voice),
    ssml: `<speak><prosody rate="${rate}">${escapeSsml(text)}</prosody></speak>`,
    cacheKey: JSON.stringify([text, voice, languageCode, direction]),
  };
}

function parseSpeechMarks(value: string): SpeechMark[] {
  const marks: SpeechMark[] = [];
  for (const line of value.split(/\r?\n/u)) {
    if (!line.trim()) continue;
    try {
      const candidate = JSON.parse(line) as Record<string, unknown>;
      const type = candidate.type;
      if (
        typeof candidate.time !== "number"
        || !Number.isFinite(candidate.time)
        || candidate.time < 0
        || (type !== "sentence" && type !== "ssml" && type !== "viseme" && type !== "word")
        || typeof candidate.value !== "string"
      ) continue;
      marks.push({
        time: Math.round(candidate.time),
        type,
        value: candidate.value,
        ...(typeof candidate.start === "number" ? { start: candidate.start } : {}),
        ...(typeof candidate.end === "number" ? { end: candidate.end } : {}),
      });
    } catch {
      // Ignore a malformed line without losing the audio performance.
    }
  }
  return marks.sort((left, right) => left.time - right.time);
}

export async function synthesizeUnrealSpeech(input: {
  text?: unknown;
  voice?: unknown;
  languageCode?: unknown;
  direction?: unknown;
}): Promise<{
  audio: Uint8Array;
  voice: SupportedVoice;
  languageCode: string;
  engine: PollySpeechEngine;
}> {
  const request = normalizeSpeechRequest(input);
  const { voice, languageCode, engine, cacheKey } = request;
  const cached = speechCache.get(cacheKey);
  if (cached) {
    speechCache.delete(cacheKey);
    speechCache.set(cacheKey, cached);
    return { ...cached, audio: cached.audio.slice() };
  }
  const output = await pollyClient().send(new SynthesizeSpeechCommand({
    Engine: engine,
    VoiceId: voice,
    LanguageCode: languageCode,
    OutputFormat: "pcm",
    SampleRate: "16000",
    TextType: "ssml",
    Text: request.ssml,
  }));
  if (!output.AudioStream) throw new Error("Polly returned no audio");
  const result = {
    audio: Uint8Array.from(await output.AudioStream.transformToByteArray()),
    voice,
    languageCode,
    engine,
  };
  if (result.audio.byteLength <= maxCachedSpeechBytesPerItem) {
    speechCache.set(cacheKey, result);
    while (speechCache.size > maxCachedSpeechItems) {
      const oldest = speechCache.keys().next().value;
      if (typeof oldest !== "string") break;
      speechCache.delete(oldest);
    }
  }
  return { ...result, audio: result.audio.slice() };
}

export async function synthesizePerformanceSpeech(input: {
  text?: unknown;
  voice?: unknown;
  languageCode?: unknown;
  direction?: unknown;
}): Promise<{
  audio: Uint8Array;
  marks: SpeechMark[];
  voice: SupportedVoice;
  languageCode: string;
  engine: PollySpeechEngine;
}> {
  const request = normalizeSpeechRequest(input);
  const audioPromise = synthesizeUnrealSpeech(input);
  const cachedMarks = speechMarksCache.get(request.cacheKey);
  const marksPromise = cachedMarks
    ? Promise.resolve(cachedMarks.map((mark) => ({ ...mark })))
    : pollyClient().send(new SynthesizeSpeechCommand({
        Engine: request.engine,
        VoiceId: request.voice,
        LanguageCode: request.languageCode,
        OutputFormat: "json",
        TextType: "ssml",
        Text: request.ssml,
        SpeechMarkTypes: ["sentence", "word", "viseme"],
      })).then(async (output) => {
        if (!output.AudioStream) return [];
        const marks = parseSpeechMarks(await output.AudioStream.transformToString());
        speechMarksCache.set(request.cacheKey, marks);
        while (speechMarksCache.size > maxCachedSpeechItems) {
          const oldest = speechMarksCache.keys().next().value;
          if (typeof oldest !== "string") break;
          speechMarksCache.delete(oldest);
        }
        return marks.map((mark) => ({ ...mark }));
      }).catch(() => [] as SpeechMark[]);
  const [audio, marks] = await Promise.all([audioPromise, marksPromise]);
  return { ...audio, marks };
}
