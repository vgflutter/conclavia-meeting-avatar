import type { Metadata } from "next";
import { PodcastEditor } from "@/components/podcast/PodcastEditor";
export const metadata: Metadata = { title: "Nuovo podcast · New podcast" };
export default function NewPodcastPage() { return <PodcastEditor />; }
