import type { Metadata } from "next";
import { PodcastStylesGallery } from "@/components/podcast/PodcastStylesGallery";
import { normalizeStudioTheme } from "@/lib/podcast/studio-themes";

export const metadata: Metadata = { title: "Stili e scenari · Styles & scenes" };
export default async function PodcastStylesPage({ searchParams }: { searchParams: Promise<{ style?: string | string[] }> }) {
  const { style } = await searchParams;
  return <PodcastStylesGallery initialTheme={normalizeStudioTheme(style)} />;
}
