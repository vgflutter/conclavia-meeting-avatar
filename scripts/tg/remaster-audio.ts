import { randomUUID } from 'node:crypto';
import { rename } from 'node:fs/promises';
import path from 'node:path';
import { Types } from 'mongoose';
import { connectToDatabase } from '../../src/lib/mongodb';
import { TgRunModel } from '../../src/models/tg/TgRun';
import { TgDeliveryModel } from '../../src/models/tg/TgDelivery';
import { checkpoint, renewLease } from '../../src/lib/tg/store';
import { jobDirectory } from '../../src/lib/tg/artifacts';
import { command, renderMedia } from '../../src/lib/tg/media';
import { scriptDigest } from '../../src/lib/tg/editorial';

/** Operator QA: change only loudness, retain the audited script and measured timing. */
async function main() {
  const id=process.argv.find(x=>x.startsWith('--id='))?.slice(5);
  if (!id || !Types.ObjectId.isValid(id) || !process.argv.includes('--confirm') || process.env.TG_PUBLISH_ENABLED!=='false') throw new Error('Specificare un id, --confirm e pubblicazione disabilitata');
  await connectToDatabase();
  if (await TgDeliveryModel.exists({jobId:id})) throw new Error('Edizione già inviata: non modificare i media');
  const candidate=await TgRunModel.findById(id).lean();
  if (!candidate?.script || !candidate.manifest || !candidate.audit?.passed || candidate.audit.scriptSha256!==scriptDigest(candidate.script) || Date.now()-new Date(candidate.audit.checkedAt).getTime()>6*3600000) throw new Error('Serve un copione verificato, attuale e con timeline misurata');
  const owner=randomUUID(), now=new Date();
  const claimed=await TgRunModel.findOneAndUpdate({_id:id,state:'needs_review',approvedAt:{$exists:false},$or:[{leaseUntil:{$exists:false}},{leaseUntil:{$lt:now}}]},{$set:{state:'rendering',leaseOwner:owner,leaseUntil:new Date(now.getTime()+120000),assets:[]}}, {returnDocument:'after'});
  if (!claimed) throw new Error('Edizione non disponibile per la rifinitura');
  const controller=new AbortController();
  const beat=setInterval(()=>void renewLease(id,owner).then(ok=>{if(!ok)controller.abort();}).catch(()=>controller.abort()),30000);
  try {
    const directory=jobDirectory(id), temporary=path.join(directory,'normalized.wav');
    await command('ffmpeg',['-y','-v','error','-i',path.join(directory,'track.wav'),'-af',`loudnorm=I=-16:TP=-1.5:LRA=11,apad,atrim=duration=${candidate.manifest.seconds}`,'-ar','24000',temporary],controller.signal);
    await rename(temporary,path.join(directory,'track.wav'));
    const assets=await renderMedia(id,candidate.manifest,controller.signal);
    await checkpoint(id,owner,'needs_review',{assets,issues:[]},'QA audio: livello uniforme -16 LUFS / picco -1,5 dBTP; copione e tempi verificati conservati');
    console.log(JSON.stringify({event:'tg_audio_remastered',id,state:'needs_review'}));
  } catch(error) {
    await checkpoint(id,owner,'failed',{issues:['Rifinitura audio da completare; nessun invio effettuato']},'Rifinitura audio interrotta').catch(()=>undefined);
    throw error;
  } finally {
    clearInterval(beat);
    await TgRunModel.updateOne({_id:id,leaseOwner:owner},{$unset:{leaseOwner:1,leaseUntil:1}});
  }
}
void main().catch(error=>{console.error(error instanceof Error?error.message:'Rifinitura non riuscita');process.exitCode=1;}).finally(async()=>{const {default:mongoose}=await import('mongoose');await mongoose.disconnect();});
