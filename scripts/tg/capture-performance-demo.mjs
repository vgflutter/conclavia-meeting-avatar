// Offline capture of the same local browser/kit renderer. No AI or database writes.
import {chromium} from '@playwright/test';
import {spawnSync} from 'node:child_process';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
const origin=process.env.TG_RENDER_ORIGIN??'http://127.0.0.1:3106',dir=resolve('public/daily-performance');
if(!/^http:\/\/127\.0\.0\.1:31\d\d$/u.test(origin))throw Error('Local renderer required');
const complete=process.argv.includes('--complete'),prefix=complete?'complete':'robot',captureDir=resolve(complete?'docs/images/daily-complete-performance':'docs/images/daily-robot-performance');
const sequence=JSON.parse(await readFile(resolve(dir,'sequence.json'),'utf8'));
const audioPath=sequence.audioUrl?resolve('public',sequence.audioUrl.replace(/^\//u,'')):resolve(dir,'nicola.wav');
if(!audioPath.startsWith(dir+'/')||!audioPath.endsWith('.wav'))throw Error('Local audition audio required');
await mkdir(captureDir,{recursive:true});
const browser=await chromium.launch({channel:'chrome'});
try{
  const page=await browser.newPage({viewport:{width:1500,height:1700},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>route.request().method()!=='GET'||!route.request().url().startsWith(origin)?route.abort():route.continue());
  await page.goto(origin+'/podcast/tg/performance');
  await page.waitForFunction(()=>window.conclaviaActorReview?.duration>0&&document.querySelector('[data-stage="daily-studio"][data-ready="true"]'),{},{timeout:90_000});
  if(complete){await page.getByRole('button',{name:'Test completo · 8 mood',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-mode="complete"][data-ready="true"]'));}
  await page.addStyleTag({content:'[data-testid="actor-viewport"]{width:1280px;height:720px;max-width:none;border-radius:0;box-shadow:none}[data-testid="actor-viewport"][class*="portrait"]{width:720px;height:1280px}'});
  const portraitOnly=process.argv.includes('--portrait');
  const diagnostics=portraitOnly?JSON.parse(await readFile(resolve(dir,`${prefix}-capture-report.json`),'utf8')).diagnostics.filter(d=>d.format==='landscape'):[];
  for(const portrait of portraitOnly?[true]:[false,true]){
    if(portrait)await page.getByRole('button',{name:'Formato 9:16'}).click();
    const name=portrait?'portrait':'landscape',fps=25;
    const frames=await mkdtemp(join(tmpdir(),'daily-acting-'));
    await page.waitForFunction(vertical=>{const c=document.querySelector('[data-testid="actor-viewport"] canvas');return c?.width===(vertical?720:1280)&&c?.height===(vertical?1280:720);},portrait);
    for(let frame=0;frame<Math.ceil(sequence.duration*fps);frame++){
      const time=frame/fps;
      // Capture the shared canvas synchronously on its audio clock. Waiting
      // for DOM screenshot stability can stall on the live position controls.
      const pixels=await page.evaluate(t=>window.conclaviaActorReview.frame(t,true),time);
      await writeFile(join(frames,`${String(frame).padStart(4,'0')}.png`),Buffer.from(pixels,'base64'));
      if(frame%125===0||complete&&frame%100===50){console.log(`${name}: ${time}s`);diagnostics.push({format:name,time,mood:await page.locator('[data-stage="daily-studio"]').getAttribute('data-mood'),sample:await page.evaluate(()=>window.conclaviaActorReview.sample())});}
    }
    const encoded=spawnSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-framerate',String(fps),'-i',join(frames,'%04d.png'),'-i',audioPath,'-map','0:v','-map','1:a','-vf',`scale=${portrait?'720:1280':'1280:720'}:out_range=tv:out_color_matrix=bt709,setsar=1,format=yuv420p`,'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-c:a','aac','-b:a','128k','-t',String(sequence.duration),'-movflags','+faststart',resolve(dir,`${prefix}-${name}.mp4`)],{encoding:'utf8'});
    if(encoded.status!==0)throw new Error(encoded.stderr||'Encoding failed');
    await rm(frames,{recursive:true,force:true});
    const stills=complete?[...['attention','curiosity','doubt','agreement','amusement','empathy','disagreement','surprise'].map((m,i)=>[m,2+i*4]),['listening',34]]:[['presence',2],['curiosity',8.8],['doubt',13],['empathy',19],['warmth',24.5],['listening',34]];
    for(const [label,time] of stills){
      const pixels=await page.evaluate(t=>window.conclaviaActorReview.frame(t,true),time);
      await writeFile(join(captureDir,`${name}-${label}.png`),Buffer.from(pixels,'base64'));
    }
  }
  if(errors.length)throw new Error(errors.join('\n'));
  await writeFile(resolve(dir,`${prefix}-capture-report.json`),JSON.stringify({fps:25,duration:sequence.duration,mode:complete?'complete':'voice',errors,diagnostics},null,2));
  console.log('Robot 2D audition exported.');
}finally{await browser.close();}
