// Read-only acceptance on the official local GUI, never approval/publication.
import {chromium,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const origin='http://127.0.0.1:3105',dir='docs/images/daily-studio/acting';
const dashboard=await(await fetch(origin+'/api/tg/newsroom')).json();
if(!dashboard.control.paused||dashboard.control.enabled)throw Error('Publication must remain paused and disabled');
const jobs=dashboard.jobs.filter(j=>['it','world'].includes(j.edition));
if(jobs.length!==2||jobs.some(j=>j.state!=='needs_review'||j.deliveries.length))throw Error('Expected two unapproved local pilots');
const browser=await chromium.launch({channel:'chrome'}),errors=[],mutations=[],videos=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}});
 await page.context().addCookies([{name:'conclavia_locale',value:'it',url:origin}]);
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{if(r.request().method()!=='GET'){mutations.push(r.request().url());return r.abort();}return r.continue();});
 await page.goto(origin+'/podcast/tg');const canvas=page.getByTestId('tg-canvas');await expect(canvas).toHaveAttribute('data-ready','true');
 const select=page.getByTestId('tg-preview-mood');await expect(select.locator('option')).toHaveCount(9);
 for(const mood of ['attention','curiosity','doubt','agreement','amusement','empathy','disagreement','surprise']){await select.selectOption(mood);await expect(select).toHaveValue(mood);await page.waitForTimeout(320);}
 await select.selectOption('curiosity');await page.waitForTimeout(500);await canvas.screenshot({path:`${dir}/official-studio-landscape.png`});
 await page.getByRole('button',{name:'9:16 · social'}).click();await expect(canvas).toHaveAttribute('data-tg-format','portrait');await page.waitForTimeout(500);await canvas.screenshot({path:`${dir}/official-studio-portrait.png`});
 for(const job of jobs){
  await page.goto(`${origin}/podcast/tg/redazione?job=${job.id}`);
  for(const portrait of [false,true]){
   await page.getByRole('button',{name:portrait?'Social · 9:16':'Episodio · 16:9',exact:true}).click();
   const video=page.locator('video');await expect(video).toBeVisible();
   await expect.poll(()=>video.evaluate(v=>v.readyState)).toBeGreaterThanOrEqual(2);
   await video.evaluate(v=>{v.muted=true;return v.play();});await expect.poll(()=>video.evaluate(v=>v.currentTime)).toBeGreaterThan(.2);
   await video.evaluate(v=>{v.pause();v.currentTime=8;});await expect.poll(()=>video.evaluate(v=>v.seeking)).toBe(false);
   const info=await video.evaluate(v=>({seconds:v.duration,width:v.videoWidth,height:v.videoHeight,time:v.currentTime}));
   expect(info.seconds).toBeCloseTo(90,1);expect(info.width).toBe(portrait?1080:1920);expect(info.height).toBe(portrait?1920:1080);
   videos.push({edition:job.edition,portrait,...info});await video.screenshot({path:`${dir}/official-player-${job.edition}-${portrait?'portrait':'landscape'}.png`});
  }
 }
 const overflow=[];
 for(const path of ['/podcast/tg','/podcast/tg/redazione']){
  await page.setViewportSize({width:390,height:1000});await page.goto(origin+path);await page.waitForTimeout(700);
  const width=await page.evaluate(()=>document.documentElement.scrollWidth);overflow.push({path,width});expect(width).toBeLessThanOrEqual(390);
 }
 expect(errors).toEqual([]);expect(mutations).toEqual([]);
 await writeFile(`${dir}/official-gui-report.json`,JSON.stringify({errors,mutations,videos,overflow,control:dashboard.control,jobs:jobs.map(j=>({edition:j.edition,state:j.state,revision:j.revision}))},null,2));
 console.log('Official GUI: eight moods, four videos with playback/seek, mobile layout and no mutations verified.');
}finally{await browser.close();}
