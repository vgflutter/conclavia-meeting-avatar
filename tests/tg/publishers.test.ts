import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { startDelivery, pollDelivery, type DeliveryReceipt } from '../../src/lib/tg/publishers';
import { TG_PRODUCTS } from '../../src/lib/tg/config';
import { publicationCopy } from '../../src/lib/tg/presentation';
import type { TgJob } from '../../src/lib/tg/types';
const fixture=():TgJob=>({id:'d'.repeat(24),edition:'it',date:'2026-10-18',state:'ready',product:TG_PRODUCTS[0],assets:[],issues:[],events:[],attempts:1,createdAt:'2026-10-18',updatedAt:'2026-10-18',deliveries:[]});
const reply=(data:unknown)=>Response.json(data);
test('YouTube checks the target channel, declares AI media, stores receipt and checks actual visibility',async()=>{
 const original=globalThis.fetch,dir=await mkdtemp(path.join(os.tmpdir(),'tg-publisher-')),calls:{url:string;body:unknown}[]=[],saved:DeliveryReceipt[]=[];
 process.env.TG_ARTIFACT_DIR=dir;process.env.TG_IT_YOUTUBE_CLIENT_ID='synthetic-client';process.env.TG_IT_YOUTUBE_CLIENT_SECRET='synthetic-secret';process.env.TG_IT_YOUTUBE_REFRESH_TOKEN='synthetic-refresh';process.env.TG_IT_YOUTUBE_CHANNEL_ID='synthetic-channel';
 await mkdir(path.join(dir,fixture().id));await writeFile(path.join(dir,fixture().id,'landscape.mp4'),'SYNTHETIC_VIDEO');
 globalThis.fetch=async(input,init)=>{const url=String(input);calls.push({url,body:init?.body});if(url.includes('oauth2.googleapis.com'))return reply({access_token:'synthetic-access'});if(url.includes('/channels?'))return reply({items:[{id:'synthetic-channel'}]});if(url.includes('uploadType=resumable'))return new Response(null,{status:200,headers:{location:'https://www.googleapis.com/upload/session-fixture'}});if(url.includes('session-fixture'))return reply({id:'fixture-video'});if(url.includes('/videos?'))return reply({items:[{snippet:{channelId:'synthetic-channel'},status:{uploadStatus:'processed',privacyStatus:'public'}}]});throw new Error('Unstubbed network');};
 try{const receipt=await startDelivery(fixture(),'youtube',undefined,new AbortController().signal,async r=>{saved.push(r);});assert.equal(receipt.state,'submitted');assert.equal(saved[0].remoteId,'fixture-video');const meta=JSON.parse(String(calls.find(c=>c.url.includes('uploadType=resumable'))!.body));assert.equal(meta.status.containsSyntheticMedia,true);assert.equal(meta.status.privacyStatus,'public');assert.equal((await pollDelivery(fixture(),'youtube',receipt.remoteId,new AbortController().signal)).state,'published');}
 finally{globalThis.fetch=original;await rm(dir,{recursive:true,force:true});}
});
test('TikTok never contacts a platform when Metricool configuration is missing',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;throw new Error('No TikTok request should be made');};
 try{await assert.rejects(startDelivery(fixture(),'tiktok','https://media.example/video.mp4',new AbortController().signal,async()=>undefined),/Metricool incompleto/);assert.equal(calls,0);}
 finally{globalThis.fetch=original;}
});
test('Instagram preserves the processing container and publishes only once it finishes',async()=>{
 const original=globalThis.fetch,saved:DeliveryReceipt[]=[],urls:string[]=[];process.env.TG_META_GRAPH_VERSION='v24.0';process.env.TG_IT_INSTAGRAM_ACCESS_TOKEN='synthetic-token';process.env.TG_IT_INSTAGRAM_ACCOUNT_ID='12345';
 const job={...fixture(),script:{title:'La puntata di prova',description:'Sintesi di prova con quattro temi verificati. '.repeat(20),sentences:[]}};
 const expected=publicationCopy(job,'instagram');
 globalThis.fetch=async(input,init)=>{const url=String(input);urls.push(url);if(url.includes('fields=id,username'))return reply({id:'12345',username:'conclavia_tg_fixture'});if(url.endsWith('/media')){const body=JSON.parse(String(init?.body));assert.equal(body.caption,expected.description);assert.ok(body.caption.includes(job.script.description));assert.equal(body.caption.split(expected.title).length-1,1);return reply({id:'container-fixture'});}if(url.includes('status_code'))return reply({status_code:'FINISHED'});if(url.endsWith('/media_publish'))return reply({id:'published-fixture'});throw new Error('Unstubbed network');};
 try{const result=await startDelivery(job,'instagram','https://media.example/video.mp4',new AbortController().signal,async r=>{saved.push(r);});assert.equal(result.state,'submitted');assert.equal(saved[0].remoteId,'container-fixture');assert.equal(urls.some(u=>u.endsWith('/media_publish')),false);assert.equal((await pollDelivery(job,'instagram',result.remoteId,new AbortController().signal)).state,'published');}
 finally{globalThis.fetch=original;}
});

test('YouTube resumes a persisted upload session instead of creating a second video',async()=>{
 const original=globalThis.fetch,dir=await mkdtemp(path.join(os.tmpdir(),'tg-resume-')),calls:string[]=[];
 process.env.TG_ARTIFACT_DIR=dir;await mkdir(path.join(dir,fixture().id));await writeFile(path.join(dir,fixture().id,'landscape.mp4'),'SYNTHETIC_VIDEO');
 globalThis.fetch=async(input,init)=>{const url=String(input);calls.push(url);if(url.includes('oauth2.googleapis.com'))return reply({access_token:'synthetic'});if(url.includes('/channels?'))return reply({items:[{id:'synthetic-channel'}]});if(url.includes('saved-session')){if(new Headers(init?.headers).get('Content-Length')==='0')return new Response(null,{status:308,headers:{range:'bytes=0-3'}});assert.equal(Buffer.from(init?.body as Uint8Array).toString(),'HETIC_VIDEO');return reply({id:'resumed-video'});}throw new Error('Unexpected request');};
 try{await startDelivery(fixture(),'youtube',undefined,new AbortController().signal,async()=>undefined,{remoteSession:'https://www.googleapis.com/upload/saved-session'});assert.equal(calls.some(url=>url.includes('uploadType=resumable')),false);}
 finally{globalThis.fetch=original;await rm(dir,{recursive:true,force:true});}
});

test('TikTok verifies the dedicated brand, uploads media, labels AI, and waits for the real published receipt',async()=>{
 const original=globalThis.fetch,dir=await mkdtemp(path.join(os.tmpdir(),'tg-metricool-')),saved:DeliveryReceipt[]=[];let postBody:Record<string,unknown>|undefined,published=false;
 Object.assign(process.env,{TG_ARTIFACT_DIR:dir,TG_METRICOOL_TOKEN:'synthetic-token',TG_METRICOOL_USER_ID:'888',TG_IT_METRICOOL_BLOG_ID:'777',TG_IT_TIKTOK_USERNAME:'conclaviatg_it'});
 await mkdir(path.join(dir,fixture().id));await writeFile(path.join(dir,fixture().id,'portrait.mp4'),'SYNTHETIC_VIDEO');
 globalThis.fetch=async(input,init)=>{
   const url=new URL(String(input));
   if(url.hostname.endsWith('amazonaws.com'))return new Response(null,{status:200});
   assert.equal(url.hostname,'app.metricool.com');assert.equal(url.searchParams.get('blogId'),'777');assert.equal(new Headers(init?.headers).get('X-Mc-Auth'),'synthetic-token');
   if(url.pathname.endsWith('/simpleProfiles'))return reply([{id:777,tiktok:'conclaviatg_it'}]);
   if(url.pathname.endsWith('/creator-info'))return reply({data:{creatorUsername:'conclaviatg_it',privacyLevelOptions:['PUBLIC_TO_EVERYONE'],maxVideoPostDurationSec:600,commentDisabled:false,duetDisabled:true,stitchDisabled:true}});
   if(url.pathname.endsWith('/upload-transactions'))return init?.method==='PUT'?reply({data:{uploadType:'SIMPLE',presignedUrl:'https://metricool-upload.s3.eu-west-1.amazonaws.com/upload',fileUrl:'https://metricool-upload.s3.eu-west-1.amazonaws.com/video.mp4'}}):reply({data:{fileUrl:'https://metricool-download.s3.eu-west-1.amazonaws.com/video.mp4'}});
   if(url.pathname.endsWith('/posts/123'))return reply({data:{id:123,providers:[{network:'tiktok',status:published?'PUBLISHED':'PENDING',publicUrl:'https://www.tiktok.com/@conclaviatg_it/video/123'}]}});
   if(url.pathname.endsWith('/posts')){postBody=JSON.parse(String(init?.body));return reply({data:{id:123}});}
   throw new Error('Unexpected request');
 };
 try{
  const result=await startDelivery(fixture(),'tiktok',undefined,new AbortController().signal,async r=>{saved.push(r);});assert.equal(result.state,'submitted');assert.equal(saved[0].remoteId,'123');
  assert.deepEqual(postBody?.media,['https://metricool-download.s3.eu-west-1.amazonaws.com/video.mp4']);assert.equal((postBody?.tiktokData as {isAigc:boolean}).isAigc,true);assert.equal(postBody?.autoPublish,true);
  assert.equal((await pollDelivery(fixture(),'tiktok','123',new AbortController().signal)).state,'submitted');published=true;assert.equal((await pollDelivery(fixture(),'tiktok','123',new AbortController().signal)).state,'published');
 }finally{globalThis.fetch=original;await rm(dir,{recursive:true,force:true});}
});

test('TikTok refuses a connected brand from another project before any media or post mutation',async()=>{
 const original=globalThis.fetch;let writes=0;
 globalThis.fetch=async(_input,init)=>{if(init?.method&&init.method!=='GET')writes++;return reply([{id:777,tiktok:'another_project'}]);};
 try{await assert.rejects(startDelivery(fixture(),'tiktok',undefined,new AbortController().signal,async()=>undefined),/non corrisponde/);assert.equal(writes,0);}finally{globalThis.fetch=original;}
});
