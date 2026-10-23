import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const script=path.resolve('scripts/tg/apply-approved-daily-closing.mjs');
const id='2026-10-23-it-pilot-r3',reference='avatar-comments-gesture-20261023';
async function fixture(fn,{gap=true,brisk=true}={}){
 const root=await mkdtemp(path.join(tmpdir(),'cdaily-closing-'));
 try{
  const dir=path.join(root,'public/daily-launch/editions',id),ref=path.join(root,'public/daily-launch/revisions',reference);await mkdir(dir,{recursive:true});await mkdir(ref,{recursive:true});
  const original={kind:'point-down',hand:1,start:.11,apex:.96,hold:.5,end:2.46,strength:.98,variant:.08473361167125404};
  const manifest={id,kind:'daily-pilot',words:[{text:'sito',start:13,end:gap?14.96:15.6},{text:'Scrivici',start:15.6,end:brisk?15.76:16.4},{text:'nei',start:brisk?15.76:16.4,end:brisk?15.96:16.8},{text:'commenti',start:brisk?15.96:16.8,end:brisk?16.36:17.2}],cues:[{scene:'chiusura',thought:'sito',text:'Fonti sul sito.',start:12,end:15.6},{scene:'chiusura',thought:'commenti',text:'Scrivici nei commenti cosa vuoi approfondire:',gestureWord:'commenti',start:15.6,end:18},{scene:'chiusura',thought:'commenti',text:'partiamo dalle tue domande.',start:18,end:19.5},{scene:'chiusura',thought:'firma',text:'Meno rumore, più contesto.',start:19.5,end:20.4}]};
  const file=path.join(dir,'manifest.json');await writeFile(file,JSON.stringify(manifest));await writeFile(path.join(ref,'manifest.json'),JSON.stringify({mediaVersion:'fixture',cues:[{intent:'point-down',choreography:{key:'approved',durationSeconds:3,strokes:[original]}}]}));
  await fn({root,file,manifest,original,run:()=>execFileSync(process.execPath,[script,'--id='+id],{cwd:root,stdio:['ignore','pipe','pipe']})});
 }finally{await rm(root,{recursive:true,force:true});}
}
test('brisk invitation anticipates in a real measured gap and preserves speech times and approved shape',async()=>fixture(async({file,manifest,original,run})=>{
 run();const result=JSON.parse(await readFile(file,'utf8'));assert.deepEqual(result.words,manifest.words);assert.deepEqual(result.cues.map(({text,start,end})=>({text,start,end})),manifest.cues.map(({text,start,end})=>({text,start,end})));
 const cue=result.cues[1],stroke=cue.choreography.strokes[0],window=cue.performanceWindow;assert.ok(window.start>=14.96&&window.start<15.6);assert.equal(result.cues[0].performanceWindow.start,window.start);assert.equal(result.cues[2].performanceWindow.start,window.start);
 assert.ok(window.start+stroke.start>14.96);assert.ok(Math.abs(window.start+stroke.apex-16.16)<1e-8);assert.ok(Math.abs((stroke.apex-stroke.start)-(original.apex-original.start))<1e-8);assert.equal(stroke.variant,original.variant);assert.equal(stroke.hand,original.hand);assert.equal(stroke.strength,original.strength);assert.equal(result.approvedClosingGesture.shapePreserved,true);
}));
test('absence of a quiet anticipation gap fails without moving words or publishing an invalid pose',async()=>fixture(async({file,manifest,run})=>{
 assert.throws(run);assert.deepEqual(JSON.parse(await readFile(file,'utf8')),manifest);
},{gap:false}));
test('an unhurried invitation fits within its own cue without borrowing the previous narration',async()=>fixture(async({file,run})=>{
 run();const result=JSON.parse(await readFile(file,'utf8'));assert.equal(result.approvedClosingGesture.anticipationBeforeCueSeconds,0);assert.equal(result.cues[0].performanceWindow,undefined);assert.equal(result.cues[0].choreography.strokes.length,0);
},{brisk:false}));
