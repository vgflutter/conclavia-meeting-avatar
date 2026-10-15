import type { Metadata } from "next";
import { PodcastStudio } from "@/components/podcast/PodcastStudio";
export const metadata: Metadata = { title: "Studio podcast · Anteprima" };
export default function PodcastPreviewPage() { return <PodcastStudio id="preview" preview />; }
