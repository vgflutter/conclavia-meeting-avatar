// Bounded offline pace refinement of a selected continuous voice recording.
// No TTS, ASR, publication or shared-renderer edits. Originals are preserved.
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';

const argument=name=>process.argv[process.argv.indexOf(name)+1];
for(const name of ['--source','--target','--voice-cache','--rate'])if(!process.argv.includes(name))throw Error('Required: --source REVISION --target NEW_REVISION --voice-cache CACHE --rate 1.06');
const source=argument('--source'),target=argument('--target'),cache=argument('--voice-cache'),rate=Number(argument('--rate'));
if([source,target,cache].some(s=>!s||!/^[a-z0-9][a-z0-9-]{0,80}$/u.test(s))||!Number.isFinite(rate)||rate<=1||rate>1.08)throw Error('Use named revisions and a small pace change (1 < rate <= 1.08)');
if(source===target)throw Error('Keep the selected original revision');
const publicRoot=path.resolve('public/daily-launch/revisions'),privateRoot=path.resolve('.tg-artifacts/.launch-promo/voices');
const sourceDir=path.join(publicRoot,source),out=path.join(publicRoot,target),voiceDir=path.join(privateRoot,cache),proofDir=path.join(privateRoot,target);
try{await access(out);throw Error('Target already exists; choose a new revision');}catch(e){if(e.code!=='ENOENT')throw e;}
const base=JSON.parse(await readFile(path.join(sourceDir,'manifest.json'),'utf8'));
if(base.speechProvider!=='elevenlabs'||!base.voice.includes('Alex')||base.cues.length!==16||base.music?.mode!=='intro-only'||base.music?.endsAtSeconds!==4)throw Error('Expected the reviewed continuous Alex introduction with an intro-only score');
const voiceImport=JSON.parse(await readFile(path.join(voiceDir,'import.json'),'utf8'));
if(voiceImport.sha256!==base.sourceSha256)throw Error('Voice cache provenance does not match the selected recording');
const lead=base.cues[0].start,lastEnd=base.cues.at(-1).end;
const duration=Math.ceil((lead+(base.duration-lead)/rate)*25)/25;
const time=t=>t<=lead?t:lead+(t-lead)/rate;
if(lead<0||lead>.5||duration<30||duration>60||lastEnd>=base.duration)throw Error('Unexpected voice or programme duration');
const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','json',path.join(voiceDir,'voice.wav')],{encoding:'utf8'}));
if(Math.abs(Number(probe.format.duration)-base.duration)>.01)throw Error('Voice cache does not match the selected original');
await mkdir(out,{recursive:true});await mkdir(proofDir,{recursive:true,mode:0o700});
const ffmpeg=args=>execFileSync('ffmpeg',['-y','-v','error',...args],{maxBuffer:12000000});
// Preserve the leading silence and pad the tail. atempo changes tempo rather
// than sample rate, so it does not transpose the voice. Word times inherit
// the same continuous, affine transform of the measured source timeline.
ffmpeg(['-i',path.join(voiceDir,'voice.wav'),'-af',`atrim=start=${lead}:end=${lastEnd},asetpts=PTS-STARTPTS,atempo=${rate},adelay=${Math.round(lead*1000)}:all=1,apad,atrim=duration=${duration}`,'-ar','24000','-ac','1',path.join(proofDir,'voice.wav')]);
ffmpeg(['-i',path.join(proofDir,'voice.wav'),'-i',path.join(voiceDir,'music-bed-intro-only.wav'),'-filter_complex',`[0:a]aresample=48000[v];[1:a]atrim=start=0:end=${duration},apad[bed];[v][bed]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.870964:level=false:latency=true[mix]`,'-map','[mix]','-t',String(duration),'-ar','48000','-ac','2',path.join(out,'audio.wav')]);
const retimePlan=p=>p?{...p,durationSeconds:p.durationSeconds/rate,strokes:p.strokes.map(s=>({...s,start:s.start/rate,apex:s.apex/rate,hold:s.hold/rate,end:s.end/rate}))}:undefined;
const manifest={...base,duration,spokenSeconds:base.spokenSeconds/rate,sourceTempo:rate,wordTimingSource:(base.wordTimingSource??'measured')+'-retimed',paceRevision:{sourceMediaVersion:base.mediaVersion,rate,filter:'atempo',pitchPreserved:true},mediaVersion:undefined,
 cues:base.cues.map(c=>({...c,start:time(c.start),end:time(c.end),frameSeconds:c.frameSeconds/rate,phones:c.phones.map(p=>({...p,start:p.start/rate,end:p.end/rate})),...(c.choreography?{choreography:retimePlan(c.choreography)}:{})})),
 words:base.words.map(w=>({...w,start:time(w.start),end:time(w.end)})),
 scenes:base.scenes.map((s,i)=>({...s,start:time(s.start),end:i===base.scenes.length-1?duration:time(s.end),...(s.turns?{turns:s.turns.map(t=>({...t,...(t.choreography?{choreography:retimePlan(t.choreography)}:{})}))}:{})})),
};
await writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const masterHash=createHash('sha256').update(await readFile(path.join(out,'audio.wav'))).digest('hex');
await writeFile(path.join(proofDir,'pace-notes.json'),JSON.stringify({source,sourceMediaVersion:base.mediaVersion,sourceSeconds:base.duration,targetSeconds:duration,rate,sourceRecordingSha256:base.sourceSha256,masterHash,lead,wordTiming:'Original measured ASR anchors retimed with the same affine transform; no new ASR; source anchors remain approximate',unchanged:['copy','voice identity','studio','font','brand','colours','music waveform and first-four-second window'],ttsCalls:0,asrCalls:0,providerCalls:0},null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({out,duration,rate,sourceDuration:base.duration,cues:manifest.cues.length,providerCalls:0}));
