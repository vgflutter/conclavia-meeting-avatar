// Code-rendered review frames, with no AI/TTS, writes or social publication.
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const origin=process.env.TG_RENDER_ORIGIN??'http://127.0.0.1:3106';
if(!/^http:\/\/127\.0\.0\.1:31\d\d$/u.test(origin))throw Error('Local renderer required');
const dir='docs/images/daily-studio/acting';await mkdir(dir,{recursive:true});
const moods=['attention','curiosity','doubt','agreement','amusement','empathy','disagreement','surprise'];
const manifest=mood=>({version:1,demo:true,product:{name:'Daily',edition:'it',language:'it',seconds:6,presenters:1},date:'2026-10-18',seconds:6,
 stories:[{id:'demo',headline:'Una voce, otto modi di esprimersi.',whyItMatters:'Prova visiva della recitazione. Nessuna notizia reale.',sourceIds:[]}],sources:[],
 cues:[{text:'Una frase dimostrativa per confrontare sguardo, postura, braccia e mani.',mood,intensity:.9,speaker:0,storyId:'demo',sourceIds:[],start:0,end:6,frameSeconds:1,levels:Array(6).fill(.5),phones:[{start:0,end:6,viseme:'e'}]}]});
const browser=await chromium.launch({channel:'chrome'}),report=[];
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.request().method()!=='GET'||!r.request().url().startsWith(origin)?r.abort():r.continue());
 await page.goto(origin+'/podcast/tg/render');await page.waitForFunction(()=>window.conclaviaTgRender||window.conclaviaTgRenderError,{},{timeout:90000});
 if(await page.evaluate(()=>window.conclaviaTgRenderError))throw Error('Studio failed to load');
 for(const mood of moods)for(const portrait of [false,true]){
  const result=await page.evaluate(({m,portrait})=>{
   const api=window.conclaviaTgRender;api.prepare(m,portrait);
   for(let i=0;i<=40;i++)api.frame(i/25);
   return {image:document.querySelector('canvas').toDataURL('image/jpeg',.92),sample:api.sample()};
  },{m:manifest(mood),portrait});
  await writeFile(`${dir}/${mood}-${portrait?'portrait':'landscape'}.jpg`,Buffer.from(result.image.split(',')[1],'base64'));
  report.push({mood,portrait,pose:result.sample.actors[0]});
 }
 if(errors.length)throw Error(errors.join('\n'));
 await writeFile(`${dir}/report.json`,JSON.stringify({errors,frames:report},null,2));console.log('Eight moods reviewed in both compositions, no browser errors.');
}finally{await browser.close();}
