import { videoTopicSelection } from "@/lib/podcast/video-topic";
import type { Metadata } from "next";
import { PodcastRehearsal } from "@/components/podcast/PodcastRehearsal";
import { normalizeStudioTheme, normalizeStudioCast, normalizeStudioGuest } from "@/lib/podcast/studio-themes";
import { normalizeStudioScenario } from "@/lib/podcast/studio-scenarios";

export const metadata: Metadata = { title: "Prova a due voci · Two-voice rehearsal" };
export default async function PodcastRehearsalPage({ searchParams }: { searchParams: Promise<{ style?: string | string[]; scenario?: string | string[]; cast?: string | string[]; guest?: string | string[]; topicMode?: string | string[]; topicText?: string | string[] }> }) {
  const { style, scenario, cast, guest, topicMode, topicText } = await searchParams;
  return <PodcastRehearsal initialTopic={videoTopicSelection({ topicMode, topicText })} initialTheme={normalizeStudioTheme(style)} initialLayout={normalizeStudioScenario(scenario)} initialCast={normalizeStudioCast(cast)} initialGuest={normalizeStudioGuest(guest)} />;
}
