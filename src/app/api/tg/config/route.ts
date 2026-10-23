import { TgWorkerModel } from '@/models/tg/TgWorker';
import { products } from '@/lib/tg/store';
import { tgReadiness } from '@/lib/tg/readiness';
import { parseProduct } from '@/lib/tg/config';
import { podcastMutationIsSameOrigin, readPodcastJson } from '@/lib/podcast/request-guard';
import { TgEditionModel } from '@/models/tg/TgEdition';
export const runtime = 'nodejs';
async function readinessFor(product: Parameters<typeof tgReadiness>[0]) {
  const readiness=tgReadiness(product);
  const worker=await TgWorkerModel.exists({heartbeatAt:{$gte:new Date(Date.now()-90000)}});
  const checks=readiness.checks.map(c=>c.id==='worker'?{...c,ready:c.ready&&Boolean(worker)}:c);
  return {...readiness,checks,productionReady:checks.every(c=>c.ready)&&readiness.channels.every(c=>c.ready)};
}
export async function GET() {
  try { const editions = await products(); return Response.json({ editions: await Promise.all(editions.map(async x=>({...x,readiness:await readinessFor(x.product)}))) }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return Response.json({ error: 'Configurazione TG non disponibile' }, { status: 503 }); }
}
export async function PUT(request: Request) {
  if (!podcastMutationIsSameOrigin(request)) return Response.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const body = await readPodcastJson(request, 4000) as { product: unknown; revision: number };
    const product = parseProduct(body.product);
    if (!Number.isInteger(body.revision) || body.revision < 0) throw new Error('Versione non valida');
    await products();
    // The Daily controller enables the reviewers only inside its scoped child job.
    const scopedDaily=product.productionStandard==='cdaily-v1'&&product.publicationDriver==='chatgpt-work';
    if (product.automatic && !scopedDaily && process.env.TG_AUTOMATIC_REVIEW_ENABLED !== 'true') return Response.json({error:'Il revisore finale AI non è abilitato sul server. La modalità assistita richiede ancora una revisione umana.'},{status:409});
    const record = await TgEditionModel.findOneAndUpdate({ edition: product.edition, revision: body.revision }, { $set: { product, updatedAt: new Date() }, $inc: { revision: 1 } }, { upsert: body.revision === 0, returnDocument: 'after' });
    if (!record) return Response.json({ error: 'Configurazione cambiata: ricarica prima di salvare' }, { status: 409 });
    return Response.json({ product, revision: record.revision, readiness: tgReadiness(product) });
  } catch (error) { return Response.json({ error: (error as {code?: number}).code === 11000 ? 'Configurazione cambiata: ricarica' : 'Configurazione TG non valida' }, { status: (error as {code?: number}).code === 11000 ? 409 : 400 }); }
}
