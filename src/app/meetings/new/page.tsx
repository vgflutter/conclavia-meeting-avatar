import type { Metadata } from "next";
import Link from "next/link";

import { MeetingCreateForm } from "@/components/MeetingCreateForm";
import { getRequestLocale } from "@/i18n/server";
import { getMeetingAutomationPublicConfig } from "@/lib/meeting-bot-config";
import { getAssistantProfile } from "@/lib/assistant-profile";
import { Types } from "mongoose";
import { notFound } from "next/navigation";
import { connectToDatabase } from "@/lib/mongodb";
import { MeetingModel } from "@/models/Meeting";
import type { MeetingCreateInput } from "@/types/meeting";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return { title: locale === "it" ? "Nuovo meeting" : "New meeting" };
}

export default async function NewMeetingPage({searchParams}: {searchParams: Promise<{from?: string}>}) {
  const locale = await getRequestLocale();
  const isItalian = locale === "it";
  const automation = getMeetingAutomationPublicConfig();
  const profile = await getAssistantProfile();
  const { from } = await searchParams;
  let initialMeeting: Pick<MeetingCreateInput, "title" | "objective" | "meetingUrl" | "durationMinutes" | "timezone" | "language" | "agenda" | "correctionPolicy" | "seriesLabel"> | undefined;
  if (from) {
    if (!Types.ObjectId.isValid(from)) notFound();
    await connectToDatabase();
    const source = await MeetingModel.findById(from).select("title objective meetingUrl scheduledStart scheduledEnd timezone language agenda assistant.correctionPolicy seriesLabel").lean();
    if (!source) notFound();
    initialMeeting = { title: source.title, objective: source.objective || "", meetingUrl: source.meetingUrl,
      durationMinutes: Math.max(15, Math.round((source.scheduledEnd.getTime() - source.scheduledStart.getTime()) / 60_000)),
      timezone: source.timezone, language: source.language, agenda: source.agenda.map(({title, mandatory}) => ({title, mandatory})),
      correctionPolicy: source.assistant?.correctionPolicy || "important_only", seriesLabel: source.seriesLabel,
    };
  }

  return (
    <div className="container-page py-8 sm:py-12">
      <Link
        href="/meetings"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"
      >
        <span aria-hidden="true">←</span>
        {isItalian ? "Tutti i meeting" : "All meetings"}
      </Link>
      <div className="mb-7 max-w-3xl">
        <p className="section-kicker">
          {isItalian ? "Nuova programmazione" : "New schedule"}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          {isItalian ? "Aggiungi un meeting" : "Add a meeting"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
          {isItalian
            ? "Incolla il link Teams e scegli se entrare subito o all’orario stabilito. Per più appuntamenti, crea una serie con memoria condivisa."
            : "Paste the Teams link and choose whether to join now or at a scheduled time. For multiple appointments, create a series with shared memory."}
        </p>
      </div>
      {initialMeeting && <p className="mb-5 rounded-xl bg-[#edf4ef] p-4 text-sm text-[#295c43]">{isItalian ? "Scegli una nuova data. Verrà creato un nuovo appuntamento; quello originale resterà nello storico. Nessun ingresso viene avviato prima della conferma." : "Choose a new date. A new appointment will be created; the original stays in history. No meeting entry starts before you confirm."}</p>}
      <MeetingCreateForm automation={automation} assistantName={profile.displayName} initialMeeting={initialMeeting} />
    </div>
  );
}
