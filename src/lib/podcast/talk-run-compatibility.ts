// Recovered from vgflutter/conclavia @ 5d4746f900a106defe1377131bce7ebbc5b69ca3.
// Namespaced podcast feature; existing Meeting records and runtime stay separate.
import { getLlmModel, type LlmProvider } from "@/lib/podcast/llm-models";
import type { TalkInput } from "@/types/podcast";
import type { PodcastLayout } from "@conclavia/avatar-kit/types/podcast";
import { STUDIO_SCENARIOS } from "@/lib/podcast/studio-scenarios";

export const MAX_RUN_TURNS = 50;
export const DEFAULT_STUDIO_LAYOUT: PodcastLayout = "studio";
export const STUDIO_LAYOUT_IDS = STUDIO_SCENARIOS.map((scenario) => scenario.id);

export function isStudioLayout(value: unknown): value is PodcastLayout {
  return STUDIO_LAYOUT_IDS.some((layout) => layout === value);
}

/** Read compatibility only; input validation rejects explicitly unknown layouts. */
export function normalizeStudioLayout(value: unknown): PodcastLayout {
  return isStudioLayout(value) ? value : DEFAULT_STUDIO_LAYOUT;
}

export type TalkRunBlockCode =
  | "unassigned_participants"
  | "draft_talk";

export function getTalkRunBlockCode(
  talk: TalkInput,
): TalkRunBlockCode | undefined {
  if (talk.status !== "ready") return "draft_talk";
  if (talk.participants.some((participant) => participant.kind === "unassigned")) {
    return "unassigned_participants";
  }
  return undefined;
}

export function requiredTalkProviders(talk: TalkInput): LlmProvider[] {
  const providers = new Set<LlmProvider>();

  // The default provider also powers the off-air editorial desk, including
  // fully human casts.
  providers.add(getLlmModel(talk.settings.defaultModel).provider);

  for (const participant of talk.participants) {
    if (participant.kind === "ai") {
      providers.add(
        getLlmModel(participant.modelOverride ?? talk.settings.defaultModel)
          .provider,
      );
    }
  }

  if (talk.moderator.kind === "ai") {
    providers.add(
      getLlmModel(talk.moderator.modelOverride ?? talk.settings.defaultModel)
        .provider,
    );
  }

  return [...providers];
}
