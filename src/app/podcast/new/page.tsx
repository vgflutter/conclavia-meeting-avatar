import type { Metadata } from "next";
import { PodcastEditor } from "@/components/podcast/PodcastEditor";
import { normalizeStudioTheme } from "@/lib/podcast/studio-themes";
import { normalizeStudioScenario } from "@/lib/podcast/studio-scenarios";
export const metadata: Metadata = { title: "Nuovo podcast · New podcast" };
export default async function NewPodcastPage({ searchParams }: { searchParams: Promise<{ style?: string | string[]; scenario?: string | string[] }> }) {
  const { style, scenario } = await searchParams;
  return <PodcastEditor initialTheme={normalizeStudioTheme(style)} initialLayout={normalizeStudioScenario(scenario)} />;
}
