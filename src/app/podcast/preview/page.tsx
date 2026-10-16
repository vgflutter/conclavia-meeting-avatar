import type { Metadata } from "next";
import { PodcastStudio } from "@/components/podcast/PodcastStudio";
import { PodcastRehearsalInvitation } from "@/components/podcast/PodcastRehearsalInvitation";
export const metadata: Metadata = { title: "Studio podcast · Anteprima" };
export default function PodcastPreviewPage() { return <><PodcastRehearsalInvitation /><PodcastStudio id="preview" preview /></>; }
