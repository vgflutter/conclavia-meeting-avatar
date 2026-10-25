import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {manualTextApprovalIsCurrent} from '../../src/lib/tg/text-approval';
import {scoredNarration} from '../../src/lib/tg/script-review';
import {dailyGreeting,dailyClosing,scriptDigest} from '../../src/lib/tg/editorial';
import {editorialFixture} from './editorial-fixture';
import {scriptReviewFixture} from './fixtures';
import {produceTg} from '../../src/lib/tg/pipeline';
import {synthesize} from '../../src/lib/tg/media';
import type {TgState} from '../../src/lib/tg/types';
const now=new Date('2026-10-25T09:00:00Z');
test('manual text confirmation is tied to the exact words, moods, intentions and edition date',()=>{
 const job=editorialFixture(now);job.product.textReviewMode='manual';
 assert.equal(manualTextApprovalIsCurrent(job,now),false);
 job.textApproval={mode:'manual',reviewer:'Synthetic user fixture',at:now.toISOString(),date:job.date,scriptSha256:scriptDigest(job.script!),scoreSha256:createHash('sha256').update(scoredNarration(job.script!).scoreMarkup).digest('hex')};
 assert.equal(manualTextApprovalIsCurrent(job,now),true);
 for(const change of [()=>job.script!.sentences[1].text+=' Modifica.',()=>job.script!.sentences[1].mood='curiosity',()=>job.script!.sentences[1].intent='reflect']){
  const original=structuredClone(job.script);change();assert.equal(manualTextApprovalIsCurrent(job,now),false);job.script=original;
 }
 assert.equal(manualTextApprovalIsCurrent(job,new Date('2026-10-26T09:00:00Z')),false);
});
test('an AI-approved script in full mode still waits for the user and never calls media ports',async()=>{
 const job=editorialFixture(now);job.product={...job.product,productionMode:'full',textReviewMode:'manual'};
 job.scriptReview=scriptReviewFixture(job.product,job.date,job.research!,job.script!,now);const states:TgState[]=[];
 await produceTg(job,'',{research:async()=>job.research!,write:async()=>{assert.fail('No rewrite');},audit:async()=>job.audit!,reviewScript:async()=>job.scriptReview!,editorialReady:async()=>{},
  voice:async()=>{assert.fail('No TTS');},render:async()=>{assert.fail('No render');},now:()=>now,checkpoint:async s=>{states.push(s);}});
 assert.equal(states.at(-1),'editorial_ready');
 await assert.rejects(synthesize(job.id,job.product,job.date,job.research!,job.script!,AbortSignal.abort()),/OK manuale/u);
});
test('the reviewed opening is short and dated, and the closing has one comments pointer',()=>{
 const opening=dailyGreeting('it','2026-10-25','reviewed');
 assert.match(opening,/Ciao a tutti/u);assert.match(opening,/Meno rumore, più contesto/u);assert.match(opening,/venticinque ottobre/u);
 assert.ok(opening.split(/\s+/u).length<=25);
 const closing=dailyClosing('it','reviewed');assert.equal(closing.filter(s=>s.intent==='point-down').length,1);
 assert.ok(closing.some(s=>s.text.includes('daily.conclavia.me')));assert.ok(closing.some(s=>s.text.includes('Segui Conclavia Daily')));
});
