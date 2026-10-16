import type { Metadata } from "next";
import { PodcastStudio } from "@/components/podcast/PodcastStudio";
import { PodcastRehearsalInvitation } from "@/components/podcast/PodcastRehearsalInvitation";
import { normalizeStudioTheme, normalizeStudioCast, normalizeStudioGuest, studioSelectionQuery } from "@/lib/podcast/studio-themes";
import { normalizeStudioScenario } from "@/lib/podcast/studio-scenarios";
export const metadata: Metadata = { title: "Studio podcast · Anteprima" };
export default async function PodcastPreviewPage({ searchParams }: { searchParams: Promise<{ style?: string | string[]; scenario?: string | string[]; cast?: string | string[]; guest?: string | string[] }> }) {
  const { style, scenario, cast, guest } = await searchParams;
  return <><PodcastRehearsalInvitation selectionQuery={studioSelectionQuery({ studioTheme: style, studioLayout: scenario, studioCast: cast, studioGuest: guest })} /><PodcastStudio id="preview" preview initialTheme={normalizeStudioTheme(style)} initialLayout={normalizeStudioScenario(scenario)} initialCast={normalizeStudioCast(cast)} initialGuest={normalizeStudioGuest(guest)} /></>;
}
