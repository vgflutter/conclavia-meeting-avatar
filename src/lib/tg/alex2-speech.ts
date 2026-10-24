import 'server-only';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { elevenLabsSpeechPcm } from '@conclavia/avatar-kit/speech/server';
import { buildWordAnchoredLipSync, SPEECH_SAMPLE_RATE as RATE, type SpeechWord } from '@conclavia/avatar-kit/speech';
import { jobDirectory } from './artifacts';
import { alex2ConfigDigest, verifyAlex2Identity } from './alex2-config';
import { TgEditorialError } from './editorial';
import { insertDailyOpeningPause } from './opening-pause';
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
export interface Alex2Passage { sentences: TgSentence[]; pcm: Buffer; words: SpeechWord[] }
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
function validateTake(text: string, pcm: Buffer, words: SpeechWord[]) {
  const tokens = text.match(/\S+/gu) ?? [], seconds = pcm.length / (RATE * 2);
  if (pcm.length < 2400 || pcm.length % 2 || seconds > 240 || !Array.isArray(words) || words.length !== tokens.length
    || words.some((w, i) => w.text !== tokens[i] || !Number.isFinite(w.start) || !Number.isFinite(w.end)
      || w.start < 0 || w.end <= w.start || w.end > seconds + .02 || i > 0 && w.start < words[i - 1].end - .03)) throw new TgEditorialError('Take Alex 2 incompleto o non allineato: nessuna stima sostitutiva');
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
    let take: {pcm:Buffer; words:SpeechWord[]} | undefined;
    let metadata: {pcmSha256?:string; words:SpeechWord[]} | undefined;
    try {
      metadata = JSON.parse(await readFile(metadataFile, 'utf8'));
      if(!metadata||typeof metadata!=='object'||!Array.isArray(metadata.words)||!metadata.pcmSha256)throw Error();
    }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new TgEditorialError('Cache Alex 2 non leggibile: revisione richiesta, nessun nuovo addebito'); }
    if (metadata) {
      try {
        const pcm = await readFile(file + '.pcm');
        if (digest(pcm) !== metadata.pcmSha256) throw Error();
        validateTake(text, pcm, metadata.words); take = {pcm, words:metadata.words};
      } catch { throw new TgEditorialError('Cache Alex 2 alterata o incompleta: nessuna rigenerazione automatica'); }
    }
    if (!take) {
      try { await writeFile(file + '.attempt.json', JSON.stringify({version:1,requestSha256:key,startedAt:new Date().toISOString()}), {flag:'wx', mode:0o600}); }
      catch { throw new TgEditorialError('Richiesta Alex 2 già iniziata con esito non confermato: controllare prima di ripetere la sintesi'); }
      try {
        const recorded = await elevenLabsSpeechPcm({text,voiceId:config.voiceId,model:config.model,language:'it',settings:config.settings,previousText,nextText,signal}, {apiKey:config.apiKey});
        take = {pcm:Buffer.from(recorded.pcm), words:recorded.words}; validateTake(text, take.pcm, take.words);
        await writeFile(file + '.pcm.partial', take.pcm, {mode:0o600}); await rename(file + '.pcm.partial', file + '.pcm');
        await writeFile(metadataFile + '.partial', JSON.stringify({version:1,pcmSha256:digest(take.pcm),words:take.words}), {mode:0o600});
        await rename(metadataFile + '.partial', metadataFile);
      } catch { throw new TgEditorialError('Registrazione Alex 2 non completata: take precedenti conservati; nessun cambio voce o nuovo tentativo a pagamento automatico'); }
    }
    parts.push({sentences:group,...take});
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
      const count = (sentence.text.match(/\S+/gu) ?? []).length, from = allWords.length + cursor;
      clauses.push({sentence,from,to:from+count}); cursor += count;
    }
    allWords.push(...part.words.map(w => ({...w,start:w.start+offset,end:w.end+offset})));
    chunks.push(part.pcm, Buffer.alloc(Math.round(RATE * .18) * 2));
    offset += part.pcm.length / (RATE * 2) + .18;
  }
  const firstNews = clauses.findIndex(c => c.sentence.storyId !== 'intro');
  if (firstNews <= 0 || clauses.slice(firstNews).some(c => c.sentence.storyId === 'intro')) throw new TgEditorialError('Manca una sola introduzione completa prima delle notizie');
  const before = allWords[clauses[firstNews-1].to-1].end, after = allWords[clauses[firstNews].from].start;
  const edited = insertDailyOpeningPause(Buffer.concat(chunks), allWords, RATE, before, after, 2);
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
  return {pcm:edited.pcm,cues,seconds,openingPause:edited.edit,words:edited.words};
}
