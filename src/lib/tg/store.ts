import { randomBytes, randomUUID } from 'node:crypto';
import { connectToDatabase } from '../mongodb';
import { TgEditionModel } from '../../models/tg/TgEdition';
import { TgRunModel } from '../../models/tg/TgRun';
import { TG_PRODUCTS, localEditionDate } from './config';
import { editionSlot } from './schedule';
import type { TgJob, TgProduct, TgState } from './types';
export function serializeJob(record: unknown): TgJob {
  const raw = record as TgJob & { _id: {toString(): string}; createdAt: Date; updatedAt: Date };
  // Whitelist: never return leases, publisher sessions, or media capabilities.
  return JSON.parse(JSON.stringify({ id: raw._id.toString(), edition: raw.edition, date: raw.date, state: raw.state, product: raw.product, research: raw.research, script: raw.script, audit: raw.audit, scriptReview:raw.scriptReview,editorialRepairs:raw.editorialRepairs??0,durationRepairs:raw.durationRepairs??0, manifest: raw.manifest, assets: raw.assets ?? [], issues: raw.issues ?? [], events: (raw.events ?? []).slice(-50), approvedAt: raw.approvedAt, publishedAt: raw.publishedAt, attempts: raw.attempts, deliveries: (raw.deliveries??[]).map(d=>({platform:d.platform,state:d.state,remoteId:d.remoteId,url:d.url,issue:d.issue,attempts:d.attempts,nextAttemptAt:d.nextAttemptAt,resumable:d.resumable})), revision: raw.revision ?? 0, publicationPlan: raw.publicationPlan, review: raw.review, finalReview: raw.finalReview, nextProductionAttemptAt: raw.nextProductionAttemptAt, createdAt: raw.createdAt, updatedAt: raw.updatedAt }));
}
export async function products() {
  await connectToDatabase(); const saved = await TgEditionModel.find().lean();
  return TG_PRODUCTS.map(base => { const record = saved.find(x => x.edition === base.edition); return { product: record?.product ?? base, revision: record?.revision ?? 0 }; });
}
export async function queueEdition(product: TgProduct, now = new Date(), date = localEditionDate(now, product.timezone)) {
  await connectToDatabase();
  const prepareAt=editionSlot(product,date).prepareAt;
  const defer=product.automatic&&Date.parse(prepareAt)>now.getTime();
  await TgRunModel.init();
  try { return await TgRunModel.findOneAndUpdate({ edition: product.edition, date }, { $setOnInsert: { edition: product.edition, date, product, state: 'queued', ...(defer?{nextProductionAttemptAt:prepareAt}:{}), mediaCapability: randomBytes(32).toString('hex'), events: [{ at: now.toISOString(), stage: 'queued', detail: defer?'Edizione prenotata; preparazione nella finestra giornaliera, configurazione congelata':'Edizione accodata; configurazione congelata' }] } }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }).orFail(); }
  catch (error) { if ((error as {code?: number}).code === 11000) return TgRunModel.findOne({ edition: product.edition, date }).orFail(); throw error; }
}
export const ACTIVE_STATES = ['researching', 'writing', 'verifying', 'voicing', 'rendering', 'reviewing'];
export async function claimJob(now = new Date(), jobId?: string) {
  await connectToDatabase();
  const owner = randomUUID();
  const run = await TgRunModel.findOneAndUpdate({ ...(jobId ? {_id:jobId} : {}), state: { $in: ['queued', ...ACTIVE_STATES] }, $and:[{$or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lt: now } }]},{$or:[{publicationLeaseUntil:{$exists:false}},{publicationLeaseUntil:{$lt:now}}]},{$or:[{nextProductionAttemptAt:{$exists:false}},{nextProductionAttemptAt:{$lte:now.toISOString()}}]}], attempts: { $lt: 3 } }, { $set: { leaseOwner: owner, leaseUntil: new Date(now.getTime() + 120000) }, $unset:{nextProductionAttemptAt:1}, $inc: { attempts: 1 } }, { sort: { createdAt: 1 }, returnDocument: 'after' });
  return run ? { run, owner } : undefined;
}
export async function checkpoint(id: string, owner: string, state: TgState, data: Partial<TgJob> = {}, detail: string = state) {
  const now = new Date();
  const result = await TgRunModel.updateOne({ _id: id, leaseOwner: owner, leaseUntil: { $gt: now } }, { $set: { ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)), state }, $inc: {revision:1}, ...(Object.values(data).some(value => value === undefined) ? { $unset: Object.fromEntries(Object.entries(data).filter(([, value]) => value === undefined).map(([key]) => [key, 1])) } : {}), $push: { events: { $each: [{ at: now.toISOString(), stage: state, detail }], $slice: -50 } } });
  if (!result.matchedCount) throw new Error('Lease TG persa');
}
export async function renewLease(id: string, owner: string) {
  return (await TgRunModel.updateOne({ _id: id, leaseOwner: owner, leaseUntil: { $gt: new Date() } }, { $set: { leaseUntil: new Date(Date.now() + 120000) } })).matchedCount === 1;
}
