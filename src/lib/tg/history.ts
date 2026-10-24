import { TgRunModel } from '@/models/tg/TgRun';
import { TgDeliveryModel } from '@/models/tg/TgDelivery';
import { addCalendarDays } from './schedule';
import { TgEditorialError } from './editorial';
import type { TgEdition, TgJob, TgPublishedEdition } from './types';

type Receipt={jobId:string;state:string;updatedAt:Date|string};
export function publishedStories(job:TgJob){
 const speech=job.manifest?.cues??job.script?.sentences;
 if(!speech?.length)throw new TgEditorialError('Archivio pubblicato senza copione: confronto editoriale impossibile');
 const stories=[...new Set(speech.map(s=>s.storyId).filter(id=>!['intro','outro'].includes(id)))].map(storyId=>({
  key:`${job.id}:${storyId}`,
  headline:job.manifest?.stories?.find(s=>s.id===storyId)?.headline??job.script?.headlines?.find(h=>h.storyId===storyId)?.title??job.research?.stories.find(s=>s.id===storyId)?.headline??storyId,
  claims:speech.filter(s=>s.storyId===storyId).map(s=>s.text),
  development:job.audit?.freshness?.checks?.find(c=>c.storyId===storyId)?.development,
 }));
 if(!stories.length)throw new TgEditorialError('Archivio pubblicato senza fatti confrontabili');return stories;
}
/** Only confirmed published speech enters memory; research drafts never count as aired. */
export function publishedHistory(jobs:TgJob[],receipts:Receipt[],now:Date):TgPublishedEdition[] {
  return jobs.flatMap(job=>{
    const publishedReceipts=receipts.filter(r=>r.jobId===job.id&&r.state==='published');
    const delivered=publishedReceipts.length>0||job.deliveries?.some(d=>d.state==='published')||Boolean(job.sitePublication);
    if(job.state!=='published'&&!delivered)return [];
    const times=[job.publishedAt,job.sitePublication?.publishedAt,...publishedReceipts.map(r=>new Date(r.updatedAt).toISOString())].filter((s):s is string=>Boolean(s)).map(Date.parse);
    if(!times.length||times.some(t=>!Number.isFinite(t)||t>now.getTime()))throw new TgEditorialError('Data di un’uscita pubblicata non verificabile');
    if(job.sitePublication&&!job.sitePublication.stories?.length)throw new TgEditorialError('Archivio sito senza snapshot del testo pubblicato');
    const stories=job.sitePublication?.stories??publishedStories(job);
    if(!stories.length)throw new TgEditorialError('Archivio pubblicato senza fatti confrontabili');
    return [{id:job.id,edition:job.edition,date:job.date,publishedAt:new Date(Math.min(...times)).toISOString(),stories}];
  }).sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
}
export async function loadPublishedHistory(edition:TgEdition,date:string,now=new Date()):Promise<TgPublishedEdition[]> {
  const records=await TgRunModel.find({edition,date:{$lt:date,$gte:addCalendarDays(date,-7)}})
    .select('_id edition date state publishedAt sitePublication deliveries research.stories script.sentences script.headlines manifest.cues manifest.stories audit.freshness.checks').sort({date:-1}).limit(7).lean();
  const ids=records.map(r=>r._id.toString());
  const receipts=await TgDeliveryModel.find({jobId:{$in:ids},state:'published'}).select('jobId state updatedAt').lean();
  const history=publishedHistory(records.map(r=>({...r,id:r._id.toString()})) as unknown as TgJob[],receipts,now);
  if(Buffer.byteLength(JSON.stringify(history))>180000)throw new TgEditorialError('Archivio settimanale troppo grande: confronto incompleto non consentito');
  return history;
}
