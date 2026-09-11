import type { Metadata } from "next";
import { AvatarNavigation } from "@/components/AvatarNavigation";

import { StreamingVoiceTestStudio } from "@/components/StreamingVoiceTestStudio";
import { getRequestLocale } from "@/i18n/server";
import { getAssistantProfile } from "@/lib/assistant-profile";
import { meetingTtsConfig, selectedMeetingVoices } from "@/lib/meeting-tts-config";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return { title: locale === "it" ? "Prova avatar" : "Test avatar" };
}

export default async function AvatarTestPage() {
  const locale = await getRequestLocale();
  const isItalian = locale === "it";
  const profile = await getAssistantProfile();
  const tts = meetingTtsConfig();

  return (
    <div className="container-page py-10 sm:py-14">
      <header className="mb-8 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#295c43]">
          {isItalian ? "Prova avatar" : "Avatar test"}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          {isItalian ? "Ascolta, regola, scegli" : "Listen, adjust, choose"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
          {isItalian
            ? "Prova voce, velocità ed espressioni senza avviare un meeting. Le prove non cambiano le impostazioni finché non salvi."
            : "Try voices, speaking rate and expressions without starting a meeting. Preview changes stay unsaved until you save."}
        </p>
      </header>
      <AvatarNavigation active="test" locale={locale} />
      <StreamingVoiceTestStudio profile={profile} locale={locale} model={tts.model} configured={tts.ready} voices={selectedMeetingVoices(profile.voice, tts)} />
    </div>
  );
}
