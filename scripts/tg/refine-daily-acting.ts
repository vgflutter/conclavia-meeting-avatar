/** Re-score an immutable, dated pilot using its existing synthetic recording.
 * No model, ASR, database, publisher or selected-media update. */
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {planPerformancePhrases,type PerformancePhraseSpec,type PerformancePhraseSegment} from '@conclavia/avatar-kit/performance';
import type {TgPromoSequence,TgPromoCue} from '@conclavia/avatar-kit/formats/tg';
import {dailyPerformanceDirection} from '../../src/lib/tg/performance-direction';
type Cue=TgPromoCue&{thought?:string;intent?:PerformancePhraseSpec['intent']};
async function main(){
const sourceId='2026-10-23-it-pilot-r3',id='2026-10-23-it-pilot-r5';
const source=`public/daily-launch/editions/${sourceId}`,out=`public/daily-launch/editions/${id}`;
const raw=await readFile(source+'/manifest.json'),original=JSON.parse(raw.toString()) as Omit<TgPromoSequence,'cues'>&{cues:Cue[];id:string};
const sequence=structuredClone(original);
const groups:{indices:number[]}[]=[];
sequence.cues.forEach((cue,index)=>{
 const last=groups.at(-1),prior=last?sequence.cues[last.indices.at(-1)!]:undefined;
 if(last&&prior&&cue.thought&&cue.thought===prior.thought&&cue.scene===prior.scene)last.indices.push(index);
 else groups.push({indices:[index]});
});
const phrases:PerformancePhraseSpec[]=groups.map(({indices})=>{
 const first=sequence.cues[indices[0]],last=sequence.cues[indices.at(-1)!];
 const segments:PerformancePhraseSegment[]=indices.map(index=>{const cue=sequence.cues[index];return{
  cueId:'clause-'+index,startSeconds:cue.start-first.start,endSeconds:cue.end-first.start,
  mood:cue.mood,intensity:cue.intensity,intent:cue.intent};});
 return {cueId:id+':'+indices[0],mood:first.mood,intensity:first.intensity,intent:first.intent,
  startSeconds:first.start,durationSeconds:last.end-first.start,segments};
});
const firstScene=(indices:number[])=>sequence.cues[indices[0]].scene;
const plans=planPerformancePhrases(phrases,{seed:id,actorId:'promo-host',...dailyPerformanceDirection});
groups.forEach(({indices},group)=>{
 // The approved pointer and its preparation/window are frozen verbatim.
 if(firstScene(indices)==='chiusura')return;
 const first=sequence.cues[indices[0]],last=sequence.cues[indices.at(-1)!];
 for(const index of indices)sequence.cues[index]={...sequence.cues[index],choreography:plans[group],performanceWindow:{start:first.start,end:last.end}};
});
for(const key of ['words','scenes','duration','voice','title','description'] as const)assert.deepEqual(sequence[key],original[key]);
for(let i=0;i<sequence.cues.length;i++)for(const key of ['start','end','text','mood','intensity','phones','levels'] as const)assert.deepEqual(sequence.cues[i][key],original.cues[i][key]);
for(let i=0;i<sequence.cues.length;i++)if(sequence.cues[i].scene==='chiusura')assert.deepEqual(sequence.cues[i],original.cues[i]);
Object.assign(sequence,{id,revisionOf:sourceId,mediaVersion:undefined,actingRevision:'semantic-clauses-20261023',previewOnly:true});
await mkdir(out,{recursive:true});
await writeFile(out+'/manifest.json',JSON.stringify(sequence,null,2)+'\n');
for(const name of ['audio.wav','script.txt','caption.txt','social-summary.txt','captions.vtt'])await copyFile(source+'/'+name,out+'/'+name);
const strokes=(data:TgPromoSequence)=>[...new Map(data.cues.filter(c=>c.choreography).map(c=>[c.choreography!.key,c.choreography!])).values()].flatMap(p=>p.strokes);
const inventory=(data:TgPromoSequence)=>{const all=strokes(data),counts=Object.fromEntries([...new Set(all.map(s=>s.kind))].map(kind=>[kind,all.filter(s=>s.kind===kind).length]));return{strokes:all.length,counts,topThreeShare:all.filter(s=>['gather','explain','precision'].includes(s.kind)).length/all.length};};
const report={revision:id,source:sourceId,sourceManifestSha256:createHash('sha256').update(raw).digest('hex'),
 audioSha256:createHash('sha256').update(await readFile(out+'/audio.wav')).digest('hex'),before:inventory(original),after:inventory(sequence),
 preserved:['actual audio','speech text','word anchors','moods','scene clock','artwork identity','approved closing pointer'],
 additions:['clause-aware continuous plans','28-second frequency memory','semantic intent without topic or cue-index contact rules'],providerCalls:0,published:false};
await writeFile(out+'/acting-revision.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
}
void main().catch(error=>{console.error(error instanceof Error?error.message:'Acting refinement failed');process.exitCode=1;});
