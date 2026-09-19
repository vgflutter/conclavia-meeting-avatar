import type { Metadata } from "next";
import { AvatarNavigation } from "@/components/AvatarNavigation";

import { StreamingVoiceTestStudio } from "@/components/StreamingVoiceTestStudio";
import { getRequestLocale } from "@/i18n/server";
import { meetingTtsConfig } from "@/lib/meeting-tts-config";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return { title: locale === "it" ? "Voce e movimenti" : "Voice & movement" };
}

export default async function AvatarTestPage() {
  const locale = await getRequestLocale();
  const isItalian = locale === "it";
  const tts = meetingTtsConfig();

  return (
    <div className="container-page py-8 sm:py-10">
      <header className="mb-6 max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight">
          {isItalian ? "Voce e movimenti" : "Voice & movement"}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {isItalian
            ? "Scegli l’aspetto e la voce del tuo avatar. Guarda come si muove, ascoltalo e salva le modifiche."
            : "Choose your avatar’s appearance and voice. See it move, listen and save your changes."}
        </p>
      </header>
      <AvatarNavigation active="test" locale={locale} />
      <StreamingVoiceTestStudio locale={locale} model={tts.model} configured={tts.ready} />
    </div>
  );
}
