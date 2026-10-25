import assert from 'node:assert/strict';
import {test} from 'node:test';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {editorialWorkspace,rehearsalProduct} from '../../src/lib/tg/rehearsal';
import {editionSlot} from '../../src/lib/tg/schedule';
import {publishedHistory} from '../../src/lib/tg/history';
import {editorialFixture} from './editorial-fixture';

test('a rehearsal has separate private artifacts and review, without overwriting the ordinary written edition',()=>{
 const root='/private/tmp/rehearsal-fixture',ordinary=editorialWorkspace(root,'2026-10-25'),trial=editorialWorkspace(root,'2026-10-25','prova-serale');
 assert.equal(ordinary.directory,path.join(root,'.tg-artifacts/editorial/2026-10-25'));
 assert.equal(ordinary.reviewDocument,path.join(root,'docs/tg/editions/2026-10-25-it-editorial-review.md'));
 assert.equal(trial.reviewDocument,path.join(trial.directory,'review.md'));
 assert.equal(trial.artifactDirectory,path.join(trial.directory,'artifacts'));
 assert.ok(!trial.directory.startsWith(ordinary.directory));assert.ok(!trial.directory.includes('/public/'));
 for(const id of ['../escape','a/b','/tmp/x','', 'a'.repeat(49)])assert.throws(()=>editorialWorkspace(root,'2026-10-25',id));
 assert.throws(()=>editorialWorkspace(root,'2026-02-31','prova-serale'));
});
test('the private evening window never changes the morning schedule, skips approval or writes publication memory',()=>{
 const now=new Date('2026-10-25T17:00:00Z'),job=editorialFixture(now);
 const production={...job.product,productionMode:'full' as const,textReviewMode:'manual' as const,productionTime:'07:30',publishTime:'08:15',timezone:'Europe/Rome',enabled:true};
 const before=JSON.stringify(production),trial=rehearsalProduct(production,now);
 assert.equal(JSON.stringify(production),before);assert.equal(trial.enabled,false);assert.equal(trial.textReviewMode,'manual');
 assert.equal(trial.productionTime,'18:00');assert.equal(trial.publishTime,'19:30');
 assert.equal(editionSlot(trial,job.date).closesAt,'2026-10-25T19:00:00.000Z');
 for(const state of ['editorial_ready','needs_review','ready'] as const)assert.deepEqual(publishedHistory([{...job,product:trial,state,assets:[],deliveries:[]}],[],now),[]);
 assert.throws(()=>rehearsalProduct(production,new Date('2026-10-25T22:00:00Z')),/Troppo tardi/u);
});
test('the media command can inspect an isolated rehearsal offline but cannot turn a plan into user confirmation',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cdaily-private-plan-'));
 try{
  const now=new Date(),date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(now),workspace=editorialWorkspace(root,date,'prova-test');
  const job=editorialFixture(now);job.date=date;job.state='editorial_ready';job.assets=[];job.product={...job.product,enabled:false,productionMode:'full',textReviewMode:'manual'};
  await mkdir(workspace.directory,{recursive:true});await mkdir(path.join(root,'config/tg'),{recursive:true});
  const config='{}\n';await writeFile(path.join(root,'config/tg/daily-agent.json'),config);
  await writeFile(path.join(workspace.directory,'isolation.json'),JSON.stringify({kind:'private-rehearsal',date,rehearsal:'prova-test',registeredInDatabase:false,publicationEligible:false,productionScheduleSha256:createHash('sha256').update(config).digest('hex')}));
  const session=JSON.stringify(job);await writeFile(path.join(workspace.directory,'session.json'),session);
  const deny=path.join(root,'deny.cjs');await writeFile(deny,"globalThis.fetch=async()=>{throw Error('Network forbidden');};require('node:net').Socket.prototype.connect=function(){throw Error('Socket forbidden');};\n");
  const run=(dry:boolean)=>new Promise<{code:number;stdout:string;stderr:string}>(resolve=>{
   const child=spawn(process.execPath,['--require',deny,'--conditions=react-server','--import',pathToFileURL(createRequire(path.resolve('package.json')).resolve('tsx')).href,path.resolve('scripts/tg/rehearsal-media.ts'),'--rehearsal=prova-test',...(dry?['--dry-run']:[])],{cwd:root,env:{...process.env,TSX_TSCONFIG_PATH:path.resolve('tsconfig.json'),TG_PUBLISH_ENABLED:'false',PODCAST_SPEECH_ENABLED:'true',TG_EDITORIAL_ONLY:'false',OPENAI_API_KEY:'',ELEVENLABS_API_KEY:'',MONGODB_URI:''},stdio:['ignore','pipe','pipe']});
   let stdout='',stderr='';child.stdout.on('data',v=>stdout+=v);child.stderr.on('data',v=>stderr+=v);child.once('error',()=>resolve({code:1,stdout,stderr}));child.once('close',code=>resolve({code:code??1,stdout,stderr}));
  });
  const planned=await run(true);assert.equal(planned.code,0,planned.stderr);const report=JSON.parse(planned.stdout);
  assert.equal(report.providerGeneration,false);assert.equal(report.publicationEligible,false);assert.equal(report.manualConfirmationRequired,true);
  const unconfirmed=await run(false);assert.notEqual(unconfirmed.code,0);assert.match(unconfirmed.stderr,/conferma esplicita/u);assert.doesNotMatch(unconfirmed.stderr,/Network forbidden|Socket forbidden/u);
  assert.equal(await readFile(path.join(workspace.directory,'session.json'),'utf8'),session);
  assert.equal(await readFile(path.join(root,'config/tg/daily-agent.json'),'utf8'),config);
 }finally{await rm(root,{recursive:true,force:true});}
});
