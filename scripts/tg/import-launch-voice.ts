/** Import one approved recording. No TTS, publishing or saved-profile changes. */
import {mkdir,readFile,writeFile,copyFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {openAiSpeechWordTimings} from '@conclavia/avatar-kit/speech/server';
import {SPEECH_SAMPLE_RATE,alignSpeechSegments,coalesceSpeechWordAnchors,buildAudioLipSync,type SpeechWord} from '@conclavia/avatar-kit/speech';
import {dailyLaunch} from '../../src/components/tg/daily-launch-storyboard';
import {command,wave} from '../../src/lib/tg/media';

let stage='validation';
async function main(){
 if(!process.argv.includes('--confirm')||process.env.TG_PUBLISH_ENABLED!=='false')throw Error('Explicit import with publication disabled required');
 const input=process.argv.find(a=>a.startsWith('--file='))?.slice(7);
 if(!input||!path.isAbsolute(input))throw Error('An absolute path to the approved recording is required');
 const info=await stat(input);if(!info.isFile()||info.size>12000000)throw Error('Recording exceeds import bounds');
 const source=await readFile(input),sha256=createHash('sha256').update(source).digest('hex');
 const privateBase=path.resolve('.tg-artifacts/.launch-promo'),publicBase=path.resolve('public/daily-launch');
 const root=path.resolve(process.env.TG_LAUNCH_VOICE_DIR??'.tg-artifacts/.launch-promo/voices/alex-v4'),out=path.resolve(process.env.TG_LAUNCH_DIR??'public/daily-launch/voices/alex-v4');
 if(!root.startsWith(privateBase+path.sep)||(out!==publicBase&&!out.startsWith(publicBase+path.sep)))throw Error('Import destinations must remain inside the launch cache and public launch directory');
 await mkdir(root,{recursive:true,mode:0o700});await mkdir(out,{recursive:true});
 await copyFile(input,path.join(root,'source.mp3'));
 const probe=JSON.parse(await command('ffprobe',['-v','error','-show_entries','format=duration','-of','json',input],AbortSignal.timeout(15000)));
 const inputSeconds=Number(probe.format.duration);if(!Number.isFinite(inputSeconds)||inputSeconds<5||inputSeconds>57)throw Error('Recording must be between 5 and 57 seconds');
 await command('ffmpeg',['-y','-v','error','-i',input,'-ar',String(SPEECH_SAMPLE_RATE),'-ac','1','-f','s16le',path.join(root,'source.pcm')],AbortSignal.timeout(15000));
 const pcm=await readFile(path.join(root,'source.pcm')),spokenSeconds=pcm.length/(SPEECH_SAMPLE_RATE*2),text=dailyLaunch.lines.map(l=>l.text).join(' ');
 if(process.argv.includes('--prepare-only')){
  await writeFile(path.join(root,'import.json'),JSON.stringify({sha256,spokenSeconds,text,speechProvider:'elevenlabs',speechModel:dailyLaunch.model,voice:dailyLaunch.voice,published:false},null,2),{mode:0o600});
  console.log(JSON.stringify({state:'recording-prepared',sha256,spokenSeconds,externalCalls:0,published:false}));return;
 }
 const cache=path.join(root,sha256+'.words.json');let words:SpeechWord[]=[];
 try{words=JSON.parse(await readFile(cache,'utf8'));}catch{}
 if(!words.length){
  if(!process.argv.includes('--align'))throw Error('Missing cached alignment; --align explicitly permits one transcription of this recording');
  stage='word-timing';
  words=await openAiSpeechWordTimings({wave:wave(pcm),transcript:text,language:'it',signal:AbortSignal.timeout(90000)});
  await writeFile(cache,JSON.stringify(words),{mode:0o600});
 }
 stage='alignment';
 const originalWords=words,expected=text.split(/\s+/u),norm=(s:string)=>s.normalize('NFKD').toLowerCase().replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]/gu,'');
 if(expected.length===words.length&&expected.every((w,i)=>norm(w)===norm(words[i].text)))words=words.map((w,i)=>({...w,text:expected[i]}));
 words=coalesceSpeechWordAnchors(dailyLaunch.lines.map(l=>l.text),words,spokenSeconds);
 const timings=alignSpeechSegments(dailyLaunch.lines.map(l=>l.text),words,spokenSeconds);
 await writeFile(path.join(root,'alignment-review.json'),JSON.stringify({text,spokenSeconds,originalWords,words,timings,pointAnchors:originalWords.filter(w=>w.start===w.end).length},null,2),{mode:0o600});
 if(timings.some(t=>t.alignment!=='word'))throw Error('Review measured ASR words against the complete approved script before rendering');
 const lead=.18,duration=Math.ceil((spokenSeconds+lead+2.5)*25)/25;
 const cues=dailyLaunch.lines.map((line,i)=>{
  const t=timings[i],a=Math.floor(t.start*SPEECH_SAMPLE_RATE),b=Math.min(pcm.length/2,Math.floor(t.end*SPEECH_SAMPLE_RATE)),samples=new Float32Array(b-a);
  for(let j=0;j<samples.length;j++)samples[j]=pcm.readInt16LE((a+j)*2)/32768;
  const lips=buildAudioLipSync(line.text,samples,SPEECH_SAMPLE_RATE);
  return {...line,start:lead+t.start,end:lead+t.end,frameSeconds:lips.frameSeconds,levels:lips.frames.map(f=>f.level),phones:lips.frames.map((f,n)=>({start:n*lips.frameSeconds,end:(n+1)*lips.frameSeconds,viseme:f.viseme})),alignment:t.alignment};
 });
 const scenes=dailyLaunch.scenes.map((scene,i)=>{
  const group=cues.filter(c=>c.scene===scene.id),next=dailyLaunch.scenes[i+1],nextCue=next?cues.find(c=>c.scene===next.id):undefined;
  return {...scene,start:i===0?0:group[0].start,end:nextCue?.start??duration};
 });
 const manifest={version:1,duration,brandLabel:'CDaily',visualStyle:'clean',captionMode:'separate',claim:dailyLaunch.claim,cta:'Seguici sui social e su Spotify',url:'daily.conclavia.me',disclosure:'',voice:dailyLaunch.voice+' · ElevenLabs',speechProvider:'elevenlabs',speechModel:dailyLaunch.model,wordTimingSource:'whisper-1-asr-coalesced-anchors',sourceSha256:sha256,title:dailyLaunch.title,description:dailyLaunch.description,cues,scenes,words:words.map(w=>({...w,start:lead+w.start,end:lead+w.end})),spokenSeconds};
 await writeFile(path.join(root,'raw.wav'),wave(Buffer.concat([Buffer.alloc(Math.round(lead*SPEECH_SAMPLE_RATE)*2),pcm])),{mode:0o600});
 await command('ffmpeg',['-y','-v','error','-i',path.join(root,'raw.wav'),'-af',`apad,atrim=duration=${duration},loudnorm=I=-16:TP=-1.8:LRA=9`,'-ar',String(SPEECH_SAMPLE_RATE),path.join(root,'voice.wav')],AbortSignal.timeout(30000));
 await writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest));
 await writeFile(path.join(out,'caption.txt'),dailyLaunch.description+'\n\n#ConclaviaDaily #Notizie #Attualità #Italia #World\n');
 console.log(JSON.stringify({state:'imported',voice:manifest.voice,model:manifest.speechModel,duration,segments:cues.length,scenes:scenes.length,wordTimingSource:manifest.wordTimingSource,ttsCalls:0,published:false}));
}
void main().catch(e=>{console.error(JSON.stringify({error:'Approved voice import stopped',stage,kind:e instanceof Error?e.name:'unknown',status:typeof e?.status==='number'?e.status:undefined,privateCacheRetained:true,published:false}));process.exitCode=1;});
