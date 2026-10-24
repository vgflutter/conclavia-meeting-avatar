import 'server-only';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { jobDirectory } from './artifacts';
import { publicationCopy } from './presentation';
import type { TgJob } from './types';
import type { DeliveryReceipt } from './publishers';
import {masterSeconds} from './media-contract';

function setting(name:string){const value=process.env[name]?.trim();if(!value)throw new Error('Collegamento Metricool incompleto');return value;}
function prefix(job:Pick<TgJob,'edition'>){return job.edition==='it'?'TG_IT_':'TG_WORLD_';}
function username(value:string){return value.replace(/^@/u,'').toLowerCase();}
async function request(job:Pick<TgJob,'edition'>,route:string,signal:AbortSignal,init:RequestInit={},params:Record<string,string>={}){
  const url=new URL(`https://app.metricool.com/api${route}`);
  url.searchParams.set('userId',setting('TG_METRICOOL_USER_ID'));url.searchParams.set('blogId',setting(prefix(job)+'METRICOOL_BLOG_ID'));
  for(const [key,value]of Object.entries(params))url.searchParams.set(key,value);
  const response=await fetch(url,{...init,redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(120000)]),headers:{'X-Mc-Auth':setting('TG_METRICOOL_TOKEN'),'Content-Type':'application/json',...init.headers}});
  if(!response.ok){await response.body?.cancel();throw new Error(`Metricool: HTTP ${response.status}`);}
  return response.json();
}
export async function verifyMetricoolTarget(job:Pick<TgJob,'edition'>,signal:AbortSignal){
  const result=await request(job,'/admin/simpleProfiles',signal);
  const profiles=Array.isArray(result)?result:result.data;
  const profile=Array.isArray(profiles)?profiles.find(p=>String(p.id)===setting(prefix(job)+'METRICOOL_BLOG_ID')):undefined;
  const expected=username(setting(prefix(job)+'TIKTOK_USERNAME'));
  if(!profile||typeof profile.tiktok!=='string'||username(profile.tiktok)!==expected)throw new Error('La destinazione TikTok non corrisponde al brand TG configurato');
  const creator=(await request(job,'/v2/scheduler/catalogs/tiktok/creator-info',signal)).data;
  if(!creator||typeof creator.creatorUsername!=='string'||username(creator.creatorUsername)!==expected)throw new Error('Account TikTok non confermato');
  if(!Array.isArray(creator.privacyLevelOptions)||!creator.privacyLevelOptions.includes('PUBLIC_TO_EVERYONE'))throw new Error('L’account TikTok non permette la pubblicazione pubblica');
  return creator as {creatorUsername:string;maxVideoPostDurationSec:number;commentDisabled:boolean;duetDisabled:boolean;stitchDisabled:boolean};
}
function trustedStorage(raw:unknown){
  if(typeof raw!=='string')throw new Error('URL media Metricool assente');
  const url=new URL(raw);
  if(url.protocol!=='https:'||url.username||url.password||!((url.hostname.endsWith('.amazonaws.com')&&url.hostname.startsWith('metricool-'))||url.hostname==='static.metricool.com'))throw new Error('Destinazione media Metricool non valida');
  return url.toString();
}
/** Uploads local media into Metricool storage; no expiring public draft links. */
async function uploadVideo(job:TgJob,signal:AbortSignal,beforeMutation:()=>Promise<void>){
  const data=await readFile(path.join(jobDirectory(job.id),'portrait.mp4'));
  if(!data.length||data.length>200*1024*1024)throw new Error('Dimensione video TikTok non supportata');
  const chunks=Array.from({length:Math.ceil(data.length/(5*1024*1024))},(_,i)=>{
    const startByte=i*5*1024*1024,endByte=Math.min(data.length,startByte+5*1024*1024);
    return {startByte,endByte,size:endByte-startByte,hash:createHash('sha256').update(data.subarray(startByte,endByte)).digest('base64')};
  });
  await beforeMutation();
  const upload=(await request(job,'/v2/media/s3/upload-transactions',signal,{method:'PUT',body:JSON.stringify({resourceType:'planner',contentType:'video/mp4',fileExtension:'mp4',parts:chunks})})).data;
  let completion:unknown;
  if(upload?.uploadType==='SIMPLE'){
    await beforeMutation();
    const response=await fetch(trustedStorage(upload.presignedUrl),{method:'PUT',redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(120000)]),headers:{'Content-Type':'video/mp4','x-amz-checksum-sha256':chunks[0].hash},body:new Uint8Array(data)});
    if(!response.ok)throw new Error('Trasferimento video Metricool interrotto');
    completion={simple:{fileUrl:trustedStorage(upload.fileUrl)}};
  }else if(upload?.uploadType==='MULTIPART'&&Array.isArray(upload.parts)&&upload.parts.length===chunks.length){
    const parts=[];
    for(let i=0;i<chunks.length;i++){
      const part=upload.parts[i],chunk=chunks[i];
      if(part.partNumber!==i+1||part.startByte!==chunk.startByte||part.endByte!==chunk.endByte)throw new Error('Parti video Metricool non coerenti');
      await beforeMutation();
      const response=await fetch(trustedStorage(part.presignedUrl),{method:'PUT',redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(120000)]),headers:{'x-amz-checksum-sha256':chunk.hash},body:new Uint8Array(data.subarray(chunk.startByte,chunk.endByte))});
      const etag=response.headers.get('etag');if(!response.ok||!etag)throw new Error('Parte video Metricool non confermata');
      parts.push({partNumber:i+1,etag});
    }
    completion={multipart:{uploadId:upload.uploadId,key:upload.key,parts}};
  }else throw new Error('Trasferimento Metricool non riconosciuto');
  await beforeMutation();
  const complete=(await request(job,'/v2/media/s3/upload-transactions',signal,{method:'PATCH',body:JSON.stringify(completion)})).data;
  return trustedStorage(complete?.convertedFileUrl||complete?.fileUrl);
}
export async function startMetricoolTikTok(job:TgJob,signal:AbortSignal,checkpoint:(r:DeliveryReceipt)=>Promise<void>,beforeMutation:()=>Promise<void>){
  const creator=await verifyMetricoolTarget(job,signal);
  if(!Number.isFinite(creator.maxVideoPostDurationSec)||masterSeconds(job)>creator.maxVideoPostDurationSec)throw new Error('La durata supera il limite dell’account TikTok');
  const media=await uploadVideo(job,signal,beforeMutation),copy=publicationCopy(job,'tiktok');
  // Dispatch only starts at the approved airtime. The planner needs a future date.
  const at=new Date(Date.now()+60000).toISOString().slice(0,19);
  await beforeMutation();
  const post=(await request(job,'/v2/scheduler/posts',signal,{method:'POST',body:JSON.stringify({
    publicationDate:{dateTime:at,timezone:'UTC'},text:copy.description,providers:[{network:'tiktok'}],
    media:[media],autoPublish:true,draft:false,saveExternalMediaFiles:true,
    tiktokData:{privacyOption:'PUBLIC_TO_EVERYONE',disableComment:creator.commentDisabled,disableDuet:creator.duetDisabled,disableStitch:creator.stitchDisabled,commercialContentThirdParty:false,commercialContentOwnBrand:false,isAigc:true,autoAddMusic:false},
  })},{jobId:`conclavia-tg-${job.id}-tiktok`})).data;
  if(!Number.isSafeInteger(post?.id))throw new Error('Ricevuta Metricool assente');
  const receipt:DeliveryReceipt={state:'submitted',remoteId:String(post.id)};await checkpoint(receipt);return receipt;
}
export async function pollMetricoolTikTok(job:TgJob,remoteId:string,signal:AbortSignal):Promise<DeliveryReceipt>{
  if(!/^\d+$/u.test(remoteId))throw new Error('ID ricevuta Metricool non valido');
  await verifyMetricoolTarget(job,signal);
  const post=(await request(job,`/v2/scheduler/posts/${remoteId}`,signal)).data;
  if(String(post?.id)!==remoteId)throw new Error('Ricevuta Metricool non corrispondente');
  const provider=post.providers?.find((p:{network:string})=>p.network==='tiktok');
  if(!provider||['ERROR','DRAFT','AWAITING_CONFIRMATION'].includes(provider.status))throw new Error('Metricool richiede un intervento sulla pubblicazione TikTok');
  const url=typeof provider.publicUrl==='string'&&/^https:\/\/(?:www\.)?tiktok\.com\//u.test(provider.publicUrl)?provider.publicUrl:undefined;
  return {state:provider.status==='PUBLISHED'?'published':'submitted',remoteId,...(url?{url}:{})};
}
