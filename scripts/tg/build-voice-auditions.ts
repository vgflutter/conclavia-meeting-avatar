/** Explicit bounded creative audition, never run by app/worker/regression tests. */
import {mkdir,readFile,writeFile,copyFile,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {inworldSpeechResponse} from '@conclavia/avatar-kit/speech/server';
import {readSpeechLines,SPEECH_SAMPLE_RATE,buildAudioLipSync,type SpeechFrame} from '@conclavia/avatar-kit/speech';
import type {PodcastEmotion} from '@conclavia/avatar-kit/performance';

const voices=[{id:'gianni',voiceId:'Gianni',label:'Gianni'},{id:'orietta',voiceId:'Orietta',label:'Orietta'},{id:'ingegnere',voiceId:'community-wogdp7fnk36a',label:'Ingegnere'}];
type Line={mood:PodcastEmotion;label:string;text:string;pause:number;id:string};
async function main(){
 if(!process.argv.includes('--confirm')||process.env.PODCAST_SPEECH_ENABLED!=='true')throw Error('Explicit audition confirmation and voice feature required');
 const root=path.resolve('public/daily-performance'),dir=path.join(root,'voices');await mkdir(dir,{recursive:true});
 let reference:{cues:Line[];[key:string]:unknown};
 try{reference=JSON.parse(await readFile(path.join(dir,'reference-sequence.json'),'utf8'));}
 catch{reference=JSON.parse(await readFile(path.join(root,'sequence.json'),'utf8'));await writeFile(path.join(dir,'reference-sequence.json'),JSON.stringify(reference));}
 const lines=reference.cues.map(({mood,label,text,pause,id})=>({mood,label,text,pause,id}));
 if(lines.length!==6||lines.reduce((n,l)=>n+l.text.length,0)>1000)throw Error('Audition script exceeds the explicit six-line bound');
 const available=[];
 for(const voice of voices){
  const target=path.join(dir,voice.id);await mkdir(target,{recursive:true});
  try{
   const cached=JSON.parse(await readFile(path.join(target,'sequence.json'),'utf8'));
   await access(path.join(target,'audio.wav'));
   const content=(c:Line)=>[c.text,c.mood,c.label,c.pause];
   if(cached.model==='inworld-tts-2'&&cached.voiceId===voice.voiceId&&cached.speakingRate===.98&&JSON.stringify(cached.cues.map(content))===JSON.stringify(lines.map(content))){available.push({id:voice.id,label:voice.label,provider:'Inworld',sequenceUrl:`/daily-performance/voices/${voice.id}/sequence.json`});console.log(JSON.stringify({voice:voice.label,state:'cached'}));continue;}
  }catch{}
  const chunks:Buffer[]=[],cues=[];let samples=0;
  for(const line of lines){
   const response=await inworldSpeechResponse({text:line.text,language:'it',voiceId:voice.voiceId,model:'inworld-tts-2',speakingRate:.98,signal:AbortSignal.timeout(90000)});
   if(!response.body)throw Error('Voice audition returned no audio');
   let complete=false,bytes=0;const pieces:Buffer[]=[];
   for await(const rawFrame of readSpeechLines(response.body)){
    const frame=rawFrame as SpeechFrame;
    if(frame.error)throw Error('Voice audition interrupted');
    if(frame.audio){const piece=Buffer.from(frame.audio,'base64');bytes+=piece.length;if(bytes>SPEECH_SAMPLE_RATE*2*20)throw Error('Audition line exceeds twenty seconds');pieces.push(piece);}
    if(frame.done)complete=true;
   }
   if(!complete||bytes<2400||bytes%2)throw Error('Incomplete voice audition');
   const pcm=Buffer.concat(pieces),floats=new Float32Array(pcm.length/2);for(let i=0;i<floats.length;i++)floats[i]=pcm.readInt16LE(i*2)/32768;
   const pause=Math.max(.3,Math.min(4,line.pause)),start=samples/SPEECH_SAMPLE_RATE,end=start+floats.length/SPEECH_SAMPLE_RATE;
   cues.push({...line,start,end,lips:buildAudioLipSync(line.text,floats,SPEECH_SAMPLE_RATE)});
   const silence=Buffer.alloc(Math.round(pause*SPEECH_SAMPLE_RATE)*2);chunks.push(pcm,silence);samples+=floats.length+silence.length/2;
  }
  const duration=Math.max(36,samples/SPEECH_SAMPLE_RATE);if(duration>55)throw Error('Audition exceeds fifty-five seconds');
  const encoded=spawnSync('ffmpeg',['-y','-v','error','-f','s16le','-ar',String(SPEECH_SAMPLE_RATE),'-ac','1','-i','pipe:0','-af',`apad,atrim=duration=${duration},loudnorm=I=-16:TP=-1.5:LRA=11`,'-ar',String(SPEECH_SAMPLE_RATE),path.join(target,'audio.wav')],{input:Buffer.concat(chunks),maxBuffer:2000000});
  if(encoded.status!==0)throw Error('Audition audio encoding failed');
  await writeFile(path.join(target,'sequence.json'),JSON.stringify({version:1,duration,voice:`Inworld · ${voice.label}`,voiceId:voice.voiceId,model:'inworld-tts-2',speakingRate:.98,audioUrl:`/daily-performance/voices/${voice.id}/audio.wav`,fiction:true,cues}));
  available.push({id:voice.id,label:voice.label,provider:'Inworld',sequenceUrl:`/daily-performance/voices/${voice.id}/sequence.json`});
  console.log(JSON.stringify({voice:voice.label,state:'generated',seconds:duration}));
 }
 const primary=available.find(v=>v.id==='gianni');if(!primary)throw Error('Primary audition unavailable');
 await writeFile(path.join(dir,'catalog.json'),JSON.stringify({defaultId:primary.id,voices:available}));
 await copyFile(path.join(dir,primary.id,'sequence.json'),path.join(root,'sequence.json'));
 await writeFile(path.join(dir,'README.txt'),'Confronto creativo esplicito: sei frasi originali dimostrative, stesso testo, modello Inworld TTS 2 e velocità 0,98. Non contiene notizie reali. Tre voci del catalogo già integrato; PCM 24 kHz e livello uniforme. Non eseguito da app, worker o test. Visemi approssimati da testo e PCM. Nessuna scelta editoriale o voce dei piloti è modificata da questi file.\n');
}
void main().catch(error=>{console.error(error instanceof Error?error.message:'Voice audition failed');process.exitCode=1;});
