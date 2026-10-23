import { videoTopicSelection } from "@/lib/podcast/video-topic";
import type { Metadata } from "next";
import { PodcastStylesGallery } from "@/components/podcast/PodcastStylesGallery";
import { normalizeStudioTheme, normalizeStudioCast, normalizeStudioGuest } from "@/lib/podcast/studio-themes";
import { normalizeStudioScenario } from "@/lib/podcast/studio-scenarios";

export const metadata: Metadata = { title: "Stili e scenari · Styles & scenes" };
export default async function PodcastStylesPage({ searchParams }: { searchParams: Promise<{ style?: string | string[]; scenario?: string | string[]; cast?: string | string[]; guest?: string | string[]; topicMode?: string | string[]; topicText?: string | string[] }> }) {
  const { style, scenario, cast, guest, topicMode, topicText } = await searchParams;
  return <PodcastStylesGallery initialTopic={videoTopicSelection({ topicMode, topicText })} initialTheme={normalizeStudioTheme(style)} initialScenario={normalizeStudioScenario(scenario)} initialCast={normalizeStudioCast(cast)} initialGuest={normalizeStudioGuest(guest)} />;
}
