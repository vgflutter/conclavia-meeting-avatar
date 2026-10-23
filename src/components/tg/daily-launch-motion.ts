import {planPerformancePhrases,type GestureIntent} from '@conclavia/avatar-kit/performance';
import type {TgPromoSequence} from '@conclavia/avatar-kit/formats/tg';
import {dailyLaunch} from './daily-launch-storyboard';
import {dailyPerformanceForPosture} from '../../lib/tg/performance-direction';

// Editorial intent is product data; gesture selection/animation is shared.
// These annotations do not change speech, captions, moods or scene timing.
const intents:readonly GestureIntent[]=[
 'emphasize','reassure','acknowledge','explain','question','invite',
 'contrast','emphasize','contrast','explain','emphasize','contrast',
 'emphasize','invite','invite','acknowledge',
];
const direction=new Map(dailyLaunch.lines.map((line,i)=>[line.text,intents[i]]));
export function directDailyLaunchMotion(sequence:TgPromoSequence,options:{posture?:'standing'|'desk';coordinatedHands?:boolean;vitality?:number}={}):TgPromoSequence {
 const posture=options.posture??(options.coordinatedHands?'desk':'standing'),directionProfile=dailyPerformanceForPosture(posture);
 // Product-specific semantic accents. Their positions come from the cached
 // word alignment, never evenly spaced syllables or a separate animation clock.
 const anchors=new Set(['capire','contano','idea','mondo','conta','cambia','cerca','ricontrolla','verificabili','opinioni','politiche','approfondimento','segui','spotify','contesto']);
 const wordKey=(s:string)=>s.toLocaleLowerCase('it-IT').replace(/[^\p{L}]/gu,'');
 // One thought may contain several emotional clauses. Keep its arm action
 // on a shared media window while mood, words and lip sync stay cue-local.
 const groups:{indices:number[];intent:GestureIntent|undefined}[]=[];
 sequence.cues.forEach((c,i)=>{
  const last=groups.at(-1),prior=last?sequence.cues[last.indices.at(-1)!]:undefined;
  const join=!c.choreography&&prior&&!prior.choreography&&direction.has(c.text)&&direction.has(prior.text)&&c.scene===prior.scene&&
   (c.scene==='purpose'||c.scene==='method'||c.scene==='trust'&&prior.text==='Fonti verificabili,');
  if(join)last!.indices.push(i);
  else groups.push({indices:[i],intent:posture==='desk'&&c.text.startsWith('Stiamo costruendo una redazione')?'fold-hands':c.text.startsWith('Stiamo costruendo una redazione')?'point-up':direction.get(c.text)});
 });
 const plans=planPerformancePhrases(groups.map(g=>{const c=sequence.cues[g.indices[0]],last=sequence.cues[g.indices.at(-1)!];return{cueId:'promo:'+c.start,mood:c.mood,
  startSeconds:c.start,durationSeconds:last.end-c.start,intensity:c.intensity,intent:g.intent,
  ...(g.intent==='fold-hands'?{contact:'interlace' as const}:{}),
  ...(g.indices.length>1?{segments:g.indices.map(index=>{const clause=sequence.cues[index];return{
   cueId:'clause-'+index,startSeconds:clause.start-c.start,endSeconds:clause.end-c.start,mood:clause.mood,intensity:clause.intensity,intent:direction.get(clause.text),
   accents:sequence.words.filter(w=>w.start>=clause.start&&w.end<=clause.end&&anchors.has(wordKey(w.text))).map(w=>(w.start+w.end)/2-clause.start)};})}:{}),
  accents:sequence.words.filter(w=>w.start>=c.start&&w.end<=last.end&&(g.intent==='point-up'?wordKey(w.text)==='ricontrolla':anchors.has(wordKey(w.text)))).map(w=>(w.start+w.end)/2-c.start)};}),
  {seed:'daily-launch-standing-v3',actorId:'promo-host',...directionProfile,vitality:options.vitality??directionProfile.vitality});
 const cues=[...sequence.cues];groups.forEach((g,i)=>{
  const first=cues[g.indices[0]],last=cues[g.indices.at(-1)!],plan=plans[i];
  // The explicit composed pause is used once, not as the default hand pose.
  for(const index of g.indices)if(!cues[index].choreography)cues[index]={...cues[index],choreography:plan,
   ...(g.indices.length>1?{performanceWindow:{start:first.start,end:last.end}}:{})};
 });
 return {...sequence,cues,
  scenes:sequence.scenes.map(scene=>{
   if(!scene.turns?.length||scene.spoken)return scene;
   const duration=(scene.end-scene.start)/scene.turns.length;
   const turns=planPerformancePhrases(scene.turns.map((t,i)=>({cueId:scene.id+':'+i,mood:t.mood,
    startSeconds:scene.start+i*duration,durationSeconds:duration,intent:i===0?'question':'contrast'})),
    {seed:'daily-launch-standing-v3',actorId:'preview',...directionProfile,vitality:options.vitality??directionProfile.vitality});
   return {...scene,turns:scene.turns.map((t,i)=>({...t,choreography:t.choreography??turns[i]}))};
  })};
}
