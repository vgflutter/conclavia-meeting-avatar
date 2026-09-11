import { notFound } from "next/navigation";

import { MeetingOutputSurface } from "@/components/MeetingOutputSurface";
import { getRequestLocale } from "@/i18n/server";
import { getAssistantProfile } from "@/lib/assistant-profile";
import { connectToDatabase } from "@/lib/mongodb";
import { MeetingModel } from "@/models/Meeting";
import { publicMeetingTtsConfig } from "@/lib/meeting-tts-config";

export const dynamic = "force-dynamic";

export default async function MeetingRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ mode?: string | string[]; attempt?: string | string[] }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const locale = await getRequestLocale();
  await connectToDatabase();
  const meeting = await MeetingModel.findOne({ "bot.outputToken": token }).exec();
  if (!meeting) notFound();
  const profile = await getAssistantProfile();

  return (
    <MeetingOutputSurface
      outputToken={token}
      outputAttemptId={query.mode === "meeting" && typeof query.attempt === "string" && query.attempt === meeting.bot.entryAttemptId ? query.attempt : undefined}
      initialStatus={meeting.status}
      initialCommandId={meeting.commandHistory.at(-1)?.id}
      initialInterventionId={meeting.pendingIntervention?.id}
      displayName={meeting.assistant.wakeWord || profile.displayName}
      role={profile.role}
      appearance={profile.appearance}
      locale={locale}
      inMeeting={query.mode === "meeting"}
      meetingProvider={meeting.bot.provider}
      tts={publicMeetingTtsConfig()}
    />
  );
}
