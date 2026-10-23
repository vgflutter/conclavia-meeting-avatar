// Visual QA of the production renderer using existing pilots; GET-only, no AI/TTS.
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const origin='http://127.0.0.1:3106',archive='http://127.0.0.1:3105';
const dir='docs/images/daily-studio';await mkdir(dir,{recursive:true});
const jobs=await(await fetch(archive+'/api/tg/newsroom')).json();
const browser=await chromium.launch({channel:'chrome'});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.request().method()!=='GET'||!r.request().url().startsWith(origin)?r.abort():r.continue());
 await page.goto(origin+'/podcast/tg/render');await page.waitForFunction(()=>window.conclaviaTgRender||window.conclaviaTgRenderError,{},{timeout:90000});
 if(await page.evaluate(()=>window.conclaviaTgRenderError))throw Error('Studio not ready');
 for(const job of jobs.jobs.filter(j=>j.state==='needs_review')){
  const m=await(await fetch(`${archive}/api/tg/editions/${job.id}/assets?name=manifest.json`)).json();
  for(const portrait of [false,true])for(const t of [3,35,70]){
   const image=await page.evaluate(({m,portrait,t})=>{window.conclaviaTgRender.prepare(m,portrait);return window.conclaviaTgRender.frame(t);},{m,portrait,t});
   await writeFile(`${dir}/${job.edition}-${portrait?'portrait':'landscape'}-${t}.jpg`,Buffer.from(image,'base64'));
  }
 }
 if(errors.length)throw Error(errors.join('\n'));console.log('Daily production scene: pilot review frames saved; no browser errors or mutations.');
}finally{await browser.close();}
