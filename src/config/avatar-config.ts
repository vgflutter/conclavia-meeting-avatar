import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import type { ChatCommandAliases } from "../domain/protocol.js";
import {
  characterTraits,
  type AvatarCharacterTraits,
} from "./avatar-character.js";

export const avatarProfiles = [
  { id: "showcase", label: "Showcase · Cine MetaHuman" },
  { id: "aera", label: "Aera · MetaHuman" },
  { id: "ada", label: "Ada · MetaHuman" },
  { id: "vivian", label: "Vivian · MetaHuman" },
  { id: "jelena", label: "Jelena · MetaHuman" },
] as const;

export const italianVoices = [
  { id: "Bianca", label: "Bianca · Italiano · donna" },
  { id: "Beatrice", label: "Beatrice · Italiano · donna" },
  { id: "Lorenzo", label: "Lorenzo · Italiano · uomo" },
] as const;

export const englishVoices = [
  { id: "Danielle", label: "Danielle · English US · woman" },
  { id: "Joanna", label: "Joanna · English US · woman" },
  { id: "Ruth", label: "Ruth · English US · woman" },
  { id: "Salli", label: "Salli · English US · woman" },
  { id: "Tiffany", label: "Tiffany · English US · woman" },
  { id: "Matthew", label: "Matthew · English US · man" },
  { id: "Stephen", label: "Stephen · English US · man" },
] as const;

export const meetingPlatforms = ["teams", "google-meet", "generic"] as const;
export type MeetingPlatform = (typeof meetingPlatforms)[number];
export type ItalianVoiceId = (typeof italianVoices)[number]["id"];
export type EnglishVoiceId = (typeof englishVoices)[number]["id"];

export const voiceStyles = ["natural", "lively", "authoritative"] as const;
export type VoiceStyle = (typeof voiceStyles)[number];

export const defaultChatCommandAliases: ChatCommandAliases = {
  raiseHand: ["alza la mano", "chiedi la parola", "raise your hand", "request to speak"],
  lowerHand: ["abbassa la mano", "ritira la richiesta", "lower your hand"],
  applaud: ["applaudi", "fai un applauso", "batti le mani", "clap", "applaud"],
  summarizeInChat: ["riassumi in chat", "scrivi un riassunto", "summarize in chat"],
  replyInChat: ["rispondi in chat", "scrivi in chat", "reply in chat"],
  speak: ["intervieni", "parla", "rispondi a voce", "speak"],
};

export interface AvatarConfig {
  avatarProfile: string;
  name: string;
  apiKey: string;
  responseModel: string;
  purpose: string;
  personality: string;
  characterTraits: AvatarCharacterTraits;
  systemPrompt: string;
  webSearchEnabled: boolean;
  requestToSpeakEnabled: boolean;
  autonomousApplauseEnabled: boolean;
  chatEnabled: boolean;
  chatCommandAliases: ChatCommandAliases;
  voiceStyle: VoiceStyle;
  italianVoice: ItalianVoiceId;
  englishVoice: EnglishVoiceId;
  meetingPlatform: MeetingPlatform;
  meetingAudioDevice: string;
  meetingSpeakerName: string;
}

export interface PublicAvatarConfig extends Omit<AvatarConfig, "apiKey"> {
  apiKeyConfigured: boolean;
  apiKeySource: "environment" | "local" | "none";
}

export interface AvatarConfigInput {
  avatarProfile?: unknown;
  name?: unknown;
  apiKey?: unknown;
  responseModel?: unknown;
  purpose?: unknown;
  personality?: unknown;
  characterTraits?: unknown;
  systemPrompt?: unknown;
  webSearchEnabled?: unknown;
  requestToSpeakEnabled?: unknown;
  autonomousApplauseEnabled?: unknown;
  chatEnabled?: unknown;
  chatCommandAliases?: unknown;
  voiceStyle?: unknown;
  italianVoice?: unknown;
  englishVoice?: unknown;
  meetingPlatform?: unknown;
  meetingAudioDevice?: unknown;
  meetingSpeakerName?: unknown;
}

interface StoredAvatarConfig extends Omit<AvatarConfig, "apiKey"> {
  version: 3;
  apiKey?: string;
}

function textField(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") throw new Error(`${label} non valido`);
  const text = value.trim();
  if (!text || text.length > maxLength) {
    throw new Error(`${label} deve contenere da 1 a ${maxLength} caratteri`);
  }
  return text;
}

function optionalUpdate(
  value: unknown,
  current: string,
  label: string,
  maxLength: number,
): string {
  return value === undefined ? current : textField(value, label, maxLength);
}

function boolUpdate(value: unknown, current: boolean, label: string): boolean {
  if (value === undefined) return current;
  if (typeof value !== "boolean") throw new Error(`${label} non valido`);
  return value;
}

function commandAliasList(value: unknown, fallback: string[], label: string): string[] {
  if (value === undefined) return [...fallback];
  if (!Array.isArray(value) || value.length === 0 || value.length > 12) {
    throw new Error(`${label} deve contenere da 1 a 12 comandi`);
  }
  const aliases = value.map((entry) => textField(entry, label, 80));
  return [...new Set(aliases.map((alias) => alias.replace(/\s+/gu, " ")))];
}

function commandAliases(
  value: unknown,
  fallback: ChatCommandAliases,
): ChatCommandAliases {
  if (value === undefined) {
    return {
      raiseHand: [...fallback.raiseHand],
      lowerHand: [...fallback.lowerHand],
      applaud: [...fallback.applaud],
      summarizeInChat: [...fallback.summarizeInChat],
      replyInChat: [...fallback.replyInChat],
      speak: [...fallback.speak],
    };
  }
  if (typeof value !== "object" || value === null) {
    throw new Error("Comandi chat non validi");
  }
  const record = value as Record<string, unknown>;
  return {
    raiseHand: commandAliasList(record.raiseHand, fallback.raiseHand, "Comandi alza mano"),
    lowerHand: commandAliasList(record.lowerHand, fallback.lowerHand, "Comandi abbassa mano"),
    applaud: commandAliasList(record.applaud, fallback.applaud, "Comandi applauso"),
    summarizeInChat: commandAliasList(
      record.summarizeInChat,
      fallback.summarizeInChat,
      "Comandi riassunto chat",
    ),
    replyInChat: commandAliasList(
      record.replyInChat,
      fallback.replyInChat,
      "Comandi risposta chat",
    ),
    speak: commandAliasList(record.speak, fallback.speak, "Comandi intervento vocale"),
  };
}

function parseStored(value: unknown, fallback: AvatarConfig): AvatarConfig | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  try {
    return {
      avatarProfile: record.avatarProfile === "mary-metahuman"
        ? "aera"
        : optionalUpdate(record.avatarProfile, fallback.avatarProfile, "Profilo avatar", 80),
      name: optionalUpdate(record.name, fallback.name, "Nome avatar", 40),
      apiKey: typeof record.apiKey === "string" && record.apiKey.trim()
        ? record.apiKey.trim()
        : fallback.apiKey,
      responseModel: optionalUpdate(record.responseModel, fallback.responseModel, "Modello", 120),
      purpose: optionalUpdate(record.purpose, fallback.purpose, "Scopo", 1_500),
      personality: optionalUpdate(record.personality, fallback.personality, "Personalità", 1_500),
      characterTraits: characterTraits(record.characterTraits, fallback.characterTraits),
      systemPrompt: optionalUpdate(record.systemPrompt, fallback.systemPrompt, "System prompt", 6_000),
      webSearchEnabled: typeof record.webSearchEnabled === "boolean"
        ? record.webSearchEnabled
        : fallback.webSearchEnabled,
      requestToSpeakEnabled: typeof record.requestToSpeakEnabled === "boolean"
        ? record.requestToSpeakEnabled
        : fallback.requestToSpeakEnabled,
      autonomousApplauseEnabled: typeof record.autonomousApplauseEnabled === "boolean"
        ? record.autonomousApplauseEnabled
        : fallback.autonomousApplauseEnabled,
      chatEnabled: typeof record.chatEnabled === "boolean"
        ? record.chatEnabled
        : fallback.chatEnabled,
      chatCommandAliases: commandAliases(record.chatCommandAliases, fallback.chatCommandAliases),
      voiceStyle: voiceStyles.includes(record.voiceStyle as VoiceStyle)
        ? record.voiceStyle as VoiceStyle
        : fallback.voiceStyle,
      italianVoice: italianVoices.some((voice) => voice.id === record.italianVoice)
        ? record.italianVoice as ItalianVoiceId
        : fallback.italianVoice,
      englishVoice: englishVoices.some((voice) => voice.id === record.englishVoice)
        ? record.englishVoice as EnglishVoiceId
        : fallback.englishVoice,
      meetingPlatform: meetingPlatforms.includes(record.meetingPlatform as MeetingPlatform)
        ? record.meetingPlatform as MeetingPlatform
        : fallback.meetingPlatform,
      meetingAudioDevice: optionalUpdate(
        record.meetingAudioDevice,
        fallback.meetingAudioDevice,
        "Dispositivo audio riunione",
        160,
      ),
      meetingSpeakerName: optionalUpdate(
        record.meetingSpeakerName,
        fallback.meetingSpeakerName,
        "Nome partecipante riunione",
        80,
      ),
    };
  } catch {
    return null;
  }
}

export class AvatarConfigStore {
  readonly #path: string;
  readonly #environmentApiKey: string;
  #config: AvatarConfig;
  #hasLocalApiKey = false;

  constructor(path: string, defaults: AvatarConfig) {
    this.#path = path;
    this.#environmentApiKey = defaults.apiKey.trim();
    this.#config = { ...defaults, apiKey: this.#environmentApiKey };

    if (!existsSync(path)) return;
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
      const record = typeof parsed === "object" && parsed !== null
        ? parsed as Record<string, unknown>
        : null;
      this.#hasLocalApiKey = typeof record?.apiKey === "string" && record.apiKey.trim().length > 0;
      this.#config = parseStored(parsed, this.#config) ?? this.#config;
    } catch {
      // A malformed local file must not prevent the companion from starting.
      // The next successful save replaces it atomically.
    }
  }

  get current(): AvatarConfig {
    return {
      ...this.#config,
      characterTraits: characterTraits(undefined, this.#config.characterTraits),
      chatCommandAliases: commandAliases(undefined, this.#config.chatCommandAliases),
    };
  }

  get publicConfig(): PublicAvatarConfig {
    const { apiKey, ...config } = this.#config;
    return {
      ...config,
      characterTraits: characterTraits(undefined, config.characterTraits),
      chatCommandAliases: commandAliases(undefined, config.chatCommandAliases),
      apiKeyConfigured: apiKey.length > 0,
      apiKeySource: this.#hasLocalApiKey
        ? "local"
        : this.#environmentApiKey
          ? "environment"
          : "none",
    };
  }

  update(input: AvatarConfigInput): AvatarConfig {
    const current = this.#config;
    const requestedProfile = optionalUpdate(
      input.avatarProfile,
      current.avatarProfile,
      "Profilo avatar",
      80,
    );
    if (!avatarProfiles.some((profile) => profile.id === requestedProfile)) {
      throw new Error("Profilo avatar non supportato");
    }

    let apiKey = current.apiKey;
    if (input.apiKey !== undefined) {
      if (typeof input.apiKey !== "string") throw new Error("API key non valida");
      if (input.apiKey.trim()) {
        apiKey = textField(input.apiKey, "API key", 500);
        this.#hasLocalApiKey = true;
      }
    }

    const voiceStyle = input.voiceStyle === undefined
      ? current.voiceStyle
      : input.voiceStyle;
    if (!voiceStyles.includes(voiceStyle as VoiceStyle)) {
      throw new Error("Stile voce non supportato");
    }
    const italianVoice = input.italianVoice === undefined
      ? current.italianVoice
      : input.italianVoice;
    if (!italianVoices.some((voice) => voice.id === italianVoice)) {
      throw new Error("Voce italiana non supportata");
    }
    const englishVoice = input.englishVoice === undefined
      ? current.englishVoice
      : input.englishVoice;
    if (!englishVoices.some((voice) => voice.id === englishVoice)) {
      throw new Error("Voce inglese non supportata");
    }
    const meetingPlatform = input.meetingPlatform === undefined
      ? current.meetingPlatform
      : input.meetingPlatform;
    if (!meetingPlatforms.includes(meetingPlatform as MeetingPlatform)) {
      throw new Error("Piattaforma meeting non supportata");
    }

    this.#config = {
      avatarProfile: requestedProfile,
      name: optionalUpdate(input.name, current.name, "Nome avatar", 40),
      apiKey,
      responseModel: optionalUpdate(input.responseModel, current.responseModel, "Modello", 120),
      purpose: optionalUpdate(input.purpose, current.purpose, "Scopo", 1_500),
      personality: optionalUpdate(input.personality, current.personality, "Personalità", 1_500),
      characterTraits: characterTraits(input.characterTraits, current.characterTraits),
      systemPrompt: optionalUpdate(input.systemPrompt, current.systemPrompt, "System prompt", 6_000),
      webSearchEnabled: boolUpdate(input.webSearchEnabled, current.webSearchEnabled, "Ricerca web"),
      requestToSpeakEnabled: boolUpdate(
        input.requestToSpeakEnabled,
        current.requestToSpeakEnabled,
        "Richiesta di parola",
      ),
      autonomousApplauseEnabled: boolUpdate(
        input.autonomousApplauseEnabled,
        current.autonomousApplauseEnabled,
        "Applauso autonomo",
      ),
      chatEnabled: boolUpdate(input.chatEnabled, current.chatEnabled, "Lettura chat"),
      chatCommandAliases: commandAliases(
        input.chatCommandAliases,
        current.chatCommandAliases,
      ),
      voiceStyle: voiceStyle as VoiceStyle,
      italianVoice: italianVoice as ItalianVoiceId,
      englishVoice: englishVoice as EnglishVoiceId,
      meetingPlatform: meetingPlatform as MeetingPlatform,
      meetingAudioDevice: optionalUpdate(
        input.meetingAudioDevice,
        current.meetingAudioDevice,
        "Dispositivo audio riunione",
        160,
      ),
      meetingSpeakerName: optionalUpdate(
        input.meetingSpeakerName,
        current.meetingSpeakerName,
        "Nome partecipante riunione",
        80,
      ),
    };
    this.#persist();
    return this.current;
  }

  #persist(): void {
    mkdirSync(dirname(this.#path), { recursive: true, mode: 0o700 });
    const temporaryPath = `${this.#path}.tmp`;
    const { apiKey, ...publicFields } = this.#config;
    const stored: StoredAvatarConfig = {
      version: 3,
      ...publicFields,
      ...(this.#hasLocalApiKey ? { apiKey } : {}),
    };
    writeFileSync(temporaryPath, `${JSON.stringify(stored, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    chmodSync(temporaryPath, 0o600);
    renameSync(temporaryPath, this.#path);
  }
}
