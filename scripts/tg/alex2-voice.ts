/** Explicit, bounded voice commissioning. No DB, scheduler or social writes. */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { elevenLabsSpeechPcm } from '@conclavia/avatar-kit/speech/server';
import { alex2ConfigStatus, alex2ConfigDigest, verifyAlex2Identity } from '../../src/lib/tg/alex2-config';
import { wave } from '../../src/lib/tg/media';
import { ALEX2_PROBE_TEXT, alex2ProofDirectory, alex2SynthesisVerified } from '../../src/lib/tg/alex2-proof';

const action=process.argv[2]??'status', signal=AbortSignal.timeout(150000);
const directory=alex2ProofDirectory(),text=ALEX2_PROBE_TEXT;
async function main(){
  if(action==='status'){
    const synthesisVerified=alex2SynthesisVerified();
    return console.log(JSON.stringify({...alex2ConfigStatus(),synthesisVerified,completeVideoChecked:false,publishes:false},null,2));
  }
  if(!['check','probe'].includes(action))throw Error();
  if(action==='probe'&&!process.argv.includes('--confirm'))return console.log(JSON.stringify({generated:false,reason:'Usare probe --confirm per una sola breve sintesi con crediti reali. check verifica soltanto l’identità.'}));
  const config=await verifyAlex2Identity(signal);
  if(action==='check')return console.log(JSON.stringify({identityVerified:true,synthesisVerified:false,generated:false}));
  await mkdir(directory,{recursive:true,mode:0o700});
  // Preserve an uncertain paid call instead of rebilling after a process crash.
  await writeFile(path.join(directory,'attempt.json'),JSON.stringify({version:1,startedAt:new Date().toISOString(),configSha256:alex2ConfigDigest(config)}),{flag:'wx',mode:0o600});
  const take=await elevenLabsSpeechPcm({text,voiceId:config.voiceId,model:config.model,language:'it',settings:config.settings,signal},{apiKey:config.apiKey});
  const audio=wave(Buffer.from(take.pcm));
  await writeFile(path.join(directory,'take.wav'),audio,{mode:0o600});
  await writeFile(path.join(directory,'proof.json'),JSON.stringify({version:1,checkedAt:new Date().toISOString(),configSha256:alex2ConfigDigest(config),
    text,words:take.words,seconds:take.pcm.length/48000,audioSha256:createHash('sha256').update(audio).digest('hex')},null,2),{mode:0o600});
  if(!alex2SynthesisVerified())throw Error();
  console.log(JSON.stringify({generated:true,synthesisVerified:true,seconds:take.pcm.length/48000,wordCount:take.words.length,proofDirectory:directory,completeVideoChecked:false,publishes:false}));
}
main().catch(()=>{console.error(JSON.stringify({ready:false,issue:'Alex 2 non verificato: controllare configurazione privata, identità, crediti o precedente tentativo. Nessun fallback; nessun segreto nei log.'}));process.exitCode=1;});
