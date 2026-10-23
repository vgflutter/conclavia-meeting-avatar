import { products, queueEdition, serializeJob } from '@/lib/tg/store';
import { editionId } from '@/lib/tg/config';
import { TgRunModel } from '@/models/tg/TgRun';
import { podcastMutationIsSameOrigin, readPodcastJson } from '@/lib/podcast/request-guard';
export const runtime = 'nodejs';
export async function GET() {
  try { await products(); const jobs = await TgRunModel.find().sort({ createdAt: -1 }).limit(30).lean(); return Response.json({ jobs: jobs.map(serializeJob) }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return Response.json({ error: 'Archivio TG non disponibile' }, { status: 503 }); }
}
export async function POST(request: Request) {
  if (!podcastMutationIsSameOrigin(request)) return Response.json({ error: 'Forbidden' }, { status: 403 });
  try { const body = await readPodcastJson(request, 300) as { edition: unknown }; if (!editionId(body.edition)) return Response.json({ error: 'Edizione non valida' }, { status: 400 });
    const settings = await products(), product = settings.find(x => x.product.edition === body.edition)!.product;
    const job = await queueEdition(product); return Response.json({ job: serializeJob(job.toObject()) }, { status: 201 });
  } catch { return Response.json({ error: 'Impossibile accodare l’edizione' }, { status: 503 }); }
}
