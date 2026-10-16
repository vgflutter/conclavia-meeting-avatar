import type { Metadata } from "next";
import { PodcastEditor } from "@/components/podcast/PodcastEditor";
import { normalizeStudioTheme } from "@/lib/podcast/studio-themes";
export const metadata: Metadata = { title: "Nuovo podcast · New podcast" };
export default async function NewPodcastPage({ searchParams }: { searchParams: Promise<{ style?: string | string[] }> }) { const { style } = await searchParams; return <PodcastEditor initialTheme={normalizeStudioTheme(style)} />; }
