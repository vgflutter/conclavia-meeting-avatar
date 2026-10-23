// Exhaustive local render review. No research, provider calls or database writes.
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const origin=process.env.TG_RENDER_ORIGIN??'http://127.0.0.1:3106';
if(!/^http:\/\/127\.0\.0\.1:31\d\d$/u.test(origin))throw Error('Local renderer only');
const dir='docs/images/daily-studio/harmony-review';await mkdir(dir,{recursive:true});
const moods=['attention','curiosity','doubt','agreement','amusement','empathy','disagreement','surprise'];
const browser=await chromium.launch({channel:'chrome'}),errors=[],faces=[],transitions=[];
try{
 const page=await browser.newPage({viewport:{width:1400,height:1200}});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.request().method()!=='GET'||!r.request().url().startsWith(origin)?r.abort():r.continue());
 await page.goto(origin+'/podcast/tg/render');await page.waitForFunction(()=>window.conclaviaTgRender,{},{timeout:90000});
 // Both identities use the actual Daily rendering surface. Identity 1 uses
 // its real portrait cut, preserving the same palette and head/neck renderer.
 for(const identity of [0,1]){
  for(const mood of moods){
   const frame=await page.evaluate(({identity,mood})=>{
    const a=window.conclaviaTgRender;
    const manifest={version:1,demo:true,product:{name:'Daily',edition:'it',language:'it',seconds:5,presenters:identity+1},date:'PROVA MOVIMENTO',seconds:5,sources:[],stories:[{id:'review',headline:'Espressioni, gesti e ascolto.',whyItMatters:'Prova grafica locale. Nessuna notizia reale.',sourceIds:[]}],cues:[{speaker:identity,storyId:'review',text:'Prova dei movimenti del conduttore.',mood,intensity:.94,start:0,end:4,frameSeconds:.04,levels:Array(100).fill(.6),phones:[{start:0,end:4,viseme:'e'}]}]};
    a.prepare(manifest,identity===1);for(let i=0;i<=48;i++)a.frame(i/25,false);
    const sample=a.sample(),canvas=document.querySelector('canvas'),at=sample.layout.actors[identity],r=canvas.width/sample.layout.width;
    const crop=document.createElement('canvas');crop.width=264;crop.height=348;
    crop.getContext('2d').drawImage(canvas,(at.x-110*at.scale)*r,(at.y+20*at.scale)*r,220*at.scale*r,290*at.scale*r,0,0,264,348);
    return {image:crop.toDataURL('image/png').split(',')[1],sample:sample.actors[identity],full:canvas.toDataURL('image/jpeg',.88).split(',')[1]};
   },{identity,mood});
   await writeFile(`${dir}/face-${identity}-${mood}.png`,Buffer.from(frame.image,'base64'));
   await writeFile(`${dir}/body-${identity}-${mood}.jpg`,Buffer.from(frame.full,'base64'));
   faces.push({identity,mood,image:frame.image,sample:frame.sample});
  }
  for(const from of moods)for(const to of moods){if(from===to)continue;
   const result=await page.evaluate(({identity,from,to})=>{
    const a=window.conclaviaTgRender;
    const cues=[from,to].map((mood,i)=>({speaker:identity,storyId:'review',text:'Prova del raccordo tra le espressioni.',mood,intensity:.94,start:i*2,end:(i+1)*2,frameSeconds:.04,levels:Array(50).fill(.6),phones:[{start:0,end:2,viseme:'e'}]}));
    a.prepare({version:1,demo:true,product:{name:'Daily',edition:'it',language:'it',seconds:5,presenters:identity+1},date:'PROVA TRANSIZIONE',seconds:5,sources:[],stories:[{id:'review',headline:'Un’espressione accompagna la successiva.',whyItMatters:'Test locale del renderer del Daily.',sourceIds:[]}],cues},identity===1);
    const frames=[],times=[1.8,2,2.12,2.32,2.72,3.2],diagnostics=[];let maxJump=0,previous;
    for(let i=0;i<=125;i++){
     const time=i/25;a.frame(time,false);const sample=a.sample(),p=sample.actors[identity];
     if(previous)maxJump=Math.max(maxJump,Math.abs(p.acting.tilt-previous.acting.tilt),Math.abs(p.acting.pitch-previous.acting.pitch));previous=p;
     if(times.some(t=>Math.abs(t-time)<.001)){
      const canvas=document.querySelector('canvas'),at=sample.layout.actors[identity],r=canvas.width/sample.layout.width,crop=document.createElement('canvas');crop.width=132;crop.height=174;
      crop.getContext('2d').drawImage(canvas,(at.x-110*at.scale)*r,(at.y+20*at.scale)*r,220*at.scale*r,290*at.scale*r,0,0,132,174);
      frames.push(crop.toDataURL('image/png'));diagnostics.push({time,acting:p.acting,face:p.face,motion:p.motion});
     }
    }
    if(previous.mouthOpen)throw Error('Listening tail must be silent');
    return {frames,diagnostics,maxJump};
   },{identity,from,to});
   if(result.maxJump>.08)throw Error(`Abrupt head transition: ${identity} ${from}→${to}`);
   transitions.push({identity,from,to,...result});
  }
 }
 const contact=await browser.newPage({viewport:{width:1140,height:1500},deviceScaleFactor:1});
 await contact.setContent(`<style>*{box-sizing:border-box}body{margin:0;background:#e5ebe6;color:#203944;padding:12px;font:14px Arial}.grid{display:grid;grid-template-columns:repeat(4,264px);gap:12px}.card{background:white;border-radius:6px;overflow:hidden}p{padding:0 10px}img{display:block;width:100%}</style><div class="grid">${faces.map(f=>`<div class="card"><p>${f.identity?'Sofia':'Riccardo'} · ${f.mood}</p><img src="data:image/png;base64,${f.image}"></div>`).join('')}</div>`);
 await contact.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await contact.screenshot({path:`${dir}/all-faces.png`,fullPage:true});
 for(const identity of [0,1])for(const from of moods){
  await contact.setViewportSize({width:1030,height:1400});
  const rows=transitions.filter(t=>t.identity===identity&&t.from===from);
  await contact.setContent(`<style>*{box-sizing:border-box}body{margin:0;padding:12px;background:#e5ebe6;color:#203944;font:12px Arial}.row{display:grid;grid-template-columns:165px repeat(6,132px);gap:4px;margin-bottom:8px;align-items:center}img{width:132px}</style>${rows.map(t=>`<div class="row"><strong>${from} → ${t.to}</strong>${t.frames.map(f=>`<img src="${f}">`).join('')}</div>`).join('')}`);
  await contact.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await contact.screenshot({path:`${dir}/transitions-${identity}-${from}.png`,fullPage:true});
 }
 if(errors.length)throw Error(errors.join('\n'));
 await writeFile(`${dir}/report.json`,JSON.stringify({origin,errors,faces:faces.map(({identity,mood,sample})=>({identity,mood,sample})),transitions:transitions.map(({identity,from,to,maxJump,diagnostics})=>({identity,from,to,maxJump,diagnostics}))},null,2));
 console.log('Eight moods, two identities and all 112 directed mood transitions rendered and captured.');
}finally{await browser.close();}
