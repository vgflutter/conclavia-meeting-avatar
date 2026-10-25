import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,rm,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {recordAlex2Passages} from '../../src/lib/tg/alex2-speech';
import {reviewedAsrSpellings} from '../../src/lib/tg/alex2-alignment';

test('only equivalent integer spellings can reconcile ASR; different facts remain blocked',()=>{
 assert.equal(reviewedAsrSpellings('Oggi ventisei ottobre',[{text:'Oggi',start:0,end:.2},{text:'26',start:.2,end:.5},{text:'ottobre',start:.5,end:.8}])[1].text,'ventisei');
 assert.throws(()=>reviewedAsrSpellings('Oggi ventisei ottobre',[{text:'Oggi',start:0,end:.2},{text:'27',start:.2,end:.5}]),/copione/);
});
test('invalid native timing reuses the exact take and one measured ASR; uncertain ASR never causes a second synthesis',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'daily-aligned-')),fetcher=globalThis.fetch;
 const values={TG_ARTIFACT_DIR:directory,ELEVENLABS_API_KEY:'synthetic',OPENAI_API_KEY:'synthetic',TG_IT_ELEVENLABS_VOICE_ID:'synthetic-voice',TG_ELEVENLABS_MODEL_ID:'eleven_v4'};
 const previous=Object.fromEntries(Object.keys(values).map(k=>[k,process.env[k]]));Object.assign(process.env,values);
 let speech=0,asr=0,fail=false;
 globalThis.fetch=async(url,init)=>{
  if(String(url).includes('/voices/'))return Response.json({voice_id:values.TG_IT_ELEVENLABS_VOICE_ID,name:'Alex 2 - daily'});
  if(String(url).includes('/audio/transcriptions')){asr++;if(fail)throw Error('uncertain');return Response.json({words:['Ciao,','oggi','è','il','26','ottobre.'].map((word,i)=>({word,start:i*.3,end:word==='è'?i*.3:i*.3+.25}))});}
  assert.equal(init?.method,'POST');speech++;
  const text=JSON.parse(String(init?.body)).text as string,characters=[...text],pcm=Buffer.alloc(4*48000);
  for(let i=0;i<pcm.length/2;i++)pcm.writeInt16LE(Math.round(Math.sin(i*.2)*4000),i*2);
  return Response.json({audio_base64:pcm.toString('base64'),alignment:{characters,character_start_times_seconds:characters.map((_,i)=>i*.02),character_end_times_seconds:characters.map(()=>-1)}});
 };
 try{
  const lines=[{text:'Ciao, oggi è il ventisei ottobre.',storyId:'intro',speaker:0 as const,mood:'attention' as const,intensity:.5,sourceIds:[]}];
  const first=await recordAlex2Passages('1'.repeat(24),lines,AbortSignal.timeout(10000));
  assert.equal(first[0].timingSource,'whisper-1-verified-anchors');assert.ok(first[0].words.some(w=>w.text.includes('ventisei')));
  const again=await recordAlex2Passages('1'.repeat(24),lines,AbortSignal.timeout(10000));
  assert.deepEqual(again[0].pcm,first[0].pcm);assert.equal(speech,1);assert.equal(asr,1);
  assert.ok((await readdir(path.join(directory,'1'.repeat(24),'.speech/alex2'))).some(n=>n.endsWith('.response.json')));
  fail=true;await assert.rejects(recordAlex2Passages('2'.repeat(24),lines,AbortSignal.timeout(10000)));
  await assert.rejects(recordAlex2Passages('2'.repeat(24),lines,AbortSignal.timeout(10000)));
  assert.equal(speech,2);assert.equal(asr,2,'uncertain transcript requests are not automatically rebilled');
 }finally{globalThis.fetch=fetcher;for(const [k,v] of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v;}await rm(directory,{recursive:true,force:true});}
});
