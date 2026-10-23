// GET-only acceptance of independent digits on the real audition/audio clock.
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const origin=process.env.TG_RENDER_ORIGIN??'http://127.0.0.1:3105';
if(!/^http:\/\/127\.0\.0\.1:31\d\d$/u.test(origin))throw Error('Local GUI only');
const dir=process.env.TG_REVIEW_DIR??'docs/images/daily-studio/gesture-review';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome'}),errors=[],mutations=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{if(r.request().method()!=='GET'){mutations.push(r.request().url());return r.abort();}return r.request().url().startsWith(origin)?r.continue():r.abort();});
 await page.goto(origin+'/podcast/tg/performance');await page.waitForFunction(()=>window.conclaviaActorReview?.duration>0&&document.querySelector('[data-ready=true]'));
 await page.getByRole('button',{name:'Test completo · 8 mood',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[data-mode=complete][data-ready=true]'));
 const complete=await page.evaluate(()=>{
  const api=window.conclaviaActorReview,moods=new Set(),samples=[],started=performance.now();
  for(let i=0;i<900;i++){api.frame(i/25,false);if(i%100===50){if(i<800)moods.add(document.querySelector('[data-mode=complete]').dataset.mood);samples.push(api.sample());}}
  const renderMilliseconds=performance.now()-started,tail=api.sample();api.frame(0,false);return {moods:[...moods],samples,tail,renderMilliseconds,renderedFrames:900};
 });
 assert.deepEqual(complete.moods,['attention','curiosity','doubt','agreement','amusement','empathy','disagreement','surprise']);
 assert.equal(complete.tail.mouthOpen,false);assert.ok(Math.abs(complete.tail.motion.left.indexCurl-.08)<1e-8,'the final deployed build has relaxed resting digits');
 await page.locator('audio').evaluate(a=>{a.muted=true;});await page.getByRole('button',{name:'Avvia prova',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('audio').currentTime>.25);
 const playing=[];
 for(let i=0;i<44;i++){playing.push(await page.evaluate(()=>({audio:document.querySelector('audio').currentTime,pose:window.conclaviaActorReview.sample()})));await page.waitForTimeout(60);}
 await page.getByRole('button',{name:'Pausa',exact:true}).click();
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const held=await page.evaluate(()=>window.conclaviaActorReview.sample());await page.waitForTimeout(180);
 assert.deepEqual(await page.evaluate(()=>window.conclaviaActorReview.sample()),held,'paused audio freezes every new finger channel');
 assert.ok(playing.at(-1).audio>playing[0].audio+2);
 for(const key of ['middleCurl','ringCurl','littleCurl','opposition']){
  const values=playing.map(s=>s.pose.motion.right[key]);assert.ok(Math.max(...values)-Math.min(...values)>.08,`${key} actually articulates during audio playback`);
 }
 await page.getByRole('button',{name:'Formato 9:16'}).click();await page.setViewportSize({width:390,height:1000});
 await page.waitForFunction(()=>{const c=document.querySelector('canvas');return c.height>c.width&&window.conclaviaActorReview.sample().layout.width===720;});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=390));
 await page.evaluate(()=>{const a=window.conclaviaActorReview;for(let i=0;i<=48;i++)a.frame(i/25,false);});
 await page.locator('canvas').screenshot({path:`${dir}/official-mobile-gesture.png`});
 const header=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=960;c.height=48;const x=c.getContext('2d');x.fillStyle='#f2f3ef';x.fillRect(0,0,960,48);x.fillStyle='#203944';x.font='600 22px Arial';x.fillText('PRIMA',20,31);x.fillText('ORA',500,31);return c.toDataURL('image/png').split(',')[1];});
 await writeFile(`${dir}/comparison-header.png`,Buffer.from(header,'base64'));
 assert.deepEqual(errors,[]);assert.deepEqual(mutations,[]);
 await writeFile(`${dir}/official-gui.json`,JSON.stringify({origin,complete,playing,held,phoneWidth:390,errors,mutations},null,2));
 console.log('Official GUI: eight moods, independent finger movement during real audio, frozen pause, relaxed rest and mobile layout verified.');
}finally{await browser.close();}
