/** All-frame local composition audit; only existing audio/media and GETs. */
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
import type {TgPromoSequence} from '@conclavia/avatar-kit/formats/tg';
import type {RobotPose} from '@conclavia/avatar-kit/characters/robot';
async function main(){
 const edition=process.argv.find(v=>v.startsWith('--edition='))?.slice(10);
 if(edition&&!/^\d{4}-\d{2}-\d{2}-it-pilot(?:-r[1-9]\d*)?$/u.test(edition))throw Error('Invalid Daily pilot ID');
 const origin=process.env.TG_RENDER_ORIGIN??'http://127.0.0.1:3106';
 const renderPath=process.env.TG_RENDER_PATH??'/podcast/tg/presentazione/render';
 if(!/^\/[a-zA-Z0-9/_-]+(?:\.html)?$/u.test(renderPath))throw Error('Local render path required');
 const fps=Number(process.env.TG_AUDIT_FPS??25);
 if(fps!==25&&fps!==50)throw Error('Audit FPS must be 25 or 50');
 if(!/^http:\/\/127\.0\.0\.1:31\d\d$/u.test(origin))throw Error('Local audit origin required');
 const output=edition?`docs/images/daily-launch/editions/${edition}`:'docs/images/daily-launch/pilots/recheck',browser=await chromium.launch({channel:'chrome'});
 const results:unknown[]=[],errors:string[]=[],blocked:string[]=[];
 try{
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  // tsx preserves local function names; support its helper in this isolated
  // audit page, without changing the application or the user's browser.
  await page.addInitScript('window.__name = value => value;');
  await page.route('**/*',r=>{if(r.request().method()!=='GET'||!r.request().url().startsWith(origin+'/')){blocked.push(r.request().url());return r.abort();}return r.continue();});
  await page.goto(origin+renderPath);await page.waitForFunction(()=>Boolean((window as unknown as {conclaviaLaunchRender:unknown}).conclaviaLaunchRender));
  for(const id of edition?[edition]:['dato','confronto','traccia']){
   const root=(edition?'public/daily-launch/editions/':'public/daily-launch/pilots/')+id,sequence=JSON.parse(await readFile(root+'/manifest.json','utf8')) as TgPromoSequence;
   const audioSha256=createHash('sha256').update(await readFile(root+'/audio.wav')).digest('hex');
   const formats=await page.evaluate(({sequence,fps})=>{
    type Rect={x:number;y:number;width:number;height:number};
    type Sample={scene:string;entry:number;caption:string;active?:number;actors:RobotPose[];placements:unknown[];regions:{head:Rect;hands:Rect[]}[];bubbles:({speaker:number;text:string;name?:string}&Rect)[];texts:{text:string;overflow:boolean;inkRows:Rect[]}[]};
    const api=(window as unknown as {conclaviaLaunchRender:{prepare(s:TgPromoSequence,p:boolean):void;frame(t:number,c?:boolean):void;sample():Sample}}).conclaviaLaunchRender;
    return [true,false].map(portrait=>{
     api.prepare(sequence,portrait);const width=portrait?720:1280,height=portrait?1280:720,issues:{at:number;kind:string;detail:string}[]=[],ranges:Record<string,{min:number;max:number;maxStep:number;previous:number;at:number}>={};
     let previousScene='',frames=0;const captions=new Set<string>();
     const overlap=(a:Rect,b:Rect)=>Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)+1&&Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y)+1;
     const add=(at:number,kind:string,detail:string)=>{if(issues.length<80)issues.push({at,kind,detail});};
     for(let frame=0;frame<Math.round(sequence.duration*fps);frame++){
      const at=frame/fps;api.frame(at,false);const s=api.sample(),sameScene=previousScene===s.scene;frames++;
      if(s.caption)captions.add(s.caption);
      for(const text of s.texts){if(text.overflow)add(at,'text-overflow',text.text);if(s.entry>.5)for(const row of text.inkRows)for(const region of s.regions)if(overlap(row,region.head))add(at,'text-over-head',text.text);}
      if(s.entry>.5)for(const region of s.regions)for(const hand of region.hands)if(hand.x<0||hand.y<0||hand.x+hand.width>width||hand.y+hand.height>height)add(at,'cropped-hand','Finger envelope crosses frame');
      for(const bubble of s.bubbles)if(!bubble.text.trim())add(at,'empty-bubble','Empty discussion summary');
      if(sequence.scenes.find(v=>v.id===s.scene)?.spoken){
       const started=new Set<number|undefined>(sequence.cues.filter(c=>c.scene===s.scene&&c.start<=at).map(c=>c.speaker));
       for(const bubble of s.bubbles)if(!started.has(bubble.speaker)&&at>=sequence.cues[0].start)add(at,'future-speaker','Summary shown before its first speech cue');
       if(s.active!==undefined&&s.actors[1-s.active].mouthOpen)add(at,'listener-lipsync','Listener speaks with the other voice');
      }
      for(const [i,pose] of s.actors.slice(0,s.placements.length).entries()){
       const channels:Record<string,number>={torso:pose.motion.torso,neckYaw:pose.acting.yaw,neckPitch:pose.acting.pitch,browLeft:pose.face.browLeft,browRight:pose.face.browRight};
       for(const side of ['left','right'] as const)for(const name of ['lift','indexCurl','middleCurl','ringCurl','littleCurl','thumbCurl','opposition'] as const)channels[side+'.'+name]=pose.motion[side][name]??0;
       for(const [name,value] of Object.entries(channels)){const key=i+'.'+name,r=ranges[key];if(!Number.isFinite(value)){add(at,'non-finite-pose',key);continue;}if(!r){ranges[key]={min:value,max:value,maxStep:0,previous:value,at};continue;}r.min=Math.min(r.min,value);r.max=Math.max(r.max,value);const step=sameScene?Math.abs(value-r.previous):0;if(step>r.maxStep){r.maxStep=step;r.at=at;}r.previous=value;}
      }
      previousScene=s.scene;
     }
     return {format:portrait?'portrait':'landscape',fps,frames,issues,captions:[...captions],ranges:Object.fromEntries(Object.entries(ranges).map(([k,{min,max,maxStep,at}])=>[k,{min,max,maxStep,at}]))};
    });
   },{sequence,fps});
   results.push({id,audioSha256,formats});
  }
  await mkdir(output,{recursive:true});await writeFile(output+'/all-frame-audit.json',JSON.stringify({scope:'geometry-and-timing-not-perceptual-approval',providerCalls:0,errors,blocked,results},null,2));
  const count=(results as {formats:{issues:unknown[]}[]}[]).flatMap(r=>r.formats).reduce((n,f)=>n+f.issues.length,0);
  console.log(JSON.stringify({clips:results.length,formats:results.length*2,issues:count,errors,blocked,providerCalls:0}));if(count||errors.length||blocked.length)process.exitCode=1;
 }finally{await browser.close();}
}
void main().catch(e=>{console.error(e instanceof Error?e.message:'Creative audit failed');process.exitCode=1;});
