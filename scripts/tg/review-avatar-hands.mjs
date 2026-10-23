/** Bounded local gesture proofs, without AI, audio generation or publication. */
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {chromium} from '@playwright/test';
const origin=process.env.TG_RENDER_ORIGIN??'http://127.0.0.1:3107';
if(!/^http:\/\/127\.0\.0\.1:31\d\d$/u.test(origin))throw Error('Local review origin required');
const out=process.env.TG_HAND_REVIEW_DIR??'docs/images/daily-avatar-standing-20261022/motion-final';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome'}),errors=[],blocked=[],report=[];
const available={offer:'Una mano aperta',clasp:'Sovrapponi le mani',compare:'Spiega con entrambe',precision:'Un dettaglio preciso',reflect:'Rifletti','point-down':'Indica in basso',explain:'Spiega un punto',open:'Apri il discorso'};
const selected=(process.env.TG_HAND_REVIEW_GESTURES??'offer,clasp,compare').split(',');
if(!selected.length||selected.length>8||selected.some(k=>!Object.hasOwn(available,k)))throw Error('Choose up to eight existing hand rehearsals');
const modes=selected.map(k=>[k,available[k]]);
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{if(r.request().method()!=='GET'||!r.request().url().startsWith(origin+'/')){blocked.push(r.request().url());return r.abort();}return r.continue();});
 await page.goto(origin+'/podcast/tg/avatar');await page.waitForFunction(()=>window.conclaviaAvatarReview);
  await page.getByText('Prova le pose delle mani',{exact:true}).click();
 for(const baseline of (process.env.TG_HAND_REVIEW_BASELINE==='0'?[false]:[false,true]))for(const portrait of (baseline?[true]:[true,false])){
  await page.getByRole('button',{name:baseline?'Versione precedente':'Mani rifinite',exact:true}).click();
  await page.waitForFunction(value=>document.querySelector('canvas')?.dataset.finish===value,baseline?'original':'sculpted');
  await page.getByRole('button',{name:portrait?'9:16':'16:9',exact:true}).click();
  await page.waitForFunction(p=>document.querySelector('canvas')?.height===(p?1920:1080)&&window.conclaviaAvatarReview,portrait);
  for(const [kind,label] of modes){
   await page.getByRole('button',{name:label,exact:true}).click();
   const key=`${baseline?'baseline':'anatomical'}-${portrait?'portrait':'landscape'}-${kind}`;
   const encoder=spawn('ffmpeg',['-y','-v','error','-f','image2pipe','-framerate','25','-vcodec','mjpeg','-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-t','8','-movflags','+faststart',`${out}/${key}.mp4`],{stdio:['pipe','ignore','pipe']});
   let encodeError='';encoder.stderr.on('data',b=>encodeError=(encodeError+String(b)).slice(-1600));const closed=once(encoder,'close'),samples=[];
   try{
    for(let frame=0;frame<200;frame++){
     const result=await page.evaluate(time=>{const a=window.conclaviaAvatarReview,start=performance.now();a.frame(time,false);const ms=performance.now()-start;const c=document.querySelector('canvas');return{jpeg:c.toDataURL('image/jpeg',.95).split(',')[1],sample:a.sample(),ms};},frame/25);
     if(result.sample.texts.some(t=>t.overflow))throw Error('Proof text overflow');
     samples.push({time:frame/25,actor:result.sample.actor,regions:result.sample.regions,ms:result.ms});
     if(frame===84)await writeFile(`${out}/${key}.jpg`,Buffer.from(result.jpeg,'base64'));
     if(!encoder.stdin.write(Buffer.from(result.jpeg,'base64')))await Promise.race([once(encoder.stdin,'drain'),closed.then(()=>{throw Error('Proof encoder stopped');})]);
    }
    encoder.stdin.end();const [code]=await closed;if(code!==0)throw Error('Proof encode failed: '+encodeError);
   }catch(e){encoder.kill('SIGTERM');await closed.catch(()=>{});throw e;}
   const times=samples.map(s=>s.ms).sort((a,b)=>a-b),timing={median:times[100],p95:times[190],max:times[199]};
   await writeFile(`${out}/${key}.json`,JSON.stringify({kind,portrait,baseline,timing,samples},null,2));report.push({key,timing,frames:samples.length});console.log(JSON.stringify(report.at(-1)));
  }
 }
 if(errors.length||blocked.length)throw Error('Unexpected browser activity');
 await writeFile(`${out}/gesture-report.json`,JSON.stringify({errors,blocked,report},null,2));
}finally{await browser.close();}
