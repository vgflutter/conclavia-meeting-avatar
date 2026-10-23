// Local, read-only acceptance of the hands in the actual Daily renderer.
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const origin=process.env.TG_RENDER_ORIGIN??'http://127.0.0.1:3106';
if(!/^http:\/\/127\.0\.0\.1:31\d\d$/u.test(origin))throw Error('Local renderer only');
const dir='docs/images/daily-studio/hand-review';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome'}),errors=[],samples=[];
try{
 const page=await browser.newPage({viewport:{width:1500,height:1300}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.request().method()!=='GET'||!r.request().url().startsWith(origin)?r.abort():r.continue());
 await page.goto(origin+'/podcast/tg/proposte');
 await page.waitForFunction(()=>window.conclaviaActorReview?.duration>0&&document.querySelector('[data-ready="true"]'),{},{timeout:90000});
 await page.getByRole('button',{name:'06 · Umanoide'}).click();
 await page.addStyleTag({content:'[data-testid="actor-viewport"]{width:1280px;height:720px;max-width:none;border-radius:0}'});
 for(const mood of ['attention','curiosity','doubt','agreement','amusement','empathy','disagreement','surprise']){
  await page.getByLabel('Espressione della proposta').selectOption(mood);
  await page.waitForFunction(m=>document.querySelector(`[data-mood="${m}"][data-ready="true"]`),mood);
  const frames=await page.evaluate(()=>{
   const api=window.conclaviaActorReview;let peak={time:0,height:0};
   for(let i=0;i<=100;i++){api.frame(i/25,false);const s=api.sample(),h=Math.max(s.motion.left.lift,s.motion.right.lift);if(h>peak.height)peak={time:i/25,height:h};}
   const times=[0,Math.max(0,peak.time-.24),peak.time,peak.time+.24,4.4],frames=[];
   for(const time of times){for(let t=0;t<=Math.round(time*25);t++)api.frame(t/25,false);api.frame(time,false);
    const canvas=document.querySelector('[data-testid="actor-viewport"] canvas'),crop=document.createElement('canvas');crop.width=570;crop.height=360;crop.getContext('2d').drawImage(canvas,15,262,570,360,0,0,570,360);
    frames.push({time,sample:api.sample(),image:crop.toDataURL('image/png').split(',')[1]});
   }return frames;
  });
  for(const [i,f]of frames.entries())await writeFile(`${dir}/${mood}-${i}.png`,Buffer.from(f.image,'base64'));
  samples.push({mood,frames});
 }
 const contact=await browser.newPage({viewport:{width:1500,height:1600},deviceScaleFactor:1});
 await contact.setContent(`<style>*{box-sizing:border-box}body{margin:0;padding:12px;background:#dce3df;font:14px Arial;color:#203944}.row{display:grid;grid-template-columns:110px repeat(5,1fr);gap:8px;margin-bottom:10px;align-items:center}img{width:100%;background:white;border-radius:5px}p{margin:4px}</style>${samples.map(s=>`<div class="row"><strong>${s.mood}</strong>${s.frames.map(f=>`<div><p>${f.time.toFixed(2)} s</p><img src="data:image/png;base64,${f.image}"></div>`).join('')}</div>`).join('')}`);
 await contact.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await contact.screenshot({path:`${dir}/contact-sheet.png`,fullPage:true});
 if(errors.length)throw Error(errors.join('\n'));
 await writeFile(`${dir}/report.json`,JSON.stringify({origin,errors,samples:samples.map(s=>({mood:s.mood,frames:s.frames.map(({time,sample})=>({time,sample}))}))},null,2));
 console.log('Eight moods, rest, preparation, emphasis and recovery captured from the live Daily renderer.');
}finally{await browser.close();}
