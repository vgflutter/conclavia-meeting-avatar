import type { Metadata } from "next";
import { PodcastLibrary } from "@/components/podcast/PodcastLibrary";
export const metadata: Metadata = { title: "Podcast" };
export default function PodcastPage() { return <PodcastLibrary />; }
