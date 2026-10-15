import { PodcastStudio } from "@/components/podcast/PodcastStudio";
export default async function PodcastStudioPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <PodcastStudio id={id} />; }
