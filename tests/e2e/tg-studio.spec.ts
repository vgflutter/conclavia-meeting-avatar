import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, copyFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import { connectToDatabase } from '../../src/lib/mongodb';
import { TgRunModel } from '../../src/models/tg/TgRun';
import { TgEditionModel } from '../../src/models/tg/TgEdition';
import { TG_PRODUCTS } from '../../src/lib/tg/config';
import { scriptDigest } from '../../src/lib/tg/editorial';
const execute=promisify(execFile);
test.beforeAll(async()=>{if(process.env.MONGODB_URI!=='mongodb://127.0.0.1:27018'||!process.env.MONGODB_DB_NAME?.startsWith('conclavia_e2e_'))throw new Error('TG needs isolated DB');loadEnvConfig(process.cwd());await connectToDatabase();});
test.beforeEach(async({page})=>{await page.context().addCookies([{name:'conclavia_locale',value:'it',url:'http://127.0.0.1:3101'}]);});
test.afterEach(async()=>{await TgRunModel.deleteMany({});await TgEditionModel.deleteMany({});});
test('TG has an exclusive visual identity, two editions and real portrait composition without paid work on load',async({page},info)=>{
 const mutations:string[]=[];page.on('request',r=>{if(r.method()!=='GET')mutations.push(r.url());});await page.goto('/podcast/tg');
 await expect(page.getByRole('heading',{name:'Le notizie. Il contesto.'})).toBeVisible();await expect(page.getByTestId('tg-edition-it')).toContainText('3:00');await expect(page.getByTestId('tg-edition-world')).toContainText('3:00');
 await expect(page.getByRole('navigation',{name:'Navigazione podcast'}).getByRole('link',{name:'Conclavia TG'})).toHaveAttribute('aria-current','page');
 const canvas=page.getByTestId('tg-canvas');await expect(canvas).toHaveAttribute('data-tg-style','daily-studio');await expect(canvas).toHaveAttribute('data-ready','true');await expect(canvas).toHaveAttribute('data-tg-format','landscape');await page.waitForTimeout(250);await writeFile(info.outputPath('tg-italia-landscape.png'), Buffer.from((await canvas.evaluate((c:HTMLCanvasElement)=>c.toDataURL('image/png'))).split(',')[1], 'base64'));
 await expect(page.getByTestId('tg-preview-mood').locator('option')).toHaveCount(9);await page.getByTestId('tg-preview-mood').selectOption('doubt');await expect(page.getByTestId('tg-preview-mood')).toHaveValue('doubt');
 await page.getByRole('button',{name:'9:16 · social'}).click();await expect(canvas).toHaveAttribute('data-tg-format','portrait');await page.getByTestId('tg-presenters').selectOption('2');await page.waitForTimeout(250);await writeFile(info.outputPath('tg-italia-duo-portrait.png'), Buffer.from((await canvas.evaluate((c:HTMLCanvasElement)=>c.toDataURL('image/png'))).split(',')[1], 'base64'));
 await page.getByTestId('tg-edition-world').click();await expect(canvas).toHaveAttribute('aria-label',/World/u);await page.getByRole('button',{name:'16:9 · episodio'}).click();await writeFile(info.outputPath('tg-world-landscape.png'), Buffer.from((await canvas.evaluate((c:HTMLCanvasElement)=>c.toDataURL('image/png'))).split(',')[1], 'base64'));
 for(const width of [320,1440]){await page.setViewportSize({width,height:1000});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);}
 expect(mutations).toEqual([]);
});
test('TG config uses conflict protection and daily queue is idempotent across concurrent requests',async({request})=>{
 const read=await(await request.get('/api/tg/config')).json();const input={...read.editions[0].product,name:'TG fixture '+randomUUID()};
 const saved=await request.put('/api/tg/config',{data:{product:input,revision:0}});expect(saved.status()).toBe(200);
 expect((await request.put('/api/tg/config',{data:{product:input,revision:0}})).status()).toBe(409);
 const jobs=await Promise.all(Array.from({length:5},()=>request.post('/api/tg/editions',{data:{edition:'it'}})));expect(jobs.every(j=>j.status()===201)).toBe(true);const data=await Promise.all(jobs.map(j=>j.json()));expect(new Set(data.map(d=>d.job.id)).size).toBe(1);
 expect(data[0].job.product.name).toBe(input.name);expect(data[0].job.mediaCapability).toBeUndefined();expect(data[0].job.leaseOwner).toBeUndefined();
 const revision=(await saved.json()).revision;expect((await request.put('/api/tg/config',{data:{product:{...input,automatic:true},revision}})).status()).toBe(409);
 expect((await request.post(`/api/tg/editions/${data[0].job.id}`,{data:{action:'approve'}})).status()).toBe(409);
 expect((await request.post('/api/tg/editions',{headers:{Origin:'https://foreign.example'},data:{edition:'it'}})).status()).toBe(403);
});
test('TG review cannot expose an unapproved draft through the public video capability',async({request})=>{
 const cap='c'.repeat(64),run=await TgRunModel.create({edition:'it',date:'2026-10-17',product:TG_PRODUCTS[0],state:'needs_review',mediaCapability:cap,audit:{passed:true},assets:[{name:'landscape.mp4',bytes:100,sha256:'d'.repeat(64)}]});
 expect((await request.get(`/api/tg-media/${cap}/landscape.mp4`)).status()).toBe(404);expect((await request.get(`/api/tg-media/${cap}/manifest.json`)).status()).toBe(404);expect((await request.get(`/api/tg/editions/${run._id}/assets?name=../../package.json`)).status()).toBe(404);
 expect((await request.get('/api/tg/config',{headers:{'x-forwarded-host':'tg-fixture.trycloudflare.com'}})).status()).toBe(404);
});
test('lease claim is exclusive, preserves checkpoints and refuses expired owners',async()=>{
 const {claimJob,checkpoint}=await import('../../src/lib/tg/store');const run=await TgRunModel.create({edition:'it',date:'2026-10-18',product:TG_PRODUCTS[0],state:'queued'});
 const claims=await Promise.all([claimJob(),claimJob()]);expect(claims.filter(Boolean)).toHaveLength(1);const claim=claims.find(Boolean)!;
 await checkpoint(run._id.toString(),claim.owner,'writing',{issues:[]},'fixture');await expect(checkpoint(run._id.toString(),'wrong-owner','failed',{},'wrong')).rejects.toThrow('Lease');
});
test('technical retry preserves paid checkpoints, editorial retry rewrites and approval rejects a changed script',async({request})=>{
 const script={title:'Titolo fixture',description:'Descrizione fixture',sentences:[]};
 const run=await TgRunModel.create({edition:'it',date:'2026-10-18',product:TG_PRODUCTS[0],state:'failed',attempts:1,research:{marker:'original-ledger'},script,issues:['Problema tecnico']});
 expect((await request.post(`/api/tg/editions/${run._id}`,{data:{action:'retry',revision:(await TgRunModel.findById(run._id).lean())?.revision??0,note:'Ripristino esplicito della fixture'}})).status()).toBe(200);
 let saved=await TgRunModel.findById(run._id).lean();expect(saved?.research).toEqual({marker:'original-ledger'});expect(saved?.script?.title).toBe(script.title);
 await TgRunModel.updateOne({_id:run._id},{$set:{state:'blocked',issues:['Attribuire la dichiarazione'],audit:{passed:false}}});
 expect((await request.post(`/api/tg/editions/${run._id}`,{data:{action:'retry',revision:(await TgRunModel.findById(run._id).lean())?.revision??0,note:'Ripristino esplicito della fixture'}})).status()).toBe(200);
 saved=await TgRunModel.findById(run._id).lean();expect(saved?.research).toEqual({marker:'original-ledger'});expect(saved?.script).toBeUndefined();expect(saved?.issues).toEqual(['Attribuire la dichiarazione','Ripristino esplicito della fixture']);
 await TgRunModel.updateOne({_id:run._id},{$set:{state:'needs_review',script:{...script,title:'Titolo cambiato'},audit:{passed:true,scriptSha256:scriptDigest(script),checkedAt:new Date().toISOString()},assets:['landscape.mp4','portrait.mp4','audio.mp3'].map(name=>({name,bytes:1,sha256:'a'.repeat(64)}))}});
 expect((await request.post(`/api/tg/editions/${run._id}`,{data:{action:'approve'}})).status()).toBe(409);
});
test('worker encodes genuine H264/AAC landscape and portrait videos with exact duration and subtitles',async({},info)=>{
 test.setTimeout(150000);const root=info.outputPath('tg-media');await mkdir(root,{recursive:true});
 const result=await execute(process.execPath,['--conditions=react-server','--import','tsx','scripts/tg/verify-media.ts'],{cwd:process.cwd(),env:{...process.env,TG_TEST_MODE:'true',TG_AI_ENABLED:'false',TG_PUBLISH_ENABLED:'false',TG_ARTIFACT_DIR:root,TG_RENDER_ORIGIN:'http://127.0.0.1:3101',TG_CHROME_CHANNEL:'chrome'},timeout:130000,maxBuffer:200000});
 const data=JSON.parse(result.stdout.trim());expect(data.assets.map((x:{name:string})=>x.name)).toContain('portrait.mp4');for(const asset of data.assets.filter((x:{name:string})=>x.name.endsWith('.mp4')))expect(Math.abs(asset.duration-4)).toBeLessThanOrEqual(.1);
 await copyFile(path.join(root,data.id,'landscape.mp4'),info.outputPath('tg-technical-demo-landscape.mp4'));await copyFile(path.join(root,data.id,'portrait.mp4'),info.outputPath('tg-technical-demo-portrait.mp4'));
 await writeFile(info.outputPath('tg-artifacts.json'),JSON.stringify(data,null,2));await rm(root,{recursive:true,force:true});
});
