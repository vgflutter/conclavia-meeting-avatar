/** One imported recording per pilot; cached alignment and one explicit retry,
 * never automatic provider retries, TTS or publishing. */
import {mkdir,readFile,writeFile,copyFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {openAiSpeechWordTimings} from '@conclavia/avatar-kit/speech/server';
import {SPEECH_SAMPLE_RATE,alignSpeechSegments,coalesceSpeechWordAnchors,punctuateSpeechWordAnchors,buildAudioLipSync,type SpeechWord} from '@conclavia/avatar-kit/speech';
import {creativePilot} from '../../src/components/tg/daily-creative-pilots';
import {command,wave} from '../../src/lib/tg/media';
async function main(){
 if(!process.argv.includes('--confirm')||process.env.TG_PUBLISH_ENABLED!=='false')throw Error('Explicit creative preparation with publication disabled required');
 const id=process.argv.find(a=>a.startsWith('--id='))?.slice(5)??'',input=process.argv.find(a=>a.startsWith('--file='))?.slice(7),pilot=creativePilot(id);
 if(!input||!path.isAbsolute(input))throw Error('Absolute imported recording required');
 const info=await stat(input);if(!info.isFile()||info.size>12000000)throw Error('Recording exceeds bounds');
 const root=path.resolve('.tg-artifacts/.launch-promo/pilots',id),out=path.resolve('public/daily-launch/pilots',id);
 await mkdir(root,{recursive:true,mode:0o700});await mkdir(out,{recursive:true});
 const source=await readFile(input),sha=createHash('sha256').update(source).digest('hex');await copyFile(input,path.join(root,'source.mp3'));
 await command('ffmpeg',['-y','-v','error','-i',input,'-ar',String(SPEECH_SAMPLE_RATE),'-ac','1','-f','s16le',path.join(root,'source.pcm')],AbortSignal.timeout(30000));
 const pcm=await readFile(path.join(root,'source.pcm')),spokenSeconds=pcm.length/(SPEECH_SAMPLE_RATE*2);
 if(spokenSeconds<8||spokenSeconds>57)throw Error('Pilot must contain 8–57 seconds of actual speech');
 const text=pilot.lines.map(l=>l.text).join(' '),retry=process.argv.includes('--retry-timing'),cache=path.join(root,sha+(retry?'.vocabulary':'')+'.words.json');let originalWords:SpeechWord[]=[];
 try{originalWords=JSON.parse(await readFile(cache,'utf8'));}catch{}
 if(!originalWords.length){if(!process.argv.includes('--align'))throw Error('Cached ASR unavailable; use --align for one bounded call');if(retry)await stat(path.join(root,sha+'.words.json'));originalWords=await openAiSpeechWordTimings({wave:wave(pcm),transcript:retry?'Conclavia Daily. AI generativa. Chatbot. ILO–NASK.':text,language:'it',signal:AbortSignal.timeout(90000)});await writeFile(cache,JSON.stringify(originalWords),{mode:0o600});}
 const words=punctuateSpeechWordAnchors(pilot.lines.map(l=>l.text),coalesceSpeechWordAnchors(pilot.lines.map(l=>l.text),originalWords,spokenSeconds));
 const timings=alignSpeechSegments(pilot.lines.map(l=>l.text),words,spokenSeconds);
 await writeFile(path.join(root,'alignment-review.json'),JSON.stringify({text,spokenSeconds,originalWords,words,timings},null,2),{mode:0o600});
 if(timings.some(t=>t.alignment!=='word'))throw Error('ASR and complete intended script need review before rendering');
 const lead=.16,duration=Math.ceil((spokenSeconds+lead+1.7)*25)/25;
 const cues=pilot.lines.map((line,i)=>{const t=timings[i],a=Math.floor(t.start*SPEECH_SAMPLE_RATE),b=Math.min(pcm.length/2,Math.floor(t.end*SPEECH_SAMPLE_RATE)),floats=new Float32Array(b-a);for(let j=0;j<floats.length;j++)floats[j]=pcm.readInt16LE((a+j)*2)/32768;const lips=buildAudioLipSync(line.text,floats,SPEECH_SAMPLE_RATE);return {...line,start:lead+t.start,end:lead+t.end,frameSeconds:lips.frameSeconds,levels:lips.frames.map(f=>f.level),phones:lips.frames.map((f,n)=>({start:n*lips.frameSeconds,end:(n+1)*lips.frameSeconds,viseme:f.viseme})),alignment:t.alignment};});
 const scenes=pilot.scenes.map((scene,i)=>{const group=cues.filter(c=>c.scene===scene.id),next=pilot.scenes[i+1],nextCue=next?cues.find(c=>c.scene===next.id):undefined;if(!group.length)throw Error('Scene lacks real speech');return {...scene,start:i?group[0].start:0,end:nextCue?.start??duration};});
 const manifest={version:1,id,brandLabel:'Daily',claim:'Meno rumore. Più contesto.',cta:'Segui Daily',url:'conclavia.me/tg',disclosure:'PRESENTATORI E VOCI AI · PILOTA',title:pilot.title,description:pilot.description,format:pilot.format,hypothesis:pilot.hypothesis,sources:pilot.sources,voice:pilot.voices.join(' + ')+' · ElevenLabs',speechProvider:'elevenlabs',speechModel:'eleven_v4',sourceSha256:sha,wordTimingSource:'whisper-1-asr-coalesced-anchors',duration,spokenSeconds,cues,scenes,words:words.map(w=>({...w,start:lead+w.start,end:lead+w.end}))};
 await writeFile(path.join(root,'raw.wav'),wave(Buffer.concat([Buffer.alloc(Math.round(lead*SPEECH_SAMPLE_RATE)*2),pcm])),{mode:0o600});
 await command('ffmpeg',['-y','-v','error','-i',path.join(root,'raw.wav'),'-af',`apad,atrim=duration=${duration},loudnorm=I=-16:TP=-1.8:LRA=9`,'-ar',String(SPEECH_SAMPLE_RATE),path.join(root,'voice.wav')],AbortSignal.timeout(30000));
 await writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
 await writeFile(path.join(out,'caption.txt'),pilot.description+'\n\n'+pilot.sources.map(s=>s.label+'\n'+s.url).join('\n')+'\n\n#ConclaviaDaily #Attualità #Contesto\n');
 console.log(JSON.stringify({id,seconds:duration,segments:cues.length,scenes:scenes.length,voices:pilot.voices,sourceSha256:sha,externalCalls:retry?'explicit second ASR, cached':'one cached ASR at most',published:false}));
}
void main().catch(error=>{console.error(error instanceof Error?error.message:'Creative pilot preparation failed');process.exitCode=1;});
