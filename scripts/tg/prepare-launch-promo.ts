/** One bounded creative voice call, explicitly invoked. Never a regression/worker. */
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {openAiSpeechPcm,openAiSpeechWordTimings} from '@conclavia/avatar-kit/speech/server';
import {SPEECH_SAMPLE_RATE,alignSpeechSegments,buildAudioLipSync,type SpeechWord} from '@conclavia/avatar-kit/speech';
import {dailyLaunch} from '../../src/components/tg/daily-launch-storyboard';
import {launchVoice} from '../../src/components/tg/daily-launch-voices';
import {command,wave} from '../../src/lib/tg/media';

let stage='validation';
async function main(){
 if(!process.argv.includes('--confirm')||process.env.PODCAST_SPEECH_ENABLED!=='true'||process.env.TG_PUBLISH_ENABLED!=='false')throw Error('Explicit voice generation with publication disabled required');
 const voice=launchVoice(process.argv.find(a=>a.startsWith('--voice='))?.slice(8)??'');
 const text=dailyLaunch.lines.map(l=>l.text).join(' ');
 if(text.split(/\s+/u).length>110||text.length>1400)throw Error('Launch script exceeds one bounded voice request');
 const privateDir=path.resolve('.tg-artifacts/.launch-promo/voices',voice.id),out=path.resolve('public/daily-launch/voices',voice.id);
 await mkdir(privateDir,{recursive:true,mode:0o700});await mkdir(out,{recursive:true});
 const request={text,voice:voice.voiceId,instructions:dailyLaunch.direction.replace(/^\[|\]$/gu,''),speed:voice.speakingRate};
 const key=createHash('sha256').update(JSON.stringify(request)).digest('hex'),cache=path.join(privateDir,key);
 let pcm:Buffer|undefined,words:SpeechWord[]=[];
 try{pcm=await readFile(cache+'.pcm');words=JSON.parse(await readFile(cache+'.json','utf8'));}catch{}
 if(!pcm){
  stage='voice-stream';
  pcm=Buffer.from(await openAiSpeechPcm({...request,signal:AbortSignal.timeout(90000)}));
  await writeFile(cache+'.pcm',pcm,{mode:0o600});
 }
 if(!words.length){
  stage='word-timing';
  words=await openAiSpeechWordTimings({wave:wave(pcm),transcript:text,language:'it',signal:AbortSignal.timeout(90000)});
  await writeFile(cache+'.json',JSON.stringify(words),{mode:0o600});
 }
 stage='alignment';
 const spokenSeconds=pcm.length/(SPEECH_SAMPLE_RATE*2),lead=.18,duration=Math.ceil((spokenSeconds+lead+2.5)*25)/25;
 if(duration>60)throw Error('Promo is too long: shorten the copy rather than rushing the voice');
 const timings=alignSpeechSegments(dailyLaunch.lines.map(l=>l.text),words,spokenSeconds);
 if(timings.some(t=>t.alignment!=='word'))throw Error('Review ASR word alignment before rendering');
 const cues=dailyLaunch.lines.map((line,i)=>{
  const t=timings[i],a=Math.floor(t.start*SPEECH_SAMPLE_RATE),b=Math.floor(t.end*SPEECH_SAMPLE_RATE);
  const samples=new Float32Array(b-a);for(let j=0;j<samples.length;j++)samples[j]=pcm!.readInt16LE((a+j)*2)/32768;
  const lips=buildAudioLipSync(line.text,samples,SPEECH_SAMPLE_RATE);
  return {...line,start:lead+t.start,end:lead+t.end,frameSeconds:lips.frameSeconds,
   levels:lips.frames.map(f=>f.level),phones:lips.frames.map((f,n)=>({start:n*lips.frameSeconds,end:(n+1)*lips.frameSeconds,viseme:f.viseme})),alignment:t.alignment};
 });
 const scenes=dailyLaunch.scenes.map((scene,i)=>{
  const group=cues.filter(c=>c.scene===scene.id),next=dailyLaunch.scenes[i+1],nextCue=next?cues.find(c=>c.scene===next.id):undefined;
  return {...scene,start:i===0?0:group[0].start,end:nextCue?.start??duration};
 });
 const manifest={version:1,duration,brandLabel:'Daily',claim:dailyLaunch.claim,cta:'Segui il progetto',url:'daily.conclavia.me',disclosure:'',voice:voice.label+' · OpenAI',voiceId:voice.voiceId,auditionId:voice.id,speechProvider:'openai',speechModel:'gpt-4o-mini-tts',wordTimingSource:'whisper-1',title:dailyLaunch.title,description:dailyLaunch.description,
  cues,scenes,words:words.map(w=>({...w,start:lead+w.start,end:lead+w.end})),spokenSeconds};
 await writeFile(path.join(privateDir,'raw.wav'),wave(Buffer.concat([Buffer.alloc(Math.round(lead*SPEECH_SAMPLE_RATE)*2),pcm])));
 await command('ffmpeg',['-y','-v','error','-i',path.join(privateDir,'raw.wav'),'-af',`apad,atrim=duration=${duration},loudnorm=I=-16:TP=-1.8:LRA=9`,'-ar',String(SPEECH_SAMPLE_RATE),path.join(privateDir,'voice.wav')],AbortSignal.timeout(60000));
 const sampleStart=cues.find(c=>c.scene==='trust')!.start,sampleEnd=cues.filter(c=>c.scene==='invitation').at(-1)!.end;
 await command('ffmpeg',['-y','-v','error','-i',path.join(privateDir,'voice.wav'),'-af',`atrim=start=${sampleStart}:end=${sampleEnd},asetpts=PTS-STARTPTS`,'-ar',String(SPEECH_SAMPLE_RATE),path.join(out,'sample.wav')],AbortSignal.timeout(30000));
 await writeFile(path.join(out,'sample.json'),JSON.stringify({voice:voice.label,seconds:sampleEnd-sampleStart,start:sampleStart,end:sampleEnd,text:cues.filter(c=>['trust','invitation'].includes(c.scene)).map(c=>c.text).join(' ')}));
 await writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest));
 await writeFile(path.join(out,'caption.txt'),dailyLaunch.description+'\n\n#ConclaviaDaily #Notizie #Attualità #Italia #World\n');
 console.log(JSON.stringify({id:voice.id,voice:manifest.voice,sampleSeconds:sampleEnd-sampleStart,seconds:duration,words:text.split(/\s+/u).length,segments:cues.length,moods:[...new Set(cues.map(c=>c.mood))],alignment:[...new Set(timings.map(t=>t.alignment))],voiceCalls:'at most one synthesis and one timing, cached',publication:false}));
}
void main().catch(e=>{console.error(JSON.stringify({error:'Promo voice preparation stopped',stage,kind:e instanceof Error?e.name:'unknown',status:typeof e?.status==='number'?e.status:undefined,privateCacheRetained:true,published:false}));process.exitCode=1;});
