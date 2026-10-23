/** GET-only review player checks; no AI, persistence, publishing or fixtures. */
import {chromium} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const id=process.argv.find(v=>v.startsWith('--id='))?.slice(5),origin=process.env.TG_RENDER_ORIGIN??'http://127.0.0.1:3105';
if(!id||!/^\d{4}-\d{2}-\d{2}-it-pilot(?:-r[1-9]\d*)?$/u.test(id)||!/^http:\/\/127\.0\.0\.1:31\d\d$/u.test(origin))throw Error('Explicit local Daily pilot required');
const out=`docs/images/daily-launch/editions/${id}`,m=JSON.parse(await readFile(`public/daily-launch/editions/${id}/manifest.json`,'utf8'));
const browser=await chromium.launch({channel:'chrome'}),results=[],errors=[],blocked=[];
try{
 await mkdir(out,{recursive:true});
 for(const width of [360,390,1440]){
  const page=await browser.newPage({viewport:{width,height:width<800?844:1100}}),mediaRequests=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>{const req=r.request();if(req.method()!=='GET'||!req.url().startsWith(origin+'/')){blocked.push(req.url());return r.abort();}if(/\.mp4(?:\?|$)/u.test(req.url()))mediaRequests.push(req.url());return r.continue();});
  await page.goto(`${origin}/daily-launch/editions/${id}/index.html`);await page.evaluate(()=>document.fonts.ready);
  if(mediaRequests.length)throw Error('Videos fetched before the user presses play');
  const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,sources:document.querySelectorAll('.sources a').length,players:[...document.querySelectorAll('video')].map(v=>({id:v.id,preload:v.preload,controls:v.controls,muted:v.muted,defaultCaptions:v.querySelector('track')?.default}))}));
  if(layout.overflow||layout.sources!==m.sources.length||layout.players.length!==1||layout.players.some(p=>p.preload!=='none'||!p.controls||p.muted||p.defaultCaptions))throw Error('Review page layout, sources or player settings failed: '+JSON.stringify({width,layout}));
  await page.screenshot({path:`${out}/review-${width}.jpg`});
  const playback=[];
  const format=width<800?'portrait':'landscape',video=page.locator('#daily-video');
  await video.evaluate(async v=>{v.volume=.12;await v.play()});
  await page.waitForFunction(()=>{const v=document.getElementById('daily-video');return v.currentTime>.12&&v.readyState>=2});
  const state=await video.evaluate(v=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight,paused:v.paused,error:v.error?.message,source:v.currentSrc}));
  if(state.error||state.paused||Math.abs(state.duration-m.duration)>.1||state.width!==(format==='portrait'?1080:1920)||state.height!==(format==='portrait'?1920:1080)||!state.source.includes(m.mediaVersion))throw Error('Actual encoded video failed playback');
  playback.push({format,...state});
  const news=m.scenes.filter(s=>!['apertura','chiusura','firma-finale'].includes(s.id));
  for(const chapter of news){
   await page.locator(`.chapter[href="#${chapter.id}"]`).click();
   await page.waitForFunction(start=>[...document.querySelectorAll('video')].some(v=>!v.paused&&Math.abs(v.currentTime-start)<1),chapter.start);
  }
  let closingChapterPassed=false,closingCaptionsPassed=false;
  const closing=m.approvedClosingGesture?{start:m.scenes.find(s=>s.id==='chiusura').start,commentsAt:m.approvedClosingGesture.apexSeconds}:m.closingIntegration;
  if(closing){
   await page.getByRole('link',{name:/Commenti e approfondimenti/}).click();
   await page.waitForFunction(start=>{const v=document.querySelector('video');return !v.paused&&Math.abs(v.currentTime-start)<1;},closing.start);
   closingChapterPassed=true;
   await video.evaluate(v=>{v.pause();v.textTracks[0].mode='hidden';});
   await page.waitForFunction(()=>document.querySelector('video').textTracks[0]?.cues?.length>0);
   const captions=await video.evaluate(v=>[...v.textTracks[0].cues].slice(-3).map(c=>({text:c.text,start:c.startTime,end:c.endTime})));
   if(captions.some((c,i)=>c.text!==m.cues.at(-3+i).text||Math.abs(c.start-m.cues.at(-3+i).start)>.002||Math.abs(c.end-m.cues.at(-3+i).end)>.002))throw Error('Closing captions do not match measured final speech');
   closingCaptionsPassed=true;
   await video.evaluate((v,t)=>new Promise(resolve=>{v.addEventListener('seeked',resolve,{once:true});v.currentTime=t;}),closing.commentsAt+.2);
   await video.screenshot({path:`${out}/closing-player-${width}.jpg`});
  }
  await page.evaluate(()=>document.querySelectorAll('video').forEach(v=>v.pause()));
  results.push({width,...layout,playback,chapterPassed:true,newsChaptersChecked:news.length,...(closing?{closingChapterPassed,closingCaptionsPassed}:{})});await page.close();
 }
 const report={id,mediaVersion:m.mediaVersion,errors,blocked,providerCalls:0,results};
 await writeFile(`${out}/player-proof.json`,JSON.stringify(report,null,2)+'\n');
 if(errors.length||blocked.length)throw Error('Unexpected browser errors or external requests');
 console.log(JSON.stringify({id,widths:results.map(r=>r.width),formats:2,sources:m.sources.length,playback:'passed',chapters:'passed',oneResponsivePlayer:true,providerCalls:0}));
}finally{await browser.close()}
