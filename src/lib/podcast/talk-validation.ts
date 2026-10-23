import { isVideoTopicMode, normalizeVideoTopicMode, normalizeVideoTopicText, VIDEO_TOPIC_MAX_LENGTH } from "./video-topic";
// Recovered from vgflutter/conclavia @ 5d4746f900a106defe1377131bce7ebbc5b69ca3.
// Namespaced podcast feature; existing Meeting records and runtime stay separate.
import type {
  ModeratorConfiguration,
  ModeratorKind,
  ModeratorStyle,
  Participant,
  ParticipantKind,
  ParticipantSex,
  PerspectiveMode,
  TalkInput,
  TalkPace,
  TalkSettings,
  TalkStatus,
} from "@/types/podcast";
import {
  DEFAULT_LLM_MODEL,
  isLlmModelId,
  type LlmModelId,
} from "@/lib/podcast/llm-models";
import { isStudioLayout, MAX_RUN_TURNS, normalizeStudioLayout } from "@/lib/podcast/talk-run-compatibility";
import {
  DEFAULT_STUDIO_THEME,
  isStudioThemeId, isStudioCast, normalizeStudioCast, isStudioGuest, normalizeStudioGuest,
} from "@/lib/podcast/studio-themes";
import { findStudioVoice } from "@/lib/podcast/voice-catalog";

type ValidationResult =
  | { success: true; data: TalkInput }
  | { success: false; issues: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(
  value: unknown,
  field: string,
  issues: string[],
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push(`${field} is required`);
    return "";
  }

  const normalized = value.trim();
  if (normalized.length > 8000) issues.push(`${field} must not exceed 8000 characters`);
  return normalized;
}

function optionalString(
  value: unknown,
  field: string,
  issues: string[],
): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    issues.push(`${field} must be a string`);
    return undefined;
  }

  const normalized = value.trim();
  if (normalized.length > 8000) issues.push(`${field} must not exceed 8000 characters`);
  return normalized || undefined;
}

function optionalModelId(
  value: unknown,
  field: string,
  issues: string[],
): LlmModelId | undefined {
  const modelId = optionalString(value, field, issues);

  if (modelId === undefined) {
    return undefined;
  }

  if (!isLlmModelId(modelId)) {
    issues.push(`${field} must be one of the supported models`);
    return undefined;
  }

  return modelId;
}

function optionalVoiceId(
  value: unknown,
  sex: ParticipantSex,
  field: string,
  issues: string[],
  provider: "inworld" | "kokoro" = "inworld",
  language?: string,
): string | undefined {
  const voiceId = optionalString(value, field, issues);
  if (!voiceId) return undefined;
  const voice = findStudioVoice(voiceId, provider, language);
  if (!voice || voice.sex !== sex) {
    issues.push(`${field} must be a supported voice matching the participant sex`);
    return undefined;
  }
  return voice.id;
}

function voiceDelivery(value: unknown, field: string, issues: string[]) {
  if (value === undefined || value === "natural") return "natural" as const;
  if (value === "energetic" || value === "authoritative") return value;
  issues.push(`${field} must be natural, energetic, or authoritative`);
  return "natural" as const;
}

function score(value: unknown, field: string, issues: string[]): number {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 100) {
    issues.push(`${field} must be an integer from 0 to 100`);
    return 0;
  }

  return value as number;
}

function participantKind(
  value: unknown,
  field: string,
  issues: string[],
): ParticipantKind {
  if (value === undefined || value === "ai") {
    return "ai";
  }

  if (value === "human" || value === "unassigned") {
    return value;
  }

  issues.push(`${field} must be ai, human, or unassigned`);
  return "ai";
}

function participantSex(
  value: unknown,
  index: number,
  field: string,
  issues: string[],
): ParticipantSex {
  if (value === undefined) {
    return index % 2 === 0 ? "female" : "male";
  }
  if (value === "female" || value === "male") {
    return value;
  }

  issues.push(`${field} must be female or male`);
  return index % 2 === 0 ? "female" : "male";
}

function perspectiveMode(
  value: unknown,
  field: string,
  issues: string[],
): PerspectiveMode {
  if (value === undefined || value === "custom") {
    return "custom";
  }

  if (value === "automatic" || value === "random") {
    return value;
  }

  issues.push(`${field} must be custom, automatic, or random`);
  return "custom";
}

function perspectivePrompt(
  value: unknown,
  mode: PerspectiveMode,
  field: string,
  issues: string[],
): string {
  if (mode === "custom") {
    return requiredString(value, field, issues);
  }

  if (value === undefined || value === null || value === "") {
    return "";
  }

  if (typeof value !== "string") {
    issues.push(`${field} must be a string`);
    return "";
  }

  const normalized = value.trim();
  if (normalized.length > 8000) issues.push(`${field} must not exceed 8000 characters`);
  return normalized;
}

function parseParticipant(
  value: unknown,
  index: number,
  issues: string[],
  provider: "inworld" | "kokoro",
  language: string,
): Participant {
  const field = `participants[${index}]`;
  const participant = isRecord(value) ? value : {};

  if (!isRecord(value)) {
    issues.push(`${field} must be an object`);
  }

  const mode = perspectiveMode(
    participant.perspectiveMode,
    `${field}.perspectiveMode`,
    issues,
  );
  const kind = participantKind(participant.kind, `${field}.kind`, issues);
  const name =
    kind === "unassigned"
      ? optionalString(participant.name, `${field}.name`, issues) ?? ""
      : requiredString(participant.name, `${field}.name`, issues);
  const role =
    kind === "unassigned"
      ? optionalString(participant.role, `${field}.role`, issues) ?? ""
      : requiredString(participant.role, `${field}.role`, issues);

  const sex = participantSex(participant.sex, index, `${field}.sex`, issues);
  const personalityPrompt = kind === "ai"
    ? optionalString(participant.personalityPrompt, `${field}.personalityPrompt`, issues)
    : undefined;
  if (personalityPrompt && personalityPrompt.length > 2000) {
    issues.push(`${field}.personalityPrompt must not exceed 2000 characters`);
  }
  return {
    kind,
    sex,
    name,
    role,
    personalityPrompt,
    perspectiveMode: kind === "ai" ? mode : "custom",
    perspectivePrompt:
      kind === "ai"
        ? perspectivePrompt(
            participant.perspectivePrompt,
            mode,
            `${field}.perspectivePrompt`,
            issues,
          )
        : kind === "human"
          ? optionalString(
              participant.perspectivePrompt,
              `${field}.perspectivePrompt`,
              issues,
            ) ?? ""
          : "",
    speakingStylePrompt:
      kind === "ai"
        ? optionalString(
            participant.speakingStylePrompt,
            `${field}.speakingStylePrompt`,
            issues,
          )
        : undefined,
    goals:
      kind === "ai"
        ? optionalString(participant.goals, `${field}.goals`, issues)
        : undefined,
    nonNegotiables:
      kind === "ai"
        ? optionalString(
            participant.nonNegotiables,
            `${field}.nonNegotiables`,
            issues,
          )
        : undefined,
    modelOverride:
      kind === "ai"
        ? optionalModelId(
            participant.modelOverride,
            `${field}.modelOverride`,
            issues,
          )
          : undefined,
    voiceId:
      kind === "ai"
        ? optionalVoiceId(participant.voiceId, sex, `${field}.voiceId`, issues, provider, language)
        : undefined,
    voiceDelivery:
      kind === "ai"
        ? voiceDelivery(
            participant.voiceDelivery,
            `${field}.voiceDelivery`,
            issues,
          )
        : undefined,
    assertiveness: score(
      participant.assertiveness ?? 50,
      `${field}.assertiveness`,
      issues,
    ),
    patience: score(participant.patience ?? 50, `${field}.patience`, issues),
    interruptiveness: score(
      participant.interruptiveness ?? 20,
      `${field}.interruptiveness`,
      issues,
    ),
    baselineTension: score(
      participant.baselineTension ?? 20,
      `${field}.baselineTension`,
      issues,
    ),
  };
}

function parseModerator(
  value: unknown,
  issues: string[],
  provider: "inworld" | "kokoro",
  language: string,
): ModeratorConfiguration {
  if (value === undefined) {
    return {
      kind: "none",
      style: "neutral",
      canInterrupt: true,
      manageTime: true,
      summarizeAtEnd: true,
    };
  }

  const moderator = isRecord(value) ? value : {};
  if (!isRecord(value)) {
    issues.push("moderator must be an object");
  }

  let kind: ModeratorKind = "none";
  if (moderator.kind === "ai" || moderator.kind === "human") {
    kind = moderator.kind;
  } else if (moderator.kind !== undefined && moderator.kind !== "none") {
    issues.push("moderator.kind must be none, ai, or human");
  }

  let style: ModeratorStyle = "neutral";
  if (
    moderator.style === "challenging" ||
    moderator.style === "facilitating"
  ) {
    style = moderator.style;
  } else if (moderator.style !== undefined && moderator.style !== "neutral") {
    issues.push("moderator.style must be neutral, challenging, or facilitating");
  }

  function moderatorBoolean(
    field: "canInterrupt" | "manageTime" | "summarizeAtEnd",
    fallback: boolean,
  ): boolean {
    const fieldValue = moderator[field];
    if (fieldValue === undefined) {
      return fallback;
    }
    if (typeof fieldValue !== "boolean") {
      issues.push(`moderator.${field} must be a boolean`);
      return fallback;
    }
    return fieldValue;
  }

  return {
    kind,
    name:
      kind === "none"
        ? undefined
        : requiredString(moderator.name, "moderator.name", issues),
    role:
      kind === "none"
        ? undefined
        : optionalString(moderator.role, "moderator.role", issues),
    instructions:
      kind === "none"
        ? undefined
        : optionalString(
            moderator.instructions,
            "moderator.instructions",
            issues,
          ),
    style,
    modelOverride:
      kind === "ai"
        ? optionalModelId(
            moderator.modelOverride,
            "moderator.modelOverride",
            issues,
          )
          : undefined,
    voiceId:
      kind === "ai"
        ? optionalVoiceId(moderator.voiceId, "male", "moderator.voiceId", issues, provider, language)
        : undefined,
    voiceDelivery:
      kind === "ai"
        ? voiceDelivery(
            moderator.voiceDelivery,
            "moderator.voiceDelivery",
            issues,
          )
        : undefined,
    canInterrupt: moderatorBoolean("canInterrupt", true),
    manageTime: moderatorBoolean("manageTime", true),
    summarizeAtEnd: moderatorBoolean("summarizeAtEnd", true),
  };
}

function parseSettings(value: unknown, issues: string[]): TalkSettings {
  const settings = isRecord(value) ? value : {};

  if (!isRecord(value)) {
    issues.push("settings must be an object");
  }

  const maxTurns = settings.maxTurns;
  if (!Number.isInteger(maxTurns) || (maxTurns as number) < 1) {
    issues.push("settings.maxTurns must be a positive integer");
  } else if ((maxTurns as number) > MAX_RUN_TURNS) {
    issues.push(`settings.maxTurns must not exceed ${MAX_RUN_TURNS}`);
  }

  const targetDurationMinutes = settings.targetDurationMinutes ?? 5;
  if (
    !Number.isInteger(targetDurationMinutes) ||
    (targetDurationMinutes as number) < 1
  ) {
    issues.push("settings.targetDurationMinutes must be a positive integer");
  } else if ((targetDurationMinutes as number) > 60) {
    issues.push("settings.targetDurationMinutes must not exceed 60");
  }

  const videoMode = "cartoon" as const;
  if (settings.videoMode !== undefined && settings.videoMode !== "cartoon") {
    issues.push("settings.videoMode must be cartoon");
  }

  const rawDefaultModel =
    settings.defaultModel === undefined || settings.defaultModel === "auto"
      ? DEFAULT_LLM_MODEL
      : settings.defaultModel;
  const defaultModel = isLlmModelId(rawDefaultModel)
    ? rawDefaultModel
    : DEFAULT_LLM_MODEL;

  if (!isLlmModelId(rawDefaultModel)) {
    issues.push("settings.defaultModel must be one of the supported models");
  }

  if (typeof settings.allowInterruptions !== "boolean") {
    issues.push("settings.allowInterruptions must be a boolean");
  }

  let pace: TalkPace = "balanced";
  if (settings.pace === "fast" || settings.pace === "deep") {
    pace = settings.pace;
  } else if (settings.pace !== undefined && settings.pace !== "balanced") {
    issues.push("settings.pace must be fast, balanced, or deep");
  }

  const studioTheme =
    settings.studioTheme === undefined
      ? DEFAULT_STUDIO_THEME
      : isStudioThemeId(settings.studioTheme)
        ? settings.studioTheme
        : DEFAULT_STUDIO_THEME;
  if (
    settings.studioTheme !== undefined &&
    !isStudioThemeId(settings.studioTheme)
  ) {
    issues.push("settings.studioTheme must be one of the supported themes");
  }

  if (settings.voiceProvider !== undefined && settings.voiceProvider !== "inworld" && settings.voiceProvider !== "kokoro") issues.push("settings.voiceProvider must be inworld or kokoro");
  if (settings.studioLayout !== undefined && !isStudioLayout(settings.studioLayout)) {
    issues.push("settings.studioLayout must be one of the supported studio layouts");
  }
  if (settings.studioCast !== undefined && !isStudioCast(settings.studioCast)) issues.push("settings.studioCast must be one of the supported casts");
  if (settings.studioGuest !== undefined && !isStudioGuest(settings.studioGuest)) issues.push("settings.studioGuest must be auto, reserve, or hidden");
  if (settings.videoTopicMode !== undefined && !isVideoTopicMode(settings.videoTopicMode)) issues.push("settings.videoTopicMode must be episode, conversation, custom, or hidden");
  if (settings.videoTopicText !== undefined && (typeof settings.videoTopicText !== "string" || settings.videoTopicText.length > VIDEO_TOPIC_MAX_LENGTH)) issues.push("settings.videoTopicText must be a string of at most 80 characters");
  if (settings.videoTopicMode === "custom" && !normalizeVideoTopicText(settings.videoTopicText)) issues.push("settings.videoTopicText is required for a custom video topic");
  return {
    videoTopicMode: normalizeVideoTopicMode(settings.videoTopicMode),
    videoTopicText: normalizeVideoTopicText(settings.videoTopicText),
    voiceProvider: settings.voiceProvider === "kokoro" ? "kokoro" : "inworld",
    maxTurns: Number.isInteger(maxTurns) ? (maxTurns as number) : 1,
    targetDurationMinutes: Number.isInteger(targetDurationMinutes)
      ? (targetDurationMinutes as number)
      : 5,
    videoMode,
    studioTheme,
    studioCast: normalizeStudioCast(settings.studioCast),
    studioGuest: normalizeStudioGuest(settings.studioGuest),
    studioLayout: normalizeStudioLayout(settings.studioLayout),
    defaultModel,
    allowInterruptions:
      typeof settings.allowInterruptions === "boolean"
        ? settings.allowInterruptions
        : false,
    pace,
  };
}

export function validateTalkInput(value: unknown): ValidationResult {
  const issues: string[] = [];

  if (!isRecord(value)) {
    return { success: false, issues: ["Request body must be an object"] };
  }

  const provider = isRecord(value.settings) && value.settings.voiceProvider === "kokoro" ? "kokoro" : "inworld";
  const language = typeof value.language === "string" ? value.language.trim() : "";
  if (provider === "kokoro" && language !== "it") issues.push("Kokoro podcast voices currently support Italian only");
  let participants: Participant[] = [];
  if (!Array.isArray(value.participants) || value.participants.length < 2 || value.participants.length > 5) {
    issues.push("participants must contain between two and five items");
  } else {
    participants = value.participants.map((participant, index) =>
      parseParticipant(participant, index, issues, provider, language),
    );
  }

  let status: TalkStatus = "draft";
  if (value.status === "draft" || value.status === "ready") {
    status = value.status;
  } else {
    issues.push("status must be draft or ready");
  }

  if (
    status === "ready" &&
    participants.some((participant) => participant.kind === "unassigned")
  ) {
    issues.push("ready talks cannot contain unassigned participants");
  }

  const data: TalkInput = {
    title: requiredString(value.title, "title", issues),
    topic: requiredString(value.topic, "topic", issues),
    centralQuestion: optionalString(value.centralQuestion, "centralQuestion", issues),
    editorialInstructions: optionalString(value.editorialInstructions, "editorialInstructions", issues),
    description: optionalString(value.description, "description", issues),
    language: requiredString(value.language, "language", issues),
    participants,
    moderator: parseModerator(value.moderator, issues, provider, language),
    status,
    settings: parseSettings(value.settings, issues),
  };

  if (data.title.length > 200 || data.topic.length > 2000 || (data.centralQuestion?.length ?? 0) > 2000) issues.push("Title/topic/question exceed their maximum length");
  return issues.length > 0
    ? { success: false, issues }
    : { success: true, data };
}
