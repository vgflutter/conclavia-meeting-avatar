import { PodcastBroadcast } from "@/components/podcast/PodcastBroadcast";
export default async function PodcastBroadcastPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <PodcastBroadcast id={id} />; }
