import type { Metadata } from "next";
import { PodcastStudio } from "@/components/podcast/PodcastStudio";
import { PodcastRehearsalInvitation } from "@/components/podcast/PodcastRehearsalInvitation";
import { normalizeStudioTheme } from "@/lib/podcast/studio-themes";
export const metadata: Metadata = { title: "Studio podcast · Anteprima" };
export default async function PodcastPreviewPage({ searchParams }: { searchParams: Promise<{ style?: string | string[] }> }) { const { style } = await searchParams; return <><PodcastRehearsalInvitation /><PodcastStudio id="preview" preview initialTheme={normalizeStudioTheme(style)} /></>; }
