import type { MeetingLanguage } from "@/types/meeting";

export const CAPTION_LANGUAGE_MAX_ATTEMPTS = 3;

export function teamsCaptionLanguage(language: MeetingLanguage): "it-it" | "en-us" | undefined {
  return language === "it" ? "it-it" : language === "en" ? "en-us" : undefined;
}
