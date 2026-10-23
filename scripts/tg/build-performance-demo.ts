// Explicit, local-only audition. Never called by the app, worker or tests.
import { mkdir, writeFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { localKokoroSpeechResponse } from '@conclavia/avatar-kit/speech/server';
import { readSpeechLines, SPEECH_SAMPLE_RATE, buildAudioLipSync } from '@conclavia/avatar-kit/speech';
import type { PodcastEmotion } from '@conclavia/avatar-kit/performance';

const lines: {mood:PodcastEmotion;label:string;text:string;pause:number}[] = [
  {mood:'attention',label:'Presenza',text:'Una notizia deve aiutarti a capire. Partiamo dai fatti, e dalle domande giuste.',pause:.65},
  {mood:'curiosity',label:'Curiosità',text:'Ma che cosa cambia davvero per noi? È questo il punto interessante.',pause:.65},
  {mood:'doubt',label:'Dubbio',text:'Aspetta, però. Una promessa non è un risultato. Servono prove.',pause:.85},
  {mood:'empathy',label:'Empatia',text:'Quando ci sono persone in difficoltà, servono attenzione, e rispetto.',pause:.85},
  {mood:'amusement',label:'Calore',text:'E una buona notizia possiamo accoglierla con un sorriso. Anche questo conta.',pause:.7},
  {mood:'attention',label:'Ascolto',text:'Ora ascolto. Una conversazione comincia anche da qui.',pause:3.8},
];
async function main(){
const chunks:Buffer[]=[];
const cues=[];
let samples=0;
for(const [i,line] of lines.entries()) {
  const response=await localKokoroSpeechResponse({text:line.text,voiceId:'im_nicola',language:'it',signal:AbortSignal.timeout(90_000)});
  if(!response.body) throw new Error('No local audio');
  const pieces:Buffer[]=[]; let complete=false;
  for await(const value of readSpeechLines(response.body)) {
    if(!value||typeof value!=='object')throw new Error('Invalid local audio frame');
    const frame=value as {error?:unknown;audio?:unknown;done?:unknown};
    if(frame.error) throw new Error('Local audio failed');
    if(typeof frame.audio==='string') pieces.push(Buffer.from(frame.audio,'base64'));
    if(frame.done===true) complete=true;
  }
  if(!complete) throw new Error('Incomplete local audio');
  const pcm=Buffer.concat(pieces), floats=new Float32Array(pcm.length/2);
  for(let j=0;j<floats.length;j++) floats[j]=pcm.readInt16LE(j*2)/32768;
  const start=samples/SPEECH_SAMPLE_RATE,end=start+floats.length/SPEECH_SAMPLE_RATE;
  const lips=buildAudioLipSync(line.text,floats,SPEECH_SAMPLE_RATE);
  cues.push({...line,id:`acting-${i}`,start,end,lips});
  chunks.push(pcm,Buffer.alloc(Math.round(line.pause*SPEECH_SAMPLE_RATE)*2));
  samples+=floats.length+Math.round(line.pause*SPEECH_SAMPLE_RATE);
  console.log(`${line.label}: ${(end-start).toFixed(2)}s`);
}
const actual=samples/SPEECH_SAMPLE_RATE;
if(actual>45) throw new Error(`Audition is ${actual.toFixed(1)}s; shorten the script instead of rushing it.`);
const duration=Math.max(36,actual),dir=pathToFileURL(resolve('public/daily-performance')+'/');
await mkdir(dir,{recursive:true});
const encoded=spawnSync('ffmpeg',['-y','-v','error','-f','s16le','-ar',String(SPEECH_SAMPLE_RATE),'-ac','1','-i','pipe:0','-af',`apad,atrim=duration=${duration},loudnorm=I=-16:TP=-1.5:LRA=11`,'-ar',String(SPEECH_SAMPLE_RATE),new URL('nicola.wav',dir).pathname],{input:Buffer.concat(chunks),maxBuffer:2_000_000});
if(encoded.status!==0) throw new Error('Local WAV encoding failed');
const comparisonActive=await access(new URL('voices/catalog.json',dir)).then(()=>true).catch(()=>false);
await writeFile(new URL(comparisonActive?'voices/reference-sequence.json':'sequence.json',dir),JSON.stringify({version:1,duration,voice:'Kokoro · Nicola',fiction:true,cues}));
if(!comparisonActive)await writeFile(new URL('README.txt',dir),'Prova di recitazione, non notizie reali. Testo originale Conclavia. Voce sintetica Kokoro Nicola generata localmente. Visemi approssimati da testo e PCM, non allineamento fonetico del provider. Nessuna chiamata a provider a pagamento.\n');
console.log(`Saved local audition: ${duration.toFixed(2)}s, ${cues.length} acting cues.`);
}
void main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=1;});
