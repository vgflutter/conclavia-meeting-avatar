import { PodcastEditor } from "@/components/podcast/PodcastEditor";
export default async function EditPodcastPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <PodcastEditor id={id} />; }
