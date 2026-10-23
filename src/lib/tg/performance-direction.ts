import {planPerformancePhrases,type PerformanceContact,type PerformancePhraseSpec} from '@conclavia/avatar-kit/performance';
import type {TgCue} from './types';
/** CDaily direction only. Reusable timing, anatomy and contact live in the kit. */
export function dailyPerformanceForPosture(posture:'standing'|'desk'='standing'){
 return {articulated:true,vitality:.9,phrasing:'connected',variety:'semantic',expressions:['palms-joined','chin-touch'],contactStyles:(posture==='desk'?['overlap','steeple','interlace']:['overlap','steeple']) as readonly PerformanceContact[]} as const;
}
export const dailyPerformanceDirection=dailyPerformanceForPosture();
/** Editorial clauses feed a shared thought clock. No story title, topic,
 * literal keyword or fixed timestamp selects a physical gesture. */
export function directDailyCueMotion(cues:TgCue[],date:string){
 const groups:TgCue[][]=[];
 let adjacent=false;
 for(const cue of cues){
  if(!cue.intent||cue.choreography){adjacent=false;continue;}
  const last=groups.at(-1),prior=last?.at(-1),special=cue.intent==='point-down'||cue.intent==='point-up'||cue.intent==='fold-hands';
  if(adjacent&&last&&prior&&prior.speaker===cue.speaker&&prior.storyId===cue.storyId&&cue.end-last[0].start<=60&&cue.start>=prior.end&&cue.start-prior.end<1.5&&!special&&!['point-down','point-up','fold-hands'].includes(prior.intent??''))last.push(cue);
  else groups.push([cue]);
  adjacent=true;
 }
 for(const speaker of new Set(groups.map(g=>g[0].speaker))){
  const local=groups.filter(g=>g[0].speaker===speaker),phrases:PerformancePhraseSpec[]=local.map(group=>{
   const first=group[0],last=group.at(-1)!;
   return {cueId:`${date}:${first.start}:${speaker}`,mood:first.mood,intensity:first.intensity,intent:first.intent,startSeconds:first.start,durationSeconds:last.end-first.start,
    segments:group.map(c=>({cueId:String(c.start),startSeconds:c.start-first.start,endSeconds:c.end-first.start,mood:c.mood,intensity:c.intensity,intent:c.intent,accents:c.gestureAccent===undefined?undefined:[c.gestureAccent]}))};
  });
  const plans=planPerformancePhrases(phrases,{seed:`tg:${date}`,actorId:`presenter:${speaker}`,...dailyPerformanceDirection});
  local.forEach((group,index)=>group.forEach(cue=>{cue.choreography=plans[index];cue.performanceWindow={start:group[0].start,end:group.at(-1)!.end};}));
 }
 return cues;
}
