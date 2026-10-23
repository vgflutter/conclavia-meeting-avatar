/** Bounded local UI/production-adapter proof. No writes to DB or providers. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const origin='http://127.0.0.1:3107';
const chest=process.argv.includes('--palms-chest'),closer=chest||process.argv.includes('--palms-closer');
const dossier=chest?'cdaily-palms-chest':closer?'cdaily-palms-closer':'cdaily-editorial-acting';
const folder=chest?'docs/images/daily-palms-chest-20261023/ui':closer?'docs/images/daily-palms-closer-20261023/ui':'docs/images/daily-editorial-acting-20261023';
await mkdir(folder,{recursive:true});
const browser=await chromium.launch({channel:'chrome'}),results=[],errors=[];
try{
 const page=await browser.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.request().method()==='GET'&&new URL(r.request().url()).origin===origin?r.continue():r.abort());
 const examples=[];
 const cases=['reassure','reflect'].flatMap(intent=>[390,1440].flatMap(width=>[{intent,width,detail:false},...(closer&&intent==='reassure'?[{intent,width,detail:true}]:[])]));
 for(const {intent,width,detail} of cases){
  await page.setViewportSize({width,height:1100});
  await page.goto(`${origin}/daily-launch/hand-lab/index.html?pose=editorial-${intent}${detail?'&detail=1':''}`);
  await page.waitForFunction(()=>window.conclaviaHandProof);
  const proof=await page.evaluate(at=>{
   const p=window.conclaviaHandProof;p.frame(at,false);
   const before=JSON.stringify(p.sample());p.frame(at,false);
   return {duration:p.duration,score:p.score,plan:p.plan,paused:before===JSON.stringify(p.sample()),
    mouthOpen:p.sample().pose.mouthOpen,overflow:document.documentElement.scrollWidth>innerWidth+1};
  },closer&&intent==='reassure'?2.25:2.1);
  assert.equal(proof.duration,8);assert.equal(proof.score.intent,intent);
  assert.ok(proof.plan.strokes.some(s=>s.kind===(intent==='reassure'?'palms-joined':'chin-touch')));
  assert.equal(proof.paused,true);assert.equal(proof.mouthOpen,false);assert.equal(proof.overflow,false);
  await page.screenshot({path:`${folder}/${intent}-${width}${detail?'-detail':''}.png`,fullPage:true});
  const result={kind:'editorial-lab',intent,width,detail,duration:8,overflow:false,paused:true,audio:false};results.push(result);console.log(JSON.stringify(result));
  if(width===390&&!detail)examples.push(proof);
 }
 for(const example of examples)for(const portrait of [false,true]){
  await page.setViewportSize({width:1280,height:800});
  await page.goto(origin+'/podcast/tg/render');
  await page.waitForFunction(()=>window.conclaviaTgRender||window.conclaviaTgRenderError);
  const result=await page.evaluate(({example,portrait})=>{
   if(window.conclaviaTgRenderError)throw Error(window.conclaviaTgRenderError);
   const r=window.conclaviaTgRender,manifest={version:1,date:'2026-10-23',seconds:8,
    product:{edition:'it',language:'it',presenters:1,name:'CDaily',seconds:8},sources:[],
    stories:[{id:'example',headline:'Prova di regia editoriale',whyItMatters:'Una frase, un’intenzione e un movimento coerente.',changedSinceYesterday:'',sourceIds:[]}],
    cues:[{...example.score,speaker:0,storyId:'example',sourceIds:[],start:0,end:8,choreography:example.plan,performanceWindow:{start:0,end:8}}]};
   r.prepare(manifest,portrait);let peak=0;
   for(let i=0;i<=200;i++){
    r.frame(i/25,false);const actor=r.sample().actors[0];
    if(actor.mouthOpen)throw Error('Silent production proof invented speech');
    if(!actor.standingKinematics)throw Error('Anatomical production controller was not activated');
    peak=Math.max(peak,example.score.intent==='reassure'?(actor.motion.handsPrayer??0):Math.max(actor.motion.left.chinTouch??0,actor.motion.right.chinTouch??0));
   }
   return {kind:'production-adapter',intent:example.score.intent,portrait,frames:201,peak,audio:false};
  },{example,portrait});
  assert.ok(result.peak>.95,'the production adapter must actually execute the contact');
  results.push(result);console.log(JSON.stringify(result));
 }
 assert.deepEqual(errors,[]);
 await writeFile(`docs/tg/${dossier}-ui-verification-20261023.json`,JSON.stringify({origin,providerCalls:0,databaseWrites:0,errors,results},null,2)+'\n');
}finally{await browser.close();}
