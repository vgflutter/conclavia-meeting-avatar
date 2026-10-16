import type { Metadata } from "next";
import { PodcastRehearsal } from "@/components/podcast/PodcastRehearsal";

export const metadata: Metadata = { title: "Prova a due voci · Two-voice rehearsal" };
export default function PodcastRehearsalPage() { return <PodcastRehearsal />; }
