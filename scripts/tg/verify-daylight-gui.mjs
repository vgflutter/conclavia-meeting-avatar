// GET-only acceptance of the actual local audition, without AI/TTS or saves.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const origin=process.env.TG_RENDER_ORIGIN??'http://127.0.0.1:3105';
if(!/^http:\/\/127\.0\.0\.1:31\d\d$/u.test(origin))throw Error('Local GUI required');
const dir='docs/images/daily-studio/acting';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome'}),errors=[],mutations=[],voices=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1200},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const request=r.request();if(request.method()!=='GET'){mutations.push(request.url());return r.abort();}return request.url().startsWith(origin)?r.continue():r.abort();});
 await page.goto(origin+'/podcast/tg/performance');
 await page.waitForFunction(()=>window.conclaviaActorReview?.duration>0&&document.querySelector('[data-stage="daily-studio"][data-ready="true"]'));
 for(const [label,id] of [['Gianni','gianni'],['Orietta','orietta'],['Ingegnere','ingegnere']]){
  await page.getByRole('button',{name:new RegExp(label+' Inworld')}).click();
  await page.waitForFunction(name=>{const a=document.querySelector('audio');return a?.getAttribute('src')===`/daily-performance/voices/${name}/audio.wav`&&a.readyState>=1&&a.duration>0;},id);
  await page.locator('audio').evaluate(a=>{a.muted=true;});
  await page.getByRole('button',{name:'Avvia prova',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('audio').currentTime>.3);
  await page.getByRole('button',{name:'Pausa',exact:true}).click();
  const before=await page.locator('audio').evaluate(a=>a.currentTime);await page.waitForTimeout(160);
  assert.equal(await page.locator('audio').evaluate(a=>a.currentTime),before);
  const sample=await page.evaluate(()=>{const api=window.conclaviaActorReview;api.frame(2,false);return {duration:api.duration,pose:api.sample()};});
  assert.ok(sample.duration>=35&&sample.duration<38);assert.ok(sample.pose.face.innerBrow>=0);
  voices.push({label,duration:sample.duration,paused:true});
 }
 // Retain the default sample after the comparison.
 await page.getByRole('button',{name:/Gianni Inworld/}).click();
 await page.waitForFunction(()=>document.querySelector('audio')?.getAttribute('src')==='/daily-performance/voices/gianni/audio.wav'&&document.querySelector('audio').readyState>=1);
 await page.waitForFunction(()=>document.querySelector('[data-ready="true"]')&&window.conclaviaActorReview?.sample());
 const formats=[];
 for(const portrait of [false,true]){
  if(portrait)await page.getByRole('button',{name:'Formato 9:16'}).click();
  await page.waitForFunction(vertical=>{const c=document.querySelector('canvas');return c&&((c.width/c.height<1)===vertical);},portrait);
  const captured=await page.evaluate(()=>{const api=window.conclaviaActorReview;const pixels=api.frame(12,false),sample=api.sample(),a=sample.layout.actors[0],canvas=document.querySelector('canvas'),r=canvas.width/sample.layout.width;
   const color=Array.from(canvas.getContext('2d').getImageData(a.x*r,(a.y+82*a.scale)*r,1,1).data);
   return {pixels,image:canvas.toDataURL('image/png'),color,layout:sample.layout,face:sample.face};});
  const luminance=captured.color[0]*.2126+captured.color[1]*.7152+captured.color[2]*.0722;assert.ok(luminance>190,'face must actually be light');
  assert.equal(captured.layout.width,portrait?720:1280,'the capture must use the requested composition');
  await writeFile(`${dir}/daylight-gui-${portrait?'portrait':'landscape'}.png`,Buffer.from(captured.image.split(',')[1],'base64'));
  formats.push({portrait,luminance,layout:captured.layout});
 }
 await page.setViewportSize({width:390,height:1000});
 await page.waitForTimeout(200);await page.evaluate(()=>window.conclaviaActorReview.frame(19,false));
 const phone=await page.evaluate(()=>{const c=document.querySelector('canvas'),sample=window.conclaviaActorReview.sample(),a=sample.layout.actors[0],width=c.getBoundingClientRect().width;return {window:innerWidth,overflow:document.documentElement.scrollWidth,width,faceWidth:sample.headWidth*a.scale*width/720};});
 assert.ok(phone.overflow<=390);assert.ok(phone.faceWidth>=100,'adult head remains readable at the actual padded phone viewport');
 await page.screenshot({path:`${dir}/daylight-gui-mobile.png`,fullPage:true,animations:'disabled'});
 await writeFile(`${dir}/daylight-gui-mobile-canvas.png`,await page.evaluate(()=>window.conclaviaActorReview.frame(19,true)).then(p=>Buffer.from(p,'base64')));
 assert.deepEqual(errors,[]);assert.deepEqual(mutations,[]);
 await writeFile(`${dir}/daylight-gui-report.json`,JSON.stringify({origin,voices,formats,phone,errors,mutations},null,2));
 console.log('Daylight GUI: three voices play/pause; two formats have light faces; mobile fits; no browser errors or mutations.');
}finally{await browser.close();}
