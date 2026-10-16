import type { Metadata } from "next";
import { PodcastStudio } from "@/components/podcast/PodcastStudio";
import { PodcastRehearsalInvitation } from "@/components/podcast/PodcastRehearsalInvitation";
import { normalizeStudioTheme } from "@/lib/podcast/studio-themes";
import { normalizeStudioScenario } from "@/lib/podcast/studio-scenarios";
export const metadata: Metadata = { title: "Studio podcast · Anteprima" };
export default async function PodcastPreviewPage({ searchParams }: { searchParams: Promise<{ style?: string | string[]; scenario?: string | string[] }> }) {
  const { style, scenario } = await searchParams;
  return <><PodcastRehearsalInvitation /><PodcastStudio id="preview" preview initialTheme={normalizeStudioTheme(style)} initialLayout={normalizeStudioScenario(scenario)} /></>;
}
