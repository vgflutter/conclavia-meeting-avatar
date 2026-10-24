import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';
import { publishReadyTg } from '../../src/lib/tg/publishing';
import { TgRunModel } from '../../src/models/tg/TgRun';
import { TgDeliveryModel } from '../../src/models/tg/TgDelivery';
import { TgPublicationControlModel } from '../../src/models/tg/TgPublicationControl';
import { approvedFixture } from './fixtures';
import { createEditorialApproval } from '../../src/lib/tg/review';
import { reviewFixture, approvalInput,scriptReviewFixture } from './fixtures';
const enabled=process.env.TG_INTEGRATION_TESTS==='true';
const env={TG_PUBLISH_ENABLED:'true',TG_IT_YOUTUBE_CLIENT_ID:'synthetic-client',TG_IT_YOUTUBE_CLIENT_SECRET:'synthetic-secret',TG_IT_YOUTUBE_REFRESH_TOKEN:'synthetic-refresh',TG_IT_YOUTUBE_CHANNEL_ID:'synthetic-channel'};
before(async()=>{
  if(!enabled)return;
  if(process.env.MONGODB_URI!=='mongodb://127.0.0.1:27018'||!process.env.MONGODB_DB_NAME?.startsWith('conclavia_e2e_'))throw new Error('Isolated MongoDB required');
  Object.assign(process.env,env);
  await mongoose.connect(process.env.MONGODB_URI,{dbName:process.env.MONGODB_DB_NAME});
  await Promise.all([TgRunModel.init(),TgDeliveryModel.init(),TgPublicationControlModel.init()]);
});
beforeEach(async()=>{if(!enabled)return;await Promise.all([TgRunModel.deleteMany({}),TgDeliveryModel.deleteMany({}),TgPublicationControlModel.deleteMany({})]);await TgPublicationControlModel.create({key:'tg',paused:false});});
after(async()=>{if(enabled){await mongoose.connection.dropDatabase();await mongoose.disconnect();}});
async function createRun(){
  const now=new Date(Date.now()-5000),job=approvedFixture(now,process.env);
  await TgRunModel.create({...job,_id:job.id,mediaCapability:randomBytes(32).toString('hex')});return job;
}
function ports(job:import('../../src/lib/tg/types').TgJob){
  const calls={start:0,poll:0};return {calls,ports:{
    inspect:async(_id:string,name:typeof job.assets[number]['name'])=>job.assets.find(a=>a.name===name)!,
    start:async(...args:Parameters<typeof import('../../src/lib/tg/publishers').startDelivery>)=>{calls.start++;await args[5]?.beforeMutation?.();const receipt={state:'submitted' as const,remoteId:'remote-fixture'};await args[4](receipt);return receipt;},
    poll:async(...args:Parameters<typeof import('../../src/lib/tg/publishers').pollDelivery>)=>{calls.poll++;return {state:'published' as const,remoteId:args[2],url:'https://www.youtube.com/watch?v=remote-fixture'};},
  }};
}
test('outbox sends once under competing workers and marks published only after receipt polling',{skip:!enabled},async()=>{
  const job=await createRun(),h=ports(job),signal=new AbortController().signal;
  await Promise.all([publishReadyTg(signal,h.ports),publishReadyTg(signal,h.ports)]);
  assert.equal(h.calls.start,1);assert.equal((await TgDeliveryModel.countDocuments({jobId:job.id})),1);
  await publishReadyTg(signal,h.ports);await publishReadyTg(signal,h.ports);
  assert.equal(h.calls.start,1);assert.equal(h.calls.poll,1);assert.equal((await TgRunModel.findById(job.id).lean())?.state,'published');
});
test('site-first editions stay untouched by the native social outbox',{skip:!enabled},async()=>{
 const job=await createRun(),h=ports(job);
 await TgRunModel.updateOne({_id:job.id},{$set:{'product.siteFirst':true}});
 await publishReadyTg(new AbortController().signal,h.ports);
 assert.equal(h.calls.start,0);assert.equal(h.calls.poll,0);assert.equal(await TgDeliveryModel.countDocuments({jobId:job.id}),0);
 assert.equal((await TgRunModel.findById(job.id).lean())?.state,'ready');
});
test('a Work-owned edition is never dispatched by the background worker and is scoped by date and id',{skip:!enabled},async()=>{
  const now=new Date(Date.now()-5000),job=reviewFixture(now);
  job.product.publicationDriver='chatgpt-work';
  job.scriptReview=scriptReviewFixture(job.product,job.date,job.research!,job.script!,now);
  const approved={...job,...createEditorialApproval(job,approvalInput(now),now,process.env),state:'ready' as const};
  await TgRunModel.create({...approved,_id:approved.id});
  const h=ports(approved),signal=new AbortController().signal;
  await publishReadyTg(signal,h.ports);assert.equal(h.calls.start,0);
  await publishReadyTg(signal,h.ports,{driver:'chatgpt-work',date:'2000-01-01',jobId:approved.id});assert.equal(h.calls.start,0);
  await publishReadyTg(signal,h.ports,{driver:'chatgpt-work',date:approved.date,jobId:approved.id});assert.equal(h.calls.start,1);
  await publishReadyTg(signal,h.ports);assert.equal(h.calls.poll,0);
  await publishReadyTg(signal,h.ports,{driver:'chatgpt-work',date:approved.date,jobId:approved.id});assert.equal(h.calls.poll,1);
  assert.equal((await TgRunModel.findById(job.id).lean())?.state,'published');
});
test('paused distribution and missing channels never create external deliveries',{skip:!enabled},async()=>{
  const job=await createRun(),h=ports(job);await TgPublicationControlModel.updateOne({key:'tg'},{$set:{paused:true}});
  await publishReadyTg(new AbortController().signal,h.ports);assert.equal(h.calls.start,0);assert.equal(await TgDeliveryModel.countDocuments({}),0);
  await TgPublicationControlModel.updateOne({key:'tg'},{$set:{paused:false}});
  const old=process.env.TG_IT_YOUTUBE_REFRESH_TOKEN;delete process.env.TG_IT_YOUTUBE_REFRESH_TOKEN;
  try{await publishReadyTg(new AbortController().signal,h.ports);assert.equal(h.calls.start,0);}finally{process.env.TG_IT_YOUTUBE_REFRESH_TOKEN=old;}
});
test('an uncertain send is never retried automatically, including after restart',{skip:!enabled},async()=>{
  const job=await createRun(),h=ports(job);h.ports.start=async()=>{h.calls.start++;throw new Error('Connection disappeared after request');};
  for(let i=0;i<3;i++)await publishReadyTg(new AbortController().signal,h.ports);
  assert.equal(h.calls.start,1);assert.equal((await TgDeliveryModel.findOne({jobId:job.id}).lean())?.state,'unknown');
});
test('pausing during dispatch rechecks the gate before external mutation',{skip:!enabled},async()=>{
  const job=await createRun(),h=ports(job);let external=0;
  h.ports.start=async(...args)=>{await TgPublicationControlModel.updateOne({key:'tg'},{$set:{paused:true}});await args[5]?.beforeMutation?.();external++;const receipt={state:'submitted' as const,remoteId:'should-not-exist'};await args[4](receipt);return receipt;};
  await publishReadyTg(new AbortController().signal,h.ports);assert.equal(external,0);assert.equal((await TgDeliveryModel.findOne({jobId:job.id}).lean())?.state,'waiting');
});
test('changed media or a changed channel invalidates an existing editorial approval',{skip:!enabled},async()=>{
  const job=await createRun(),h=ports(job);
  await TgRunModel.updateOne({_id:job.id},{$set:{'assets.0.sha256':'c'.repeat(64)}});
  await publishReadyTg(new AbortController().signal,h.ports);assert.equal(h.calls.start,0);assert.equal((await TgRunModel.findById(job.id).lean())?.state,'blocked');
});
test('pending remote receipts are reconciled after audit expiry without starting new uploads',{skip:!enabled},async()=>{
  const now=new Date(),job=reviewFixture(now);const approval=createEditorialApproval(job,approvalInput(now),now,process.env);
  const stored={...job,...approval,state:'publishing' as const};
  // Build a valid historical approval, whose evidence has since expired.
  stored.audit!.checkedAt=new Date(Date.now()-7*3600000).toISOString();
  const {publicationDigest}=await import('../../src/lib/tg/review');stored.review.bundleSha256=publicationDigest(stored,stored.publicationPlan,stored.review.destinations);
  await TgRunModel.create({...stored,_id:stored.id});await TgDeliveryModel.create({jobId:stored.id,platform:'youtube',state:'submitted',remoteId:'remote-fixture'});
  const h=ports(stored);await publishReadyTg(new AbortController().signal,h.ports);assert.equal(h.calls.start,0);assert.equal(h.calls.poll,1);assert.equal((await TgRunModel.findById(job.id).lean())?.state,'published');
});

test('an unavailable channel does not prevent a configured approved channel from publishing',{skip:!enabled},async()=>{
 const job=reviewFixture(new Date(Date.now()-5000));process.env.TG_IT_INSTAGRAM_ACCOUNT_ID='fixture-ig';
 const input=approvalInput(new Date(Date.now()-5000));input.plan.platforms=['youtube','instagram'];
 const approval=createEditorialApproval(job,input,new Date(),process.env),stored={...job,...approval,state:'ready' as const};
 await TgRunModel.create({...stored,_id:stored.id});const h=ports(stored);await publishReadyTg(new AbortController().signal,h.ports);await publishReadyTg(new AbortController().signal,h.ports);
 assert.equal(h.calls.start,1);assert.equal((await TgDeliveryModel.findOne({jobId:job.id}).lean())?.platform,'youtube');assert.equal((await TgRunModel.findById(job.id).lean())?.state,'publishing');
});
test('receipt polling backs off and stops after five failures without uploading again',{skip:!enabled},async()=>{
 const job=await createRun(),h=ports(job);await publishReadyTg(new AbortController().signal,h.ports);
 h.ports.poll=async()=>{h.calls.poll++;throw new Error('Transient status failure');};
 for(let i=0;i<5;i++){await publishReadyTg(new AbortController().signal,h.ports);await TgDeliveryModel.updateMany({jobId:job.id},{$set:{nextAttemptAt:new Date(0)}});}
 assert.equal(h.calls.start,1);assert.equal(h.calls.poll,5);assert.equal((await TgDeliveryModel.findOne({jobId:job.id}).lean())?.state,'blocked');
});
test('an uncertain Instagram finalization is not repeated on the next tick',{skip:!enabled},async()=>{
 const prior=new Date(Date.now()-5000),job=reviewFixture(prior);job.product.platforms=['instagram'];job.scriptReview=scriptReviewFixture(job.product,job.date,job.research!,job.script!,prior);process.env.TG_IT_INSTAGRAM_ACCOUNT_ID='fixture-ig';
 const input=approvalInput(prior);input.plan.platforms=['instagram'];const approval=createEditorialApproval(job,input,new Date(),process.env),stored={...job,...approval,state:'publishing' as const};
 await TgRunModel.create({...stored,_id:stored.id});await TgDeliveryModel.create({jobId:job.id,platform:'instagram',state:'submitted',remoteId:'existing-container'});
 const h=ports(stored);let mutations=0;h.ports.poll=async(...args)=>{await args[4]?.beforeMutation?.();await args[4]?.beforeFinalize?.();mutations++;throw new Error('Connection lost after media_publish');};
 await publishReadyTg(new AbortController().signal,h.ports);await publishReadyTg(new AbortController().signal,h.ports);
 assert.equal(mutations,1);assert.equal(h.calls.start,0);assert.equal((await TgDeliveryModel.findOne({jobId:job.id}).lean())?.state,'unknown');
});

test('midnight scheduling remains unique under two workers and backoff jobs cannot be claimed early',{skip:!enabled},async()=>{
 const {queueEdition,claimJob}=await import('../../src/lib/tg/store');
 const {dueSlot}=await import('../../src/lib/tg/schedule');
 const {TG_PRODUCTS}=await import('../../src/lib/tg/config');
 const now=new Date(),product={...TG_PRODUCTS[0],enabled:true,publishTime:'00:15',timezone:'UTC'};
 const preparation=new Date(now.toISOString().slice(0,10)+'T23:45:00Z'),slot=dueSlot(product,preparation)!;
 const queued=await Promise.all([queueEdition(product,preparation,slot.date),queueEdition(product,preparation,slot.date)]);
 assert.equal(queued[0]._id.toString(),queued[1]._id.toString());assert.equal(await TgRunModel.countDocuments({}),1);assert.notEqual(slot.date,preparation.toISOString().slice(0,10));
 await TgRunModel.updateOne({_id:queued[0]._id},{$set:{nextProductionAttemptAt:new Date(now.getTime()+120000).toISOString()}});
 assert.equal(await claimJob(now),undefined);
 const claims=await Promise.all([claimJob(new Date(now.getTime()+130000)),claimJob(new Date(now.getTime()+130000))]);
 assert.equal(claims.filter(Boolean).length,1);assert.equal(claims.find(Boolean)?.run.attempts,1);
});

test('an early automatic request reserves the edition without consuming a production attempt',{skip:!enabled},async()=>{
 const {queueEdition,claimJob}=await import('../../src/lib/tg/store');const {TG_PRODUCTS}=await import('../../src/lib/tg/config');
 const now=new Date(new Date().toISOString().slice(0,10)+'T10:00:00Z');
 const job=await queueEdition({...TG_PRODUCTS[0],automatic:true,publishTime:'19:15',timezone:'UTC'},now);
 assert.equal(job.nextProductionAttemptAt,now.toISOString().slice(0,10)+'T18:30:00.000Z');
 assert.equal(await claimJob(now),undefined);assert.equal((await TgRunModel.findById(job._id).lean())?.attempts,0);
});

test('AI-approved outbox still requires receipts, and an expired review cannot start a new upload',{skip:!enabled},async()=>{
 const {createAiApproval}=await import('../../src/lib/tg/review');const {finalReviewInputDigest}=await import('../../src/lib/tg/final-review-policy');
 for(const expired of [false,true]){
  await TgRunModel.deleteMany({});await TgDeliveryModel.deleteMany({});
  const at=new Date(Date.now()-(expired?7*3600000:5000)),job=reviewFixture(at);
  job.product={...job.product,automatic:true,publishTime:at.toISOString().slice(11,16),platforms:['youtube']};
  job.scriptReview=scriptReviewFixture(job.product,job.date,job.research!,job.script!,at);
  job.manifest={version:1,product:job.product,date:job.date,seconds:180,stories:[],sources:job.research!.sources,cues:job.script!.sentences.map((s,i)=>({...s,start:i*10,end:i*10+9}))};
  job.finalReview={version:1,checkedAt:at.toISOString(),model:'fixture',inputSha256:finalReviewInputDigest(job),passed:true,checks:{visual:true,headlines:true,captions:true,emotion:true,publication:true},issues:[],summary:'Fotogrammi campionati sintetici.',
   media:([{format:'landscape',width:1920,height:1080},{format:'portrait',width:1080,height:1920}] as const).map(m=>({...m,seconds:180,rms:.1,peak:.8,clippedRatio:0,leadingSilence:.2,trailingSilence:2})),samples:(['landscape','portrait'] as const).flatMap(format=>[1,90,177].map(t=>({format,at:t})))};
  const approved={...job,...createAiApproval(job,at,process.env),state:expired?'publishing':'ready'};
  await TgRunModel.create({...approved,_id:job.id});
  if(expired)await TgDeliveryModel.create({jobId:job.id,platform:'youtube',state:'submitted',remoteId:'remote-fixture'});
  const h=ports(job);await publishReadyTg(new AbortController().signal,h.ports);await publishReadyTg(new AbortController().signal,h.ports);
  assert.equal(h.calls.start,expired?0:1);assert.equal(h.calls.poll,1);assert.equal((await TgRunModel.findById(job.id).lean())?.state,'published');
 }
});

test('published history includes confirmed partial releases and excludes unbroadcast research',{skip:!enabled},async()=>{
 const {loadPublishedHistory}=await import('../../src/lib/tg/history');
 const now=new Date(),previous=new Date(now.getTime()-86400000),old=reviewFixture(previous);
 old.id='b'.repeat(24);old.state='needs_review';
 await TgRunModel.create({...old,_id:old.id});
 assert.deepEqual(await loadPublishedHistory('it',now.toISOString().slice(0,10),now),[]);
 await TgRunModel.updateOne({_id:old.id},{$set:{state:'publishing'}});
 await TgDeliveryModel.create({jobId:old.id,platform:'youtube',state:'published',remoteId:'already-aired',updatedAt:previous});
 const history=await loadPublishedHistory('it',now.toISOString().slice(0,10),now);
 assert.equal(history.length,1);assert.equal(history[0].stories.length,3);
 assert.deepEqual(history[0].stories[0].claims,old.script!.sentences.filter(s=>s.storyId==='story-0').map(s=>s.text));
 assert.deepEqual(await loadPublishedHistory('world',now.toISOString().slice(0,10),now),[]);
});

test('a newly published prior edition invalidates the archive checked at approval before any external upload',{skip:!enabled},async()=>{
 const job=await createRun(),h=ports(job),now=new Date(),previous=new Date(now.getTime()-86400000),old=reviewFixture(previous);
 old.id='b'.repeat(24);old.state='published';old.publishedAt=previous.toISOString();
 await TgRunModel.create({...old,_id:old.id});
 await publishReadyTg(new AbortController().signal,h.ports);
 assert.equal(h.calls.start,0);assert.equal(await TgDeliveryModel.countDocuments({jobId:job.id}),0);
 const stopped=await TgRunModel.findById(job.id).lean();assert.equal(stopped?.state,'blocked');assert.match(stopped!.issues.join(' '),/archivio|Attualità/);
});

test('regenerating a blocked edition discards stale research rather than reusing yesterday sources',{skip:!enabled},async()=>{
 const {editorialAction}=await import('../../src/lib/tg/newsroom');
 const job=reviewFixture(new Date());job.state='blocked';job.issues=['Fonti fuori dalla finestra delle notizie.'];
 await TgRunModel.create({...job,_id:job.id});
 const retried=await editorialAction(job.id,{action:'retry',revision:0,note:'Raccogli fonti nuove e ricontrolla la scaletta.'});
 assert.equal(retried.state,'queued');assert.equal(retried.research,undefined);assert.equal(retried.script,undefined);assert.equal(retried.manifest,undefined);assert.deepEqual(retried.assets,[]);
});
