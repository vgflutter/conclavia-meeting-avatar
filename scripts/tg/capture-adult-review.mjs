import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const origin=process.env.TG_RENDER_ORIGIN??'http://127.0.0.1:3106';
if(!/^http:\/\/127\.0\.0\.1:31\d\d$/u.test(origin))throw Error('Local renderer only');
const dir='docs/images/daily-studio/hybrid-review';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome'}),results=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1300}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.request().method()!=='GET'||!r.request().url().startsWith(origin)?r.abort():r.continue());
 await page.goto(origin+'/podcast/tg/proposte');await page.waitForFunction(()=>window.conclaviaActorReview&&document.querySelector('[data-ready="true"]'),{},{timeout:90000});
 for(const [id,label] of [['editorial-human','01 · Ritratto editoriale'],['porcelain','02 · Ceramica viva'],['graphic-novel','03 · Inchiostro'],['synthetic','04 · Sintesi'],['print','05 · Stampa'],['hybrid','06 · Umanoide']]){
  await page.getByRole('button',{name:label}).click();
  for(const identity of ['0','1']){
   await page.getByLabel('Inquadratura della proposta').selectOption(identity);
   await page.waitForFunction(id=>document.querySelector(`[data-design="${id}"][data-ready="true"]`),id);
   const r=await page.evaluate(()=>{const a=window.conclaviaActorReview;for(let i=0;i<66;i++)a.frame(i/25,false);return {image:a.frame(2.6),sample:a.sample()};});
   await writeFile(`${dir}/${id}-${identity}.png`,Buffer.from(r.image,'base64'));results.push({id,identity,sample:r.sample,image:r.image});
  }
 }
 if(errors.length)throw Error(errors.join('\n'));
 const ordered=[...results].sort((a,b)=>Number(a.identity)-Number(b.identity));
 const contact=await browser.newPage({viewport:{width:2160,height:1360},deviceScaleFactor:1});
 await contact.setContent(`<style>*{box-sizing:border-box}body{margin:0;padding:20px;background:#e7ece9;font:16px Arial;color:#203944}.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:14px}.card{background:white;overflow:hidden;border-radius:8px}.crop{height:570px;position:relative;overflow:hidden}.crop img{position:absolute;width:1180px;max-width:none;left:-105px;top:-82px}.card p{padding:0 15px}</style><div class="grid">${ordered.map(r=>`<div class="card"><p>${r.id} / ${r.identity}</p><div class="crop"><img src="data:image/png;base64,${r.image}"></div></div>`).join('')}</div>`);
 await contact.locator('img').last().waitFor();await contact.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await contact.screenshot({path:`${dir}/six-proposals.png`,fullPage:true});
 const moods=['attention','curiosity','doubt','agreement','amusement','empathy','disagreement','surprise'],moodFrames=[];
 await page.getByRole('button',{name:'06 · Umanoide'}).click();
 await page.waitForFunction(()=>document.querySelector('[data-design="hybrid"][data-ready="true"]'));
 for(const identity of ['0','1']){
  await page.getByLabel('Inquadratura della proposta').selectOption(identity);
  await page.waitForFunction(id=>document.querySelector(`[data-identity="${id}"][data-ready="true"]`),identity);
  for(const mood of moods){
   await page.getByLabel('Espressione della proposta').selectOption(mood);
   await page.waitForFunction(m=>document.querySelector(`[data-mood="${m}"][data-ready="true"]`),mood);
   const frame=await page.evaluate(()=>{const a=window.conclaviaActorReview;for(let i=0;i<=40;i++)a.frame(i/25,false);return {image:a.frame(1.6),sample:a.sample()};});
   await writeFile(`${dir}/winner-${identity}-${mood}.png`,Buffer.from(frame.image,'base64'));moodFrames.push({identity,mood,...frame});
  }
 }
 await contact.setViewportSize({width:1440,height:1300});
 await contact.setContent(`<style>*{box-sizing:border-box}body{margin:0;padding:14px;background:#e7ece9;font:16px Arial;color:#203944}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.card{background:white;overflow:hidden;border-radius:8px}.crop{height:530px;position:relative;overflow:hidden}.crop img{position:absolute;width:1180px;max-width:none;left:-105px;top:-82px}.card p{padding:0 14px}</style><div class="grid">${moodFrames.map(r=>`<div class="card"><p>${r.identity=== '0'?'Riccardo':'Sofia'} · ${r.mood}</p><div class="crop"><img src="data:image/png;base64,${r.image}"></div></div>`).join('')}</div>`);
 await contact.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await contact.screenshot({path:`${dir}/winner-moods.png`,fullPage:true});
 await writeFile(`${dir}/report.json`,JSON.stringify({errors,proposals:results.map(r=>({id:r.id,identity:r.identity,sample:r.sample})),winnerMoods:moodFrames.map(r=>({identity:r.identity,mood:r.mood,sample:r.sample}))},null,2));console.log('Six designs, twelve identities captured.');
}finally{await browser.close();}
