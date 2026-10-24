import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir,readFile,writeFile,copyFile,rename,chmod,lstat,rm} from 'node:fs/promises';
import path from 'node:path';
import {approvalIsBound,auditIsCurrent} from './review';
import {freshnessIsCurrent} from './freshness';
import {editionSlot,localEditionDate} from './schedule';
import {jobDirectory} from './artifacts';
import {publicationCopy} from './presentation';
import {DAILY_SITE_ORIGIN,siteEditionPath} from './site-contract';
import type {TgJob,TgPublishedEdition} from './types';
import {publishedStories} from './history';
const hex=/^[a-f0-9]{64}$/u;
const sha=(value:string)=>createHash('sha256').update(value).digest('hex');
const esc=(value:unknown)=>String(value).replace(/[&<>"']/gu,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const mediaNames=['portrait.mp4','landscape.mp4','audio.mp3','captions.vtt'] as const;
export function assertSiteReady(job:TgJob,history:TgPublishedEdition[],now:Date){
 if(!job.product.siteFirst||!job.product.automatic||job.product.productionMode==='editorial'||job.review?.scope!=='website'
  ||!['ready','publishing','published'].includes(job.state)||!job.script||!job.manifest||job.manifest.demo
  ||!auditIsCurrent(job,now)||!approvalIsBound(job,{},now)||!freshnessIsCurrent(job,now,history)
  ||localEditionDate(now,job.product.timezone)!==job.date)throw Error('Edizione non approvata per il sito');
 const slot=editionSlot(job.product,job.date);
 if(now.getTime()<Date.parse(slot.prepareAt)||now.getTime()>Date.parse(slot.closesAt))throw Error('Finestra sito scaduta');
 if(!hex.test(job.review.bundleSha256??''))throw Error('Identità del pacchetto mancante');
}
export function publicSiteEdition(job:TgJob,publishedAt:string){
 if(!job.script||!job.research||!job.manifest||!job.review?.bundleSha256)throw Error('Pacchetto incompleto');
 const base=siteEditionPath(job.edition,job.date),releasePath=base+job.review.bundleSha256+'/';
 const media=Object.fromEntries(mediaNames.map(name=>{
  const asset=job.assets.find(a=>a.name===name);
  if(!asset||!hex.test(asset.sha256)||asset.bytes<=0||asset.bytes>1500000000)throw Error('Asset pubblico non verificato');
  return [name,{url:DAILY_SITE_ORIGIN+releasePath+name,sha256:asset.sha256,bytes:asset.bytes,...(asset.duration===undefined?{}:{seconds:asset.duration})}];
 }));
 const spoken=new Set(job.script.sentences.flatMap(s=>s.sourceIds));
 const sources=job.research.sources.filter(s=>spoken.has(s.id)).map(s=>{const url=new URL(s.url);if(url.protocol!=='https:'||url.username||url.password)throw Error('Fonte pubblica non valida');return{publisher:s.publisher,title:s.title,url:s.url,publishedAt:s.publishedAt};});
 const stories=job.script.headlines?.map(h=>({title:h.title,summary:job.script!.cards?.find(c=>c.storyId===h.storyId)?.context??'',at:job.manifest!.cues.find(c=>c.storyId===h.storyId)?.start??0}))??[];
 const record={schema:1,kind:'daily' as const,edition:job.edition,date:job.date,language:job.product.language,title:job.script.title,description:job.script.description,
  publicationKey:job.review.bundleSha256,publishedAt,url:DAILY_SITE_ORIGIN+base,releaseUrl:DAILY_SITE_ORIGIN+releasePath+'release.json',seconds:job.manifest.seconds,
  distribution:{eligible:true,notBefore:job.publicationPlan!.scheduledAt,notAfter:editionSlot(job.product,job.date).closesAt},
  review:{facts:true,editorial:true,video:true,mode:'ai',scope:'website'},media,stories,sources,
  transcript:job.script.sentences.map(s=>s.text).join('\n\n'),socialPosts:Object.fromEntries(job.product.platforms.map(p=>[p,publicationCopy(job,p)]))};
 return {...record,sha256:sha(JSON.stringify(record))};
}
export type PublicSiteEdition=ReturnType<typeof publicSiteEdition>;
export function publicEditionHtml(m:Pick<PublicSiteEdition,'language'|'title'|'description'|'date'|'url'|'releaseUrl'|'media'|'seconds'|'transcript'|'stories'|'sources'>&{kind:'daily'|'demo'}){
 const it=m.language==='it',video=(name:string)=>esc(m.media[name].url),duration=`${Math.floor(m.seconds/60)}:${String(Math.floor(m.seconds%60)).padStart(2,'0')}`;
 return `<!doctype html><html lang="${m.language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(m.title)} · CDaily</title><meta name="description" content="${esc(m.description)}"><link rel="canonical" href="${esc(m.url)}"><meta property="og:title" content="${esc(m.title)}"><meta property="og:description" content="${esc(m.description)}"><meta property="og:type" content="video.other"><link rel="alternate" type="application/json" href="${esc(m.releaseUrl)}"><link rel="stylesheet" href="/assets/daily-edition.css"><script src="/assets/daily-edition.js" defer></script></head><body><header><a href="/"><img src="/assets/daily-edition-logo.svg" alt="CDaily"></a><a href="${it?'/edizioni/':'/en/editions/'}">${it?'Tutte le edizioni':'All editions'} ↗</a></header><main><p class="eyebrow">${esc(m.date)} · ${m.kind==='daily'?(it?'ITALIA':'WORLD'):'DEMO'} · ${duration}</p><h1>${esc(m.title)}</h1><p class="intro">${esc(m.description)}</p><nav class="formats" aria-label="${it?'Formato video':'Video format'}"><button data-format="portrait">${it?'Verticale':'Portrait'} · 9:16</button><button data-format="landscape">${it?'Orizzontale':'Landscape'} · 16:9</button></nav><video controls playsinline preload="metadata" data-portrait="${video('portrait.mp4')}" data-landscape="${video('landscape.mp4')}"><source media="(max-width:700px)" src="${video('portrait.mp4')}" type="video/mp4"><source src="${video('landscape.mp4')}" type="video/mp4"><track kind="captions" srclang="${m.language}" label="${it?'Italiano':'English'}" src="${video('captions.vtt')}"></video><p class="downloads"><a href="${video('portrait.mp4')}">MP4 9:16</a> · <a href="${video('landscape.mp4')}">MP4 16:9</a></p><nav class="chapters" aria-label="${it?'Scaletta':'Rundown'}">${m.stories.map(s=>`<button data-seek="${s.at}">${esc(s.title)}</button>`).join('')}</nav><section><h2>${it?'La scaletta':'The rundown'}</h2>${m.stories.map(s=>`<article><h3>${esc(s.title)}</h3><p>${esc(s.summary)}</p></article>`).join('')}</section><section><h2>${it?'Da condividere':'Share this edition'}</h2><p>${esc(m.description)}</p></section>${m.sources.length?`<section><h2>${it?'Fonti':'Sources'}</h2><ul>${m.sources.map(s=>`<li><a href="${esc(s.url)}" rel="noopener noreferrer" target="_blank">${esc(s.publisher)} · ${esc(s.title)}</a></li>`).join('')}</ul></section>`:''}<details><summary>${it?'Leggi il copione':'Read the transcript'}</summary>${m.transcript.split('\n\n').map(t=>`<p>${esc(t)}</p>`).join('')}</details></main><footer>CDaily · by Conclavia. ${it?'Presentatore e voce AI.':'AI presenter and voice.'}</footer></body></html>\n`;
}
async function fileHash(file:string){const hash=createHash('sha256');let bytes=0;for await(const chunk of createReadStream(file)){hash.update(chunk);bytes+=chunk.length;}return{bytes,sha256:hash.digest('hex')};}
async function atomic(file:string,data:string){const temporary=file+'.'+randomUUID()+'.partial';await writeFile(temporary,data,{mode:0o644});await rename(temporary,file);}
export async function addSiteIndex(root:string,edition:{kind:string;edition:string;date:string;title:string;description:string;url:string;releaseUrl:string;publicationKey:string;publishedAt:string;seconds:number}){
 let index:{schema:number;editions:typeof edition[]}={schema:1,editions:[]};
 try{index=JSON.parse(await readFile(path.join(root,'index.json'),'utf8'));if(index.schema!==1||!Array.isArray(index.editions))throw Error('Invalid site index');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 index.editions=index.editions.filter(e=>!(e.kind===edition.kind&&e.edition===edition.edition&&e.date===edition.date));index.editions.push(edition);index.editions.sort((a,b)=>b.date.localeCompare(a.date));
 if(index.editions.length>2000)throw Error('Archivio pubblico da partizionare prima di aggiungere edizioni');
 await atomic(path.join(root,'index.json'),JSON.stringify(index,null,2)+'\n');
 for(const editionId of ['it','world']){
  const latest=index.editions.find(e=>e.kind==='daily'&&e.edition===editionId);
  if(latest){await mkdir(path.join(root,editionId),{recursive:true,mode:0o755});await atomic(path.join(root,editionId,'latest.json'),JSON.stringify({schema:1,...latest},null,2)+'\n');}
 }
}
/** The index is the commit marker. Only whitelisted, hash-checked public files
 * leave the private artifact tree; raw manifests/reviews/provider data do not. */
export async function publishEditionToSite(job:TgJob,root:string,history:TgPublishedEdition[],now:Date,revalidate:()=>Promise<void>){
 assertSiteReady(job,history,now);root=path.resolve(root);await mkdir(root,{recursive:true,mode:0o755});
 const base=siteEditionPath(job.edition,job.date).replace(/^\/edizioni\//u,''),folder=path.join(root,base),out=path.join(folder,job.review!.bundleSha256!);
 let publishedAt=now.toISOString();try{const old=JSON.parse(await readFile(path.join(out,'release.json'),'utf8'));if(!Number.isFinite(Date.parse(old.publishedAt))||Date.parse(old.publishedAt)>now.getTime())throw Error('Invalid stored publication');publishedAt=old.publishedAt;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 const data=publicSiteEdition(job,publishedAt),temporary=path.join(root,'.staging-'+randomUUID());await mkdir(temporary,{mode:0o700});
 try{
  for(const name of mediaNames){const source=path.join(jobDirectory(job.id),name);if(!(await lstat(source)).isFile())throw Error('Asset non regolare');const target=path.join(temporary,name);await copyFile(source,target);const actual=await fileHash(target),expected=data.media[name];if(actual.bytes!==expected.bytes||actual.sha256!==expected.sha256)throw Error('Asset cambiato: nessuna pubblicazione');await chmod(target,0o644);}
  const json=JSON.stringify(data,null,2)+'\n',html=publicEditionHtml(data);await writeFile(path.join(temporary,'release.json'),json,{mode:0o644});await writeFile(path.join(temporary,'index.html'),html,{mode:0o644});
  await revalidate();await mkdir(folder,{recursive:true,mode:0o755});await chmod(temporary,0o755);
  try{await rename(temporary,out);}catch(error){if(!['EEXIST','ENOTEMPTY'].includes((error as NodeJS.ErrnoException).code??''))throw error;const existing=await readFile(path.join(out,'release.json'),'utf8');if(existing!==json)throw Error('Release immutabile diversa');for(const name of mediaNames){const actual=await fileHash(path.join(out,name));if(actual.sha256!==data.media[name].sha256||actual.bytes!==data.media[name].bytes)throw Error('Release pubblicata alterata');}}
  await atomic(path.join(folder,'index.html'),html);
  const entry={kind:data.kind,edition:data.edition,date:data.date,title:data.title,description:data.description,url:data.url,releaseUrl:data.releaseUrl,publicationKey:data.publicationKey,publishedAt:data.publishedAt,seconds:data.seconds};
  await addSiteIndex(root,entry);
  return{url:data.url,releaseUrl:data.releaseUrl,bundleSha256:data.publicationKey,publishedAt:data.publishedAt,stories:publishedStories(job)};
 }finally{await rm(temporary,{recursive:true,force:true});}
}
