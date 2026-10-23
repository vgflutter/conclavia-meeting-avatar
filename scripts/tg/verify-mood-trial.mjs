// Acceptance of the explicitly commissioned local four-news trial. GET-only.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {chromium,expect} from '@playwright/test';
const origin=process.env.TG_RENDER_ORIGIN??'http://127.0.0.1:3105';
const id=process.argv.find(a=>a.startsWith('--id='))?.slice(5);
if(!/^http:\/\/127\.0\.0\.1:31\d\d$/u.test(origin)||!id||!/^[a-f0-9]{24}$/u.test(id))throw Error('Explicit local trial required');
const root=path.resolve(process.env.TG_ARTIFACT_DIR??'.tg-artifacts',id),dir='docs/images/daily-four-news';await mkdir(dir,{recursive:true});
const m=JSON.parse(await readFile(path.join(root,'manifest.json'),'utf8'));
assert.equal(m.stories.length,4);assert.equal(m.cues.length,17);assert.equal(m.seconds,96);
assert.equal(m.speech.model,'inworld-tts-2');assert.deepEqual(m.speech.voices,['Gianni']);
for(let i=0;i<m.cues.length;i++){
 const c=m.cues[i];assert.ok(c.end>c.start);
 if(!['intro','outro'].includes(c.storyId))assert.equal(c.alignment,'word');
 if(i&&m.cues[i-1].storyId===c.storyId)assert.ok(Math.abs(m.cues[i-1].end-c.start)<1e-8);
}
const movies=[];
for(const format of ['landscape','portrait']){
 const p=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_type,codec_name,width,height,r_frame_rate,sample_aspect_ratio:format=duration','-of','json',path.join(root,format+'.mp4')],{encoding:'utf8'}));
 const v=p.streams.find(s=>s.codec_type==='video'),a=p.streams.find(s=>s.codec_type==='audio');
 assert.equal(v.codec_name,'h264');assert.equal(a.codec_name,'aac');assert.equal(v.r_frame_rate,'25/1');assert.equal(v.sample_aspect_ratio,'1:1');
 assert.deepEqual([v.width,v.height],format==='landscape'?[1920,1080]:[1080,1920]);assert.ok(Math.abs(Number(p.format.duration)-96)<.05);movies.push({format,...p});
}
const pcm=file=>execFileSync('ffmpeg',['-v','error','-i',path.join(root,file),'-map','0:a:0','-f','s16le','-ac','1','-ar','24000','pipe:1'],{maxBuffer:8_000_000});
const raw=pcm('raw.wav'),master=pcm('track.wav'),movie=pcm('landscape.mp4');
function correlation(a,b){let xy=0,xx=0,yy=0;for(let i=0;i+2<=Math.min(a.length,b.length);i+=16){const x=a.readInt16LE(i),y=b.readInt16LE(i);xy+=x*y;xx+=x*x;yy+=y*y;}return xy/Math.sqrt(xx*yy);}
const rawToMaster=correlation(raw,master),masterToMovie=correlation(master,movie);
assert.ok(rawToMaster>.98,'the natural take must remain time-aligned and unwarped');assert.ok(masterToMovie>.98,'the video must use this exact master');
let peak=0,clipped=0;for(let i=0;i<master.length;i+=2){const x=Math.abs(master.readInt16LE(i));peak=Math.max(peak,x);if(x>=32767)clipped++;}assert.equal(clipped,0);
const dashboard=await(await fetch(origin+'/api/tg/newsroom')).json();assert.equal(dashboard.control.paused,true);assert.equal(dashboard.control.enabled,false);
const job=dashboard.jobs.find(j=>j.id===id);assert.equal(job.state,'needs_review');assert.equal(job.deliveries.length,0);assert.ok(!job.approvedAt);
for(const [edition,revision] of [['world',28],['it',51]]){const previous=dashboard.jobs.find(j=>j.edition===edition&&j.id!==id);assert.equal(previous.revision,revision);}
const browser=await chromium.launch({channel:'chrome'}),errors=[],mutations=[],samples=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{if(r.request().method()!=='GET'){mutations.push(r.request().url());return r.abort();}return r.request().url().startsWith(origin)?r.continue():r.abort();});
 await page.goto(`${origin}/podcast/tg/redazione?job=${id}`);const video=page.locator('video');await expect(video).toBeVisible();
 await expect(page.locator('[data-cue-index]')).toHaveCount(17);
 const moods=[...new Set(m.cues.map(c=>c.mood))];assert.equal(moods.length,7);
 for(const format of ['landscape','portrait']){
  await page.getByRole('button',{name:format==='portrait'?'Social · 9:16':'Episodio · 16:9',exact:true}).click();
  await expect.poll(()=>video.evaluate(v=>v.readyState)).toBeGreaterThanOrEqual(2);
  await video.evaluate(v=>{v.muted=true;return v.play();});await expect.poll(()=>video.evaluate(v=>v.currentTime)).toBeGreaterThan(.2);await video.evaluate(v=>v.pause());
  for(const mood of moods){
   const cue=m.cues.find(c=>c.mood===mood),t=cue.start+Math.min(.85,(cue.end-cue.start)*.4);
   await video.evaluate((v,t)=>{v.currentTime=t;},t);await expect.poll(()=>video.evaluate(v=>v.seeking)).toBe(false);
   await expect(page.getByTestId('tg-current-mood')).toHaveAttribute('data-mood',mood);
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const pixels=await video.evaluate((v,format)=>{const c=document.createElement('canvas');c.width=264;c.height=348;const x=c.getContext('2d');if(format==='landscape')x.drawImage(v,(302-110*1.02)*1.5,(85+20*1.02)*1.5,220*1.02*1.5,290*1.02*1.5,0,0,264,348);else x.drawImage(v,(360-110*1.4)*1.5,(336+20*1.4)*1.5,220*1.4*1.5,290*1.4*1.5,0,0,264,348);return c.toDataURL('image/png').split(',')[1];},format);
   await writeFile(`${dir}/${format}-${mood}.png`,Buffer.from(pixels,'base64'));samples.push({format,mood,time:t});
  }
 }
 await page.locator('[data-cue-index="6"] button').click();await expect.poll(()=>video.evaluate(v=>v.currentTime)).toBeCloseTo(m.cues[6].start,2);
 await expect(page.getByTestId('tg-current-mood')).toHaveAttribute('data-mood','surprise');
 await page.screenshot({path:`${dir}/official-desktop.png`});
 await page.setViewportSize({width:390,height:1000});await page.locator('[data-cue-index="2"] button').click();await expect(page.getByTestId('tg-current-mood')).toHaveAttribute('data-mood','empathy');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=390));await page.screenshot({path:`${dir}/official-mobile.png`});
 await expect(page.getByRole('button',{name:'Approva e programma'})).toBeDisabled();assert.deepEqual(errors,[]);assert.deepEqual(mutations,[]);
 await writeFile(`${dir}/verification.json`,JSON.stringify({id,origin,seconds:m.seconds,stories:4,segments:17,moods,bodyTiming:'word',noGapsWithinNews:true,speech:m.speech,rawToMaster,masterToMovie,peakDbfs:20*Math.log10(peak/32768),clipped,masterSha256:createHash('sha256').update(await readFile(path.join(root,'track.wav'))).digest('hex'),movies,samples,control:dashboard.control,job:{state:job.state,revision:job.revision},errors,mutations},null,2)+'\n');
 console.log('Four-news Daily: 96 s, 17 segments, seven moods, exact word boundaries, natural waveform, both video players, mood/seek controls and mobile verified.');
}finally{await browser.close();}
