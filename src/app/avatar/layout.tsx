import type { ReactNode } from "react";
import { AvatarWorkspace } from "@/components/AvatarWorkspace";
import { getAssistantProfile } from "@/lib/assistant-profile";
import { selectedMeetingVoices } from "@/lib/meeting-tts-config";

export const dynamic = "force-dynamic";

export default async function AvatarLayout({ children }: { children: ReactNode }) {
  const profile = await getAssistantProfile();
  return <AvatarWorkspace profile={profile} voices={selectedMeetingVoices(profile.voice)}>{children}</AvatarWorkspace>;
}
