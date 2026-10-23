import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {directDailyLaunchMotion} from '../../src/components/tg/daily-launch-motion';
import type {TgPromoSequence} from '@conclavia/avatar-kit/formats/tg';
const sequence=JSON.parse(readFileSync('public/daily-launch/manifest.json','utf8')) as TgPromoSequence;
test('Daily direction changes only body annotations and preserves the complete approved product',()=>{
 const directed=directDailyLaunchMotion(sequence);
 const plain=structuredClone(directed);
 for(const cue of plain.cues){delete cue.choreography;delete cue.performanceWindow;}
 for(const scene of plain.scenes)for(const turn of scene.turns??[])delete turn.choreography;
 assert.deepEqual(plain,sequence);
 assert.deepEqual(directed,directDailyLaunchMotion(sequence));
 const gestures=directed.cues.flatMap(c=>c.choreography!.strokes);
 assert.ok(new Set(gestures.map(s=>s.kind)).size>=4);
 assert.ok(directed.cues.some(c=>c.choreography!.strokes.length===0),'connecting clauses can remain still');
 assert.ok(directed.scenes.find(s=>s.kind==='conversation')?.turns?.every(t=>t.choreography));
});

test('a complete thought continues across emotional clauses without restarting the arm or the words',()=>{
 const directed=directDailyLaunchMotion(sequence),cues=directed.cues.filter(c=>c.scene==='purpose');
 assert.ok(cues.length>1&&new Set(cues.map(c=>c.mood)).size>1);
 assert.ok(cues.every(c=>c.performanceWindow?.start===cues[0].start&&c.performanceWindow.end===cues.at(-1)!.end));
 assert.ok(cues.every(c=>c.choreography===cues[0].choreography));
 assert.deepEqual(directed.words,sequence.words);
 const contacts=directed.cues.flatMap(c=>c.choreography?.strokes??[]).filter(s=>s.kind==='fold-hands');
 assert.equal(contacts.length,0,'standing presentation explains instead of weaving its hands');
});

test('the composed interlace is reserved for a seated presentation',()=>{
 const seated=directDailyLaunchMotion(sequence,{posture:'desk'});
 const contacts=seated.cues.flatMap(c=>c.choreography?.strokes??[]).filter(s=>s.kind==='fold-hands');
 assert.equal(contacts.length,1);assert.equal(contacts[0].contact,'interlace');
 assert.equal(directDailyLaunchMotion(sequence).cues.flatMap(c=>c.choreography?.strokes??[]).filter(s=>s.contact==='interlace').length,0);
});

test('standing accents use measured word centres and restrain the number of strokes',()=>{
 const directed=directDailyLaunchMotion(sequence),unique=[...new Set(directed.cues.map(c=>c.choreography!))];
 const strokes=unique.flatMap(p=>p.strokes.map(s=>({p,s})));
 assert.ok(strokes.length>4&&strokes.length<18,'phrase actions, not a wave per word');
 let aligned=0;
 for(const {p,s} of strokes){
  const cue=directed.cues.find(c=>c.choreography===p)!,start=cue.performanceWindow?.start??cue.start;
  if(sequence.words.some(w=>Math.abs((w.start+w.end)/2-start-s.apex)<.001))aligned++;
 }
 assert.ok(aligned>=3,'meaningful accents land on actual speech');
});

test('a new edition keeps its explicitly planned acting instead of inheriting launch intentions',()=>{
 const supplied={...sequence,cues:sequence.cues.map((c,i)=>({...c,choreography:{version:1 as const,key:'daily-pilot:'+i,durationSeconds:c.end-c.start,stance:.2,energy:.8,strokes:[]}}))};
 const directed=directDailyLaunchMotion(supplied);
 directed.cues.forEach((cue,i)=>assert.deepEqual(cue.choreography,supplied.cues[i].choreography));
});


test('the new presentation uses connected phrasing and one measured upward emphasis',()=>{
 const directed=directDailyLaunchMotion(sequence);
 assert.ok(directed.cues.every(c=>c.choreography?.phrasing==='connected'));
 const cue=directed.cues.find(c=>c.text.startsWith('Stiamo costruendo una redazione'))!;
 const pointer=cue.choreography!.strokes.find(s=>s.kind==='point-up')!;assert.ok(pointer);
 const word=sequence.words.find(w=>w.text.toLocaleLowerCase('it-IT')==='ricontrolla')!;
 assert.ok(Math.abs(cue.start+pointer.apex-(word.start+word.end)/2)<.001);
});
