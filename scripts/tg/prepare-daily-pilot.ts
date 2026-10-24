/** Bounded editorial pilot from one existing synthetic recording. No TTS,
 * database, scheduler, publisher, profile or selected launch-media mutation. */
import {mkdir,readFile,writeFile,copyFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {openAiSpeechWordTimings} from '@conclavia/avatar-kit/speech/server';
import {SPEECH_SAMPLE_RATE,coalesceSpeechWordAnchors,punctuateSpeechWordAnchors,alignSpeechSegments,buildWordAnchoredLipSync,type SpeechWord} from '@conclavia/avatar-kit/speech';
import {planPerformancePhrases,type PerformanceMood,type GestureIntent} from '@conclavia/avatar-kit/performance';
import type {TgPromoScene} from '@conclavia/avatar-kit/formats/tg';
import {command,wave} from '../../src/lib/tg/media';
import {dailyPerformanceDirection} from '../../src/lib/tg/performance-direction';
import {dailyApprovedAvatar,dailyApprovedStyleRevision} from '../../src/components/tg/daily-avatar-preset';
import {insertDailyOpeningPause} from '../../src/lib/tg/opening-pause';
type Score={id:string;kind:'daily-pilot';editionDate:string;language:'it';voice:string;title:string;description:string;researchCutoff:string;targetSeconds?:number;openingPauseSeconds?:number;speechModel?:string;actingSeed?:string;sources:{id:string;publisher:string;url:string;date:string;note:string}[];lines:{text:string;scene:string;mood:PerformanceMood;intensity:number;intent:GestureIntent;sourceIds:string[];thought?:string;gestureWord?:string}[];scenes:Omit<TgPromoScene,'start'|'end'>[]};
/** Keep the canonical ASR adapter's two-minute request bound. Long editions
 * are split at measured low-energy boundaries; completed parts are cached. */
async function pilotWordTimings(pcm:Buffer,text:string,root:string,sha:string){
 const total=pcm.length/2,words:SpeechWord[]=[];let start=0,part=0;
 while(start<total){
  // Balance the bounded chunks so the final invitation is not isolated in a
  // tiny tail, which is especially prone to ASR hallucination. Quiet-boundary
  // adjustment below remains based on the actual PCM, never on script ratios.
  const partsLeft=Math.ceil((total-start)/(80*SPEECH_SAMPLE_RATE));
  let end=partsLeft===1?total:start+Math.floor((total-start)/partsLeft);
  if(end<total){
   let quiet=Infinity,boundary=end;
   const window=Math.round(.12*SPEECH_SAMPLE_RATE);
   for(let at=end-4*SPEECH_SAMPLE_RATE;at<end-window;at+=Math.round(.02*SPEECH_SAMPLE_RATE)){
    let power=0;for(let j=at;j<at+window;j+=8){const x=pcm.readInt16LE(j*2);power+=x*x;}
    if(power<quiet){quiet=power;boundary=at+Math.floor(window/2);}
   }
   end=boundary;
  }
  const file=path.join(root,`${sha}.part-${part}-${start}-${end}.words.json`);
  let measured:SpeechWord[]=[];try{measured=JSON.parse(await readFile(file,'utf8'));}catch{}
  if(!measured.length){
   // The transcript is an ASR hint, not permission to recreate missing speech.
   // Do not send the opening as context for every later chunk: it can bias
   // boundary words and hallucinate phrases that never occur in that chunk.
   const textOffset=Math.floor(text.length*start/total),context=text.slice(Math.max(0,textOffset-160),textOffset+2200);
   measured=await openAiSpeechWordTimings({wave:wave(pcm.subarray(start*2,end*2)),transcript:context,language:'it',signal:AbortSignal.timeout(90000)},{fetcher:async(input,init)=>{
    const response=await fetch(input,init);
    if(response.ok){const body=await response.clone().text();if(body.length<=500000)await writeFile(file+'.asr-evidence.json',body,{mode:0o600});}
    return response;
   }});await writeFile(file,JSON.stringify(measured),{mode:0o600});
  }
  words.push(...measured.map(w=>({...w,start:w.start+start/SPEECH_SAMPLE_RATE,end:w.end+start/SPEECH_SAMPLE_RATE})));start=end;part++;
 }
 return words;
}
async function main(){
 const id=process.argv.find(v=>v.startsWith('--id='))?.slice(5),file=process.argv.find(v=>v.startsWith('--file='))?.slice(7);
 if(!process.argv.includes('--confirm')||process.env.TG_PUBLISH_ENABLED!=='false'||!id||!/^\d{4}-\d{2}-\d{2}-it-pilot(?:-r[1-9]\d*)?$/u.test(id)||!file||!path.isAbsolute(file))throw Error('Explicit isolated Daily pilot import required');
 const score=JSON.parse(await readFile(path.join('scripts/tg/editions',id+'.json'),'utf8')) as Score;
 if(score.id!==id||score.kind!=='daily-pilot'||score.language!=='it'||score.editionDate!==id.slice(0,10)||score.lines.length>60)throw Error('Invalid reviewed edition score');
 const text=score.lines.map(l=>l.text).join(' ');
 if(text.length>7500||score.lines.some(l=>l.sourceIds.some(s=>!score.sources.some(source=>source.id===s))))throw Error('Script length/source references invalid');
 const info=await stat(file);if(!info.isFile()||info.size>12000000)throw Error('Recording exceeds import bounds');
 const root=path.resolve('.tg-artifacts/.launch-promo/editions',id),out=path.resolve('public/daily-launch/editions',id);
 await mkdir(root,{recursive:true,mode:0o700});await mkdir(out,{recursive:true});
 const source=await readFile(file),sha256=createHash('sha256').update(source).digest('hex');await copyFile(file,path.join(root,path.extname(file)==='.wav'?'source.wav':'source.mp3'));
 await command('ffmpeg',['-y','-v','error','-i',file,'-ar',String(SPEECH_SAMPLE_RATE),'-ac','1','-f','s16le',path.join(root,'source.pcm')],AbortSignal.timeout(30000));
 let pcm:Buffer=await readFile(path.join(root,'source.pcm'));let spokenSeconds=pcm.length/(SPEECH_SAMPLE_RATE*2);
 if(spokenSeconds<30||spokenSeconds>420)throw Error('Pilot recording must contain 30–420 seconds of actual speech');
 const cache=path.join(root,sha256+'.words.json');let originalWords:SpeechWord[]=[];
 try{originalWords=JSON.parse(await readFile(cache,'utf8'));}catch{}
 if(!originalWords.length){
  if(!process.argv.includes('--align'))throw Error('No cached word timing. Explicit --align permits one transcription of this public synthetic take.');
  originalWords=spokenSeconds<=120&&text.length<=4000?await openAiSpeechWordTimings({wave:wave(pcm),transcript:text,language:'it',signal:AbortSignal.timeout(90000)},{fetcher:async(input,init)=>{
   const response=await fetch(input,init);
   if(response.ok){const body=await response.clone().text();if(body.length<=500000)await writeFile(cache+'.asr-evidence.json',body,{mode:0o600});}
   return response;
  }}):await pilotWordTimings(pcm,text,root,sha256);
  await writeFile(cache,JSON.stringify(originalWords),{mode:0o600});
 }
 // Explicit, recording-bound editorial spelling review. Keep raw ASR evidence
 // and every measured time unchanged; never infer missing speech or intervals.
 let wordReview:{version:number;sourceSha256:string;replacements:{index:number;from:string;to:string;reason:string}[]}|undefined;
 if(process.argv.includes('--word-review')){
  wordReview=JSON.parse(await readFile(path.join(root,'word-review.json'),'utf8'));
  if(!wordReview||wordReview.version!==1||wordReview.sourceSha256!==sha256||!Array.isArray(wordReview.replacements))throw Error('Word review does not match this recording');
 }
 const reviewedWords=originalWords.map(w=>({...w})),reviewedIndices=new Set<number>();
 for(const edit of wordReview?.replacements??[]){
  if(!Number.isInteger(edit.index)||reviewedIndices.has(edit.index)||reviewedWords[edit.index]?.text!==edit.from||!edit.to?.trim()||!edit.reason?.trim())throw Error('Invalid explicit word spelling review');
  reviewedWords[edit.index].text=edit.to;reviewedIndices.add(edit.index);
 }
 let words=punctuateSpeechWordAnchors(score.lines.map(l=>l.text),coalesceSpeechWordAnchors(score.lines.map(l=>l.text),reviewedWords,spokenSeconds));
 let timings=alignSpeechSegments(score.lines.map(l=>l.text),words,spokenSeconds);
 let openingPause:ReturnType<typeof insertDailyOpeningPause>['edit']|undefined;
 let introEnd:number|undefined;
 if(score.openingPauseSeconds!==undefined){
  const firstBody=score.lines.findIndex(l=>l.scene!=='apertura');
  if(firstBody<1||timings.some(t=>t.alignment!=='word'))throw Error('Opening pause needs a complete measured introduction');
  const boundary=timings[firstBody].start,before=words.filter(w=>w.start<boundary-.001).at(-1),after=words.find(w=>w.start>=boundary-.001);
  if(!before||!after)throw Error('Missing measured words at the opening handoff');
  const edited=insertDailyOpeningPause(pcm,words,SPEECH_SAMPLE_RATE,before.end,after.start,score.openingPauseSeconds);
  pcm=edited.pcm;words=edited.words;spokenSeconds=pcm.length/(SPEECH_SAMPLE_RATE*2);openingPause=edited.edit;introEnd=before.end;
  timings=alignSpeechSegments(score.lines.map(l=>l.text),words,spokenSeconds);
  timings[firstBody-1].end=introEnd;
  await writeFile(path.join(root,'opening-pause.json'),JSON.stringify(openingPause,null,2)+'\n');
 }
 await writeFile(path.join(root,'alignment-review.json'),JSON.stringify({text,spokenSeconds,originalWords,wordReview,words,timings},null,2),{mode:0o600});
 if(timings.some(t=>t.alignment!=='word'))throw Error('Full script/recording alignment needs review; no approximate fabricated timings allowed');
 if(process.argv.includes('--timing-only')){console.log(JSON.stringify({id,spokenSeconds,segments:timings.length,timingOnly:true,sourceSha256:sha256}));return;}
 const lead=.18,naturalDuration=Math.ceil((spokenSeconds+lead+2.4)*25)/25;
 if(score.targetSeconds!==undefined&&(!Number.isInteger(score.targetSeconds)||score.targetSeconds<60||score.targetSeconds>420))throw Error('Invalid target clock');
 const duration=score.targetSeconds??naturalDuration;
 if(duration<spokenSeconds+lead+1||duration-spokenSeconds>8)throw Error(`The actual take (${spokenSeconds.toFixed(2)} s) does not fit the ${duration}-second clock without rewriting or excessive silence`);
 const groups:{indices:number[]}[]=[];
 score.lines.forEach((line,i)=>{const last=groups.at(-1),prior=last?score.lines[last.indices.at(-1)!]:undefined;
  if(last&&line.thought&&prior?.thought===line.thought&&prior.scene===line.scene)last.indices.push(i);else groups.push({indices:[i]});});
 const plans=planPerformancePhrases(groups.map(({indices})=>{const first=indices[0],last=indices.at(-1)!,line=score.lines[first],start=timings[first].start,end=timings[last].end;
  if(end-start>60)throw Error('A continuous thought must fit a sixty-second performance window');
  const gestures=new Set(indices.map(i=>score.lines[i].gestureWord?.toLocaleLowerCase('it-IT')).filter(Boolean));
  return {cueId:id+':'+first,mood:line.mood,intensity:line.intensity,intent:line.intent,startSeconds:lead+start,durationSeconds:end-start,
   ...(indices.length>1?{segments:indices.map(i=>({cueId:'clause-'+i,startSeconds:timings[i].start-start,endSeconds:timings[i].end-start,
    mood:score.lines[i].mood,intensity:score.lines[i].intensity,intent:score.lines[i].intent,
    accents:words.filter(w=>w.start>=timings[i].start&&w.end<=timings[i].end&&gestures.has(w.text.toLocaleLowerCase('it-IT').replace(/[^\p{L}]/gu,''))).map(w=>(w.start+w.end)/2-timings[i].start)}))}:{}),
   accents:words.filter(w=>w.start>=start&&w.end<=end&&gestures.has(w.text.toLocaleLowerCase('it-IT').replace(/[^\p{L}]/gu,''))).map(w=>(w.start+w.end)/2-start)};
 }),{seed:score.actingSeed??id,actorId:'promo-host',...dailyPerformanceDirection});
 const planned=new Map(groups.flatMap(({indices},group)=>indices.map(i=>[i,{choreography:plans[group],...(indices.length>1?{performanceWindow:{start:lead+timings[indices[0]].start,end:lead+timings[indices.at(-1)!].end}}:{})}] as const)));
 const cues=score.lines.map((line,i)=>{
  const t=timings[i],a=Math.floor(t.start*SPEECH_SAMPLE_RATE),b=Math.min(pcm.length/2,Math.floor(t.end*SPEECH_SAMPLE_RATE)),samples=new Float32Array(b-a);
  for(let j=0;j<samples.length;j++)samples[j]=pcm.readInt16LE((a+j)*2)/32768;
  const localWords=words.filter(w=>w.start>=t.start-.001&&w.start<t.end-.001).map(w=>({...w,start:Math.max(0,w.start-a/SPEECH_SAMPLE_RATE),end:Math.min(samples.length/SPEECH_SAMPLE_RATE,w.end-a/SPEECH_SAMPLE_RATE)}));
  const lips=buildWordAnchoredLipSync(line.text,samples,SPEECH_SAMPLE_RATE,localWords);
  return {...line,start:lead+t.start,end:lead+t.end,frameSeconds:lips.frameSeconds,levels:lips.frames.map(f=>f.level),phones:lips.frames.map((f,n)=>({start:n*lips.frameSeconds,end:(n+1)*lips.frameSeconds,viseme:f.viseme})),alignment:t.alignment,...planned.get(i)};
 });
 const scenes=score.scenes.map((scene,i)=>{const current=cues.find(c=>c.scene===scene.id),next=score.scenes[i+1],nextCue=next?cues.find(c=>c.scene===next.id):undefined;if(!current)throw Error('Scene lacks measured narration');return {...scene,start:i?current.start:0,end:nextCue?.start??duration};});
 const manifest={version:1,...score,brandLabel:'CDaily',visualStyle:'clean',captionMode:'separate',styleReference:dailyApprovedStyleRevision,avatarFinish:dailyApprovedAvatar.finish,avatarPosture:dailyApprovedAvatar.posture,avatarHands:dailyApprovedAvatar.handStyle,claim:'Meno rumore.\nPiù contesto.',cta:'Seguici per notizie e approfondimenti',url:'daily.conclavia.me',disclosure:'',duration,spokenSeconds,...(openingPause?{openingPause:{...openingPause,atSeconds:lead+openingPause.atSeconds,spokenIntroEndsAt:lead+introEnd!}}:{}),speechProvider:'elevenlabs',speechModel:score.speechModel??'eleven_v4',wordTimingSource:'whisper-1-asr-coalesced-anchors',sourceSha256:sha256,voice:score.voice+' · ElevenLabs',previewOnly:true,rightsStatus:'Private review; voice plan at creation documented in the edition dossier',cues,scenes,words:words.map(w=>({...w,start:lead+w.start,end:lead+w.end}))};
 await writeFile(path.join(root,'raw.wav'),wave(Buffer.concat([Buffer.alloc(Math.round(lead*SPEECH_SAMPLE_RATE)*2),pcm])),{mode:0o600});
 await command('ffmpeg',['-y','-v','error','-i',path.join(root,'raw.wav'),'-af',`apad,atrim=duration=${duration},loudnorm=I=-16:TP=-1.8:LRA=9`,'-ar',String(SPEECH_SAMPLE_RATE),path.join(root,'voice.wav')],AbortSignal.timeout(30000));
 await writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
 await writeFile(path.join(out,'caption.txt'),score.title+'\n\n'+score.description+'\n\n'+score.sources.map(s=>s.publisher+' · '+s.date+'\n'+s.url).join('\n\n'));
 await writeFile(path.join(out,'script.txt'),score.lines.map(l=>l.text).join('\n\n')+'\n');
 console.log(JSON.stringify({id,duration,spokenSeconds,segments:cues.length,scenes:scenes.length,moods:[...new Set(cues.map(c=>c.mood))],alignment:'measured ASR, approximate word anchors',ttsCalls:0,published:false}));
}
void main().catch(e=>{console.error(e instanceof Error?e.message:'Daily pilot preparation failed',e&&typeof e==='object'&&'status' in e?{status:e.status,stage:e.stage}:{});process.exitCode=1;});
