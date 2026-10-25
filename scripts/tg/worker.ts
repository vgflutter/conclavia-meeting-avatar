import { randomUUID } from 'node:crypto';
import { TgWorkerModel } from '../../src/models/tg/TgWorker';
import { connectToDatabase } from '../../src/lib/mongodb';
import { TgRunModel } from '../../src/models/tg/TgRun';
import { claimJob, checkpoint, products, queueEdition, renewLease, serializeJob, ACTIVE_STATES } from '../../src/lib/tg/store';
import { localEditionDate } from '../../src/lib/tg/config';
import { dueSlot, editionSlot } from '../../src/lib/tg/schedule';
import { reviewFinalVideo } from '../../src/lib/tg/final-review';
import { researchAndCorroborateEdition, writeEdition, retrieveAuditEvidence, judgeEdition, reviewEditionScript } from '../../src/lib/tg/agents';
import { synthesize, renderMedia } from '../../src/lib/tg/media';
import { publicPodcastSpeechConfig } from '../../src/lib/podcast/speech';
import { produceTg } from '../../src/lib/tg/pipeline';
import { loadPublishedHistory } from '../../src/lib/tg/history';
import { scriptReviewInputDigest } from '../../src/lib/tg/script-review';
import { TgEditorialError } from '../../src/lib/tg/editorial';
import { publishReadyTg } from '../../src/lib/tg/publishing';
import { saveEditionTexts } from '../../src/lib/tg/edition-text-files';
import { tgSpeechPlan } from '../../src/lib/tg/speech-plan';
import { alex2Config, alex2ConfigDigest } from '../../src/lib/tg/alex2-config';
const workerName = randomUUID();
const once = process.argv.includes('--once');
const jobId=process.argv.find(arg=>arg.startsWith('--job='))?.slice(6);
const approvedDaily=process.argv.includes('--approved-daily');
const noSchedule=process.argv.includes('--no-schedule');
const noPublish=process.argv.includes('--no-publish');
if(jobId&&!/^[a-f\d]{24}$/u.test(jobId))throw new Error('Id TG non valido');
if(approvedDaily&&(!jobId||!noSchedule||!noPublish||!once))throw new Error('Il runner Daily deve essere isolato per edizione e senza publisher');
let phase:'idle'|'producing'|'degraded'='idle',activeJob:string|undefined,lastErrorAt:Date|undefined;
const shutdown = new AbortController(); process.on('SIGTERM', () => shutdown.abort()); process.on('SIGINT', () => shutdown.abort());
if (process.env.TG_WORKER_ENABLED !== 'true') throw new Error('TG_WORKER_ENABLED non abilitato');
async function tick() {
  await connectToDatabase(); const now = new Date();
  // A dead worker must not leave a fourth silent retry or a permanently running job.
  await TgRunModel.updateMany({ ...(jobId?{_id:jobId}:{}), state: { $in: ['queued',...ACTIVE_STATES] }, $or:[{leaseUntil:{$lt:now}},{leaseUntil:{$exists:false}}], attempts: { $gte: 3 } }, { $set: { state: 'failed', issues: ['Tre tentativi esauriti; controllare il worker'] }, $inc:{revision:1},$push:{events:{$each:[{at:now.toISOString(),stage:'failed',detail:'Tentativi esauriti dopo un’interruzione del worker'}],$slice:-50}} });
  for (const { product } of noSchedule?[]:await products()) { const slot=dueSlot(product,now);if(slot)await queueEdition(product,now,slot.date); }
  const claim = await claimJob(now,jobId);
  if (claim) {
    const { run, owner } = claim, id = run._id.toString();
    const requiresApprovedDaily=approvedDaily||run.product.productionStandard==='cdaily-v1';
    phase='producing';activeJob=id;
    const controller = new AbortController(), signal = AbortSignal.any([controller.signal, shutdown.signal]);
    let renewing = false;
    const heartbeat = setInterval(() => { if (renewing) return; renewing = true; void renewLease(id, owner).then(ok => { if (!ok) controller.abort(); }).catch(() => controller.abort()).finally(() => { renewing = false; }); }, 30000);
    try {
      const slot=editionSlot(run.product,run.date);
      if (run.date !== localEditionDate(now, run.product.timezone) && !(now.getTime()>=Date.parse(slot.prepareAt)&&now.getTime()<=Date.parse(slot.closesAt))) {
        await checkpoint(id,owner,'blocked',{issues:['Edizione scaduta: generare quella di oggi']},'Edizione fuori data: nessuna produzione tardiva');return;
      }
      if(run.product.automatic&&now.getTime()>Date.parse(slot.closesAt)){
        await checkpoint(id,owner,'blocked',{issues:['Finestra di uscita superata: nessuna produzione automatica tardiva']},'Scheduler: finestra giornaliera chiusa');return;
      }
      if(run.product.automatic&&process.env.TG_AUTOMATIC_REVIEW_ENABLED!=='true'){
        await checkpoint(id,owner,'blocked',{issues:['Revisore finale AI non abilitato: nessuna approvazione sostitutiva umana']},'Edizione autonoma fermata prima di consumare chiamate AI');return;
      }
      const voice = requiresApprovedDaily?undefined:await publicPodcastSpeechConfig();
      if (!requiresApprovedDaily&&!voice?.providers.inworld) throw new Error('Voci Inworld dell’edizione non disponibili: controllare il servizio configurato');
      if (process.env.TG_AI_ENABLED !== 'true' || process.env.PODCAST_AI_ENABLED !== 'true') throw new Error('TG AI non abilitata');
      const previous = await loadPublishedHistory(run.edition,run.date,new Date());
      let evidence:{value:Awaited<ReturnType<typeof retrieveAuditEvidence>>;at:number;key:string}|undefined;
      const getEvidence=async(r:Parameters<typeof judgeEdition>[1],s:Parameters<typeof judgeEdition>[2])=>{
        const key=scriptReviewInputDigest(run.product,run.date,r,s);
        if(!evidence||evidence.key!==key||Date.now()-evidence.at>30*60000)evidence={key,value:await retrieveAuditEvidence(r,s,signal),at:Date.now()};
        return evidence.value;
      };
      const requireApprovedVoice=()=>{if(requiresApprovedDaily){if(tgSpeechPlan(run.product).provider!=='elevenlabs')throw new TgEditorialError('Identità Alex 2 richiesta: nessuna sostituzione della voce approvata');alex2Config();}};
      await produceTg(serializeJob(run.toObject()), JSON.stringify(previous), {
        editorialOnly:process.env.TG_EDITORIAL_ONLY==='true',
        editorialReady:async job=>{await saveEditionTexts(job);},
        research: prior => researchAndCorroborateEdition(run.product, now, prior, signal),
        write: (r, correction) => writeEdition(run.product, r, signal, correction,run.date),
        audit: async (r,s)=>judgeEdition(run.product,r,s,await getEvidence(r,s),signal,previous),
        reviewScript:async(r,s)=>reviewEditionScript(run.product,run.date,r,s,await getEvidence(r,s),signal),
        voiceConfigurationSha256:()=>alex2ConfigDigest(alex2Config()),
        voice: async (r, s) => {
          const current=await TgRunModel.findById(id).lean().orFail();
          await saveEditionTexts({...serializeJob(current),research:r,script:s});
          requireApprovedVoice();
          return synthesize(id,run.product,run.date,r,s,signal,{textApproval:current.textApproval});
        }, render: async m => {
          const current=await TgRunModel.findById(id).lean().orFail();
          await saveEditionTexts(serializeJob(current));
          requireApprovedVoice();
          return renderMedia(id,m,signal);
        },
        finalReview: job=>reviewFinalVideo(job,signal),
        checkpoint: (state, data, detail) => checkpoint(id, owner, state, data, detail),
      });
      const completed=await TgRunModel.findById(id).select('state').lean();
      console.log(JSON.stringify({ event: 'tg_finished', job: id, edition: run.edition, state:completed?.state }));
    } catch (error) {
      const detail = error instanceof Error ? error.message.slice(0, 300) : 'Produzione TG non riuscita';
      const editorialStop=error instanceof TgEditorialError;
      if(!editorialStop)lastErrorAt=new Date();
      phase=editorialStop?'idle':'degraded';
      if(!signal.aborted){
        const retry=!editorialStop&&run.attempts<3,nextAt=new Date(Date.now()+60000*2**run.attempts).toISOString();
        await checkpoint(id, owner, editorialStop?'blocked':retry?'queued':'failed', { issues: [detail], nextProductionAttemptAt:retry?nextAt:undefined, ...(editorialStop?{manifest:undefined,assets:[],finalReview:undefined,review:undefined,approvedAt:undefined,publicationPlan:undefined}:{}) }, retry?`Errore tecnico; nuovo tentativo ${run.attempts+1}/3 alle ${nextAt}`:detail).catch(() => undefined);
      }
      console.error(JSON.stringify({ event: editorialStop?'tg_editorial_blocked':'tg_failed', job: id, issue: detail }));
    } finally { activeJob=undefined;if(phase!=='degraded')phase='idle';clearInterval(heartbeat); await TgRunModel.updateOne({ _id: id, leaseOwner: owner }, { $unset: { leaseOwner: 1, leaseUntil: 1 } }); }
  }
}
async function main() {
await connectToDatabase();
let beating = false;
async function beat() { if (beating) return; beating = true; try { await TgWorkerModel.updateOne({name:workerName},{$set:{heartbeatAt:new Date(),phase,...(activeJob?{jobId:activeJob}:{}),...(lastErrorAt?{lastErrorAt}:{})},...(!activeJob?{$unset:{jobId:1}}:{})},{upsert:true}); } finally { beating=false; } }
await beat();const workerHeartbeat=setInterval(()=>void beat().catch(()=>undefined),30000);
let publication:Promise<void>|undefined;
function dispatch(){if(!noPublish&&!publication&&!shutdown.signal.aborted)publication=publishReadyTg(shutdown.signal).catch(()=>{console.error(JSON.stringify({event:'tg_distribution_unavailable'}));}).finally(()=>{publication=undefined;});}
const publisher=once?undefined:setInterval(dispatch,15000);
try {
dispatch();
do { try { await tick();dispatch(); } catch { phase='degraded';lastErrorAt=new Date();console.error(JSON.stringify({ event: 'tg_worker_unavailable' })); if (once) process.exitCode = 1; } if (!once && !shutdown.signal.aborted) await new Promise<void>(resolve => { const finish=()=>{clearTimeout(timer);shutdown.signal.removeEventListener('abort',finish);resolve();};const timer = setTimeout(finish, 30000); shutdown.signal.addEventListener('abort', finish, { once: true }); }); } while (!once && !shutdown.signal.aborted);
} finally { if(publisher)clearInterval(publisher); await publication; clearInterval(workerHeartbeat); await TgWorkerModel.deleteOne({name:workerName}).catch(()=>undefined); const { default: mongoose } = await import('mongoose'); await mongoose.disconnect(); }

}
void main().catch(() => { console.error('TG worker non disponibile'); process.exitCode = 1; });
