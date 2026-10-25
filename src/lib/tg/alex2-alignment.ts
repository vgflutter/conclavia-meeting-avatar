import 'server-only';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {openAiSpeechWordTimings} from '@conclavia/avatar-kit/speech/server';
import {coalesceSpeechWordAnchors,punctuateSpeechWordAnchors,SPEECH_SAMPLE_RATE,type SpeechWord} from '@conclavia/avatar-kit/speech';
import {TgEditorialError} from './editorial';
import {wave} from './wave';

const small=['zero','uno','due','tre','quattro','cinque','sei','sette','otto','nove','dieci','undici','dodici','tredici','quattordici','quindici','sedici','diciassette','diciotto','diciannove'];
function integerWords(n:number):string{
 if(n<20)return small[n];
 if(n<100){const tens=['','','venti','trenta','quaranta','cinquanta','sessanta','settanta','ottanta','novanta'][Math.floor(n/10)],unit=n%10;return (unit===1||unit===8?tens.slice(0,-1):tens)+(unit?small[unit]:'');}
 if(n<1000){const rest=n%100;return (n<200?'':small[Math.floor(n/100)])+(rest>=80&&rest<90?'cent':'cento')+(rest?integerWords(rest):'');}
 const rest=n%1000;return (n<2000?'mille':integerWords(Math.floor(n/1000))+'mila')+(rest?integerWords(rest):'');
}
const normal=(s:string)=>s.normalize('NFKD').toLowerCase().replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]/gu,'');
/** ASR spelling equivalence only: positive integers <10,000. Audio times never
 * change; no names, facts, decimals or missing words are guessed or rewritten. */
export function reviewedAsrSpellings(text:string,words:SpeechWord[]){
 const normalized=normal(text), tokens=text.match(/\S+/gu)??[];
 const variants=new Map<string,string>();
 for(const token of tokens){const digits=normal(token);if(/^\d{1,4}$/u.test(digits))variants.set(integerWords(Number(digits)),digits);}
 let at=0;
 return words.map(word=>{
  const spoken=normal(word.text);let spelling=spoken;
  if(!normalized.startsWith(spelling,at)){
   const alternate=/^\d{1,4}$/u.test(spoken)?integerWords(Number(spoken)):variants.get(spoken);
   if(!alternate||!normalized.startsWith(alternate,at))throw new TgEditorialError('Il take non corrisponde al copione: trascrizione da verificare, nessuna riscrittura automatica');
   spelling=alternate;
  }
  at+=spelling.length;return {...word,text:spelling===spoken?word.text:spelling};
 });
}
export async function alignAlex2Pcm(file:string,texts:string[],pcm:Buffer,signal:AbortSignal){
 if(pcm.length>120*SPEECH_SAMPLE_RATE*2)throw new TgEditorialError('Passaggio Alex 2 oltre il limite di allineamento: nessuna stima sostitutiva');
 let raw:SpeechWord[]|undefined;
 try{raw=JSON.parse(await readFile(file+'.asr.json','utf8'));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw new TgEditorialError('Riscontro ASR non leggibile');}
 if(!raw){
  try{await writeFile(file+'.asr-attempt.json',JSON.stringify({startedAt:new Date().toISOString()}),{flag:'wx',mode:0o600});}
  catch{throw new TgEditorialError('Allineamento già richiesto con esito incerto: nessun nuovo addebito automatico');}
  raw=await openAiSpeechWordTimings({wave:wave(pcm),transcript:texts.join(' '),language:'it',signal});
  await writeFile(file+'.asr.json.partial',JSON.stringify(raw),{mode:0o600});await rename(file+'.asr.json.partial',file+'.asr.json');
 }
 const reviewed=reviewedAsrSpellings(texts.join(' '),raw);
 return punctuateSpeechWordAnchors(texts,coalesceSpeechWordAnchors(texts,reviewed,pcm.length/(SPEECH_SAMPLE_RATE*2)));
}
