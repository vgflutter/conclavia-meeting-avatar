/** Verify actual PCM assembly, clean intro splice and final word/gesture clock. */
import {readFile,writeFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
const id=process.argv.find(v=>v.startsWith('--id='))?.slice(5);
if(!id||!/^\d{4}-\d{2}-\d{2}-it-pilot(?:-r[1-9]\d*)?$/u.test(id))throw Error('Explicit local edition required');
const dir=`public/daily-launch/editions/${id}`,privateDir=`.tg-artifacts/.launch-promo/editions/${id}`,m=JSON.parse(await readFile(dir+'/manifest.json'));
const source=await readFile(privateDir+'/source.pcm'),rawFile=await readFile(privateDir+'/raw.wav'),edit=JSON.parse(await readFile(privateDir+'/opening-pause.json'));
function pcm(w){for(let at=12;at+8<=w.length;){const n=w.readUInt32LE(at+4);if(w.toString('ascii',at,at+4)==='data')return w.subarray(at+8,at+8+n);at+=8+n+(n%2);}throw Error('WAV data missing');}
const raw=pcm(rawFile),rate=24000,lead=Math.round(.18*rate)*2,cut=Math.round(edit.atSeconds*rate)*2,added=Math.round(edit.addedSeconds*rate)*2,fade=Math.round(edit.fadeSeconds*rate)*2;
if(!source.subarray(0,cut-fade).equals(raw.subarray(lead,lead+cut-fade))||!source.subarray(cut+fade).equals(raw.subarray(lead+cut+added+fade)))throw Error('An unexpected source edit occurred outside the reviewed fade corridor');
const master=execFileSync('ffmpeg',['-v','error','-i',dir+'/audio.wav','-ar','24000','-ac','1','-f','s16le','pipe:1'],{maxBuffer:24000000});
const silenceStart=m.openingPause.atSeconds+.01,silenceEnd=m.openingPause.atSeconds+edit.addedSeconds-.01;let sum=0,max=0,n=0;
for(let i=Math.ceil(silenceStart*rate);i<Math.floor(silenceEnd*rate);i++){const v=master.readInt16LE(i*2)/32768;sum+=v*v;max=Math.max(max,Math.abs(v));n++;}
const wordGap=m.words.find(w=>w.start>m.openingPause.spokenIntroEndsAt+.2).start-m.openingPause.spokenIntroEndsAt;
if(!Number.isFinite(m.duration)||m.duration<30||m.duration>428||Math.abs(wordGap-2)>.01||max>.001||Math.abs(master.length/(rate*2)-m.duration)>.001)throw Error('Master duration, silence or measured word gap failed');
const pointer=m.cues.find(c=>c.gestureWord==='commenti'),word=m.words.find(w=>w.text.toLowerCase()==='commenti'&&w.start>=pointer.start),stroke=pointer.choreography.strokes.find(s=>s.kind==='point-down'),apex=(pointer.performanceWindow?.start??pointer.start)+stroke.apex;
if(apex<word.start||apex>word.end||m.approvedClosingGesture.variant!==stroke.variant)throw Error('Approved pointer is not aligned with comments');
const report={id,duration:master.length/(rate*2),wordGapSeconds:wordGap,insertedSilenceRms:Math.sqrt(sum/n),insertedSilencePeak:max,fadeSeconds:edit.fadeSeconds,sourceOutsideReviewedSpliceUnchanged:true,firstNewsAt:m.scenes[1].start,approvedPointer:{apexSeconds:apex,wordStart:word.start,wordEnd:word.end,variant:stroke.variant,passed:true},music:false,audioSha256:createHash('sha256').update(await readFile(dir+'/audio.wav')).digest('hex'),providerCalls:0,passed:true};
await writeFile(`docs/images/daily-launch/editions/${id}/audio-proof.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
