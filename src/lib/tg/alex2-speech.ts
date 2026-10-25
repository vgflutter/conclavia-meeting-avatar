import 'server-only';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { elevenLabsSpeechPcm,ElevenLabsSpeechError } from '@conclavia/avatar-kit/speech/server';
import { buildWordAnchoredLipSync,punctuateSpeechWordAnchors, SPEECH_SAMPLE_RATE as RATE, type SpeechWord } from '@conclavia/avatar-kit/speech';
import {alignAlex2Pcm} from './alex2-alignment';
import {alex2ProofDirectory} from './alex2-proof';
import {wave} from './wave';
import { jobDirectory } from './artifacts';
import { alex2ConfigDigest, verifyAlex2Identity } from './alex2-config';
import { TgEditorialError } from './editorial';
import { DAILY_OPENING_PAUSE_SECONDS, insertDailyOpeningPause } from './opening-pause';
import { directDailyCueMotion } from './performance-direction';
import type { TgCue, TgSentence } from './types';

export function alex2Passages(sentences: TgSentence[]) {
  const groups: TgSentence[][] = [];
  for (const sentence of sentences) {
    const previous = groups.at(-1);
    if (previous && previous[0].speaker === sentence.speaker && previous[0].storyId === sentence.storyId
      && [...previous, sentence].map(s => s.text).join(' ').length <= 3600) previous.push(sentence);
    else groups.push([sentence]);
  }
  return groups;
}
export interface Alex2Passage { sentences: TgSentence[]; pcm: Buffer; words: SpeechWord[]; timingSource?:'elevenlabs-native-characters'|'whisper-1-verified-anchors' }
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
function validateTake(text: string, pcm: Buffer, words: SpeechWord[]) {
  const seconds = pcm.length / (RATE * 2);
  if (pcm.length < 2400 || pcm.length % 2 || seconds > 240 || !Array.isArray(words) || !words.length
    || words.some((w, i) => !w.text.trim() || !Number.isFinite(w.start) || !Number.isFinite(w.end)
      || w.start < 0 || w.end <= w.start || w.end > seconds + .02 || i > 0 && w.start < words[i - 1].end - .03)) throw new TgEditorialError('Take Alex 2 incompleto o non allineato: nessuna stima sostitutiva');
  try{punctuateSpeechWordAnchors([text],words);}catch{throw new TgEditorialError('Il take non contiene il copione completo');}
}

/** One continuous paragraph per story. Cache includes context/settings and a
 * durable attempt marker; interrupted/uncertain paid requests are not repeated. */
export async function recordAlex2Passages(id: string, sentences: TgSentence[], signal: AbortSignal): Promise<Alex2Passage[]> {
  const config = await verifyAlex2Identity(signal), groups = alex2Passages(sentences);
  const directory = path.join(jobDirectory(id), '.speech', 'alex2');
  await mkdir(directory, {recursive:true, mode:0o700});
  const parts: Alex2Passage[] = [];
  for (const [index, group] of groups.entries()) {
    signal.throwIfAborted();
    const text = group.map(s => s.text).join(' ');
    const previousText = groups[index - 1]?.map(s => s.text).join(' ').slice(-1800);
    const nextText = groups[index + 1]?.map(s => s.text).join(' ').slice(0, 1800);
    const key = digest(JSON.stringify({version:1,config:alex2ConfigDigest(config),text,previousText,nextText}));
    const file = path.join(directory, key), metadataFile = file + '.json';
    let take: {pcm:Buffer; words:SpeechWord[];timingSource?:Alex2Passage['timingSource']} | undefined;
    let metadata: {pcmSha256?:string; words:SpeechWord[];timingSource?:Alex2Passage['timingSource']} | undefined;
    try {
      metadata = JSON.parse(await readFile(metadataFile, 'utf8'));
      if(!metadata||typeof metadata!=='object'||!Array.isArray(metadata.words)||!metadata.pcmSha256)throw Error();
    }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new TgEditorialError('Cache Alex 2 non leggibile: revisione richiesta, nessun nuovo addebito'); }
    if (metadata) {
      try {
        const pcm = await readFile(file + '.pcm');
        if (digest(pcm) !== metadata.pcmSha256) throw Error();
        validateTake(text, pcm, metadata.words); take = {pcm, words:metadata.words,timingSource:metadata.timingSource};
      } catch { throw new TgEditorialError('Cache Alex 2 alterata o incompleta: nessuna rigenerazione automatica'); }
    }
    if (!take) {
      let savedResponse:string|undefined;
      try{savedResponse=await readFile(file+'.response.json','utf8');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw new TgEditorialError('Risposta vocale conservata non leggibile');}
      if(!savedResponse){
       try { await writeFile(file + '.attempt.json', JSON.stringify({version:1,requestSha256:key,startedAt:new Date().toISOString()}), {flag:'wx', mode:0o600}); }
       catch { throw new TgEditorialError('Richiesta Alex 2 già iniziata con esito non confermato: controllare prima di ripetere la sintesi'); }
      }
      try {
        try{
         const recorded = await elevenLabsSpeechPcm({text,voiceId:config.voiceId,model:config.model,language:'it',settings:config.settings,previousText,nextText,signal}, {apiKey:config.apiKey,fetcher:async(input,init)=>{
          if(savedResponse)return new Response(savedResponse,{headers:{'Content-Type':'application/json'}});
          const response=await fetch(input,init);if(!response.ok)return response;
          if(!response.body)throw Error();const reader=response.body.getReader(),chunks:Uint8Array[]=[];let bytes=0;
          try{for(;;){const next=await reader.read();if(next.done)break;bytes+=next.value.length;if(bytes>17000000)throw Error();chunks.push(next.value);}}
          finally{await reader.cancel().catch(()=>undefined);reader.releaseLock();}
          savedResponse=Buffer.concat(chunks).toString();await writeFile(file+'.response.json.partial',savedResponse,{mode:0o600});await rename(file+'.response.json.partial',file+'.response.json');
          return new Response(savedResponse,{headers:{'Content-Type':'application/json'}});
         }});
         take = {pcm:Buffer.from(recorded.pcm), words:recorded.words,timingSource:'elevenlabs-native-characters'};
        }catch(error){
         // Timing is validated after PCM by the canonical provider adapter.
         // Reuse that exact saved take, never ask ElevenLabs to synthesize it twice.
         if(!(error instanceof ElevenLabsSpeechError)||error.stage!=='timing'||!savedResponse)throw error;
         const pcm=Buffer.from(JSON.parse(savedResponse).audio_base64,'base64');
         take={pcm,words:await alignAlex2Pcm(file,group.map(s=>s.text),pcm,signal),timingSource:'whisper-1-verified-anchors'};
        }
        validateTake(text, take.pcm, take.words);
        await writeFile(file + '.pcm.partial', take.pcm, {mode:0o600}); await rename(file + '.pcm.partial', file + '.pcm');
        await writeFile(metadataFile + '.partial', JSON.stringify({version:1,pcmSha256:digest(take.pcm),words:take.words,timingSource:take.timingSource}), {mode:0o600});
        await rename(metadataFile + '.partial', metadataFile);
      } catch { throw new TgEditorialError('Registrazione Alex 2 non completata: take precedenti conservati; nessun cambio voce o nuovo tentativo a pagamento automatico'); }
    }
    parts.push({sentences:group,...take});
    if(take.pcm.length<=RATE*2*60){
     const proof=alex2ProofDirectory(),audio=wave(take.pcm);await mkdir(proof,{recursive:true,mode:0o700});
     await writeFile(path.join(proof,'take.wav.partial'),audio,{mode:0o600});await rename(path.join(proof,'take.wav.partial'),path.join(proof,'take.wav'));
     await writeFile(path.join(proof,'proof.json.partial'),JSON.stringify({version:2,checkedAt:new Date().toISOString(),configSha256:alex2ConfigDigest(config),text,seconds:take.pcm.length/(RATE*2),audioSha256:digest(audio),words:take.words,alignmentSource:take.timingSource??'elevenlabs-native-characters'}),{mode:0o600});await rename(path.join(proof,'proof.json.partial'),path.join(proof,'proof.json'));
    }
  }
  return parts;
}

/** Compose measured words first, edit the actual opening silence, then build
 * clause lip sync and semantic acting on that same clock. No time stretching. */
export function assembleAlex2Take(parts: Alex2Passage[], date: string) {
  const chunks: Buffer[] = [], clauses: {sentence:TgSentence; from:number; to:number}[] = [], allWords: SpeechWord[] = [];
  let offset = 0;
  for (const part of parts) {
    validateTake(part.sentences.map(s => s.text).join(' '), part.pcm, part.words);
    let cursor = 0;
    for (const sentence of part.sentences) {
      const norm=(s:string)=>s.normalize('NFKD').toLowerCase().replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]/gu,'');
      const expected=norm(sentence.text),from=allWords.length+cursor;let actual='';
      while(actual.length<expected.length&&cursor<part.words.length)actual+=norm(part.words[cursor++].text);
      if(actual!==expected)throw new TgEditorialError('Un intervallo vocale attraversa un cambio di mood');
      clauses.push({sentence,from,to:allWords.length+cursor});
    }
    allWords.push(...part.words.map(w => ({...w,start:w.start+offset,end:w.end+offset})));
    chunks.push(part.pcm, Buffer.alloc(Math.round(RATE * .18) * 2));
    offset += part.pcm.length / (RATE * 2) + .18;
  }
  const firstNews = clauses.findIndex(c => c.sentence.storyId !== 'intro');
  if (firstNews <= 0 || clauses.slice(firstNews).some(c => c.sentence.storyId === 'intro')) throw new TgEditorialError('Manca una sola introduzione completa prima delle notizie');
  const before = allWords[clauses[firstNews-1].to-1].end, after = allWords[clauses[firstNews].from].start;
  const edited = insertDailyOpeningPause(Buffer.concat(chunks), allWords, RATE, before, after, DAILY_OPENING_PAUSE_SECONDS);
  const cues: TgCue[] = clauses.map(({sentence,from,to}) => {
    const words = edited.words.slice(from,to), start = words[0].start, end = words.at(-1)!.end;
    const firstSample = Math.floor(start * RATE), lastSample = Math.min(edited.pcm.length/2, Math.ceil(end * RATE));
    const samples = new Float32Array(lastSample-firstSample);
    for (let i=0;i<samples.length;i++) samples[i] = edited.pcm.readInt16LE((firstSample+i)*2)/32768;
    const local = words.map(w => ({...w,start:Math.max(0,w.start-firstSample/RATE),end:Math.min(samples.length/RATE,w.end-firstSample/RATE)}));
    const acting = buildWordAnchoredLipSync(sentence.text,samples,RATE,local);
    const phones: NonNullable<TgCue['phones']> = [];
    acting.frames.forEach((frame,i) => {
      const at = i*acting.frameSeconds, until = Math.min(acting.durationSeconds,at+acting.frameSeconds), last = phones.at(-1);
      if (last?.viseme === frame.viseme) last.end = until; else phones.push({start:at,end:until,viseme:frame.viseme});
    });
    const anchor = sentence.gestureWord ? words.find(w => w.text.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'') === sentence.gestureWord!.toLowerCase()) : undefined;
    if (sentence.intent === 'point-down' && !anchor) throw new TgEditorialError('Gesto commenti senza la parola misurata: video fermato');
    return {...sentence,start,end,alignment:'word',frameSeconds:acting.frameSeconds,levels:acting.frames.map(f => f.level),phones,
      ...(sentence.intent ? {gestureAlignment:anchor?'word':'phrase',...(anchor?{gestureAccent:anchor.start-start}:{})} : {})} as TgCue;
  });
  directDailyCueMotion(cues,date);
  const seconds = Math.ceil((edited.pcm.length/(RATE*2)+1)*50)/50;
  return {pcm:edited.pcm,cues,seconds,openingPause:edited.edit,words:edited.words,timingSources:[...new Set(parts.map(p=>p.timingSource??'elevenlabs-native-characters'))]};
}
