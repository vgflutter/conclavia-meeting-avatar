import { connectToDatabase } from '@/lib/mongodb';
import { TgRunModel } from '@/models/tg/TgRun';
import { assetResponse } from '@/lib/tg/asset-response';
import { serializeJob } from '@/lib/tg/store';
import { approvalIsBound } from '@/lib/tg/review';
export const runtime = 'nodejs';
/** Public video capability only: never scripts, sources, job listings or unpublished drafts. */
export async function GET(request: Request, context: {params: Promise<{capability: string; name: string}>}) {
  const { capability, name } = await context.params;
  if (!/^[a-f\d]{64}$/u.test(capability) || !['landscape.mp4', 'portrait.mp4'].includes(name)) return new Response('Not found', { status: 404 });
  try { await connectToDatabase(); const job = await TgRunModel.findOne({ mediaCapability: capability, state: { $in: ['ready', 'publishing', 'published'] }, approvedAt: { $gte: new Date(Date.now() - 7 * 86400000).toISOString() }, 'audit.passed': true }).select('-events').lean();
    if (!job || !approvalIsBound(serializeJob(job)) || !job.assets.some(a => a.name === name)) return new Response('Not found', { status: 404 });
    return await assetResponse(job._id.toString(), name, request, true);
  } catch { return new Response('Not found', { status: 404 }); }
}
export const HEAD = GET;
