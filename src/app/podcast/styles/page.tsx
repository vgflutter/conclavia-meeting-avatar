import type { Metadata } from "next";
import { PodcastStylesGallery } from "@/components/podcast/PodcastStylesGallery";
import { normalizeStudioTheme } from "@/lib/podcast/studio-themes";
import { normalizeStudioScenario } from "@/lib/podcast/studio-scenarios";

export const metadata: Metadata = { title: "Stili e scenari · Styles & scenes" };
export default async function PodcastStylesPage({ searchParams }: { searchParams: Promise<{ style?: string | string[]; scenario?: string | string[] }> }) {
  const { style, scenario } = await searchParams;
  return <PodcastStylesGallery initialTheme={normalizeStudioTheme(style)} initialScenario={normalizeStudioScenario(scenario)} />;
}
