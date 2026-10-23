/** Reuse the user-approved pointer shape, retimed to the new measured word. */
import {readFile,writeFile} from 'node:fs/promises';
const id=process.argv.find(a=>a.startsWith('--id='))?.slice(5);
if(!id||!/^\d{4}-\d{2}-\d{2}-it-pilot(?:-r[1-9]\d*)?$/u.test(id))throw Error('Explicit isolated edition required');
const file=`public/daily-launch/editions/${id}/manifest.json`,m=JSON.parse(await readFile(file,'utf8'));
const reference='avatar-comments-gesture-20261023',r=JSON.parse(await readFile(`public/daily-launch/revisions/${reference}/manifest.json`,'utf8'));
const source=r.cues.find(c=>c.intent==='point-down')?.choreography,index=m.cues.findIndex(c=>c.scene==='chiusura'&&c.gestureWord==='commenti');
if(m.id!==id||m.kind!=='daily-pilot'||index<0||!source||source.strokes.length!==1||source.strokes[0].kind!=='point-down')throw Error('Approved reference or comments cue missing');
const cue=m.cues[index],next=m.cues[index+1],word=m.words.find(w=>w.start>=cue.start&&w.end<=cue.end&&w.text.toLowerCase()==='commenti');
if(!word||next?.text!=='partiamo dalle tue domande.')throw Error('Complete measured closing phrase required');
const original=source.strokes[0],wordMid=(word.start+word.end)/2;
// A brisk take may pronounce “Scrivici nei” faster than the approved gesture's
// anticipation. Use only the actual quiet gap after the preceding cue; keep
// every word time and the gesture shape unchanged, never delay “commenti”.
const previous=m.cues[index-1];
const previousEnd=previous?m.words.filter(w=>w.start>=previous.start&&w.end<=cue.start).at(-1)?.end??cue.start:cue.start;
const start=Math.max(previousEnd,Math.min(cue.start,wordMid-original.apex+original.start-.06)),end=next.end,apex=wordMid-start,shift=apex-original.apex;
const stroke={...original,start:original.start+shift,apex,end:original.end+shift};
if(stroke.start<0||stroke.end>end-start||stroke.apex<=stroke.start)throw Error('Approved pointer cannot fit the actual closing; review required');
const key=`${reference}:${id}:comments`,plan={...source,key,durationSeconds:end-start,strokes:[stroke]};
for(const c of m.cues.filter(c=>c.scene==='chiusura')){
 c.choreography={...source,key:`${reference}:${id}:${c.thought}`,durationSeconds:c.end-c.start,strokes:[]};delete c.performanceWindow;
}
for(const c of [...(start<cue.start&&previous?[previous]:[]),cue,next]){c.choreography=structuredClone(plan);c.performanceWindow={start,end};}
m.approvedClosingGesture={reference,referenceMediaVersion:r.mediaVersion,word:'commenti',apexSeconds:start+apex,wordStart:word.start,wordEnd:word.end,anticipationBeforeCueSeconds:cue.start-start,hand:stroke.hand,variant:stroke.variant,shapePreserved:true};
await writeFile(file,JSON.stringify(m,null,2)+'\n');console.log(JSON.stringify({id,...m.approvedClosingGesture}));
