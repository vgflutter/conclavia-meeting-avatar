/** Isolated, bounded, explicitly requested acting demo. Never touches jobs,
 * scheduler configuration, production voice proof or publishing adapters. */
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {ElevenLabsSpeechError,elevenLabsSpeechPcm} from '@conclavia/avatar-kit/speech/server';
import {verifyAlex2Identity} from '../../src/lib/tg/alex2-config';
import {wave} from '../../src/lib/tg/media';
const id='2026-10-24-it-pilot-r1';
const hash=(data:string|Buffer)=>createHash('sha256').update(data).digest('hex');
async function main(){
 if(!process.argv.includes('--confirm')||process.env.TG_PUBLISH_ENABLED!=='false')throw Error('Explicit isolated demo authorization required');
 const score=JSON.parse(await readFile(`scripts/tg/editions/${id}.json`,'utf8'));
 if(score.id!==id||score.editionScope!=='acting-demo-not-news'||score.voice!=='Alex 2 - daily'||score.sources.length)throw Error('Unexpected demonstration score');
 const text=score.lines.map((l:{text:string})=>l.text).join(' ');
 if(text.length>2000||text.length<500)throw Error('Demo copy exceeds bounded scope');
 const root=path.resolve('.daily-agent/acting-demo-20261024'),requestSha256=hash(text);
 await mkdir(root,{recursive:true,mode:0o700});
 try{
  const receipt=JSON.parse(await readFile(root+'/receipt.json','utf8')),recording=await readFile(root+'/source.wav');
  if(receipt.requestSha256!==requestSha256||receipt.wavSha256!==hash(recording))throw Error();
  console.log(JSON.stringify({cached:true,seconds:receipt.seconds,file:root+'/source.wav'}));return;
 }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw Error('Existing demo cache needs review; no paid retry');}
 const config=await verifyAlex2Identity(AbortSignal.timeout(20000));
 await writeFile(root+'/attempt.json',JSON.stringify({requestSha256,startedAt:new Date().toISOString(),maximumSpeechCalls:1}),{flag:'wx',mode:0o600});
 // Preserve the original bounded response BEFORE strict native timing checks.
 // A timing rejection must never cause another synthesis or lose usable audio.
 let body:string|undefined,nativeTimingAccepted=false;
 try{
  await elevenLabsSpeechPcm({text,voiceId:config.voiceId,model:config.model,settings:config.settings,language:'it',signal:AbortSignal.timeout(125000)},
   {apiKey:config.apiKey,fetcher:async(input,init)=>{
    const response=await fetch(input,init);
    if(!response.ok)return response;
    if(!response.body)throw Error('Missing speech response');
    const reader=response.body.getReader(),chunks:Uint8Array[]=[];let bytes=0;
    try{for(;;){const next=await reader.read();if(next.done)break;bytes+=next.value.length;if(bytes>17000000)throw Error('Speech response exceeds limit');chunks.push(next.value);}}
    catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
    body=Buffer.concat(chunks).toString('utf8');
    await writeFile(root+'/provider-response.private.json',body,{mode:0o600});
    return new Response(body,{status:response.status,headers:{'content-type':'application/json'}});
   }});
  nativeTimingAccepted=true;
 }catch(error){
  if(!(error instanceof ElevenLabsSpeechError)||error.stage!=='timing'||!body)throw Error('Demo speech request did not complete; inspect private receipt, do not retry automatically');
 }
 const data=JSON.parse(body!),base64=data.audio_base64;
 if(typeof base64!=='string'||!base64.length||base64.length%4||!/^[A-Za-z0-9+/]+={0,2}$/u.test(base64))throw Error('Invalid recovered demo audio');
 const pcm=Buffer.from(base64,'base64'),seconds=pcm.length/48000;
 if(pcm.toString('base64')!==base64||pcm.length%2||seconds<30||seconds>90||pcm.subarray(0,4).toString()==='RIFF'||pcm.subarray(0,3).toString()==='ID3')throw Error('Unexpected demo PCM');
 let power=0,peak=0;for(let i=0;i<pcm.length;i+=2){const value=pcm.readInt16LE(i)/32768;power+=value*value;peak=Math.max(peak,Math.abs(value));}
 const rms=Math.sqrt(power/(pcm.length/2));if(rms<.002)throw Error('Demo take has no usable audio');
 const recording=wave(pcm);await writeFile(root+'/source.wav',recording,{mode:0o600});
 const receipt={version:1,requestSha256,wavSha256:hash(recording),seconds,rms,peak,nativeTimingAccepted,speechCalls:1,model:config.model,voice:'Alex 2 - daily',published:false,needsIndependentWordAlignment:true};
 await writeFile(root+'/receipt.json',JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
 console.log(JSON.stringify({...receipt,file:root+'/source.wav'}));
}
void main().catch(error=>{console.error(error instanceof Error?error.message:'Isolated demo failed');process.exitCode=1;});
