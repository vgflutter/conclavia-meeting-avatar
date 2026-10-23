import { products, serializeJob } from '@/lib/tg/store';
import { publicationControl, setPublicationPaused, TgNewsroomError } from '@/lib/tg/newsroom';
import { tgReadiness } from '@/lib/tg/readiness';
import { TgRunModel } from '@/models/tg/TgRun';
import { TgWorkerModel } from '@/models/tg/TgWorker';
import { TgChannelCheckModel } from '@/models/tg/TgChannelCheck';
import { channelDestination } from '@/lib/tg/review';
import { scheduleCalendar } from '@/lib/tg/schedule';
import { podcastMutationIsSameOrigin, readPodcastJson, PodcastRequestError } from '@/lib/podcast/request-guard';
export const runtime='nodejs';
export async function GET(){
  try{
    const editions=await products();
    const [records,worker,control,channelChecks]=await Promise.all([
      TgRunModel.find().select('-manifest -research -script -audit -events -finalReview').sort({createdAt:-1}).limit(60).lean(),
      TgWorkerModel.findOne().sort({heartbeatAt:-1}).select('heartbeatAt phase jobId lastErrorAt').lean(),publicationControl(),TgChannelCheckModel.find().lean(),
    ]);
    const online=Boolean(worker&&Date.now()-worker.heartbeatAt.getTime()<90000);
    const jobs=records.map(serializeJob),now=new Date();
    return Response.json({editions:editions.map(e=>{const readiness=tgReadiness(e.product),checks=readiness.checks.map(c=>c.id==='worker'?{...c,ready:c.ready&&online}:c);return {...e,readiness:{...readiness,checks,productionReady:checks.every(c=>c.ready)&&readiness.channels.every(c=>c.ready)}};}),jobs,calendar:scheduleCalendar(editions.map(e=>e.product),jobs,now),control,worker:{online,lastSeen:worker?.heartbeatAt.toISOString(),phase:worker?.phase,jobId:worker?.jobId,lastErrorAt:worker?.lastErrorAt?.toISOString()},channelChecks:channelChecks.filter(c=>c.destination===channelDestination(c.edition as 'it'|'world',c.platform as 'youtube'|'instagram'|'tiktok'|'spotify')).map(c=>({edition:c.edition,platform:c.platform,ok:c.ok,label:c.label,checkedAt:c.checkedAt})),now:now.toISOString()},{headers:{'Cache-Control':'no-store'}});
  }catch{return Response.json({error:'Redazione non disponibile'},{status:503});}
}
export async function POST(request:Request){
  if(!podcastMutationIsSameOrigin(request))return Response.json({error:'Forbidden'},{status:403});
  try{const body=await readPodcastJson(request,500) as {paused:unknown;revision:number};if(typeof body.paused!=='boolean')throw new TgNewsroomError('Controllo non valido',400);await products();return Response.json({control:await setPublicationPaused(body.paused,body.revision)});}
  catch(error){return Response.json({error:error instanceof TgNewsroomError||error instanceof PodcastRequestError?error.message:'Controllo non disponibile'},{status:error instanceof TgNewsroomError||error instanceof PodcastRequestError?error.status:503});}
}
