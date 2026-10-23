import { normalizeVideoTopicMode, normalizeVideoTopicText } from "./video-topic";
// Recovered from vgflutter/conclavia @ 5d4746f900a106defe1377131bce7ebbc5b69ca3.
// Namespaced podcast feature; existing Meeting records and runtime stay separate.
import type { TalkDocument } from "@/models/PodcastTalk";
import type { TalkResponse } from "@/types/podcast";
import {
  DEFAULT_LLM_MODEL,
  isLlmModelId,
} from "@/lib/podcast/llm-models";
import {
  DEFAULT_STUDIO_THEME,
  normalizeStudioTheme, normalizeStudioCast, normalizeStudioGuest,
} from "@/lib/podcast/studio-themes";
import { findStudioVoice } from "@/lib/podcast/voice-catalog";
import { normalizeTalkOnAirNames } from "@/lib/podcast/on-air-names";
import { normalizeStudioLayout } from "@/lib/podcast/talk-run-compatibility";

function voiceDelivery(value: unknown) {
  return value === "energetic" || value === "authoritative"
    ? value
    : "natural";
}

export function serializeTalk(talk: TalkDocument): TalkResponse {
  return normalizeTalkOnAirNames({
    id: talk._id.toString(),
    title: talk.title,
    topic: talk.topic,
    centralQuestion: talk.centralQuestion,
    editorialInstructions: talk.editorialInstructions,
    description: talk.description,
    language: talk.language,
    participants: talk.participants.map((participant, index) => ({
      kind:
        participant.kind === "human" || participant.kind === "unassigned"
          ? participant.kind
          : "ai",
      sex:
        participant.sex === "female" || participant.sex === "male"
          ? participant.sex
          : index % 2 === 0
            ? "female"
            : "male",
      name: participant.name,
      role: participant.role,
      perspectiveMode: participant.perspectiveMode ?? "custom",
      perspectivePrompt: participant.perspectivePrompt,
      personalityPrompt: participant.personalityPrompt,
      goals: participant.goals,
      nonNegotiables: participant.nonNegotiables,
      speakingStylePrompt: participant.speakingStylePrompt,
      modelOverride: isLlmModelId(participant.modelOverride)
        ? participant.modelOverride
        : undefined,
      voiceId: findStudioVoice(participant.voiceId ?? "", talk.settings.voiceProvider === "kokoro" ? "kokoro" : "inworld", talk.language)?.id,
      voiceDelivery: voiceDelivery(participant.voiceDelivery),
      assertiveness: participant.assertiveness,
      patience: participant.patience,
      interruptiveness: participant.interruptiveness,
      baselineTension: participant.baselineTension,
    })),
    moderator: {
      kind:
        talk.moderator?.kind === "ai" || talk.moderator?.kind === "human"
          ? talk.moderator.kind
          : "none",
      name: talk.moderator?.name,
      role: talk.moderator?.role,
      instructions: talk.moderator?.instructions,
      style:
        talk.moderator?.style === "challenging" ||
        talk.moderator?.style === "facilitating"
          ? talk.moderator.style
          : "neutral",
      modelOverride: isLlmModelId(talk.moderator?.modelOverride)
        ? talk.moderator.modelOverride
        : undefined,
      voiceId: findStudioVoice(talk.moderator?.voiceId ?? "", talk.settings.voiceProvider === "kokoro" ? "kokoro" : "inworld", talk.language)?.id,
      voiceDelivery: voiceDelivery(talk.moderator?.voiceDelivery),
      canInterrupt: talk.moderator?.canInterrupt ?? true,
      manageTime: talk.moderator?.manageTime ?? true,
      summarizeAtEnd: talk.moderator?.summarizeAtEnd ?? true,
    },
    status: talk.status,
    settings: {
      videoTopicMode: normalizeVideoTopicMode(talk.settings.videoTopicMode),
      videoTopicText: normalizeVideoTopicText(talk.settings.videoTopicText),
      voiceProvider: talk.settings.voiceProvider === "kokoro" ? "kokoro" : "inworld",
      maxTurns: talk.settings.maxTurns,
      targetDurationMinutes: talk.settings.targetDurationMinutes ?? 30,
      videoMode: "cartoon",
      studioTheme: normalizeStudioTheme(
        talk.settings.studioTheme ?? DEFAULT_STUDIO_THEME,
      ),
      studioCast: normalizeStudioCast(talk.settings.studioCast),
      studioGuest: normalizeStudioGuest(talk.settings.studioGuest),
      studioLayout: normalizeStudioLayout(talk.settings.studioLayout),
      defaultModel: isLlmModelId(talk.settings.defaultModel)
        ? talk.settings.defaultModel
        : DEFAULT_LLM_MODEL,
      allowInterruptions: talk.settings.allowInterruptions,
      pace:
        talk.settings.pace === "fast" || talk.settings.pace === "deep"
          ? talk.settings.pace
          : "balanced",
    },
    createdAt: talk.createdAt.toISOString(),
    updatedAt: talk.updatedAt.toISOString(),
  });
}
