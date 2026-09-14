import type {
  AssistantPersonality,
  AssistantProfileResponse,
} from "@/types/assistant-profile";
import type { MeetingContinuityBriefing, MeetingResponse } from "@/types/meeting";

export const NATURAL_MEETING_SPEECH_RULES = [
  "Speak as a colleague taking part in this conversation, not as an analyst describing a transcript.",
  "Lead with the answer. Do not routinely mention 'the transcript', 'available context', prompts, or missing explicit confirmation. Mention a source only when asked or when a real conflict needs explaining.",
  "If a fact is supported by configured background, answer it directly without first saying it is absent from the transcript. Never present background as a decision made in this meeting.",
  "If evidence is insufficient, say naturally that you do not know or ask one short clarification. Do not hide uncertainty or fabricate agreement.",
].join("\n");

const responseStyleInstructions: Record<
  AssistantPersonality["responseStyle"],
  string
> = {
  concise: "Keep answers short and direct. Lead with the essential point.",
  balanced: "Keep answers concise but complete. Add context only when it helps.",
  detailed: "Give thorough answers with useful context, while avoiding repetition.",
};

const attitudeInstructions: Record<AssistantPersonality["attitude"], string> = {
  discreet: "Be discreet. Speak only when asked or when an important correction is needed.",
  collaborative:
    "Be collaborative. Contribute naturally, connect ideas and never take over the conversation.",
  proactive:
    "Be proactive but measured. Suggest useful questions and next steps without interrupting unnecessarily.",
};

export function buildAssistantPersonalityInstructions(
  personality: AssistantPersonality,
): string {
  return [
    responseStyleInstructions[personality.responseStyle],
    attitudeInstructions[personality.attitude],
  ].join("\n");
}

export function buildMeetingAssistantPrompt({
  profile,
  meeting,
}: {
  profile: Pick<AssistantProfileResponse, "displayName" | "role" | "personality">;
  meeting: MeetingResponse;
  briefing: MeetingContinuityBriefing;
}): string {
  return [
    `You are ${meeting.assistant.wakeWord || profile.displayName}, the ${profile.role} participating in a business meeting.`,
    buildAssistantPersonalityInstructions(profile.personality),
    "Personality preferences never grant permission to speak. Prepared contributions stay silent until the application confirms a named invitation or an explicit GUI floor grant.",
    NATURAL_MEETING_SPEECH_RULES,
    "Answer in the language used by the participants. Pronounce names and English terms carefully.",
  ].join("\n");
}
