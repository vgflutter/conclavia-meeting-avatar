import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { jobDirectory } from './artifacts';
import type { TgJob, TgPlatform } from './types';
import { publicationCopy } from './presentation';
import { startMetricoolTikTok, pollMetricoolTikTok, verifyMetricoolTarget } from './metricool';
import {masterSeconds} from './media-contract';
export interface DeliveryReceipt { state: 'submitted' | 'published'; remoteId: string; url?: string }
export function channelPrefix(job: Pick<TgJob, 'edition'>) { return job.edition === 'it' ? 'TG_IT_' : 'TG_WORLD_'; }
function required(name: string) { const value = process.env[name]?.trim(); if (!value) throw new Error(`Collegamento TG incompleto: ${name}`); return value; }
export interface DeliveryHooks {
  beforeMutation?: () => Promise<void>;
  beforeFinalize?: () => Promise<void>;
  saveSession?: (session:string) => Promise<void>;
  remoteSession?: string;
}
async function json(url: string, init: RequestInit, signal: AbortSignal) {
  const response = await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(120000)]) });
  if (!response.ok) { await response.body?.cancel(); throw new Error(`Servizio pubblicazione: HTTP ${response.status}`); }
  return response.json();
}
async function youtubeToken(prefix: string, signal: AbortSignal) {
  const body = new URLSearchParams({ client_id: required(prefix + 'YOUTUBE_CLIENT_ID'), client_secret: required(prefix + 'YOUTUBE_CLIENT_SECRET'), refresh_token: required(prefix + 'YOUTUBE_REFRESH_TOKEN'), grant_type: 'refresh_token' });
  const data = await json('https://oauth2.googleapis.com/token', { method: 'POST', body }, signal);
  if (typeof data.access_token !== 'string') throw new Error('Autorizzazione YouTube non valida'); return data.access_token as string;
}
export async function startDelivery(job: TgJob, platform: TgPlatform, mediaUrl: string | undefined, signal: AbortSignal, checkpoint: (receipt: DeliveryReceipt) => Promise<void>, hooks:DeliveryHooks={}): Promise<DeliveryReceipt> {
  if(platform==='tiktok') return startMetricoolTikTok(job,signal,checkpoint,hooks.beforeMutation??(async()=>undefined));
  const prefix = channelPrefix(job), meta = publicationCopy(job,platform);
  if (platform === 'youtube') {
    const token = await youtubeToken(prefix, signal), auth = { Authorization: `Bearer ${token}` };
    const channels = await json('https://www.googleapis.com/youtube/v3/channels?part=id&mine=true', { headers: auth }, signal);
    if (!channels.items?.some((x: {id: string}) => x.id === required(prefix + 'YOUTUBE_CHANNEL_ID'))) throw new Error('Il canale YouTube autorizzato non corrisponde all’edizione TG');
    const data = await readFile(path.join(jobDirectory(job.id), 'landscape.mp4'));
    let location=hooks.remoteSession;
    if(!location){
      await hooks.beforeMutation?.();
      const session = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', { method: 'POST', redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]), headers: { ...auth, 'Content-Type': 'application/json', 'X-Upload-Content-Type': 'video/mp4', 'X-Upload-Content-Length': String(data.length) }, body: JSON.stringify({ snippet: { title: meta.title, description: meta.description, categoryId: '25', defaultLanguage: job.product.language }, status: { privacyStatus: 'public', selfDeclaredMadeForKids: false, containsSyntheticMedia: true } }) });
      location=session.headers.get('location')??undefined;
      if(!session.ok||!location)throw new Error('Sessione YouTube non disponibile');
      validateYoutubeSession(location);
      await hooks.saveSession?.(location);
    }
    validateYoutubeSession(location);
    // A stored session is queried before sending bytes, including after a crash.
    await hooks.beforeMutation?.();
    const status=await fetch(location,{method:'PUT',redirect:'error',headers:{...auth,'Content-Length':'0','Content-Range':`bytes */${data.length}`},signal:AbortSignal.any([signal,AbortSignal.timeout(30000)])});
    let result;
    if(status.ok)result=await status.json();
    else if(status.status===308){
      const range=status.headers.get('range'),match=range?.match(/^bytes=0-(\d+)$/u);
      const offset=match?Number(match[1])+1:0;
      if(offset>=data.length)throw new Error('Stato caricamento YouTube da riconciliare');
      await hooks.beforeMutation?.();
      result=await json(location,{method:'PUT',headers:{...auth,'Content-Type':'video/mp4','Content-Length':String(data.length-offset),'Content-Range':`bytes ${offset}-${data.length-1}/${data.length}`},body:new Uint8Array(data.subarray(offset))},signal);
    }else{await status.body?.cancel();throw new Error('Sessione YouTube da verificare');}
    if(typeof result.id!=='string')throw new Error('Ricevuta YouTube assente');
    const receipt: DeliveryReceipt = { state: 'submitted', remoteId: result.id, url: `https://www.youtube.com/watch?v=${encodeURIComponent(result.id)}` }; await checkpoint(receipt); return receipt;
  }
  if (!mediaUrl) throw new Error('URL pubblico del video TG non configurato');
  if (platform === 'instagram') {
    const version = required('TG_META_GRAPH_VERSION'); if (!/^v\d+\.\d+$/u.test(version)) throw new Error('Versione Meta non valida');
    const token = required(prefix + 'INSTAGRAM_ACCESS_TOKEN'), account = required(prefix + 'INSTAGRAM_ACCOUNT_ID'); if (!/^\d+$/u.test(account)) throw new Error('Account Instagram non valido');
    await verifyChannel(job,'instagram',signal);
    await hooks.beforeMutation?.();
    const result = await json(`https://graph.facebook.com/${version}/${account}/media`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ media_type: 'REELS', video_url: mediaUrl, caption: meta.description, share_to_feed: true }) }, signal);
    if (typeof result.id !== 'string') throw new Error('Ricevuta Instagram assente');
    const receipt: DeliveryReceipt = { state: 'submitted', remoteId: result.id }; await checkpoint(receipt); return receipt;
  }
  // Spotify video needs a supported distribution host; never pretend audio RSS is video delivery.
  const origin = new URL(required('TG_SPOTIFY_PARTNER_URL')); if (origin.protocol !== 'https:' || origin.username || origin.password) throw new Error('Partner Spotify non valido');
  await hooks.beforeMutation?.();
  const result = await json(new URL('deliveries', origin.toString().replace(/\/?$/u, '/')).toString(), { method: 'POST', headers: { Authorization: `Bearer ${required('TG_SPOTIFY_PARTNER_TOKEN')}`, 'Content-Type': 'application/json', 'Idempotency-Key': `${job.id}:spotify` }, body: JSON.stringify({ destination: required(prefix + 'SPOTIFY_SHOW_ID'), videoUrl: mediaUrl, title: meta.title, description: meta.description, language: job.product.language, durationSeconds: masterSeconds(job) }) }, signal);
  if (typeof result.id !== 'string' || !['submitted', 'published'].includes(result.state)) throw new Error('Ricevuta partner Spotify non valida');
  const receipt: DeliveryReceipt = { remoteId: result.id, state: result.state, ...(typeof result.url === 'string' && result.url.startsWith('https://open.spotify.com/') ? { url: result.url } : {}) }; await checkpoint(receipt); return receipt;
}
export async function pollDelivery(job: TgJob, platform: TgPlatform, remoteId: string, signal: AbortSignal, hooks:DeliveryHooks={}): Promise<DeliveryReceipt> {
  const prefix = channelPrefix(job);
  if (platform === 'youtube') {
    const token = await youtubeToken(prefix, signal);
    const result = await json(`https://www.googleapis.com/youtube/v3/videos?part=status,processingDetails,snippet&id=${encodeURIComponent(remoteId)}`, { headers: { Authorization: `Bearer ${token}` } }, signal);
    const video = result.items?.[0];
    if(!video||video.snippet?.channelId!==required(prefix+'YOUTUBE_CHANNEL_ID'))throw new Error('Il video non appartiene al canale TG configurato');
    if (['failed', 'rejected', 'deleted'].includes(video?.status?.uploadStatus)) throw new Error('YouTube ha rifiutato il video');
    return { remoteId, state: video?.status?.uploadStatus === 'processed' && video?.status?.privacyStatus === 'public' ? 'published' : 'submitted', url: `https://www.youtube.com/watch?v=${encodeURIComponent(remoteId)}` };
  }
  if (platform === 'tiktok') return pollMetricoolTikTok(job,remoteId,signal);
  if (platform === 'instagram') {
    await verifyChannel(job,'instagram',signal);
    const base = `https://graph.facebook.com/${required('TG_META_GRAPH_VERSION')}`, headers = { Authorization: `Bearer ${required(prefix + 'INSTAGRAM_ACCESS_TOKEN')}` };
    const result = await json(`${base}/${encodeURIComponent(remoteId)}?fields=status_code`, { headers }, signal);
    if (['ERROR', 'EXPIRED'].includes(result.status_code)) throw new Error('Instagram ha rifiutato il contenitore');
    if (result.status_code !== 'FINISHED') return { state: result.status_code === 'PUBLISHED' ? 'published' : 'submitted', remoteId };
    await hooks.beforeMutation?.();
    await hooks.beforeFinalize?.();
    const published = await json(`${base}/${required(prefix + 'INSTAGRAM_ACCOUNT_ID')}/media_publish`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ creation_id: remoteId }) }, signal);
    if (typeof published.id !== 'string') throw new Error('Pubblicazione Instagram non confermata');
    return { state: 'published', remoteId: published.id };
  }
  const base = new URL(required('TG_SPOTIFY_PARTNER_URL'));
  const result = await json(new URL(`deliveries/${encodeURIComponent(remoteId)}`, base.toString().replace(/\/?$/u, '/')).toString(), { headers: { Authorization: `Bearer ${required('TG_SPOTIFY_PARTNER_TOKEN')}` } }, signal);
  if (result.state === 'failed') throw new Error('Partner Spotify: pubblicazione non riuscita');
  return { remoteId, state: result.state === 'published' ? 'published' : 'submitted' };
}

function validateYoutubeSession(raw:string){
  const url=new URL(raw);
  if(url.protocol!=='https:'||url.hostname!=='www.googleapis.com'||url.username||url.password||!url.pathname.startsWith('/upload/'))throw new Error('Sessione YouTube non valida');
}
/** Read-only connection test. It never creates uploads or posts. */
export async function verifyChannel(job:Pick<TgJob,'edition'>,platform:TgPlatform,signal:AbortSignal){
  const prefix=channelPrefix(job);
  if(platform==='youtube'){
    const token=await youtubeToken(prefix,signal);
    const result=await json('https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true',{headers:{Authorization:`Bearer ${token}`}},signal);
    const channel=result.items?.find((c:{id:string})=>c.id===required(prefix+'YOUTUBE_CHANNEL_ID'));
    if(!channel)throw new Error('Destinazione YouTube non confermata');
    return typeof channel.snippet?.title==='string'?channel.snippet.title:'Canale YouTube confermato';
  }
  if(platform==='tiktok'){const creator=await verifyMetricoolTarget(job,signal);return '@'+creator.creatorUsername;}
  if(platform==='instagram'){
    const result=await json(`https://graph.facebook.com/${required('TG_META_GRAPH_VERSION')}/${required(prefix+'INSTAGRAM_ACCOUNT_ID')}?fields=id,username`,{headers:{Authorization:`Bearer ${required(prefix+'INSTAGRAM_ACCESS_TOKEN')}`}},signal);
    if(String(result.id)!==required(prefix+'INSTAGRAM_ACCOUNT_ID'))throw new Error('Destinazione Instagram non confermata');
    return typeof result.username==='string'?'@'+result.username:'Account Instagram confermato';
  }
  throw new Error('L’host video Spotify richiede una prova di integrazione sul servizio scelto');
}
