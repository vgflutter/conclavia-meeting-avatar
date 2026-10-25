import assert from 'node:assert/strict';
import {test} from 'node:test';
import {reviewFixture,scriptReviewFixture} from './fixtures';
import {freshnessFixture} from './freshness-fixture';
import {dailyClosing,dailyGreeting,scriptDigest} from '../../src/lib/tg/editorial';
import {produceTg} from '../../src/lib/tg/pipeline';
import {tgSpeechPlan} from '../../src/lib/tg/speech-plan';
import type {TgJob,TgManifest,TgState} from '../../src/lib/tg/types';

const now=new Date('2026-10-24T06:40:00Z');
function candidate(){
  const job=reviewFixture(now);job.product={...job.product,productionStandard:'cdaily-v1',automatic:false};
  job.research!.stories.push(...[3,4].map(i=>({...job.research!.stories[0],id:`story-${i}`})));
  const source=job.script!.sentences[0];
  job.script!.sentences=[{...source,text:dailyGreeting('it',job.date),storyId:'intro',intent:'acknowledge'},
    ...job.research!.stories.flatMap(s=>Array.from({length:4},()=>({...source,storyId:s.id,sourceIds:s.sourceIds,intent:'explain' as const,
      text:'Questo testo sintetico serve soltanto alla prova del percorso tecnico e non racconta fatti reali. Il contesto viene esposto in frasi collegate che chiariscono chi è coinvolto e perché il passaggio richiede una spiegazione accessibile a tutte le persone.'}))),...dailyClosing('it')];
  job.audit!.scriptSha256=scriptDigest(job.script!);job.audit!.freshness=freshnessFixture(job.research!,job.script!,now);
  job.scriptReview=scriptReviewFixture(job.product,job.date,job.research!,job.script!,now);
  return job;
}
function timeline(job:TgJob):TgManifest{
  const step=192/(job.script!.sentences.length-1);
  const cues=job.script!.sentences.map((s,i)=>({...s,start:i?7+(i-1)*step:0,end:i?7+i*step-.1:5,alignment:'word' as const,
    ...(s.intent==='point-down'?{gestureAlignment:'word' as const,gestureAccent:1}:{})}));
  return {version:1,product:job.product,date:job.date,seconds:200,stories:[],sources:[],speech:tgSpeechPlan(job.product),fps:50,
    voiceConfigSha256:'c'.repeat(64),lipSync:'word-anchored-estimate',openingPause:{atSeconds:6,addedSeconds:1.8,wordGapSeconds:2,quietRms:0,fadeSeconds:.006},cues};
}

test('the production state machine accepts the measured master length while retaining the editorial target',async()=>{
  const job=candidate(),manifest=timeline(job),states:TgState[]=[];
  const assets=job.assets.map(a=>a.name.endsWith('.mp4')?{...a,duration:200}:a);
  await produceTg(job,'',{research:async()=>job.research!,write:async()=>{assert.fail('No rewrite needed');},audit:async()=>job.audit!,
    reviewScript:async()=>job.scriptReview!,voice:async()=>manifest,voiceConfigurationSha256:()=>manifest.voiceConfigSha256!,render:async()=>assets,
    now:()=>now,checkpoint:async(state)=>{states.push(state);}});
  assert.equal(states.at(-1),'needs_review');assert.equal(manifest.product.seconds,180);assert.equal(manifest.seconds,200);
});
test('positive AI reports cannot bypass insufficient explanation after the repair budget has been used',async()=>{
  const job=candidate();job.script!.sentences=job.script!.sentences.map(s=>({...s,text:s.storyId==='intro'?s.text:'Solo poche parole.'}));
  job.editorialRepairs=1;const states:TgState[]=[];
  await produceTg(job,'',{research:async()=>job.research!,write:async()=>{assert.fail('No second repair');},audit:async()=>job.audit!,reviewScript:async()=>job.scriptReview!,
    voice:async()=>{assert.fail('No voice credits');},render:async()=>{assert.fail('No render');},now:()=>now,checkpoint:async(state)=>{states.push(state);}});
  assert.equal(states.at(-1),'blocked');
});
test('a resumed master with changed private voice configuration is not silently reused',async()=>{
  const job=candidate();job.manifest=timeline(job);let recordings=0;
  await assert.rejects(produceTg(job,'',{research:async()=>job.research!,write:async()=>job.script!,audit:async()=>job.audit!,reviewScript:async()=>job.scriptReview!,
    voiceConfigurationSha256:()=>'d'.repeat(64),voice:async()=>{recordings++;throw Error('Synthetic voice interruption');},render:async()=>{assert.fail('No old video');},now:()=>now,checkpoint:async()=>{}}),/Synthetic/);
  assert.equal(recordings,1);
});

test('the broader edition enforces 4:30 on the measured master and binds its editorial profile',async()=>{
 const {validMasterClock}=await import('../../src/lib/tg/media-contract');
 const job=candidate(),legacy=timeline(job),product={...job.product,editorialProfile:'italia-morning-v2' as const};
 assert.equal(validMasterClock(job.product,legacy),true);
 assert.equal(validMasterClock(product,legacy),false);
 const manifest={...legacy,product,seconds:269.99};assert.equal(validMasterClock(product,manifest),false);
 manifest.seconds=270;assert.equal(validMasterClock(product,manifest),true);
 manifest.seconds=600;assert.equal(validMasterClock(product,manifest),false);
});
