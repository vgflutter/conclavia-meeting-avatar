import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const avatarProfiles = [
  { id: "mary-metahuman", label: "Mary · Conclavia MetaHuman" },
] as const;

export const voiceStyles = ["natural", "lively", "authoritative"] as const;
export type VoiceStyle = (typeof voiceStyles)[number];

export interface AvatarConfig {
  avatarProfile: string;
  name: string;
  apiKey: string;
  responseModel: string;
  purpose: string;
  personality: string;
  systemPrompt: string;
  webSearchEnabled: boolean;
  requestToSpeakEnabled: boolean;
  voiceStyle: VoiceStyle;
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
  systemPrompt?: unknown;
  webSearchEnabled?: unknown;
  requestToSpeakEnabled?: unknown;
  voiceStyle?: unknown;
}

interface StoredAvatarConfig extends Omit<AvatarConfig, "apiKey"> {
  version: 1;
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

function parseStored(value: unknown, fallback: AvatarConfig): AvatarConfig | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  try {
    return {
      avatarProfile: optionalUpdate(record.avatarProfile, fallback.avatarProfile, "Profilo avatar", 80),
      name: optionalUpdate(record.name, fallback.name, "Nome avatar", 40),
      apiKey: typeof record.apiKey === "string" && record.apiKey.trim()
        ? record.apiKey.trim()
        : fallback.apiKey,
      responseModel: optionalUpdate(record.responseModel, fallback.responseModel, "Modello", 120),
      purpose: optionalUpdate(record.purpose, fallback.purpose, "Scopo", 1_500),
      personality: optionalUpdate(record.personality, fallback.personality, "Personalità", 1_500),
      systemPrompt: optionalUpdate(record.systemPrompt, fallback.systemPrompt, "System prompt", 6_000),
      webSearchEnabled: typeof record.webSearchEnabled === "boolean"
        ? record.webSearchEnabled
        : fallback.webSearchEnabled,
      requestToSpeakEnabled: typeof record.requestToSpeakEnabled === "boolean"
        ? record.requestToSpeakEnabled
        : fallback.requestToSpeakEnabled,
      voiceStyle: voiceStyles.includes(record.voiceStyle as VoiceStyle)
        ? record.voiceStyle as VoiceStyle
        : fallback.voiceStyle,
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
    return { ...this.#config };
  }

  get publicConfig(): PublicAvatarConfig {
    const { apiKey, ...config } = this.#config;
    return {
      ...config,
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

    this.#config = {
      avatarProfile: requestedProfile,
      name: optionalUpdate(input.name, current.name, "Nome avatar", 40),
      apiKey,
      responseModel: optionalUpdate(input.responseModel, current.responseModel, "Modello", 120),
      purpose: optionalUpdate(input.purpose, current.purpose, "Scopo", 1_500),
      personality: optionalUpdate(input.personality, current.personality, "Personalità", 1_500),
      systemPrompt: optionalUpdate(input.systemPrompt, current.systemPrompt, "System prompt", 6_000),
      webSearchEnabled: boolUpdate(input.webSearchEnabled, current.webSearchEnabled, "Ricerca web"),
      requestToSpeakEnabled: boolUpdate(
        input.requestToSpeakEnabled,
        current.requestToSpeakEnabled,
        "Richiesta di parola",
      ),
      voiceStyle: voiceStyle as VoiceStyle,
    };
    this.#persist();
    return this.current;
  }

  #persist(): void {
    mkdirSync(dirname(this.#path), { recursive: true, mode: 0o700 });
    const temporaryPath = `${this.#path}.tmp`;
    const { apiKey, ...publicFields } = this.#config;
    const stored: StoredAvatarConfig = {
      version: 1,
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
