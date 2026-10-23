import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {TG_PRODUCTS} from '../../src/lib/tg/config';
import {tgReadiness} from '../../src/lib/tg/readiness';
import {tgSpeechPlan,directedTgText,tgSpeechPassages} from '../../src/lib/tg/speech-plan';
import {synthesize} from '../../src/lib/tg/media';
import type {TgScript,TgResearch} from '../../src/lib/tg/types';

test('Daily casting uses native Italian TTS-2 voices and never treats Kokoro as ready',()=>{
 const plan=tgSpeechPlan({...TG_PRODUCTS[0],presenters:2});
 assert.deepEqual(plan.voices,['Gianni','Orietta']);assert.equal(plan.model,'inworld-tts-2');
 assert.deepEqual(tgSpeechPlan(TG_PRODUCTS[0]).voices,['Gianni']);
 const local=tgReadiness(TG_PRODUCTS[0],{PODCAST_SPEECH_ENABLED:'true',KOKORO_URL:'http://127.0.0.1:8766'});
 assert.equal(local.checks.find(x=>x.id==='speech')?.ready,false);
 assert.equal(tgReadiness(TG_PRODUCTS[0],{PODCAST_SPEECH_ENABLED:'true',INWORLD_API_KEY:'fixture'}).checks.find(x=>x.id==='speech')?.ready,true);
});

test('one continuous take can carry several moods; trailing word frames align the clauses and cached timing is retained',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'tg-phrased-')),originalFetch=globalThis.fetch;
 const saved=Object.fromEntries(['PODCAST_SPEECH_ENABLED','INWORLD_API_KEY','TG_ARTIFACT_DIR'].map(k=>[k,process.env[k]]));
 Object.assign(process.env,{PODCAST_SPEECH_ENABLED:'true',INWORLD_API_KEY:'synthetic-test-key',TG_ARTIFACT_DIR:dir});
 const calls:Record<string,unknown>[]=[];const pcm=Buffer.alloc(24000*29*2);
 for(let i=0;i<pcm.length/2;i++)pcm.writeInt16LE(Math.round((Math.sin(i/24000*Math.PI*440)+.5*Math.sin(i/24000*Math.PI*682+i*i*1e-8))*2000),i*2);
 globalThis.fetch=async(_input,init)=>{calls.push(JSON.parse(String(init?.body)));return new Response(JSON.stringify({result:{audioContent:pcm.toString('base64')}})+'\n'+JSON.stringify({result:{timestampInfo:{wordAlignment:{words:['Primo','punto.','Secondo','punto.'],wordStartTimeSeconds:[0,2,13,15],wordEndTimeSeconds:[1,3,14,16]}}}})+'\n');};
 try{
  const product={...TG_PRODUCTS[0],seconds:60},script:TgScript={title:'Prova continua',description:'Fixture senza notizie.',sentences:['a','a','b','b'].map((storyId,i)=>({storyId,speaker:0,text:i%2?'Secondo punto.':'Primo punto.',sourceIds:[],mood:i%2?'curiosity':'attention',intensity:.6}))};
  const research:TgResearch={stories:[],sources:[],collectedAt:new Date().toISOString(),searchCalls:0,warnings:[]};
  assert.equal(tgSpeechPassages(script.sentences).length,2);
  const m=await synthesize('f'.repeat(24),product,'fixture',research,script,AbortSignal.timeout(30000));
  assert.equal(calls.length,1,'identical paragraph text is synthesized only once even across story IDs');assert.ok(calls.every(c=>String(c.text).includes('one flowing paragraph')));
  assert.ok(m.cues.every(c=>c.alignment==='word'));assert.deepEqual(m.cues.map(c=>c.mood),['attention','curiosity','attention','curiosity']);
  assert.equal(m.cues[0].end,m.cues[1].start);assert.equal(m.cues[2].end,m.cues[3].start);
  const natural=await synthesize('f'.repeat(24),{...product,seconds:90},'fixture',research,script,AbortSignal.timeout(30000),{naturalDuration:true});
  assert.equal(calls.length,1,'PCM and word metadata are cached together');assert.equal(natural.seconds,60);assert.equal(natural.product.seconds,60);assert.equal(natural.cues[1].start,13,'natural trial does not time-stretch the take');
  const data=(b:Buffer)=>{for(let at=12;at+8<=b.length;){const size=b.readUInt32LE(at+4);if(b.toString('ascii',at,at+4)==='data')return b.subarray(at+8,at+8+size);at+=8+size+(size%2);}throw Error('Missing WAV data');};
  const raw=data(await readFile(path.join(dir,'f'.repeat(24),'raw.wav'))),master=data(await readFile(path.join(dir,'f'.repeat(24),'track.wav')));
  let dot=0,aa=0,bb=0;
  for(let i=24000;i<Math.min(raw.length,master.length)/2;i+=8){const a=raw.readInt16LE(i*2),b=master.readInt16LE(i*2);dot+=a*b;aa+=a*a;bb+=b*b;}
  assert.ok(dot/Math.sqrt(aa*bb)>.98,'natural-duration normalization preserves the waveform at zero delay');
 }finally{globalThis.fetch=originalFetch;for(const [k,v]of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}await rm(dir,{recursive:true,force:true});}
});

test('Italian production calls the full Inworld model for both voices, records provenance and caches completed PCM',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'tg-native-voices-')),originalFetch=globalThis.fetch;
 const saved=Object.fromEntries(['PODCAST_SPEECH_ENABLED','INWORLD_API_KEY','INWORLD_TTS_MODEL','MEETING_TTS_PROVIDER','TG_ARTIFACT_DIR'].map(k=>[k,process.env[k]]));
 Object.assign(process.env,{PODCAST_SPEECH_ENABLED:'true',INWORLD_API_KEY:'synthetic-test-key',INWORLD_TTS_MODEL:'inworld-tts-2-flash',MEETING_TTS_PROVIDER:'inworld',TG_ARTIFACT_DIR:dir});
 const calls:Record<string,unknown>[]=[];
 const pcm=Buffer.alloc(24000*20*2);for(let i=0;i<pcm.length/2;i++)pcm.writeInt16LE(Math.round(Math.sin(i/24000*Math.PI*440)*2000),i*2);
 globalThis.fetch=async(input,init)=>{assert.equal(String(input),'https://api.inworld.ai/tts/v1/voice:stream');calls.push(JSON.parse(String(init?.body)));return new Response(JSON.stringify({result:{audioContent:pcm.toString('base64')}})+'\n');};
 try{
  const product={...TG_PRODUCTS[0],presenters:2 as const,seconds:60},script:TgScript={title:'Fixture vocale',description:'Nessuna notizia reale.',sentences:[0,1,0].map((speaker,i)=>({speaker:speaker as 0|1,storyId:'story',sourceIds:[],text:`Una frase campione ${i} per verificare la corretta voce.`,mood:i===1?'empathy':'attention',intensity:.6}))};
  const research:TgResearch={stories:[],sources:[],collectedAt:new Date().toISOString(),searchCalls:0,warnings:[]};
  const manifest=await synthesize('e'.repeat(24),product,'fixture',research,script,AbortSignal.timeout(30000));
  assert.equal(calls.length,3);assert.deepEqual(calls.map(c=>c.voiceId),['Gianni','Orietta','Gianni']);assert.ok(calls.every(c=>c.modelId==='inworld-tts-2'));
  assert.match(String(calls[1].text),/sober and compassionate/u);assert.ok(String(calls[0].text).includes('native Italian'));
  assert.deepEqual(manifest.speech,tgSpeechPlan(product));assert.deepEqual(manifest.cues.map(c=>c.text),script.sentences.map(s=>s.text));
  assert.ok(manifest.cues.every(c=>!c.text.includes('[Speak')));assert.ok(manifest.cues.at(-1)!.end<60);
  await synthesize('e'.repeat(24),product,'fixture',research,script,AbortSignal.timeout(30000));assert.equal(calls.length,3,'completed identical sentences must not be billed again');
  assert.match(directedTgText(script.sentences[1],'it'),/sober and compassionate/u);
 }finally{
  globalThis.fetch=originalFetch;for(const [k,v] of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
  await rm(dir,{recursive:true,force:true});
 }
});

test('the closing remains one flowing take and its downward pointer is timed to the measured comments word',async()=>{
 const {dailyClosing}=await import('../../src/lib/tg/editorial');
 const {tgFrameAt}=await import('../../src/lib/tg/timeline');
 const dir=await mkdtemp(path.join(os.tmpdir(),'tg-closing-')),originalFetch=globalThis.fetch;
 const saved=Object.fromEntries(['PODCAST_SPEECH_ENABLED','INWORLD_API_KEY','TG_ARTIFACT_DIR'].map(k=>[k,process.env[k]]));
 Object.assign(process.env,{PODCAST_SPEECH_ENABLED:'true',INWORLD_API_KEY:'synthetic-test-only',TG_ARTIFACT_DIR:dir});
 const pcm=Buffer.alloc(24000*8*2);for(let i=0;i<pcm.length/2;i++)pcm.writeInt16LE(Math.round(Math.sin(i*.075)*1800),i*2);
 const words=['Scrivici','nei','commenti','cosa','vuoi','approfondire','partiamo','dalle','tue','domande','Meno','rumore','più','contesto'];
 let calls=0;globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({result:{audioContent:pcm.toString('base64')}})+'\n'+JSON.stringify({result:{timestampInfo:{wordAlignment:{words,wordStartTimeSeconds:words.map((_,i)=>i*.5),wordEndTimeSeconds:words.map((_,i)=>i*.5+.35)}}}})+'\n');};
 try{
  const script:TgScript={title:'Chiusura di prova',description:'Fixture senza notizie.',sentences:dailyClosing('it')};
  const research:TgResearch={stories:[],sources:[],collectedAt:new Date().toISOString(),searchCalls:0,warnings:[]};
  const manifest=await synthesize('d'.repeat(24),{...TG_PRODUCTS[0],seconds:60},'fixture',research,script,AbortSignal.timeout(30000),{naturalDuration:true});
  assert.equal(calls,1,'moods and gestures do not split the voice into isolated takes');
  assert.equal(manifest.cues[0].gestureAlignment,'word');assert.equal(manifest.cues[0].gestureAccent,1);
  const stroke=manifest.cues[0].choreography!.strokes[0];assert.equal(stroke.kind,'point-down');assert.equal(stroke.apex,1);
  const frame=tgFrameAt(manifest,1.1);assert.equal(frame.speakers[0].performance?.choreography?.strokes[0].kind,'point-down');
  assert.equal(frame.headline,'Cosa vuoi approfondire?');assert.deepEqual(frame.sources,[]);
  assert.equal(tgFrameAt(manifest,10).speakers[0].speaking,false);
 }finally{globalThis.fetch=originalFetch;for(const [k,v] of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}await rm(dir,{recursive:true,force:true});}
});
