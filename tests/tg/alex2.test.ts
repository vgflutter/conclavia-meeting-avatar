import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,readFile,rm,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {alex2Config,alex2ConfigStatus} from '../../src/lib/tg/alex2-config';
import {alex2Passages,assembleAlex2Take,recordAlex2Passages,type Alex2Passage} from '../../src/lib/tg/alex2-speech';
import {dailyClosing,dailyGreeting} from '../../src/lib/tg/editorial';
import {dailyScriptDepthIssues} from '../../src/lib/tg/script-depth';
import {validMasterClock} from '../../src/lib/tg/media-contract';
import {tgSpeechPlan} from '../../src/lib/tg/speech-plan';
import {TG_PRODUCTS} from '../../src/lib/tg/config';
import {mediaCheckIssues} from '../../src/lib/tg/final-review-policy';
import {synthesize} from '../../src/lib/tg/media';
import type {TgManifest,TgSentence} from '../../src/lib/tg/types';

const sentence=(text:string,storyId='news'):TgSentence=>({text,storyId,speaker:0,mood:'attention',intensity:.5,intent:'explain',sourceIds:[]});
function passage(sentences:TgSentence[]):Alex2Passage{
  const text=sentences.map(s=>s.text).join(' '), tokens=text.split(/\s+/u);
  const words=tokens.map((text,i)=>({text,start:.1+i*.25,end:.28+i*.25}));
  const pcm=Buffer.alloc(Math.ceil((tokens.length*.25+.4)*24000)*2);
  for(const w of words)for(let i=Math.ceil(w.start*24000);i<Math.floor(w.end*24000);i++)pcm.writeInt16LE(Math.round(Math.sin(i*.2)*5000),i*2);
  return {sentences,words,pcm};
}

test('private Alex 2 status exposes booleans, requires explicit model and cannot choose another casting',()=>{
  const env={ELEVENLABS_API_KEY:'synthetic-secret',TG_IT_ELEVENLABS_VOICE_ID:'synthetic-voice-id',TG_ELEVENLABS_MODEL_ID:'eleven_v4'};
  assert.equal(alex2ConfigStatus(env).configured,true);
  assert.ok(!JSON.stringify(alex2ConfigStatus(env)).includes('synthetic-secret'));
  assert.throws(()=>alex2Config({...env,TG_ELEVENLABS_MODEL_ID:'eleven_multilingual_v2'}));
  assert.throws(()=>alex2Config({...env,TG_IT_ELEVENLABS_SETTINGS:'{"speed":1.2}'}));
  assert.equal(tgSpeechPlan({...TG_PRODUCTS[0],productionStandard:'cdaily-v1'}).provider,'elevenlabs');
});

test('moods remain clauses within a connected story; actual intro pause and comment pointer share native word times',()=>{
  const intro=[sentence(dailyGreeting('it','2026-10-24'),'intro'),sentence('Ecco le notizie da capire.','intro')];
  const body=[sentence('Il fatto è verificato.'),{...sentence('Gli effetti restano da confermare.'),mood:'doubt' as const,intent:'reflect' as const}];
  const closing=dailyClosing('it');
  assert.equal(alex2Passages([...intro,...body,...closing]).length,3);
  const take=assembleAlex2Take([passage(intro),passage(body),passage(closing)],'2026-10-24');
  assert.ok(Math.abs(take.cues[2].start-take.cues[1].end-2)<1/24000);
  assert.ok(take.cues.every(c=>c.alignment==='word'));
  assert.deepEqual(take.cues.map(c=>c.text),[...intro,...body,...closing].map(c=>c.text));
  const cue=take.cues.find(c=>c.intent==='point-down')!, word=take.words.find(w=>w.text==='commenti')!;
  assert.ok(Math.abs(cue.start+cue.gestureAccent!-word.start)<1e-6);
  assert.equal(cue.choreography?.strokes[0].kind,'point-down');
  assert.ok(cue.levels!.some(level=>level>0));
  assert.ok(take.cues[3].choreography,'semantic acting survives the mood change');
});

test('a short multi-story bulletin is stopped before it can be mistaken for the explained Daily',()=>{
  const product={...TG_PRODUCTS[0],productionStandard:'cdaily-v1' as const};
  const script={title:'Test',description:'Test',sentences:Array.from({length:5},(_,i)=>sentence('Solo un titolo molto breve.',`story-${i}`))};
  assert.ok(dailyScriptDepthIssues(product,script).length>=6);
  assert.deepEqual(dailyScriptDepthIssues({...product,productionStandard:undefined},script),[]);
});

test('natural master duration is distinct from its editorial target; low FPS and wrong pause/voice are blocked',()=>{
  const product={...TG_PRODUCTS[0],productionStandard:'cdaily-v1' as const};
  const take=assembleAlex2Take([passage([sentence('Ciao Daily.','intro')]),passage([sentence('Test.')]),passage(dailyClosing('it'))],'2026-10-24');
  const manifest:TgManifest={version:1,product,date:'2026-10-24',seconds:326.64,fps:50,lipSync:'word-anchored-estimate',speech:tgSpeechPlan(product),
    voiceConfigSha256:'a'.repeat(64),openingPause:take.openingPause,stories:[],sources:[],cues:take.cues};
  assert.equal(validMasterClock(product,manifest),true);
  for(const change of [{seconds:421},{fps:25},{speech:{...manifest.speech!,voices:['Another voice']}},{openingPause:{...manifest.openingPause!,wordGapSeconds:.18}}])assert.equal(validMasterClock(product,{...manifest,...change} as TgManifest),false);
  const media=([{format:'landscape',width:1920,height:1080},{format:'portrait',width:1080,height:1920}] as const).map(m=>({...m,seconds:326.64,fps:50,rms:.1,peak:.8,clippedRatio:0,leadingSilence:.1,trailingSilence:1}));
  assert.deepEqual(mediaCheckIssues(media,manifest.seconds,true),[]);
  assert.ok(mediaCheckIssues(media.map(m=>({...m,fps:25})),manifest.seconds,true).length);
});

test('the production synthesis route preserves natural speed, the editorial target and the same cached take for both formats',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'daily-alex2-production-')),original=globalThis.fetch;
  const values={ELEVENLABS_API_KEY:'synthetic-test-key',TG_IT_ELEVENLABS_VOICE_ID:'synthetic-voice-id',TG_ELEVENLABS_MODEL_ID:'eleven_v4',TG_ARTIFACT_DIR:directory,PODCAST_SPEECH_ENABLED:'true'};
  const saved=Object.fromEntries(Object.keys(values).map(k=>[k,process.env[k]]));Object.assign(process.env,values);
  let calls=0;
  globalThis.fetch=async(_url,init)=>{
    if(init?.method!=='POST')return Response.json({voice_id:values.TG_IT_ELEVENLABS_VOICE_ID,name:'Alex 2 - daily'});
    calls++;
    const text=JSON.parse(String(init.body)).text as string,chars=[...text],seconds=text.length>1000?185:8;
    const pcm=Buffer.alloc(seconds*48000);
    for(let i=2400;i<pcm.length/2-2400;i++)pcm.writeInt16LE(Math.round(Math.sin(i*.2)*5000),i*2);
    const step=(seconds-.3)/chars.length;
    return Response.json({audio_base64:pcm.toString('base64'),alignment:{characters:chars,character_start_times_seconds:chars.map((_,i)=>.1+i*step),character_end_times_seconds:chars.map((_,i)=>.1+(i+1)*step)}});
  };
  try{
    const product={...TG_PRODUCTS[0],productionStandard:'cdaily-v1' as const};
    const body=Array.from({length:20},()=>sentence('Il fatto verificato richiede una spiegazione chiara per capire le conseguenze.'));
    const script={title:'Fixture sintetica',description:'Solo un test, senza notizie reali.',sentences:[sentence(dailyGreeting('it','2026-10-24'),'intro'),...body,...dailyClosing('it')]};
    const research={stories:[],sources:[],collectedAt:new Date().toISOString(),searchCalls:0,warnings:[]};
    const manifest=await synthesize('3'.repeat(24),product,'2026-10-24',research,script,AbortSignal.timeout(30000));
    assert.equal(calls,3);assert.equal(manifest.product.seconds,300);assert.notEqual(manifest.seconds,300);
    assert.equal(manifest.fps,50);assert.equal(manifest.lipSync,'word-anchored-estimate');assert.equal(validMasterClock(product,manifest),true);
    await synthesize('3'.repeat(24),product,'2026-10-24',research,script,AbortSignal.timeout(30000));assert.equal(calls,3);
    const raw=await readFile(path.join(directory,'3'.repeat(24),'raw.wav'));
    assert.ok(raw.length/48000<205,'the take is never slowed to fill 300 seconds');
  }finally{globalThis.fetch=original;for(const [key,value]of Object.entries(saved)){if(value===undefined)delete process.env[key];else process.env[key]=value;}await rm(directory,{recursive:true,force:true});}
});

test('completed takes reuse PCM and timing; changed cache or uncertain paid call cannot trigger rebilling',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'daily-alex2-')),original=globalThis.fetch;
  const values={ELEVENLABS_API_KEY:'synthetic-test-key',TG_IT_ELEVENLABS_VOICE_ID:'synthetic-voice-id',TG_ELEVENLABS_MODEL_ID:'eleven_v4',TG_ARTIFACT_DIR:directory};
  const saved=Object.fromEntries(Object.keys(values).map(k=>[k,process.env[k]]));Object.assign(process.env,values);
  let paid=0,fail=false;
  globalThis.fetch=async(url,init)=>{
    assert.ok(String(url).startsWith('https://api.elevenlabs.io/'));
    if(init?.method!=='POST')return Response.json({voice_id:values.TG_IT_ELEVENLABS_VOICE_ID,name:'Alex 2 - daily'});
    paid++;if(fail)throw Error('uncertain result');
    const text=JSON.parse(String(init?.body)).text as string,chars=[...text];
    return Response.json({audio_base64:Buffer.alloc(48000).toString('base64'),alignment:{characters:chars,character_start_times_seconds:chars.map((_,i)=>i*.02),character_end_times_seconds:chars.map((_,i)=>(i+1)*.02)}});
  };
  try{
    const id='1'.repeat(24),lines=[sentence('Ciao Daily.')];
    const first=await recordAlex2Passages(id,lines,AbortSignal.timeout(10000));
    const again=await recordAlex2Passages(id,lines,AbortSignal.timeout(10000));
    assert.equal(paid,1);assert.deepEqual(again[0].pcm,first[0].pcm);assert.deepEqual(again[0].words,first[0].words);
    const cache=path.join(directory,id,'.speech','alex2'),name=(await readdir(cache)).find(n=>n.endsWith('.json')&&!n.endsWith('.attempt.json'))!;
    const metadata=JSON.parse(await readFile(path.join(cache,name),'utf8'));metadata.words=[];
    await writeFile(path.join(cache,name),JSON.stringify(metadata));
    await assert.rejects(recordAlex2Passages(id,lines,AbortSignal.timeout(10000)),/Cache/);assert.equal(paid,1);
    fail=true;
    await assert.rejects(recordAlex2Passages('2'.repeat(24),lines,AbortSignal.timeout(10000)),/Registrazione/);
    await assert.rejects(recordAlex2Passages('2'.repeat(24),lines,AbortSignal.timeout(10000)),/già iniziata/);
    assert.equal(paid,2,'uncertain successful/failed synthesis is never automatically rebilled');
  }finally{globalThis.fetch=original;for(const [key,value]of Object.entries(saved)){if(value===undefined)delete process.env[key];else process.env[key]=value;}await rm(directory,{recursive:true,force:true});}
});
