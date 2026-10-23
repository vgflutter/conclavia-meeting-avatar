import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const origin='http://127.0.0.1:3107',path='/daily-launch/editions/2026-10-23-it-pilot-r4/review.html';
const out='docs/images/daily-launch/semantic-20261023';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome'}),errors=[],blocked=[],states=[];
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const r=route.request();if(r.method()!=='GET'||new URL(r.url()).origin!==origin){blocked.push(r.url());return route.abort();}return route.continue();});
 for(const width of [360,390,1440]){
  await page.setViewportSize({width,height:1050});await page.goto(origin+path);
  for(const format of ['portrait','landscape'])for(const version of ['after','before']){
   await page.getByRole('button',{name:format==='portrait'?'Verticale':'Orizzontale',exact:true}).click();
   await page.getByRole('button',{name:version==='after'?'Revisione':'Prima',exact:true}).click();
   await page.waitForFunction(({format,version})=>{const v=document.querySelector('video');return v.readyState>=1&&v.videoWidth===(format==='portrait'?1080:1920)&&v.currentSrc.includes(version==='after'?'motion-proof-':'before-');},{format,version});
   const state=await page.evaluate(()=>{const v=document.querySelector('video');return {duration:v.duration,muted:v.muted,volume:v.volume,videos:document.querySelectorAll('video').length,overflow:document.documentElement.scrollWidth>innerWidth};});
   assert.equal(state.videos,1);assert.equal(state.overflow,false);assert.equal(state.muted,false);assert.ok(state.volume>0);assert.ok(Math.abs(state.duration-10)<.05);
   states.push({width,format,version,...state});
  }
  await page.getByRole('button',{name:width<600?'Verticale':'Orizzontale',exact:true}).click();
  await page.getByRole('button',{name:'Revisione',exact:true}).click();
  await page.locator('video').evaluate(async v=>{await v.play();});
  await page.waitForFunction(()=>document.querySelector('video').currentTime>.35);
  await page.locator('video').evaluate(v=>v.pause());
  const held=await page.locator('video').evaluate(v=>v.currentTime);await page.waitForTimeout(140);
  assert.equal(await page.locator('video').evaluate(v=>v.currentTime),held);
  if(width===390||width===1440)await page.screenshot({path:out+'/comparison-'+width+'.png',fullPage:true});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
 await writeFile(out+'/comparison-player.json',JSON.stringify({origin,states,errors,blocked,realMediaClock:true,providerCalls:0},null,2)+'\n');
 console.log(JSON.stringify({layouts:states.length,playAndPauseWidths:3,errors,blocked}));
}finally{await browser.close();}
