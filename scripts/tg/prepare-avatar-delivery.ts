/** Create a new visual-only revision from cached public speech. No providers. */
import {access,copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {directDailyLaunchMotion} from '../../src/components/tg/daily-launch-motion';
import {planPerformancePhrases,type GestureIntent} from '@conclavia/avatar-kit/performance';
import type {TgPromoSequence} from '@conclavia/avatar-kit/formats/tg';
import {dailyPerformanceDirection} from '../../src/lib/tg/performance-direction';
async function main(){
 const arg=(key:string)=>process.argv.find(v=>v.startsWith('--'+key+'='))?.split('=').slice(1).join('=');
 const source=arg('source'),target=arg('target');
 const posture=arg('posture')??'standing';
 if(posture!=='standing'&&posture!=='desk')throw Error('Posture must be standing or desk');
 const vitality=arg('vitality')===undefined?dailyPerformanceDirection.vitality:Number(arg('vitality'));
 if(!Number.isFinite(vitality)||vitality<0||vitality>1)throw Error('Vitality must be between zero and one');
 if(!source||!target||![source,target].every(v=>/^[a-z0-9][a-z0-9-]{0,80}$/u.test(v))||!target.startsWith('avatar-'))throw Error('Use named public revisions; target must start avatar-');
 const root=path.resolve('public/daily-launch/revisions'),from=path.join(root,source),to=path.join(root,target);
 const exists=await access(to).then(()=>true,()=>false);if(exists)throw Error('Preserve existing revisions: target already exists');
 const sequence=JSON.parse(await readFile(from+'/manifest.json','utf8')) as TgPromoSequence;
 if(sequence.duration>60||sequence.cues.length>20)throw Error('This visual review accepts only short cached presentations/closings');
 if(process.argv.includes('--replan')){
  for(const cue of sequence.cues){delete cue.choreography;delete cue.performanceWindow;}
  for(const scene of sequence.scenes)for(const turn of scene.turns??[])delete turn.choreography;
 }
 type DirectedCue=TgPromoSequence['cues'][number]&{intent?:GestureIntent;gestureWord?:string};
 const closing=sequence.cues.some(c=>(c as DirectedCue).intent==='point-down');
 let directed:TgPromoSequence;
 if(closing){
  const plans=planPerformancePhrases(sequence.cues.map((base,i)=>{
   const c=base as DirectedCue,word=c.gestureWord?sequence.words.find(w=>w.start>=c.start&&w.end<=c.end&&w.text.toLocaleLowerCase('it-IT')===c.gestureWord):undefined;
   return {cueId:'closing:'+i,mood:c.mood,intensity:c.intensity,startSeconds:c.start,durationSeconds:c.end-c.start,intent:c.intent,
    // Measured word centre; neither evenly spaced words nor new ASR.
    accents:word?[(word.start+word.end)/2-c.start]:undefined};
  }),{seed:'daily-closing-delivery-v2',actorId:'Alex',...dailyPerformanceDirection,vitality});
  directed={...sequence,cues:sequence.cues.map((c,i)=>({...c,choreography:plans[i]}))};
 }else directed=directDailyLaunchMotion(sequence,{posture,vitality});
 Object.assign(directed,{avatarFinish:'sculpted',avatarPosture:posture,avatarHands:'anatomical',visualRevisionOnly:true,sourceRevision:source,deliveryRevision:'connected-media-motion-v5'});
 delete directed.mediaVersion;
 await mkdir(to);await copyFile(from+'/audio.wav',to+'/audio.wav');await copyFile(from+'/captions.vtt',to+'/captions.vtt');
 await writeFile(to+'/manifest.json',JSON.stringify(directed,null,2)+'\n');
 console.log(JSON.stringify({target,duration:directed.duration,cues:directed.cues.length,cachedAudio:true,providerCalls:0}));
}
void main().catch(e=>{console.error(e instanceof Error?e.message:'Visual revision failed');process.exitCode=1;});
