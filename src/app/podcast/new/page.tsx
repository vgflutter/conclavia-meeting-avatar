import type { Metadata } from "next";
import { PodcastEditor } from "@/components/podcast/PodcastEditor";
import { normalizeStudioTheme, normalizeStudioCast, normalizeStudioGuest } from "@/lib/podcast/studio-themes";
import { normalizeStudioScenario } from "@/lib/podcast/studio-scenarios";
export const metadata: Metadata = { title: "Nuovo podcast · New podcast" };
export default async function NewPodcastPage({ searchParams }: { searchParams: Promise<{ style?: string | string[]; scenario?: string | string[]; cast?: string | string[]; guest?: string | string[] }> }) {
  const { style, scenario, cast, guest } = await searchParams;
  return <PodcastEditor initialTheme={normalizeStudioTheme(style)} initialLayout={normalizeStudioScenario(scenario)} initialCast={normalizeStudioCast(cast)} initialGuest={normalizeStudioGuest(guest)} />;
}
