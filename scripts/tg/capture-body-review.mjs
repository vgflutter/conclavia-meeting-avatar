// Offline visual evidence from the actual GUI. Never calls a speech/AI API.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const origin=process.env.TG_RENDER_ORIGIN??'http://127.0.0.1:3105';
if(!/^http:\/\/127\.0\.0\.1:31\d\d$/u.test(origin))throw Error('Local review only');
const out='docs/images/daily-body-engine';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome'}),errors=[],blocked=[],samples=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{
  const request=r.request();
  if(request.method()!=='GET'||!request.url().startsWith(origin)){blocked.push(request.url());return r.abort();}
  return r.continue();
 });
 await page.goto(origin+'/podcast/tg/espressioni');
 const canvas=page.getByTestId('expression-face');
 await canvas.waitFor();await page.waitForFunction(()=>document.querySelector('[data-testid=expression-face]')?.dataset.ready==='true');
 await page.getByRole('button',{name:'Corpo e gesti',exact:true}).click();
 for(const identity of [0,1]){
  if(identity)await page.getByRole('button',{name:'Sofia · secondo volto'}).click();
  await page.waitForFunction(i=>document.querySelector('[data-testid=expression-face][data-ready=true]')?.dataset.identity===String(i),identity);
  const result=await page.evaluate(identity=>{
   const api=window.conclaviaExpressionReview,source=document.querySelector('[data-testid=expression-face]');
   const moods=[['attention','Attenzione'],['curiosity','Curiosità'],['doubt','Dubbio'],['agreement','Accordo'],['amusement','Divertito'],['empathy','Empatia'],['disagreement','Dissenso'],['surprise','Sorpresa']];
   const atlas=document.createElement('canvas');atlas.width=1200;atlas.height=888;
   const c=atlas.getContext('2d');c.fillStyle='#f5f7f3';c.fillRect(0,0,1200,888);
   c.fillStyle='#203944';c.font='600 26px Arial';c.fillText(`${identity?'Sofia':'Riccardo'} · mood del corpo`,20,38);
   c.font='15px Arial';c.fillText('Stesso motore · postura, spalle, braccia, polsi e dita · frame della GUI',20,65);
   const rows=[];
   moods.forEach(([mood,label],i)=>{
    api.selectPair('listening',mood);api.frame(2.35,false);const sample=api.sample();
    if(sample.framing!=='body'||sample.actor.mouthOpen)throw Error('Incorrect body review');
    const x=16+(i%4)*298,y=90+Math.floor(i/4)*394;
    c.drawImage(source,x,y,282,342);c.fillStyle='#203944';c.font='600 18px Arial';c.fillText(label,x+8,y+368);
    rows.push({identity,mood,actor:sample.actor});
   });
   return {image:atlas.toDataURL('image/png').split(',')[1],rows};
  },identity);
  await writeFile(`${out}/body-${identity}.png`,Buffer.from(result.image,'base64'));samples.push(...result.rows);
 }
 await page.getByRole('button',{name:'Riccardo · primo volto'}).click();
 await page.waitForFunction(()=>document.querySelector('[data-testid=expression-face][data-ready=true]')?.dataset.identity==='0');
 await page.evaluate(()=>{const a=window.conclaviaExpressionReview;a.selectPair('curiosity','empathy');a.frame(2.35,false);});
 await page.getByRole('region',{name:'Riproduzione della transizione'}).scrollIntoViewIfNeeded();
 await page.screenshot({path:`${out}/desktop.png`});
 await page.setViewportSize({width:390,height:1000});
 await page.getByRole('button',{name:'Viso',exact:true}).click();await page.getByRole('button',{name:'Corpo e gesti',exact:true}).click();
 await canvas.scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/mobile.png`});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=390));
 assert.equal(samples.length,16);assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
 await writeFile(`${out}/verification.json`,JSON.stringify({origin,moods:8,identities:2,errors,blocked,samples},null,2));
 console.log(JSON.stringify({moods:8,identities:2,errors,blocked,artifacts:out}));
}finally{await browser.close();}
