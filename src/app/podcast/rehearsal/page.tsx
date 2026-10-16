import type { Metadata } from "next";
import { PodcastRehearsal } from "@/components/podcast/PodcastRehearsal";
import { normalizeStudioTheme } from "@/lib/podcast/studio-themes";

export const metadata: Metadata = { title: "Prova a due voci · Two-voice rehearsal" };
export default async function PodcastRehearsalPage({ searchParams }: { searchParams: Promise<{ style?: string | string[] }> }) { const { style } = await searchParams; return <PodcastRehearsal initialTheme={normalizeStudioTheme(style)} />; }
