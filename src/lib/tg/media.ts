import 'server-only';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { writeFile, readFile, rename, mkdir } from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import { inworldSpeechResponse } from '@conclavia/avatar-kit/speech/server';
import { readSpeechLines, SPEECH_SAMPLE_RATE, alignSpeechSegments, type SpeechFrame, type SpeechWord, type SpeechPhone } from '@conclavia/avatar-kit/speech';
import { buildAudioLipSync } from '@conclavia/avatar-kit/speech';
import { jobDirectory, inspectArtifact, writeArtifact } from './artifacts';
import { captionsVtt } from './timeline';
import {tgSpeechPlan,directedTgPassage,tgSpeechPassages} from './speech-plan';
import type { TgAsset, TgCue, TgManifest, TgProduct, TgResearch, TgScript } from './types';
import {directDailyCueMotion} from './performance-direction';
import {scoredNarration} from './script-review';
import { assembleAlex2Take, recordAlex2Passages } from './alex2-speech';
import { dailyRenderFps, naturalDailyClock } from './media-contract';
import { alex2Config, alex2ConfigDigest } from './alex2-config';
import {wave} from './wave';
export {wave} from './wave';
export async function command(file: string, args: string[], signal: AbortSignal) {
  const child = spawn(file, args, { stdio: ['ignore', 'pipe', 'pipe'], signal });
  let output = '', error = '';
  child.stdout.on('data', b => { output = (output + String(b)).slice(-100000); });
  child.stderr.on('data', b => { error = (error + String(b)).slice(-3000); });
  const [code] = await once(child, 'close');
  if (code !== 0) throw new Error(`${path.basename(file)}: elaborazione media non riuscita (${code}); ${error.includes('No such file') ? 'file non disponibile' : 'verificare il worker'}`);
  return output;
}
export class TgDurationError extends Error { constructor(public ratio: number, public actualSeconds: number) { super('Il parlato richiede una revisione del minutaggio'); } }
export async function synthesize(id: string, product: TgProduct, date: string, research: TgResearch, script: TgScript, signal: AbortSignal, options:{naturalDuration?:boolean}={}): Promise<TgManifest> {
  if (process.env.PODCAST_SPEECH_ENABLED !== 'true') throw new Error('Voci TG non abilitate');
  const narration=scoredNarration(script);
  const speech=tgSpeechPlan(product),cache=path.join(jobDirectory(id),'.speech');
  await mkdir(cache,{recursive:true,mode:0o700});
  await writeFile(path.join(jobDirectory(id),'narration.txt'),narration.narrationText,{mode:0o600});
  await writeFile(path.join(jobDirectory(id),'performance-score.txt'),narration.scoreMarkup,{mode:0o600});
  if (naturalDailyClock(product)) {
    if (product.edition !== 'it' || product.language !== 'it' || product.presenters !== 1) throw new Error('Alex 2 è approvato per Italia con un presentatore; configurare separatamente gli altri cast');
    const voiceConfigSha256=alex2ConfigDigest(alex2Config());
    const take = assembleAlex2Take(await recordAlex2Passages(id,narration.sentences,signal),date);
    if(take.seconds<180||take.seconds>420)throw new TgDurationError(take.seconds/product.seconds,take.seconds);
    const dir=jobDirectory(id);
    await writeFile(path.join(dir,'raw.wav'),wave(take.pcm),{mode:0o600});
    await writeFile(path.join(dir,'word-timings.json'),JSON.stringify({version:1,sources:take.timingSources,words:take.words}),{mode:0o600});
    await command('ffmpeg',['-y','-v','error','-i',path.join(dir,'raw.wav'),'-af',`apad=pad_dur=2,atrim=duration=${take.seconds},loudnorm=I=-16:TP=-1.5:LRA=11`,'-ar',String(SPEECH_SAMPLE_RATE),path.join(dir,'track.wav')],signal);
    return {...editionManifest(product,date,research,script,take.cues,take.seconds),speech,fps:50,voiceConfigSha256,lipSync:'word-anchored-estimate',openingPause:take.openingPause};
  }
  const chunks: Buffer[] = [], measured:TgCue[]=[]; let offset=0;
  for (const passage of tgSpeechPassages(narration.sentences)) {
    signal.throwIfAborted();
    const request={text:directedTgPassage(passage,product.language),language:product.language,voiceId:speech.voices[passage[0].speaker],model:speech.model,speakingRate:speech.speakingRate,signal};
    if(!request.voiceId)throw new Error('Voce del conduttore non configurata');
    const cached=path.join(cache,createHash('sha256').update(JSON.stringify({...request,signal:undefined})).digest('hex')+'.pcm');
    let pcm:Buffer|undefined, words:SpeechWord[]=[], nativePhones:SpeechPhone[]=[];
    try{const data=await readFile(cached);if(data.length>=2400&&data.length%2===0&&data.length<=SPEECH_SAMPLE_RATE*2*45)pcm=data;}catch{}
    if(pcm)try{const metadata=JSON.parse(await readFile(cached+'.json','utf8'));if(Array.isArray(metadata.words))words=metadata.words;if(Array.isArray(metadata.phones))nativePhones=metadata.phones;}catch{}
    if(!pcm){
    const response = await inworldSpeechResponse({...request,model:'inworld-tts-2'});
    if (!response.body) throw new Error('Audio TG vuoto');
    const pieces: Buffer[] = []; let done = false, bytes = 0;
    for await (const rawFrame of readSpeechLines(response.body)) {
      const frame = rawFrame as SpeechFrame;
      if (frame.error) throw new Error('Stream TG interrotto');
      if (frame.audio) { const chunk = Buffer.from(frame.audio, 'base64'); bytes += chunk.length; if (bytes > SPEECH_SAMPLE_RATE * 2 * 45) throw new Error('Segmento audio troppo lungo'); pieces.push(chunk); }
      if(frame.words)words.push(...frame.words);
      if(frame.phones)nativePhones.push(...frame.phones);
      if (frame.done === true) done = true;
    }
    if (!done || bytes < 2400 || bytes % 2) throw new Error('Audio TG incompleto');
    pcm=Buffer.concat(pieces);await writeFile(cached,pcm,{mode:0o600});await writeFile(cached+'.json',JSON.stringify({words,phones:nativePhones}),{mode:0o600});
    }
    const passageSeconds=pcm.length/(SPEECH_SAMPLE_RATE*2),timings=alignSpeechSegments(passage.map(s=>s.text),words,passageSeconds);
    for(let index=0;index<passage.length;index++){
    const sentence=passage[index],timing=timings[index],startSample=Math.floor(timing.start*SPEECH_SAMPLE_RATE),endSample=Math.min(pcm.length/2,Math.floor(timing.end*SPEECH_SAMPLE_RATE));
    const floats = new Float32Array(Math.max(0,endSample-startSample));
    for (let i = 0; i < floats.length; i++) floats[i] = pcm.readInt16LE((startSample+i) * 2) / 32768;
    const acting = buildAudioLipSync(sentence.text, floats, SPEECH_SAMPLE_RATE);
    const levels: number[] = [], phones: {start: number; end: number; viseme: string}[] = [];
    acting.frames.forEach((f, i) => { const start = i * acting.frameSeconds, end = Math.min(acting.durationSeconds, (i + 1) * acting.frameSeconds); const level = floats.subarray(Math.floor(start * SPEECH_SAMPLE_RATE), Math.floor(end * SPEECH_SAMPLE_RATE)); let power = 0; for (const sample of level) power += sample * sample; levels.push(Math.min(1, Math.sqrt(power / Math.max(1, level.length)) * 7)); const last = phones.at(-1); if (last?.viseme === f.viseme) last.end = end; else phones.push({ start, end, viseme: f.viseme }); });
    const alignedPhones=nativePhones.filter(p=>p.end>timing.start&&p.start<timing.end).map(p=>({...p,start:Math.max(0,p.start-timing.start),end:Math.min(timing.end-timing.start,p.end-timing.start)}));
    const anchor=sentence.gestureWord?words.find(w=>w.start>=timing.start-.01&&w.start<timing.end&&w.text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().split(' ').includes(sentence.gestureWord!.toLocaleLowerCase())):undefined;
    const gesture=sentence.intent?{gestureAlignment:anchor?'word' as const:'phrase' as const,...(anchor?{gestureAccent:Math.max(0,anchor.start-timing.start)}:{})}:{};
    measured.push({...sentence,...gesture,start:offset+timing.start,end:offset+timing.end,alignment:timing.alignment,levels,phones:alignedPhones.length?alignedPhones:phones,frameSeconds:acting.frameSeconds});
    }
    chunks.push(pcm, Buffer.alloc(Math.round(SPEECH_SAMPLE_RATE * .18) * 2));
    offset+=passageSeconds+.18;
  }
  const raw = Buffer.concat(chunks), rawSeconds = raw.length / (SPEECH_SAMPLE_RATE * 2), seconds=options.naturalDuration?Math.max(60,Math.ceil(rawSeconds+1)):product.seconds,ratio = options.naturalDuration?1:rawSeconds / (product.seconds - 2);
  if(seconds>600)throw new TgDurationError(ratio,rawSeconds);
  // The offline format can rewrite its copy instead of noticeably warping a voice.
  if (!options.naturalDuration&&(ratio < .95 || ratio > 1.05)) throw new TgDurationError(ratio, rawSeconds);
  const dir = jobDirectory(id); await mkdir(dir, { recursive: true, mode: 0o700 });
  await writeFile(path.join(dir, 'raw.wav'), wave(raw), { mode: 0o600 });
  const tempo=Math.abs(ratio-1)<1e-8?'':`atempo=${ratio},`;
  await command('ffmpeg', ['-y', '-v', 'error', '-i', path.join(dir, 'raw.wav'), '-af', `${tempo}apad=pad_dur=2,atrim=duration=${seconds},loudnorm=I=-16:TP=-1.5:LRA=11`, '-ar', String(SPEECH_SAMPLE_RATE), path.join(dir, 'track.wav')], signal);
  const cues:TgCue[] = measured.map(c => ({...c,...(c.gestureAccent!==undefined?{gestureAccent:c.gestureAccent/ratio}:{}),start:c.start/ratio,end:c.end/ratio,frameSeconds:c.frameSeconds!/ratio,phones:c.phones!.map(p=>({...p,start:p.start/ratio,end:p.end/ratio}))}));
  directDailyCueMotion(cues,date);
  return {...editionManifest({...product,seconds},date,research,script,cues,seconds),speech};
}
function editionManifest(product:TgProduct,date:string,research:TgResearch,script:TgScript,cues:TgCue[],seconds:number):TgManifest {
  const order=[...new Set(script.sentences.map(s=>s.storyId))];
  return {version:1,product,date,seconds,cues,sources:research.sources,stories:research.stories.filter(s=>order.includes(s.id))
    .sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id)).map(s=>({...s,headline:script.headlines?.find(h=>h.storyId===s.id)?.title??product.name,
      whyItMatters:script.cards?.find(c=>c.storyId===s.id)?.context??'',changedSinceYesterday:script.cards?.find(c=>c.storyId===s.id)?.change??''}))};
}
export async function renderMedia(id: string, manifest: TgManifest, signal: AbortSignal): Promise<TgAsset[]> {
  const { chromium } = await import('@playwright/test');
  const origin = new URL(process.env.TG_RENDER_ORIGIN || 'http://127.0.0.1:3105');
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/') throw new Error('Origine renderer TG non valida');
  const browser = await chromium.launch({ ...(process.env.TG_CHROME_CHANNEL ? { channel: process.env.TG_CHROME_CHANNEL } : {}) });
  const dir = jobDirectory(id); await mkdir(dir, { recursive: true, mode: 0o700 });
  const assets: TgAsset[] = [];
  const fps=dailyRenderFps(manifest.product);
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.route('**/*',route=>route.request().method()==='GET'&&new URL(route.request().url()).origin===origin.origin?route.continue():route.abort());
    const renderPath=process.env.TG_RENDER_PATH||'/podcast/tg/render';
    if(!/^\/[a-zA-Z0-9/_-]+\/?$/u.test(renderPath))throw new Error('Percorso renderer non valido');
    await page.goto(new URL(renderPath, origin).toString());
    await page.waitForFunction(() => Boolean((window as unknown as {conclaviaTgRender?: unknown}).conclaviaTgRender));
    for (const portrait of [false, true]) {
      signal.throwIfAborted();
      await page.evaluate(({ manifest, portrait }) => (window as unknown as {conclaviaTgRender: {prepare(m: unknown, p: boolean): void}}).conclaviaTgRender.prepare(manifest, portrait), { manifest, portrait });
      const name = portrait ? 'portrait.mp4' as const : 'landscape.mp4' as const, temporary = path.join(dir, name + '.partial.mp4');
      const encoder = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-vcodec', 'mjpeg', '-i', 'pipe:0', '-i', path.join(dir, 'track.wav'), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-t', String(manifest.seconds), '-movflags', '+faststart', temporary], { stdio: ['pipe', 'ignore', 'pipe'], signal });
      encoder.stderr.resume(); const closed = once(encoder, 'close');
      try { for (let frame = 0; frame < Math.round(manifest.seconds * fps); frame+=12) {
        signal.throwIfAborted();
        const batch=await page.evaluate(({from,count,fps})=>{
         const api=(window as unknown as {conclaviaTgRender:{frame(t:number):string;sample?():{texts?:{overflow:boolean}[]}}}).conclaviaTgRender;
         const frames:string[]=[];for(let i=0;i<count;i++){frames.push(api.frame((from+i)/fps));if(api.sample?.().texts?.some(t=>t.overflow))throw Error('Testo oltre il layout approvato');}return frames;
        },{from:frame,count:Math.min(12,Math.round(manifest.seconds*fps)-frame),fps});
        for(const data of batch)if (!encoder.stdin.write(Buffer.from(data, 'base64'))) await Promise.race([once(encoder.stdin, 'drain'),closed.then(()=>{throw new Error('Encoder TG interrotto durante il rendering');})]);
      } encoder.stdin.end(); const [code] = await closed; if (code !== 0) throw new Error('Encoder TG non riuscito'); }
      catch (error) { encoder.kill('SIGTERM'); await closed.catch(() => undefined); throw error; }
      const probe = JSON.parse(await command('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=width,height,codec_name,avg_frame_rate', '-of', 'json', temporary], signal));
      const video=probe.streams.find((s:{codec_name:string})=>s.codec_name==='h264'), rate=String(video?.avg_frame_rate).split('/').map(Number);
      if(!Number.isFinite(rate[0]/rate[1])||Math.abs(rate[0]/rate[1]-fps)>.01)throw new Error('Frequenza video TG non conforme');
      const duration = Number(probe.format.duration);
      if (Math.abs(duration - manifest.seconds) > .1 || !probe.streams.some((s: {codec_name: string}) => s.codec_name === 'aac') || !probe.streams.some((s: {codec_name: string; width: number; height: number}) => s.codec_name === 'h264' && s.width === (portrait ? 1080 : 1920) && s.height === (portrait ? 1920 : 1080))) throw new Error('Durata o formato TG non conformi');
      await rename(temporary, path.join(dir, name)); assets.push(await inspectArtifact(id, name, duration));
    }
  } finally { await browser.close(); }
  await command('ffmpeg', ['-y', '-v', 'error', '-i', path.join(dir, 'track.wav'), '-c:a', 'libmp3lame', '-b:a', '160k', path.join(dir, 'audio.mp3')], signal);
  assets.push(await inspectArtifact(id, 'audio.mp3', manifest.seconds));
  assets.push(await writeArtifact(id, 'captions.vtt', captionsVtt(manifest)));
  assets.push(await writeArtifact(id, 'manifest.json', JSON.stringify(manifest)));
  return assets;
}
