// Local visual review of actual hand articulation, using the canonical rig.
// Run with node --import tsx. No provider calls or database writes.
import {chromium} from '@playwright/test';
import {adultPresenterArms,adultHandGeometry} from '@conclavia/avatar-kit/characters/robot';
import {mkdir,writeFile} from 'node:fs/promises';
const origin=process.env.TG_RENDER_ORIGIN??'http://127.0.0.1:3106';
if(!/^http:\/\/127\.0\.0\.1:31\d\d$/u.test(origin))throw Error('Local renderer only');
const dir=process.env.TG_REVIEW_DIR??'docs/images/daily-studio/gesture-review';await mkdir(dir,{recursive:true});
const moods=['attention','curiosity','doubt','agreement','amusement','empathy','disagreement','surprise'];
const browser=await chromium.launch({channel:'chrome'}),errors=[],rows=[],diagnostics=[];
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.request().method()!=='GET'||!r.request().url().startsWith(origin)?r.abort():r.continue());
 await page.goto(origin+'/podcast/tg/render');await page.waitForFunction(()=>window.conclaviaTgRender,{},{timeout:90000});
 for(const mood of moods){
  await page.evaluate(mood=>window.conclaviaTgRender.prepare({version:1,demo:true,product:{name:'Daily',edition:'it',language:'it',seconds:6,presenters:1},date:'PROVA GESTI',seconds:6,sources:[],stories:[{id:'review',headline:'Le mani accompagnano le parole.',whyItMatters:'Prova grafica locale della gestualità. Nessuna notizia reale.',sourceIds:[]}],cues:[{speaker:0,storyId:'review',text:'Una prova di movimento delle mani e delle dita.',mood,intensity:1,start:0,end:5,frameSeconds:.04,levels:Array(125).fill(.6),phones:[{start:0,end:5,viseme:'e'}]}]},false),mood);
  const frames=[];
  for(let i=0;i<=150;i++){
   await page.evaluate(t=>window.conclaviaTgRender.frame(t,false),i/25);
   if(![25,33,41,49,57,65,83,133].includes(i))continue;
   const sample=await page.evaluate(()=>window.conclaviaTgRender.sample()),pose=sample.actors[0],at=sample.layout.actors[0];
   const angle=pose.motion.torso*.78,co=Math.cos(angle),si=Math.sin(angle),tx=pose.acting.lean*42+pose.motion.shift*.75,ty=330+pose.breath*.55;
   const crops=adultPresenterArms(pose).map(arm=>{
    const h=adultHandGeometry(arm,arm.side,arm.g),j=h.project(0,20,8);
    const x=at.x+(tx+co*j.x-si*(j.y-330))*at.scale,y=at.y+(ty+si*j.x+co*(j.y-330))*at.scale;
    return {x,y,channels:arm.g,flexions:h.digits.map(d=>d.flexion),elbow:arm.elbow};
   });
   const images=await page.evaluate(crops=>{
    const source=document.querySelector('canvas'),ratio=source.width/1280;
    const crop=(x,y,w,h,ow,oh)=>{const c=document.createElement('canvas');c.width=ow;c.height=oh;c.getContext('2d').drawImage(source,x*ratio,y*ratio,w*ratio,h*ratio,0,0,ow,oh);return c.toDataURL('image/png');};
    return {hands:crops.map(c=>crop(c.x-56,c.y-56,112,112,224,224)),body:crop(65,270,480,350,480,350)};
   },crops);
   frames.push({time:i/25,...images});diagnostics.push({mood,time:i/25,crops});
  }
  rows.push({mood,frames});
  await writeFile(`${dir}/${mood}-body.png`,Buffer.from(frames[3].body.split(',')[1],'base64'));
 }
 const sheet=await browser.newPage({viewport:{width:1510,height:2000},deviceScaleFactor:1});
 for(const side of [0,1]){
  await sheet.setContent(`<style>*{box-sizing:border-box}body{margin:0;padding:10px;background:#dce3df;color:#203944;font:13px Arial}.row{display:grid;grid-template-columns:100px repeat(8,170px);gap:4px;margin-bottom:10px;align-items:center}img{width:170px;display:block}p{margin:4px}</style>${rows.map(r=>`<div class="row"><strong>${r.mood}</strong>${r.frames.map(f=>`<div><p>${f.time.toFixed(2)} s</p><img src="${f.hands[side]}"></div>`).join('')}</div>`).join('')}`);
  await sheet.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await sheet.screenshot({path:`${dir}/hand-${side}-sequence.png`,fullPage:true});
 }
 await writeFile(`${dir}/report.json`,JSON.stringify({origin,errors,diagnostics},null,2));if(errors.length)throw Error(errors.join('\n'));
 console.log('Eight moods: independent finger performance, thumb opposition, preparation and recovery captured.');
}finally{await browser.close();}
