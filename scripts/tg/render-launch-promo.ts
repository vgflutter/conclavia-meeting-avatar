/** Offline render of the reviewed launch storyboard. GET-only browser; no AI. */
import {mkdir,readFile,writeFile,rename,access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {chromium,type Page} from '@playwright/test';
import path from 'node:path';
import type {TgPromoSequence} from '@conclavia/avatar-kit/formats/tg';
import {command} from '../../src/lib/tg/media';
type Api={prepare:(s:TgPromoSequence,p:boolean)=>void;frame:(t:number,capture?:boolean)=>string;sample:()=>{texts:{overflow:boolean;size:number}[];actor:{mouthOpen:boolean;motion:unknown};scene:string}};
declare global {interface Window {conclaviaLaunchRender?:Api;conclaviaLaunchError?:string}}
async function main(){
const origin=process.env.TG_RENDER_ORIGIN??'http://127.0.0.1:3106',dir=process.env.TG_LAUNCH_DIR??'public/daily-launch';
const renderPath=process.env.TG_RENDER_PATH??'/podcast/tg/presentazione/render';
if(!/^\/[a-zA-Z0-9/_-]+(?:\.html)?$/u.test(renderPath))throw Error('Local render path required');
const publicRoot=path.resolve('public/daily-launch'),resolvedDir=path.resolve(dir);
const finish=process.env.TG_AVATAR_FINISH;
const posture=process.env.TG_AVATAR_POSTURE;
const hands=process.env.TG_AVATAR_HANDS;
const fps=Number(process.env.TG_RENDER_FPS??25);
if(fps!==25&&fps!==50)throw Error('Render FPS must be 25 or 50');
if(hands&&hands!=='shell'&&hands!=='anatomical')throw Error('Unknown hand style');
if(hands&&!posture)throw Error('Hand trials require an explicit posture');
if(posture&&posture!=='desk'&&posture!=='standing')throw Error('Unknown avatar posture');
if(posture&&!finish)throw Error('Posture trials require an explicit avatar finish');
if(finish&&finish!=='sculpted')throw Error('Unknown avatar finish');
if(finish&&!resolvedDir.startsWith(path.join(publicRoot,'revisions','avatar-')))throw Error('Avatar finish trials require a separate avatar revision directory');
if(resolvedDir!==publicRoot&&!resolvedDir.startsWith(publicRoot+path.sep))throw Error('Launch output must remain inside the public launch directory');
if(!/^http:\/\/127\.0\.0\.1:31\d\d$/u.test(origin))throw Error('Local rendering origin required');
const qaDir=process.env.TG_LAUNCH_QA_DIR??'docs/images/daily-launch';
const qaRoot=path.resolve('docs/images/daily-launch'),resolvedQa=path.resolve(qaDir);
if(resolvedQa!==qaRoot&&!resolvedQa.startsWith(qaRoot+path.sep))throw Error('Launch QA output must remain in its documentation directory');
const sequence=JSON.parse(await readFile(dir+'/manifest.json','utf8')) as TgPromoSequence;
if(finish)Object.assign(sequence,{avatarFinish:finish});
if(posture)Object.assign(sequence,{avatarPosture:posture});
if(hands)Object.assign(sequence,{avatarHands:hands});
const proofArg=process.argv.find(a=>a.startsWith('--proof='));
const proofRange=proofArg?.slice(8).split(':').map(Number);
if(proofRange&&(proofRange.length!==2||!proofRange.every(Number.isFinite)||proofRange[0]<0||proofRange[1]>sequence.duration||proofRange[1]<=proofRange[0]||proofRange[1]-proofRange[0]>15))throw Error('Proof must be start:end inside the sequence, up to 15 seconds');
const offset=proofRange?.[0]??0,duration=proofRange?proofRange[1]-offset:sequence.duration,prefix=proofRange?'motion-proof-':'';
await access(dir+'/audio.wav');
const editionPilot=process.argv.includes('--edition-pilot');
if(editionPilot&&(!resolvedDir.startsWith(path.join(publicRoot,'editions')+path.sep)||(sequence as TgPromoSequence&{kind?:string}).kind!=='daily-pilot'))throw Error('Daily pilot requires its own edition directory and explicit kind');
if(!Number.isFinite(sequence.duration)||sequence.duration<=0||sequence.duration>(editionPilot?428:60)||sequence.cues.length>(editionPilot?60:20))throw Error('Sequence exceeds the explicit render bounds');
const browser=await chromium.launch({channel:'chrome'}),errors:string[]=[],mutations:string[]=[],samples:unknown[]=[];
async function prepare(page:Page,portrait:boolean){await page.evaluate(({sequence,portrait})=>window.conclaviaLaunchRender!.prepare(sequence,portrait),{sequence,portrait});}
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{if(r.request().method()!=='GET'){mutations.push(r.request().url());return r.abort();}return r.request().url().startsWith(origin)?r.continue():r.abort();});
 await page.goto(origin+renderPath+(finish?'?finish='+finish+(posture?'&posture='+posture:'')+(hands?'&hands='+hands:''):''));await page.waitForFunction(()=>window.conclaviaLaunchRender||window.conclaviaLaunchError);
 if(await page.evaluate(()=>window.conclaviaLaunchError))throw Error('Promo assets unavailable');
 await mkdir(qaDir,{recursive:true});
 for(const portrait of [true,false]){
  const format=portrait?'portrait':'landscape';await prepare(page,portrait);
  if(process.argv.includes('--preview')){
   for(const scene of sequence.scenes)for(const [view,t] of (scene.kind==='conversation'?[scene.start+(scene.end-scene.start)*.25,scene.start+(scene.end-scene.start)*.75]:[scene.start+Math.min((scene.end-scene.start)*.55,1.8)]).entries()){
    const result=await page.evaluate(({time})=>{window.conclaviaLaunchRender!.frame(time,false);const c=document.querySelector('canvas')!;return {image:c.toDataURL('image/jpeg',.93).split(',')[1],sample:window.conclaviaLaunchRender!.sample()};},{time:t});
    samples.push({format,...result.sample});await writeFile(`${qaDir}/${format}-${scene.id}${view?'-turn-'+(view+1):''}.jpg`,Buffer.from(result.image,'base64'));
    if(result.sample.texts.some(t=>t.overflow))throw Error('Promo text overflow');
   }
   continue;
  }
  const target=`${dir}/${prefix}${format}.partial.mp4`,encoder=spawn('ffmpeg',['-y','-v','error','-f','image2pipe','-framerate',String(fps),'-vcodec','mjpeg','-i','pipe:0',...(proofRange?['-ss',String(offset)]:[]),'-i',dir+'/audio.wav','-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-ac','2','-b:a','192k','-t',String(duration),'-movflags','+faststart',target],{stdio:['pipe','ignore','pipe']});let encodeError='';encoder.stderr.on('data',b=>{encodeError=(encodeError+String(b)).slice(-1800);});const closed=once(encoder,'close');
  try{
   for(let frame=0;frame<Math.round(duration*fps);frame++){
    const data=await page.evaluate(t=>window.conclaviaLaunchRender!.frame(t),offset+frame/fps);
    if(frame%fps===0){const sample=await page.evaluate(()=>window.conclaviaLaunchRender!.sample());if(sample.texts.some(t=>t.overflow))throw Error('Promo text overflow during export');}
    if(!encoder.stdin.write(Buffer.from(data,'base64')))await Promise.race([once(encoder.stdin,'drain'),closed.then(()=>{throw Error('Encoder stopped');})]);
   }
   encoder.stdin.end();const [code]=await closed;if(code!==0)throw Error('Promo encoding failed: '+encodeError);
  }catch(e){encoder.kill('SIGTERM');await closed.catch(()=>{});throw e;}
  await rename(target,`${dir}/${prefix}${format}.mp4`);
  const feature=resolvedDir===publicRoot?undefined:sequence.scenes.find(s=>s.kind==='conversation'||s.kind==='evidence');
  const coverTime=proofRange?offset+duration*.5:editionPilot?sequence.scenes[0].start+Math.min(1.8,(sequence.scenes[0].end-sequence.scenes[0].start)*.5):feature?feature.start+Math.min(1.8,(feature.end-feature.start)*.5):sequence.duration-1.4;await page.evaluate(t=>window.conclaviaLaunchRender!.frame(t,false),coverTime);
  const cover=await page.evaluate(()=>document.querySelector('canvas')!.toDataURL('image/jpeg',.95).split(',')[1]);await writeFile(`${dir}/${prefix}cover-${format}.jpg`,Buffer.from(cover,'base64'));
  const probe=JSON.parse(await command('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_name,width,height,r_frame_rate,sample_aspect_ratio','-of','json',`${dir}/${prefix}${format}.mp4`],AbortSignal.timeout(30000)));
  samples.push({format,probe});console.log(JSON.stringify({format,seconds:duration,offset,state:'rendered'}));
 }
 if(errors.length||mutations.length)throw Error('Browser errors or unexpected mutations');
 await writeFile(`${qaDir}/${proofRange?'motion-proof':process.argv.includes('--preview')?'preview':'render'}-report.json`,JSON.stringify({errors,mutations,samples},null,2));
 if(proofRange)return; // Internal proof never replaces selected movies/manifest.
 const stamp=(s:number)=>{const ms=Math.round(s*1000);return `00:${String(Math.floor(ms/60000)).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;};
 await writeFile(dir+'/captions.vtt','WEBVTT\n\n'+sequence.cues.map((c,i)=>`${i+1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`).join('\n'));
 if(!process.argv.includes('--preview')){
  const version=createHash('sha256');
  for(const format of ['portrait','landscape'])version.update(await readFile(`${dir}/${format}.mp4`));
  sequence.mediaVersion=version.digest('hex').slice(0,12);
  await writeFile(dir+'/manifest.partial.json',JSON.stringify(sequence,null,2)+'\n');
  await rename(dir+'/manifest.partial.json',dir+'/manifest.json');
 }
}finally{await browser.close();}
}
void main().catch(e=>{console.error(e instanceof Error?e.message:"Launch render failed");process.exitCode=1;});
