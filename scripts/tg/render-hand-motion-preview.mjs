/** Bounded, silent local proof: six seconds at 50fps, canonical rig only. */
import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
const folder=new URL('../../public/daily-launch/hand-lab/',import.meta.url);
const fps=50;
const mode=process.argv.includes('--editorial-reassure')?'editorial-reassure':process.argv.includes('--editorial-reflect')?'editorial-reflect':process.argv.includes('--palms-joined')?'palms-joined':process.argv.includes('--chin-touch')?'chin-touch':process.argv.includes('--delivery')?'delivery':process.argv.includes('--point-up')?'point-up':process.argv.includes('--point-down')?'point-down':process.argv.includes('--interlace')?'interlace':process.argv.includes('--steeple')?'steeple':process.argv.includes('--overlap')?'overlap':process.argv.includes('--fingers')?'fingers':undefined,wide=process.argv.includes('--wide'),detail=process.argv.includes('--detail'),file=(mode?'hands-'+mode:'hands')+(wide?'-wide':detail?'-detail':'');
const browser=await chromium.launch({channel:'chrome'}),errors=[];let encoder,closed;
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.request().method()==='GET'&&r.request().url().startsWith(folder.href)?r.continue():r.abort());
 const entry=new URL('index.html',folder);if(mode)entry.searchParams.set('pose',mode);
 if(wide)entry.searchParams.set('wide','1');
 if(detail)entry.searchParams.set('detail','1');
 await page.goto(entry.href);await page.waitForFunction(()=>window.conclaviaHandProof);
 const duration=await page.evaluate(()=>window.conclaviaHandProof.duration);
 encoder=spawn('ffmpeg',['-y','-v','error','-f','image2pipe','-framerate',String(fps),'-vcodec','mjpeg','-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',fileURLToPath(new URL(file+'.mp4',folder))],{stdio:['pipe','ignore','pipe']});
 let error='';encoder.stderr.on('data',b=>error=(error+String(b)).slice(-1200));closed=once(encoder,'close');
 const start=performance.now();
 for(let i=0;i<duration*fps;i++){
  const frame=await page.evaluate(t=>{const proof=window.conclaviaHandProof;const jpeg=proof.frame(t),sample=proof.sample();return {jpeg,mouthOpen:sample.pose.mouthOpen};},i/fps);
  if(frame.mouthOpen)throw Error('Silent proof must not invent speech');
  if(!encoder.stdin.write(Buffer.from(frame.jpeg,'base64')))await Promise.race([once(encoder.stdin,'drain'),closed.then(()=>{throw Error('Encoder stopped');})]);
 }
 encoder.stdin.end();const [code]=await closed;if(code)throw Error(error||'Encoder failed');if(errors.length)throw Error(errors.join('\n'));
 const report={duration,frames:duration*fps,fps,width:880,height:570,audio:false,errors,renderSeconds:Math.round((performance.now()-start)/10)/100};
 await writeFile(new URL(file+'-report.json',folder),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{if(encoder&&!encoder.stdin.writableEnded){encoder.kill('SIGTERM');await closed.catch(()=>{});}await browser.close();}
