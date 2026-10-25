import assert from 'node:assert/strict';
import {before,after,beforeEach,test} from 'node:test';
import {randomBytes} from 'node:crypto';
import mongoose from 'mongoose';
import {connectToDatabase} from '../../src/lib/mongodb';
import {TgRunModel} from '../../src/models/tg/TgRun';
import {TgDeliveryModel} from '../../src/models/tg/TgDelivery';
import {editorialAction} from '../../src/lib/tg/newsroom';
import {manualTextApprovalIsCurrent} from '../../src/lib/tg/text-approval';
import {claimJob,serializeJob} from '../../src/lib/tg/store';
import {editorialFixture} from './editorial-fixture';
import {scriptReviewFixture} from './fixtures';
const enabled=process.env.TG_INTEGRATION_TESTS==='true';
before(async()=>{
 if(!enabled)return;
 if(process.env.MONGODB_URI!=='mongodb://127.0.0.1:27018'||!process.env.MONGODB_DB_NAME?.startsWith('conclavia_e2e_'))throw Error('Isolated MongoDB required');
 await connectToDatabase();await Promise.all([TgRunModel.init(),TgDeliveryModel.init()]);
});
beforeEach(async()=>{if(enabled)await Promise.all([TgRunModel.deleteMany({}),TgDeliveryModel.deleteMany({})]);});
after(async()=>{if(enabled){await mongoose.connection.dropDatabase();await mongoose.disconnect();}});
async function fixture(){
 const now=new Date(),job=editorialFixture(now);job.id=randomBytes(12).toString('hex');job.state='editorial_ready';job.assets=[];
 job.product={...job.product,productionMode:'full',textReviewMode:'manual',productionTime:'00:00',publishTime:'23:59',timezone:'UTC'};
 job.scriptReview=scriptReviewFixture(job.product,job.date,job.research!,job.script!,now);
 await TgRunModel.create({...job,_id:job.id});
 const input={action:'approve-text',revision:0,confirmed:true,reviewer:'Synthetic user test',scriptSha256:job.audit!.scriptSha256,reviewInputSha256:job.scriptReview.inputSha256};
 return {job,input};
}
test('competing user confirmations queue one resume, preserve counters and never approve or publish media',{skip:!enabled},async()=>{
 const {job,input}=await fixture();
 const results=await Promise.allSettled([editorialAction(job.id,input),editorialAction(job.id,input)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const saved=serializeJob(await TgRunModel.findById(job.id).lean().orFail());
 assert.equal(saved.state,'queued');assert.equal(saved.revision,1);assert.equal(saved.attempts,job.attempts);
 assert.equal(saved.editorialRepairs,job.editorialRepairs??0);assert.ok(manualTextApprovalIsCurrent(saved));
 assert.equal(saved.approvedAt,undefined);assert.equal(saved.manifest,undefined);assert.deepEqual(saved.assets,[]);assert.equal(await TgDeliveryModel.countDocuments({}),0);
 const claimed=await claimJob(new Date(),job.id);assert.ok(claimed);assert.equal(claimed.run.attempts,2);
});
test('stale versions, missing AI B, changed words and active worker leases cannot be approved',{skip:!enabled},async()=>{
 const {job,input}=await fixture();
 await assert.rejects(editorialAction(job.id,{...input,scriptSha256:'changed'}));
 await TgRunModel.updateOne({_id:job.id},{$set:{revision:1}});
 await assert.rejects(editorialAction(job.id,input),/cambiata/u);
 await TgRunModel.updateOne({_id:job.id},{$unset:{scriptReview:1}});
 await assert.rejects(editorialAction(job.id,{...input,revision:1}),/controlli AI/u);
 await TgRunModel.updateOne({_id:job.id},{$set:{scriptReview:job.scriptReview,leaseUntil:new Date(Date.now()+60000),leaseOwner:'synthetic-worker'}});
 await assert.rejects(editorialAction(job.id,{...input,revision:1}),/lavorazione/u);
 assert.equal((await TgRunModel.findById(job.id).lean())?.textApproval,undefined);
 assert.equal(await TgDeliveryModel.countDocuments({}),0);
});
test('a new audit requested while waiting preserves attempts and never fabricates a text confirmation',{skip:!enabled},async()=>{
 const {job}=await fixture();
 const updated=await editorialAction(job.id,{action:'reverify',revision:0,note:'Rinnovare i controlli prima della conferma sintetica'});
 assert.equal(updated.state,'queued');assert.equal(updated.attempts,job.attempts);assert.equal(updated.editorialRepairs,job.editorialRepairs??0);
 assert.equal(updated.textApproval,undefined);assert.equal(updated.audit,undefined);assert.equal(updated.scriptReview,undefined);
 assert.deepEqual(updated.script,job.script);assert.deepEqual(updated.assets,[]);
});
