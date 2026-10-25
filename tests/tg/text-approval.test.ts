import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {createManualTextApproval,manualTextApprovalIsCurrent} from '../../src/lib/tg/text-approval';
import {scoredNarration} from '../../src/lib/tg/script-review';
import {dailyGreeting,dailyClosing,scriptDigest,scriptSchema} from '../../src/lib/tg/editorial';
import {editorialFixture} from './editorial-fixture';
import {scriptReviewFixture} from './fixtures';
import {produceTg,type TgProductionPorts} from '../../src/lib/tg/pipeline';
import {synthesize} from '../../src/lib/tg/media';
import {freshnessFixture} from './freshness-fixture';
import {tgSpeechPlan} from '../../src/lib/tg/speech-plan';
import {parseProduct} from '../../src/lib/tg/config';
import type {TgJob,TgManifest,TgProduct,TgState} from '../../src/lib/tg/types';
const now=new Date('2026-10-25T09:00:00Z');
function receipt(job:TgJob){
 return {mode:'manual' as const,reviewer:'Synthetic user fixture',at:now.toISOString(),date:job.date,scriptSha256:scriptDigest(job.script!),scoreSha256:createHash('sha256').update(scoredNarration(job.script!).scoreMarkup).digest('hex')};
}
function harness(mode:TgProduct['textReviewMode']){
 const job=editorialFixture(now);job.product={...job.product,productionMode:'full',textReviewMode:mode,automatic:false};
 const template=structuredClone(job.audit!),assets=job.assets;job.audit=undefined;job.scriptReview=undefined;job.assets=[];
 const calls:string[]=[],states:TgState[]=[],exported:TgJob[]=[];
 const ports:TgProductionPorts={
  research:async()=>{assert.fail('No new research');},write:async()=>{assert.fail('No unexpected rewrite');},
  audit:async(research,script)=>{calls.push('A');return {...template,scriptSha256:scriptDigest(script),freshness:freshnessFixture(research,script,now)};},
  reviewScript:async(research,script)=>{calls.push('B');return scriptReviewFixture(job.product,job.date,research,script,now);},
  editorialReady:async draft=>{calls.push('export');exported.push(draft);},
  voiceConfigurationSha256:()=>'c'.repeat(64),
  voice:async(_research,script)=>{
   calls.push('voice');const step=192/(script.sentences.length-1);
   const manifest:TgManifest={version:1,product:job.product,date:job.date,seconds:200,stories:[],sources:[],speech:tgSpeechPlan(job.product),fps:50,voiceConfigSha256:'c'.repeat(64),lipSync:'word-anchored-estimate',openingPause:{atSeconds:6,addedSeconds:1.8,wordGapSeconds:2,quietRms:0,fadeSeconds:.006},
    cues:script.sentences.map((s,i)=>({...s,start:i?7+(i-1)*step:0,end:i?7+i*step-.1:5,alignment:'word',...(s.intent==='point-down'?{gestureAlignment:'word',gestureAccent:1}:{})}))};
   return manifest;
  },
  render:async manifest=>{calls.push('render');return assets.map(a=>a.name.endsWith('.mp4')?{...a,duration:manifest.seconds}:a);},
  now:()=>now,checkpoint:async state=>{states.push(state);},
 };
 return {job,ports,calls,states,exported};
}
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
for(const mode of ['manual','ai',undefined] as const)test(`the review setting only adds the user gate after both AI checks: ${mode??'omitted'}`,async()=>{
 const h=harness(mode);await produceTg(h.job,'',h.ports);
 assert.deepEqual(h.calls,mode==='manual'?['A','B','export']:['A','B','export','voice','render']);
 assert.equal(h.states.at(-1),mode==='manual'?'editorial_ready':'needs_review');
});
for(const failed of ['A','B'] as const)test(`disabling manual review cannot bypass a negative AI ${failed} verdict`,async()=>{
 const h=harness('ai');h.job.editorialRepairs=1;
 if(failed==='A'){const audit=h.ports.audit;h.ports.audit=async(...args)=>({...await audit(...args),passed:false,issues:['Unsupported fixture claim']});}
 else{const review=h.ports.reviewScript;h.ports.reviewScript=async(...args)=>({...await review(...args),passed:false,issues:['Editorial fixture correction required']});}
 await produceTg(h.job,'',h.ports);assert.equal(h.states.at(-1),'blocked');
 assert.deepEqual(h.calls,failed==='A'?['A']:['A','B']);assert.equal(h.exported.length,0);
});
test('a current manual confirmation proceeds through the same checked media path',async()=>{
 const h=harness('manual');h.job.textApproval=receipt(h.job);await produceTg(h.job,'',h.ports);
 assert.deepEqual(h.calls,['A','B','export','voice','render']);assert.equal(h.states.at(-1),'needs_review');
});
test('a duration rewrite asks again for manual confirmation before any second voice call',async()=>{
 const h=harness('manual');h.job.textApproval=receipt(h.job);
 h.ports.voice=async()=>{h.calls.push('voice');throw Object.assign(new Error('Synthetic duration mismatch'),{ratio:1.2,actualSeconds:700});};
 h.ports.write=async()=>{h.calls.push('rewrite');const script=structuredClone(h.job.script!);script.sentences[1].text+=' Una correzione sintetica.';return script;};
 await produceTg(h.job,'',h.ports);
 assert.deepEqual(h.calls,['A','B','export','voice','rewrite','A','B','export']);assert.equal(h.states.at(-1),'editorial_ready');
 assert.equal(h.exported.at(-1)?.textApproval,undefined);assert.notEqual(scriptDigest(h.exported.at(-1)!.script!),h.job.textApproval.scriptSha256);
});
test('manual review does not change the writing format or accept unknown configuration values',()=>{
 const {job}=harness('manual');
 assert.deepEqual(scriptSchema(job.product,job.research!),scriptSchema({...job.product,textReviewMode:'ai'},job.research!));
 assert.deepEqual(scriptSchema(job.product,job.research!),scriptSchema({...job.product,textReviewMode:undefined},job.research!));
 for(const textReviewMode of ['manual','ai',undefined])assert.equal(parseProduct({...job.product,textReviewMode}).textReviewMode,textReviewMode);
 assert.throws(()=>parseProduct({...job.product,textReviewMode:'unknown'}));
});
test('the reviewed opening is short and dated, and the closing has one comments pointer',()=>{
 const opening=dailyGreeting('it','2026-10-25','reviewed');
 assert.match(opening,/Ciao a tutti/u);assert.match(opening,/Meno rumore, più contesto/u);assert.match(opening,/venticinque ottobre/u);
 assert.ok(opening.split(/\s+/u).length<=25);
 const closing=dailyClosing('it','reviewed');assert.equal(closing.filter(s=>s.intent==='point-down').length,1);
 assert.ok(closing.some(s=>s.text.includes('daily.conclavia.me')));assert.ok(closing.some(s=>s.text.includes('Segui Conclavia Daily')));
});
test('only an explicit confirmation of current A/B, words and score creates a text receipt within the edition window',()=>{
 const at=new Date('2026-10-26T07:00:00Z'),job=editorialFixture(at);
 job.state='editorial_ready';job.product={...job.product,productionMode:'full',textReviewMode:'manual',productionTime:'07:30',publishTime:'08:15',timezone:'Europe/Rome'};
 job.scriptReview=scriptReviewFixture(job.product,job.date,job.research!,job.script!,at);
 const input={confirmed:true,reviewer:'Synthetic test reviewer',scriptSha256:scriptDigest(job.script!),reviewInputSha256:job.scriptReview.inputSha256};
 const approval=createManualTextApproval(job,input,at);
 assert.equal(manualTextApprovalIsCurrent({...job,textApproval:approval},at),true);
 for(const invalid of [{confirmed:false},{reviewer:''},{scriptSha256:'changed'},{reviewInputSha256:'changed'}])assert.throws(()=>createManualTextApproval(job,{...input,...invalid},at));
 assert.throws(()=>createManualTextApproval(job,input,new Date('2026-10-26T08:00:00Z')),/finestra/u);
 assert.throws(()=>createManualTextApproval({...job,attempts:3},input,at),/Tentativi/u);
 assert.throws(()=>createManualTextApproval({...job,scriptReview:undefined},input,at),/controlli AI/u);
 assert.throws(()=>createManualTextApproval({...job,audit:{...job.audit!,passed:false}},input,at),/controlli AI/u);
 assert.throws(()=>createManualTextApproval({...job,product:{...job.product,productionMode:'editorial'}},input,at),/non attende/u);
});
