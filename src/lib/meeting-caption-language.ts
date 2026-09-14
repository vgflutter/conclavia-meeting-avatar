import type { MeetingLanguage, MeetingResponse } from "@/types/meeting";

export const CAPTION_LANGUAGE_MAX_ATTEMPTS = 3;

export function teamsCaptionLanguage(language: MeetingLanguage): "it-it" | "en-us" | undefined {
  return language === "it" ? "it-it" : language === "en" ? "en-us" : undefined;
}

// No public Attendee read-back currently proves the language used by Teams.
// In particular, neither an HTTP acknowledgement nor transcript.language is
// evidence of application. Do not manufacture a "verified" state from them.
export function captionLanguageSetupStatus(bot: MeetingResponse["bot"]) {
  if (bot.provider !== "attendee" || bot.status !== "joined" || bot.leftAt || bot.stopRequestedAt) return undefined;
  if (!bot.captionLanguage) return "not_requested" as const;
  if (bot.captionLanguageRequestedAt) return "requested_unverified" as const;
  if ((bot.captionLanguageAttempts || 0) >= CAPTION_LANGUAGE_MAX_ATTEMPTS) return "request_failed" as const;
  return "request_pending" as const;
}
