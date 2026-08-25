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
  const engine = preferredPollyEngine(voice);
  const cacheKey = JSON.stringify([text, voice, languageCode, direction]);
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
    Text: `<speak><prosody rate="${rate}">${escapeSsml(text)}</prosody></speak>`,
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
