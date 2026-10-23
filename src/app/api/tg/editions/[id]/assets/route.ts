import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { TgRunModel } from '@/models/tg/TgRun';
import { assetResponse, isAssetName } from '@/lib/tg/asset-response';
export const runtime = 'nodejs';
export async function GET(request: Request, context: {params: Promise<{id: string}>}) {
  const { id } = await context.params, name = new URL(request.url).searchParams.get('name') ?? '';
  if (!Types.ObjectId.isValid(id) || !isAssetName(name)) return new Response('Not found', { status: 404 });
  try { await connectToDatabase(); const job = await TgRunModel.findById(id).select('assets').lean(); if (!job?.assets.some(a => a.name === name)) return new Response('Not found', { status: 404 }); return await assetResponse(id, name, request); }
  catch { return new Response('Not found', { status: 404 }); }
}
export const HEAD = GET;
