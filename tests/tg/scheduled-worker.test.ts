import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import mongoose from 'mongoose';
import { scriptReviewFixture } from './fixtures';
import { tgSpeechPlan } from '../../src/lib/tg/speech-plan';
import { TgRunModel } from '../../src/models/tg/TgRun';
import {editorialFixture} from './editorial-fixture';
import {build} from 'esbuild';

for(const reused of [false,true])test(`the scheduled worker blocks the unavailable Alex identity without provider calls, reused audio=${reused}`,
  {skip:process.env.TG_INTEGRATION_TESTS!=='true',timeout:30000},async()=>{
    if(process.env.MONGODB_URI!=='mongodb://127.0.0.1:27018'||!process.env.MONGODB_DB_NAME?.startsWith('conclavia_e2e_'))throw new Error('Isolated MongoDB required');
    const root=await mkdtemp(path.join(os.tmpdir(),'cdaily-scheduled-worker-'));
    try{
      await mongoose.connect(process.env.MONGODB_URI,{dbName:process.env.MONGODB_DB_NAME});
      await TgRunModel.init();
      const now=new Date(),job=editorialFixture(now);
      job.state='queued';job.attempts=0;job.assets=[];job.product={...job.product,productionMode:'full',productionStandard:'cdaily-v1',publicationDriver:'chatgpt-work',productionTime:'00:00',publishTime:'23:59',automatic:true};
      job.scriptReview=scriptReviewFixture(job.product,job.date,job.research!,job.script!,now);
      if(reused)job.manifest={version:1,product:job.product,date:job.date,seconds:job.product.seconds,stories:job.research!.stories.map(s=>({...s,whyItMatters:'',changedSinceYesterday:''})),sources:job.research!.sources,cues:job.script!.sentences.map((s,i)=>({...s,start:i*10,end:i*10+5})),speech:tgSpeechPlan(job.product)};
      await TgRunModel.create({...job,_id:job.id});
      // Even if a regression mistakenly asks for fresh research or synthesis,
      // the child cannot reach a paid provider. Mongo uses its own socket driver.
      const deny=path.join(root,'deny-provider.cjs');
      await writeFile(deny,"globalThis.fetch=async()=>{throw new Error('Provider calls forbidden in regression');};\n");
      const result=await new Promise<{code:number;output:string}>(resolve=>{
        const child=spawn(process.execPath,['--require',deny,'--conditions=react-server','--import','tsx','scripts/tg/worker.ts','--once',`--job=${job.id}`,'--no-schedule','--no-publish','--approved-daily'],{
          cwd:process.cwd(),env:{...process.env,TG_ARTIFACT_DIR:root,TG_WORKER_ENABLED:'true',TG_AI_ENABLED:'true',PODCAST_AI_ENABLED:'true',TG_AUTOMATIC_REVIEW_ENABLED:'true',TG_PUBLISH_ENABLED:'false',OPENAI_API_KEY:'',INWORLD_API_KEY:''},stdio:['ignore','pipe','pipe'],
        });
        let output='';child.stdout.on('data',v=>{output+=String(v);});child.stderr.on('data',v=>{output+=String(v);});
        child.once('error',()=>resolve({code:1,output}));child.once('close',code=>resolve({code:code??1,output}));
      });
      assert.equal(result.code,0,result.output);
      const saved=await TgRunModel.findById(job.id).lean().orFail();
      assert.equal(saved.state,'blocked',result.output);assert.match(saved.issues.join(' '),/Alex 2.*chiave ElevenLabs/u);
      assert.equal(saved.assets.length,0);assert.equal(saved.manifest,undefined);assert.equal(saved.attempts,1);assert.equal(saved.scriptReview?.passed,true);
      assert.equal(await readFile(path.join(root,job.id,'social-summary.txt'),'utf8'),job.script!.description+'\n');
      assert.match(await readFile(path.join(root,job.id,'edition-dossier.md'),'utf8'),new RegExp(job.date));
      assert.doesNotMatch(result.output,/Provider calls forbidden/u);
    }finally{
      if(mongoose.connection.readyState===1)await mongoose.connection.dropDatabase();
      await mongoose.disconnect();await rm(root,{recursive:true,force:true});
    }
  });

test('scheduled editorial mode finishes and stays idle on a second tick with all providers denied',
  {skip:process.env.TG_INTEGRATION_TESTS!=='true',timeout:30000},async()=>{
    if(process.env.MONGODB_URI!=='mongodb://127.0.0.1:27018'||!process.env.MONGODB_DB_NAME?.startsWith('conclavia_e2e_'))throw new Error('Isolated MongoDB required');
    const root=await mkdtemp(path.join(os.tmpdir(),'cdaily-text-worker-'));
    try{
      await mongoose.connect(process.env.MONGODB_URI,{dbName:process.env.MONGODB_DB_NAME});
      const now=new Date(),job=editorialFixture(now);
      job.product={...job.product,productionTime:'00:00',publishTime:'23:59',timezone:'UTC'};
      job.state='queued';job.assets=[];job.attempts=0;
      job.scriptReview=scriptReviewFixture(job.product,job.date,job.research!,job.script!,now);
      await TgRunModel.create({...job,_id:job.id});
      const deny=path.join(root,'deny.cjs');await writeFile(deny,"globalThis.fetch=async()=>{throw Error('Paid providers forbidden');};\n");
      const run=()=>new Promise<{code:number;output:string}>(resolve=>{
        const child=spawn(process.execPath,['--require',deny,'--conditions=react-server','--import','tsx','scripts/tg/worker.ts','--once',`--job=${job.id}`,'--no-schedule','--no-publish','--approved-daily'],{
          cwd:process.cwd(),env:{...process.env,TG_ARTIFACT_DIR:root,TG_WORKER_ENABLED:'true',TG_AI_ENABLED:'true',PODCAST_AI_ENABLED:'true',TG_AUTOMATIC_REVIEW_ENABLED:'true',TG_PUBLISH_ENABLED:'false',OPENAI_API_KEY:'',INWORLD_API_KEY:'',ELEVENLABS_API_KEY:'',TG_ELEVENLABS_API_KEY:''},stdio:['ignore','pipe','pipe'],
        });let output='';child.stdout.on('data',v=>output+=String(v));child.stderr.on('data',v=>output+=String(v));child.once('error',()=>resolve({code:1,output}));child.once('close',code=>resolve({code:code??1,output}));
      });
      const first=await run();assert.equal(first.code,0,first.output);
      const saved=await TgRunModel.findById(job.id).lean().orFail();
      assert.equal(saved.state,'editorial_ready',first.output);assert.equal(saved.attempts,1);assert.equal(saved.approvedAt,undefined);assert.equal(saved.manifest,undefined);assert.deepEqual(saved.assets,[]);
      assert.equal(await readFile(path.join(root,job.id,'social-summary.txt'),'utf8'),job.script!.description+'\n');
      const second=await run();assert.equal(second.code,0,second.output);assert.equal((await TgRunModel.findById(job.id).lean().orFail()).attempts,1);
    }finally{if(mongoose.connection.readyState===1)await mongoose.connection.dropDatabase();await mongoose.disconnect();await rm(root,{recursive:true,force:true});}
  });

test('the standalone host bundle runs outside the checkout, shares the verified pack and imports no media adapter',
  {skip:process.env.TG_INTEGRATION_TESTS!=='true',timeout:30000},async()=>{
    if(process.env.MONGODB_URI!=='mongodb://127.0.0.1:27018'||!process.env.MONGODB_DB_NAME?.startsWith('conclavia_e2e_'))throw Error('Isolated MongoDB required');
    const root=await mkdtemp(path.join(os.tmpdir(),'cdaily-host-'));
    try{
      const outfile=path.join(root,'host.cjs');
      const bundle=await build({entryPoints:['scripts/tg/editorial-host.ts'],outfile,bundle:true,platform:'node',format:'cjs',target:'node22',conditions:['react-server'],metafile:true,logLevel:'silent',external:['kerberos','@mongodb-js/zstd','@aws-sdk/credential-providers','snappy','mongodb-client-encryption','gcp-metadata','socks','aws4']});
      assert.equal(Object.keys(bundle.metafile.inputs).some(x=>/\/tg\/(media\.ts|alex2-speech|publishers|metricool)/u.test(x)),false);
      await mongoose.connect(process.env.MONGODB_URI,{dbName:process.env.MONGODB_DB_NAME});
      const now=new Date(),job=editorialFixture(now);job.state='queued';job.assets=[];job.attempts=0;
      job.product={...job.product,productionTime:'00:00',publishTime:'23:59',timezone:'UTC',enabled:true};
      job.scriptReview=scriptReviewFixture(job.product,job.date,job.research!,job.script!,now);
      await TgRunModel.create({...job,_id:job.id});
      await mongoose.connection.collection('tg_editions').insertOne({edition:'it',product:job.product,revision:1});
      const plan=path.join(root,'plan.json');await writeFile(plan,JSON.stringify({version:1,firstEditionDate:job.date,productionDriver:'systemd',publicationDriver:'chatgpt-work',product:job.product}));
      const deny=path.join(root,'deny.cjs');await writeFile(deny,"globalThis.fetch=async()=>{throw Error('Paid providers forbidden');};\n");
      const result=await new Promise<{code:number;output:string}>(resolve=>{
        const child=spawn(process.execPath,['--require',deny,outfile,'tick'],{cwd:root,env:{NODE_ENV:'test',MONGODB_URI:process.env.MONGODB_URI,MONGODB_DB_NAME:process.env.MONGODB_DB_NAME,TG_AGENT_PLAN_FILE:plan,TG_ARTIFACT_DIR:root,TG_EDITORIAL_ONLY:'true',TG_PUBLISH_ENABLED:'false',OPENAI_API_KEY:'synthetic',TG_AI_ENABLED:'true',PODCAST_AI_ENABLED:'true'},stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',v=>output+=String(v));child.stderr.on('data',v=>output+=String(v));child.once('error',()=>resolve({code:1,output}));child.once('close',code=>resolve({code:code??1,output}));
      });
      assert.equal(result.code,0,result.output);assert.equal((await TgRunModel.findById(job.id).lean().orFail()).state,'editorial_ready',result.output);
      assert.equal(await readFile(path.join(root,job.id,'social-summary.txt'),'utf8'),job.script!.description+'\n');
    }finally{if(mongoose.connection.readyState===1)await mongoose.connection.dropDatabase();await mongoose.disconnect();await rm(root,{recursive:true,force:true});}
  });
