import assert from 'node:assert/strict';
import {test} from 'node:test';
import {macProductionStage} from '../../src/lib/tg/mac-production-stage';
import {createManualTextApproval} from '../../src/lib/tg/text-approval';
import {scriptDigest} from '../../src/lib/tg/editorial';
import {scriptReviewFixture} from './fixtures';
import {editorialFixture} from './editorial-fixture';

test('the Mac prepares manual editions without a renderer, waits, and resumes media only after the exact confirmation',()=>{
 const now=new Date('2026-10-26T07:00:00Z'),job=editorialFixture(now);
 job.product={...job.product,productionMode:'full',textReviewMode:'manual',productionTime:'07:30',publishTime:'08:15',timezone:'Europe/Rome'};
 job.scriptReview=scriptReviewFixture(job.product,job.date,job.research!,job.script!,now);
 assert.equal(macProductionStage(job.product,undefined,now),'editorial');
 job.state='queued';assert.equal(macProductionStage(job.product,job,now),'editorial');
 job.state='editorial_ready';assert.equal(macProductionStage(job.product,job,now),'waiting');
 job.textApproval=createManualTextApproval(job,{confirmed:true,reviewer:'Synthetic fixture',scriptSha256:scriptDigest(job.script!),reviewInputSha256:job.scriptReview.inputSha256},now);
 job.state='queued';assert.equal(macProductionStage(job.product,job,now),'media');
 assert.equal(macProductionStage(job.product,job,new Date('2026-10-27T07:00:00Z')),'editorial');
 job.script!.sentences[1].mood='curiosity';assert.equal(macProductionStage(job.product,job,now),'editorial');
 // A settings change cannot silently override the frozen edition's manual gate.
 assert.equal(macProductionStage({...job.product,textReviewMode:'ai'},job,now),'editorial');
 for(const state of ['blocked','failed','cancelled','needs_review'] as const){job.state=state;assert.equal(macProductionStage(job.product,job,now),'stopped');}
 job.state='ready';assert.equal(macProductionStage(job.product,job,now),'upload');
 job.state='published';assert.equal(macProductionStage(job.product,job,now),'published');
 assert.equal(macProductionStage({...job.product,textReviewMode:'ai'},undefined,now),'media');
 assert.equal(macProductionStage({...job.product,productionMode:'editorial',textReviewMode:'ai'},undefined,now),'editorial');
});
