// Frame-by-frame anatomical evidence from the real renderer. Local GET only.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {adultPresenterArms,adultHandGeometry,adultHeadFrame} from '@conclavia/avatar-kit/characters/robot';
const origin=process.env.TG_RENDER_ORIGIN??'http://127.0.0.1:3106';
if(!/^http:\/\/127\.0\.0\.1:31\d\d$/u.test(origin))throw Error('Local renderer required');
const out='docs/images/daily-studio/body-coordination-review';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome'}),errors=[],blocked=[],rows=[],sheets=[];
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const maximum={tipStep:0,screenTipStep:0,wristTurn:0,headStep:0};
function inspect(poses,label){
 let prior;let count=0;
 for(const {time,pose} of poses){
  const arms=adultPresenterArms(pose),head=adultHeadFrame(pose);
  const hands=arms.map(a=>{
   assert.ok(Math.abs(distance(a.shoulder,a.elbow)-132)<1e-6);
   assert.ok(Math.abs(distance(a.elbow,a.wrist)-120)<1e-6);
   const h=adultHandGeometry(a,a.side,a.g);
   for(const d of h.digits)for(const p of d.joints)assert.ok(Number.isFinite(p.x+p.y+p.z));
   return h;
  });
  if(prior){
   maximum.headStep=Math.max(maximum.headStep,Math.hypot(head.x-prior.head.x,head.y-prior.head.y));
   hands.forEach((h,j)=>{
    maximum.wristTurn=Math.max(maximum.wristTurn,Math.abs(wrap(h.angle-prior.hands[j].angle)));
    h.digits.forEach((d,k)=>{
     const a=d.joints[3],b=prior.hands[j].digits[k].joints[3];
     maximum.tipStep=Math.max(maximum.tipStep,distance(a,b));
     const step=Math.hypot(a.x-b.x,a.y-b.y);
     if(step>maximum.screenTipStep){maximum.screenTipStep=step;maximum.tipCase={label,time,side:arms[j].side,digit:d.name};}
    });
   });
  }
  rows.push({label,time,torso:pose.motion.torso,shoulders:[pose.motion.shoulderLeft,pose.motion.shoulderRight],head:{x:head.x,y:head.y,angle:head.angle},hands:hands.map((h,j)=>({side:arms[j].side,wrist:arms[j].wrist,angle:h.angle,bodyContact:h.bodyContact,palmFacing:h.palmFacing,flexions:h.digits.map(d=>d.flexion)}))});
  prior={head,hands};count++;
 }
 return count;
}
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{if(r.request().method()!=='GET'||!r.request().url().startsWith(origin)){blocked.push(r.request().url());return r.abort();}return r.continue();});
 await page.goto(origin+'/podcast/tg/render');await page.waitForFunction(()=>window.conclaviaTgRender);
 for(const portrait of [false,true])for(const mood of ['attention','curiosity','doubt','agreement','amusement','empathy','disagreement','surprise']){
  const poses=await page.evaluate(({portrait,mood})=>{
   const api=window.conclaviaTgRender;
   api.prepare({version:1,demo:true,product:{name:'Daily',edition:'it',language:'it',seconds:6,presenters:1},date:'PROVA GRAFICA',seconds:6,sources:[],stories:[{id:'review',headline:'Un gesto accompagna il racconto.',whyItMatters:'Prova grafica locale. Nessuna notizia reale.',sourceIds:[]}],cues:[{speaker:0,storyId:'review',text:'Una prova della coordinazione fra mani, collo e busto.',mood,intensity:1,start:0,end:5,frameSeconds:.04,levels:Array(125).fill(.6),phones:[{start:0,end:5,viseme:'e'}]}]},portrait);
   const samples=[];
   for(let frame=0;frame<=150;frame++){api.frame(frame/25,false);const s=api.sample();samples.push({time:frame/25,pose:s.actors[0]});}
   return samples;
  },{portrait,mood});
  inspect(poses,`${portrait?'portrait':'landscape'}:${mood}`);
  // Review EVERY consecutive frame around body approach and release.
  if(!process.argv.includes('--measure-only')&&!portrait&&['empathy','attention','curiosity'].includes(mood))for(let frame=30;frame<=80;frame++){
   // Capture from a freshly replayed path, never seek into an uninitialised pose.
   const crops=await page.evaluate(({time})=>{
    const api=window.conclaviaTgRender;api.frame(0,false);for(let i=1;i<=Math.round(time*25);i++)api.frame(i/25,false);
    const sample=api.sample(),source=document.querySelector('canvas');return {pose:sample.actors[0],at:sample.layout.actors[0],ratio:source.width/1280};
   },{time:frame/25});
   const p=crops.pose,ca=Math.cos(p.motion.torso*.78),sa=Math.sin(p.motion.torso*.78);
   const centres=adultPresenterArms(p).map(a=>{const h=adultHandGeometry(a,a.side,a.g).project(0,20);return {x:crops.at.x+(p.acting.lean*42+p.motion.shift*.75+ca*h.x-sa*(h.y-330))*crops.at.scale,y:crops.at.y+(330+p.breath*.55+sa*h.x+ca*(h.y-330))*crops.at.scale};});
   const images=await page.evaluate(centres=>{const source=document.querySelector('canvas'),r=source.width/1280;return centres.map(p=>{const c=document.createElement('canvas');c.width=c.height=148;c.getContext('2d').drawImage(source,(p.x-45)*r,(p.y-45)*r,90*r,90*r,0,0,148,148);return c.toDataURL('image/png');});},centres);
   sheets.push({mood,time:frame/25,images});
  }
 }
 const manifest=JSON.parse(await readFile('public/daily-launch/manifest.json','utf8'));
 await page.goto(origin+'/podcast/tg/presentazione/render');await page.waitForFunction(()=>window.conclaviaLaunchRender);
 for(const portrait of [false,true]){
  const samples=await page.evaluate(({manifest,portrait})=>{const api=window.conclaviaLaunchRender;api.prepare(manifest,portrait);const samples=[];for(let frame=0;frame<Math.round(manifest.duration*25);frame++){api.frame(frame/25,false);const s=api.sample();samples.push({time:frame/25,pose:s.actor});}return samples;},{manifest,portrait});
  inspect(samples,`promo:${portrait?'portrait':'landscape'}`);
 }
 const sheet=await browser.newPage({viewport:{width:1260,height:1400}});
 for(const mood of process.argv.includes('--measure-only')?[]:['empathy','attention','curiosity'])for(const side of [0,1]){
  await sheet.setContent(`<style>body{margin:0;padding:10px;background:#e6e9e4;color:#203944;font:13px Arial}h1{font-size:21px}.frames{display:grid;grid-template-columns:repeat(8,148px);gap:6px}img{width:148px;display:block}p{margin:4px 0}</style><h1>${mood} · mano ${side+1} · 25 fotogrammi/s · avvicinamento e rilascio</h1><div class="frames">${sheets.filter(s=>s.mood===mood).map(s=>`<div><p>${s.time.toFixed(2)} s</p><img src="${s.images[side]}"></div>`).join('')}</div>`);
  await sheet.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await sheet.screenshot({path:`${out}/${mood}-hand-${side}-all-frames.png`,fullPage:true});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
 await writeFile(out+'/frame-review.json',JSON.stringify({frames:rows.length,maximum,errors,blocked,rows},null,2));
 console.log(JSON.stringify({frames:rows.length,maximum,errors,blocked}));
}finally{await browser.close();}
