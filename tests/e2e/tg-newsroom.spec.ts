import { test, expect } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
import { randomBytes, createHash } from 'node:crypto';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { connectToDatabase } from '../../src/lib/mongodb';
import { TgRunModel } from '../../src/models/tg/TgRun';
import { TgEditionModel } from '../../src/models/tg/TgEdition';
import { TgDeliveryModel } from '../../src/models/tg/TgDelivery';
import { TgPublicationControlModel } from '../../src/models/tg/TgPublicationControl';
import { reviewFixture,scriptReviewFixture,approvalInput } from '../tg/fixtures';
import { TG_REVIEW_CHECKS } from '../../src/lib/tg/presentation';
import {editorialFixture} from '../tg/editorial-fixture';
const created:string[]=[];
test.beforeAll(async()=>{
  if(process.env.MONGODB_URI!=='mongodb://127.0.0.1:27018'||!process.env.MONGODB_DB_NAME?.startsWith('conclavia_e2e_'))throw new Error('Isolated MongoDB required');
  loadEnvConfig(process.cwd());await connectToDatabase();
});
test.beforeEach(async({page})=>{await page.context().addCookies([{name:'conclavia_locale',value:'it',url:'http://127.0.0.1:3101'}]);});
test.afterEach(async()=>{
  await Promise.all([TgRunModel.deleteMany({}),TgEditionModel.deleteMany({}),TgDeliveryModel.deleteMany({}),TgPublicationControlModel.deleteMany({})]);
  for(const id of created.splice(0))await rm(path.join(process.env.TG_ARTIFACT_DIR!,id),{recursive:true,force:true});
});
async function fixture(){
  const job=reviewFixture();job.id=randomBytes(12).toString('hex');job.product.platforms=['youtube'];job.scriptReview=scriptReviewFixture(job.product,job.date,job.research!,job.script!);
  const dir=path.join(process.env.TG_ARTIFACT_DIR!,job.id);created.push(job.id);await mkdir(dir,{recursive:true});
  for(const asset of job.assets){const data=Buffer.from('SYNTHETIC_MEDIA_'+asset.name);await writeFile(path.join(dir,asset.name),data);asset.bytes=data.length;asset.sha256=createHash('sha256').update(data).digest('hex');}
  return TgRunModel.create({...job,_id:job.id,mediaCapability:randomBytes(32).toString('hex')});
}
test('editorial-ready editions expose current downloadable texts without approving or creating media',async({page,request})=>{
  const job=editorialFixture(new Date());job.id=randomBytes(12).toString('hex');job.state='editorial_ready';job.assets=[];
  await TgRunModel.create({...job,_id:job.id});
  await page.goto(`/podcast/tg/redazione?job=${job.id}`);
  await expect(page.getByRole('tab',{name:/Testi verificati/})).toHaveAttribute('aria-selected','true');
  await expect(page.getByText(/Audio, video e pubblicazione sono rinviati/)).toBeVisible();
  const second=page.getByTestId('tg-script-review');await second.locator('summary').first().click();
  const quality=page.getByTestId('tg-quality-review');
  for(const label of ['Naturalezza del parlato','Ripetizioni informative','Pertinenza del contesto','Contributo informativo'])await expect(quality.getByText(`${label} · superata`,{exact:true})).toBeVisible();
  const freshness=page.getByTestId('tg-freshness-review');await freshness.locator('summary').click();
  await expect(page.getByTestId('tg-latest-review')).toHaveCount(job.research!.stories.length);
  await expect(freshness).toContainText('compatibili con il copione');
  const pack=page.getByTestId('tg-social-pack');await pack.locator('summary').click();
  await expect(pack.getByRole('link',{name:'social-summary.txt ↓'})).toBeVisible();
  const url=`/api/tg/editions/${job.id}/texts?name=social-summary.txt`;
  const response=await request.get(url);expect(response.status()).toBe(200);expect(await response.text()).toBe(job.script!.description+'\n');
  expect(response.headers()['x-cdaily-editorial-status']).toBe('verified');expect(response.headers()['x-cdaily-publication']).toBe('unpublished');
  await TgRunModel.updateOne({_id:job.id},{$set:{'script.description':'Una descrizione aggiornata ancora da verificare.'}});
  const changed=await request.get(url);expect(await changed.text()).toContain('Una descrizione aggiornata');expect(changed.headers()['x-cdaily-editorial-status']).toBe('draft');
  expect((await request.get(`/api/tg/editions/${job.id}/texts?name=../../.env.local`)).status()).toBe(404);
  expect((await TgDeliveryModel.countDocuments({jobId:job.id}))).toBe(0);
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:1000});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);}
});
test('the manual text gate requires an explicit read confirmation and queues the same reviewed edition for the Mac',async({page,request},info)=>{
  const now=new Date(),job=editorialFixture(now);job.id=randomBytes(12).toString('hex');job.state='editorial_ready';job.assets=[];
  job.product={...job.product,productionMode:'full',textReviewMode:'manual',productionTime:'00:00',publishTime:'23:59',timezone:'UTC'};
  job.scriptReview=scriptReviewFixture(job.product,job.date,job.research!,job.script!,now);
  await TgRunModel.create({...job,_id:job.id});
  await page.goto(`/podcast/tg/redazione?job=${job.id}`);
  const gate=page.getByTestId('tg-text-approval'),confirm=gate.getByRole('button',{name:'Conferma testo e avvia produzione'});
  await expect(confirm).toBeDisabled();await gate.getByLabel('Revisore del copione').fill('Revisore sintetico');
  await expect(confirm).toBeDisabled();
  await gate.getByRole('checkbox',{name:'Ho letto e confermo questo copione e lo score di mood e intenzioni'}).check();
  await expect(confirm).toBeEnabled();
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:1000});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);}
  await gate.screenshot({path:info.outputPath('daily-confirm-text.png')});
  await confirm.click();await expect(page.getByText(/Copione e mood confermati/)).toBeVisible();
  const saved=await TgRunModel.findById(job.id).lean().orFail();
  expect(saved.state).toBe('queued');expect(saved.textApproval?.reviewer).toBe('Revisore sintetico');
  expect(saved.attempts).toBe(job.attempts);expect(saved.assets).toEqual([]);expect(saved.approvedAt).toBeUndefined();
  expect(await TgDeliveryModel.countDocuments({jobId:job.id})).toBe(0);
  expect((await request.post(`/api/tg/editions/${job.id}`,{data:{action:'approve-text',revision:0,confirmed:true,reviewer:'Stale fixture'}})).status()).toBe(409);
});
test('the newsroom exposes the exact speech score and a missing B blocks approval despite a positive fact audit',async({page,request})=>{
  const record=await fixture(),id=record._id.toString();
  await page.goto(`/podcast/tg/redazione?job=${id}`);
  const second=page.getByTestId('tg-script-review');await expect(second.locator('summary').first()).toContainText('copione e recitazione verificati');
  const pack=page.getByTestId('tg-social-pack');await pack.locator('summary').click();
  await expect(pack.locator('pre')).toContainText('Tre aggiornamenti con fonti verificabili.');
  await expect(pack.getByRole('heading')).toHaveCount(3);
  await second.locator('summary').first().click();await second.getByText('Score di mood e intenzioni',{exact:true}).click();
  await expect(second.locator('pre').last()).toContainText('<mood:attention');
  for(const width of [390,1440]){await page.setViewportSize({width,height:1000});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);}
  await TgRunModel.updateOne({_id:id},{$unset:{scriptReview:1}});await page.reload();
  await expect(page.getByTestId('tg-script-review')).toContainText('Secondo controllo assente');
  await page.getByLabel('Revisore',{exact:true}).fill('Fixture editor');
  for(const label of Object.values(TG_REVIEW_CHECKS))await page.getByLabel(label,{exact:true}).check();
  await page.getByRole('group',{name:'Canali da autorizzare per questa uscita'}).getByRole('checkbox',{name:/YouTube/}).check();
  await expect(page.getByRole('button',{name:'Approva e programma'})).toBeDisabled();
  const response=await request.post(`/api/tg/editions/${id}`,{data:{action:'approve',revision:0,...approvalInput()}});
  expect(response.status()).toBe(409);expect((await TgDeliveryModel.countDocuments({jobId:id}))).toBe(0);
});
test('dedicated newsroom has review, schedule, channels and responsive layout without mutations on load',async({page},info)=>{
  const writes:string[]=[];page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.url());});
  await page.goto('/podcast/tg/redazione');await expect(page.getByRole('heading',{name:'Redazione e pubblicazione',exact:true})).toBeVisible();
  await expect(page.getByRole('navigation',{name:'Studio TG'}).getByRole('link',{name:'Redazione e pubblicazione'})).toHaveAttribute('aria-current','page');
  await expect(page.getByText('Invii reali disabilitati', {exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Attiva distribuzione'})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Verifica collegamenti senza pubblicare'})).toBeVisible();
  await expect(page.getByLabel('Avvio creazione',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Regia della pubblicazione',{exact:true})).toBeVisible();
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:1000});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);}
  await page.screenshot({path:info.outputPath('tg-newsroom-empty-desktop.png'),fullPage:true});expect(writes).toEqual([]);
});
test('editor reviews the actual package, programs selected channels and can withdraw before dispatch',async({page,request},info)=>{
  const record=await fixture(),id=record._id.toString();await page.goto(`/podcast/tg/redazione?job=${id}`);
  const approve=page.getByRole('button',{name:'Approva e programma'});await expect(approve).toBeDisabled();
  await page.getByLabel('Revisore',{exact:true}).fill('Redazione test');
  for(const label of Object.values(TG_REVIEW_CHECKS))await page.getByLabel(label,{exact:true}).check();
  await page.getByRole('group',{name:'Canali da autorizzare per questa uscita'}).getByRole('checkbox',{name:/YouTube/}).check();
  await expect(approve).toBeEnabled();await page.screenshot({path:info.outputPath('tg-newsroom-review.png'),fullPage:true});await approve.click();
  await expect(page.getByRole('heading',{name:'Piano approvato'})).toBeVisible();
  const saved=await TgRunModel.findById(id).lean();expect(saved?.state).toBe('ready');expect(saved?.review?.reviewer).toBe('Redazione test');expect(saved?.publicationPlan?.platforms).toEqual(['youtube']);expect(saved?.review?.bundleSha256).toMatch(/^[a-f0-9]{64}$/);
  expect((await request.post(`/api/tg/editions/${id}`,{data:{action:'approve',revision:0}})).status()).toBe(409);
  expect((await request.get(`/api/tg-media/${record.mediaCapability}/landscape.mp4`,{headers:{Range:'bytes=0-7'}})).status()).toBe(206);
  await page.getByLabel('Note editoriali o motivo dell’intervento').fill('Controllo aggiuntivo richiesto prima dell’uscita');await page.getByRole('button',{name:'Ritira approvazione'}).click();
  await expect(page.getByRole('heading',{name:'Revisione editoriale',exact:true})).toBeVisible();expect((await TgRunModel.findById(id).lean())?.approvedAt).toBeUndefined();expect(await TgDeliveryModel.countDocuments({jobId:id})).toBe(0);
  expect((await request.get(`/api/tg-media/${record.mediaCapability}/landscape.mp4`)).status()).toBe(404);
});
test('editorial notes regenerate a rejected draft without approving or publishing it',async({page})=>{
  const record=await fixture(),id=record._id.toString();await page.goto(`/podcast/tg/redazione?job=${id}`);
  await page.getByLabel('Note editoriali o motivo dell’intervento').fill('Sostituire la seconda notizia e attribuire la dichiarazione');
  await page.getByRole('button',{name:'Richiedi correzioni'}).click();await expect(page.getByRole('heading',{name:'Interventi della redazione'})).toBeVisible();
  await page.getByLabel('Note editoriali o motivo dell’intervento').fill('Rigenerare con le correzioni richieste');await page.getByRole('button',{name:'Rigenera con queste note'}).click();
  await expect.poll(async()=>(await TgRunModel.findById(id).lean())?.state).toBe('queued');
  const saved=await TgRunModel.findById(id).lean();expect(saved?.script).toBeUndefined();expect(saved?.research).toBeUndefined();expect(saved?.scriptReview).toBeUndefined();expect(saved?.editorialRepairs).toBe(0);expect(saved?.approvedAt).toBeUndefined();expect(saved?.events.some(e=>e.detail.includes('Rigenerazione richiesta'))).toBe(true);
});
test('an unknown delivery is reconciled by reference and cannot trigger a second upload',async({page})=>{
  const record=await fixture(),id=record._id.toString();await TgRunModel.updateOne({_id:id},{$set:{state:'publishing'}});
  await TgDeliveryModel.create({jobId:id,platform:'youtube',state:'unknown'});
  await page.goto(`/podcast/tg/redazione?job=${id}`);await page.getByText('Riconcilia una ricevuta',{exact:true}).click();
  await page.getByLabel('ID ricevuta',{exact:true}).fill('existing-video-id');await page.getByLabel('Verifica eseguita',{exact:true}).fill('Video già presente sul canale TG: recuperato ID');
  await page.getByRole('button',{name:'Ricontrolla questa ricevuta'}).click();
  await expect.poll(async()=>(await TgDeliveryModel.findOne({jobId:id}).lean())?.state).toBe('submitted');expect(await TgDeliveryModel.countDocuments({jobId:id})).toBe(1);
});
test('management APIs reject cross-origin decisions, stale revisions and approval bypass',async({request})=>{
  const record=await fixture(),id=record._id.toString();
  expect((await request.post(`/api/tg/editions/${id}`,{headers:{Origin:'https://evil.example'},data:{action:'approve',revision:0}})).status()).toBe(403);
  expect((await request.post(`/api/tg/editions/${id}`,{data:{action:'approve',revision:999}})).status()).toBe(409);
  expect((await request.get('/api/tg/newsroom',{headers:{'x-forwarded-host':'tg-newsroom.trycloudflare.com'}})).status()).toBe(404);
  const config=await(await request.get('/api/tg/config')).json();expect((await request.put('/api/tg/config',{data:{product:{...config.editions[0].product,automatic:true},revision:0}})).status()).toBe(409);
  const list=await(await request.get('/api/tg/newsroom')).json();expect(list.jobs[0].mediaCapability).toBeUndefined();expect(list.jobs[0].publicationOwner).toBeUndefined();expect(list.jobs[0].script).toBeUndefined();
});

test('concurrent editorial decisions are exclusive and cancelling a draft leaves no approval',async({request})=>{
 const record=await fixture(),id=record._id.toString();const {approvalInput}=await import('../tg/fixtures');
 const results=await Promise.all([request.post(`/api/tg/editions/${id}`,{data:{action:'approve',revision:0,...approvalInput()}}),request.post(`/api/tg/editions/${id}`,{data:{action:'reject',revision:0,note:'Richiesta di una seconda verifica'}})]);
 expect(results.map(r=>r.status()).sort()).toEqual([200,409]);
 const job=await TgRunModel.findById(id).lean();expect((await request.post(`/api/tg/editions/${id}`,{data:{action:'cancel',revision:job?.revision??0,note:'Edizione annullata dalla redazione'}})).status()).toBe(200);
 const saved=await TgRunModel.findById(id).lean();expect(saved?.state).toBe('cancelled');expect(saved?.approvedAt).toBeUndefined();expect(saved?.publicationPlan).toBeUndefined();expect(await TgDeliveryModel.countDocuments({jobId:id})).toBe(0);
});

test('a persisted YouTube session can be resumed from the GUI API without exposing its URL',async({request})=>{
 const record=await fixture(),id=record._id.toString();const {approvalInput}=await import('../tg/fixtures');
 expect((await request.post(`/api/tg/editions/${id}`,{data:{action:'approve',revision:0,...approvalInput()}})).status()).toBe(200);
 await TgDeliveryModel.create({jobId:id,platform:'youtube',state:'blocked',remoteSession:'https://www.googleapis.com/upload/private-session-fixture'});
 const detail=await(await request.get(`/api/tg/editions/${id}`)).json();expect(detail.job.deliveries[0].resumable).toBe(true);expect(JSON.stringify(detail)).not.toContain('private-session-fixture');
 const resumed=await request.post(`/api/tg/editions/${id}`,{data:{action:'reconcile',revision:detail.job.revision,platform:'youtube',note:'Riprendere esclusivamente la sessione già registrata'}});
 expect(resumed.status()).toBe(200);expect((await TgDeliveryModel.findOne({jobId:id}).lean())?.state).toBe('uploading');expect(await TgDeliveryModel.countDocuments({jobId:id})).toBe(1);
});

test('the calendar previews seven days and unsaved schedule changes do not mutate or create editions',async({page,request},info)=>{
 const writes:string[]=[];page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.url());});
 await page.goto('/podcast/tg/redazione');const calendar=page.getByRole('region',{name:'Calendario delle uscite'});
 await expect(calendar.getByRole('heading',{name:'Prossime uscite'})).toBeVisible();
 const initial=await(await request.get('/api/tg/newsroom')).json();
 const visibleDates=[...new Set<string>(initial.calendar.map((s:{date:string})=>s.date))].sort().slice(0,3);
 await expect(calendar.getByText('Preparazione disattivata',{exact:true})).toHaveCount(initial.calendar.filter((s:{date:string})=>visibleDates.includes(s.date)).length);
 await calendar.getByRole('button',{name:'Mostra sette giorni'}).click();await expect(calendar.getByText('Preparazione disattivata',{exact:true})).toHaveCount(14);
 const data=await(await request.get('/api/tg/newsroom')).json();expect(data.calendar).toHaveLength(14);expect(data.jobs).toHaveLength(0);
 await page.getByLabel('Orario di uscita',{exact:true}).fill('00:15');await expect(page.getByText('Anteprima non salvata',{exact:true})).toBeVisible();
 expect((await(await request.get('/api/tg/config')).json()).editions[0].product.publishTime).toBe('19:15');
 await page.getByLabel('Avvio creazione',{exact:true}).fill('08:00');
 await expect(page.getByRole('alert').filter({hasText:'la creazione deve precedere'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Salva programmazione'})).toBeDisabled();
 await page.getByLabel('Orario di uscita',{exact:true}).fill('09:00');
 await expect(page.getByText('Anteprima non salvata',{exact:true})).toBeVisible();
 expect(writes).toEqual([]);
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:1000});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);}
 await page.screenshot({path:info.outputPath('daily-scheduler-calendar-desktop.png'),fullPage:true});
});

test('Daily clocks can be saved in the GUI while creation and Work publishing remain separate',async({page,request})=>{
  const data=await(await request.get('/api/tg/config')).json(),base=data.editions[0];
  const product={...base.product,productionStandard:'cdaily-v1',productionTime:'08:00',publishTime:'09:00',publicationDriver:'chatgpt-work',automatic:true};
  const saved=await request.put('/api/tg/config',{headers:{Origin:'http://127.0.0.1:3101'},data:{product,revision:base.revision}});
  expect(saved.status()).toBe(200);
  await page.goto('/podcast/tg/redazione');
  await expect(page.getByLabel('Avvio creazione',{exact:true})).toHaveValue('08:00');
  await expect(page.getByLabel('Regia della pubblicazione',{exact:true})).toHaveValue('chatgpt-work');
  await page.getByLabel('Avvio creazione',{exact:true}).fill('07:50');
  await page.getByLabel('Orario di uscita',{exact:true}).fill('09:10');
  await page.getByRole('button',{name:'Salva programmazione'}).click();
  await expect(page.getByText('Programmazione salvata per le prossime edizioni. Le uscite già approvate conservano il loro piano.')).toBeVisible();
  const actual=(await(await request.get('/api/tg/config')).json()).editions[0].product;
  expect(actual.productionTime).toBe('07:50');expect(actual.publishTime).toBe('09:10');expect(actual.publicationDriver).toBe('chatgpt-work');
  expect(await TgRunModel.countDocuments({})).toBe(0);expect(await TgDeliveryModel.countDocuments({})).toBe(0);
});

test('autonomous editions cannot substitute a forged human approval for the final AI review',async({request})=>{
 const record=await fixture(),id=record._id.toString();await TgRunModel.updateOne({_id:id},{$set:{'product.automatic':true}});
 const {approvalInput}=await import('../tg/fixtures');
 const response=await request.post(`/api/tg/editions/${id}`,{data:{action:'approve',revision:0,...approvalInput(),finalReview:{passed:true}}});
 expect(response.status()).toBe(409);expect((await response.json()).error).toContain('revisione AI');
 expect((await TgRunModel.findById(id).lean())?.approvedAt).toBeUndefined();expect(await TgDeliveryModel.countDocuments({jobId:id})).toBe(0);
});

test('a bound AI release exposes only approved media and changing its timeline invalidates the capability',async({request})=>{
 const record=await fixture(),job=reviewFixture(),id=record._id.toString(),stored=await TgRunModel.findById(id).lean();
 job.id=id;job.assets=stored!.assets;job.product={...job.product,automatic:true,platforms:['youtube'],publishTime:new Date().toISOString().slice(11,16)};
 job.scriptReview=scriptReviewFixture(job.product,job.date,job.research!,job.script!);
 job.manifest={version:1,product:job.product,date:job.date,seconds:180,stories:[],sources:job.research!.sources,cues:job.script!.sentences.map((s,i)=>({...s,start:i*10,end:i*10+9}))};
 const {finalReviewInputDigest}=await import('../../src/lib/tg/final-review-policy');const {createAiApproval}=await import('../../src/lib/tg/review');
 job.finalReview={version:1,checkedAt:new Date().toISOString(),model:'fixture',inputSha256:finalReviewInputDigest(job),passed:true,checks:{visual:true,headlines:true,captions:true,emotion:true,publication:true},issues:[],summary:'Controllo simulato dei fotogrammi.',media:([{format:'landscape',width:1920,height:1080},{format:'portrait',width:1080,height:1920}] as const).map(m=>({...m,seconds:180,rms:.1,peak:.8,clippedRatio:0,leadingSilence:.2,trailingSilence:2})),samples:(['landscape','portrait'] as const).flatMap(format=>[1,90,177].map(at=>({format,at})))};
 const approval=createAiApproval(job);await TgRunModel.updateOne({_id:id},{$set:{...job,...approval,state:'ready'}});
 expect((await request.get(`/api/tg-media/${record.mediaCapability}/landscape.mp4`)).status()).toBe(200);
 expect((await request.get(`/api/tg-media/${record.mediaCapability}/manifest.json`)).status()).toBe(404);
 await TgRunModel.updateOne({_id:id},{$set:{'manifest.cues.0.start':1}});
 expect((await request.get(`/api/tg-media/${record.mediaCapability}/landscape.mp4`)).status()).toBe(404);
});
