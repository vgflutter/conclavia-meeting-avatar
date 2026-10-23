// Verify the commissioned launch media and its actual review GUI. GET-only.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium,expect} from '@playwright/test';
const origin=process.env.TG_RENDER_ORIGIN??'http://127.0.0.1:3105';
if(!/^http:\/\/127\.0\.0\.1:31\d\d$/u.test(origin))throw Error('Local-only verification');
const dir='public/daily-launch',out='docs/images/daily-launch',voiceDir=process.env.TG_LAUNCH_VOICE_DIR??'.tg-artifacts/.launch-promo';await mkdir(out,{recursive:true});
const m=JSON.parse(await readFile(dir+'/manifest.json','utf8'));
const revision=m.mediaVersion?'?v='+encodeURIComponent(m.mediaVersion):'';
assert.equal(m.scenes.length,7);assert.equal(m.cues.length,m.speechProvider==='elevenlabs'?16:14);assert.ok(m.cues.every(c=>c.alignment==='word'));
assert.ok(m.duration>30&&m.duration<=60);assert.ok(m.duration-m.cues.at(-1).end>=2);
const movies=[];
for(const format of ['portrait','landscape']){
 const file=`${dir}/${format}.mp4`,probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,sample_aspect_ratio,sample_rate,channels','-of','json',file],{encoding:'utf8'}));
 const video=probe.streams.find(s=>s.codec_type==='video'),audio=probe.streams.find(s=>s.codec_type==='audio');
 assert.deepEqual([video.width,video.height],format==='portrait'?[1080,1920]:[1920,1080]);assert.equal(video.codec_name,'h264');assert.equal(audio.codec_name,'aac');assert.equal(audio.channels,2);assert.equal(audio.sample_rate,'48000');assert.equal(video.r_frame_rate,'25/1');assert.equal(video.sample_aspect_ratio,'1:1');assert.ok(Math.abs(Number(probe.format.duration)-m.duration)<.05);
 execFileSync('ffmpeg',['-v','error','-i',file,'-f','null','-'],{maxBuffer:100000});
 movies.push({format,sha256:createHash('sha256').update(await readFile(file)).digest('hex'),probe});
}
const pcm=file=>execFileSync('ffmpeg',['-v','error','-i',file,'-map','0:a:0','-f','s16le','-ar','24000','-ac','1','pipe:1'],{maxBuffer:6000000});
const raw=pcm(voiceDir+'/raw.wav'),voice=pcm(voiceDir+'/voice.wav'),master=pcm(dir+'/audio.wav');
function correlate(a,b){let xy=0,xx=0,yy=0;for(let i=0;i+2<=Math.min(a.length,b.length);i+=16){const x=a.readInt16LE(i),y=b.readInt16LE(i);xy+=x*y;xx+=x*x;yy+=y*y;}return xy/Math.sqrt(xx*yy);}
const rawToVoice=correlate(raw,voice),voiceToMix=correlate(voice,master),masterToPortrait=correlate(master,pcm(dir+'/portrait.mp4')),masterToLandscape=correlate(master,pcm(dir+'/landscape.mp4'));
assert.ok(rawToVoice>.98,'natural voice timing changed');assert.ok(voiceToMix>.97,'music masks the voice');assert.ok(masterToPortrait>.98&&masterToLandscape>.98,'encoded master drift');
let peak=0,clipped=0;for(let i=0;i<master.length;i+=2){const x=Math.abs(master.readInt16LE(i));peak=Math.max(peak,x);if(x>=32767)clipped++;}assert.equal(clipped,0);
const browser=await chromium.launch({channel:'chrome'}),errors=[],mutations=[],samples=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{if(r.request().method()!=='GET'){mutations.push(r.request().url());return r.abort();}return r.request().url().startsWith(origin)?r.continue():r.abort();});
 await page.goto(origin+'/podcast/tg/presentazione');const video=page.locator('video');
 await expect.poll(()=>video.evaluate(v=>v.duration)).toBeGreaterThan(30);
 for(const format of ['portrait','landscape']){
  await page.getByRole('button',{name:format==='portrait'?'Reel · 9:16':'YouTube · 16:9'}).click();
  await expect(video).toHaveAttribute('src',`/daily-launch/${format}.mp4${revision}`);await expect.poll(()=>video.evaluate(v=>v.videoWidth)).toBe(format==='portrait'?1080:1920);
  await video.evaluate(async v=>{v.muted=true;v.currentTime=.5;await v.play();});await expect.poll(()=>video.evaluate(v=>v.currentTime)).toBeGreaterThan(.6);await video.evaluate(v=>v.pause());
  for(const scene of m.scenes)for(const [view,time] of (scene.kind==='conversation'?[scene.start+(scene.end-scene.start)*.25,scene.start+(scene.end-scene.start)*.75]:[scene.start+Math.min(1.8,(scene.end-scene.start)*.55)]).entries()){
   await video.evaluate((v,t)=>{v.currentTime=t;},time);await expect.poll(()=>video.evaluate(v=>v.seeking)).toBe(false);
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const image=await video.evaluate(v=>{const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);return c.toDataURL('image/jpeg',.92).split(',')[1];});
   await writeFile(`${out}/actual-${format}-${scene.id}${view?'-turn-'+(view+1):''}.jpg`,Buffer.from(image,'base64'));samples.push({format,scene:scene.id,time});
  }
 }
 await page.getByRole('button',{name:'Reel · 9:16'}).click();await expect.poll(()=>video.evaluate(v=>v.videoWidth)).toBe(1080);await expect.poll(()=>video.evaluate(v=>v.readyState)).toBeGreaterThanOrEqual(2);await video.evaluate(async v=>{v.muted=true;v.currentTime=8;await v.play();});await expect.poll(()=>video.evaluate(v=>v.currentTime)).toBeGreaterThan(8.35);await video.evaluate(v=>v.pause());await expect.poll(()=>video.evaluate(v=>v.readyState)).toBeGreaterThanOrEqual(3);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 await page.screenshot({path:`${out}/official-desktop.png`,fullPage:true});
 await page.setViewportSize({width:390,height:1000});await video.scrollIntoViewIfNeeded();await page.waitForTimeout(350);await page.screenshot({path:`${out}/official-mobile.png`});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=390));assert.deepEqual(errors,[]);assert.deepEqual(mutations,[]);
 await writeFile(`${out}/verification.json`,JSON.stringify({origin,duration:m.duration,voice:m.voice,wordTimingSource:m.wordTimingSource??'provider-native',scenes:7,segments:m.cues.length,moods:[...new Set(m.cues.map(c=>c.mood))],rawToVoice,voiceToMix,masterToPortrait,masterToLandscape,peakDbfs:20*Math.log10(peak/32768),clipped,movies,samples,errors,mutations},null,2));
 console.log(JSON.stringify({duration:m.duration,formats:['1080x1920','1920x1080'],scenes:7,rawToVoice,voiceToMix,masterToPortrait,masterToLandscape,clipped,errors,mutations}));
}finally{await browser.close();}
