/** Verify cached-audio visual revisions. Read-only; no providers or publication. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root='public/daily-launch/revisions';
const revisions=(process.env.TG_AVATAR_REVISIONS??'avatar-delivery-20261022,avatar-closing-20261022').split(',');
if(!revisions.length||revisions.length>4||revisions.some(r=>!/^avatar-[a-z0-9-]{1,70}$/u.test(r)))throw Error('Use bounded named avatar revisions');
const qa='docs/images/daily-launch/'+revisions[0];await mkdir(qa,{recursive:true});
const pcm=file=>execFileSync('ffmpeg',['-v','error','-i',file,'-map','0:a:0','-f','s16le','-ar','24000','-ac','1','pipe:1'],{maxBuffer:6000000});
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
const correlate=(a,b)=>{let xy=0,xx=0,yy=0;for(let i=0;i+2<=Math.min(a.length,b.length);i+=16){const x=a.readInt16LE(i),y=b.readInt16LE(i);xy+=x*y;xx+=x*x;yy+=y*y;}return xy/Math.sqrt(xx*yy);};
const report=[];
for(const revision of revisions){
 const dir=root+'/'+revision,m=JSON.parse(await readFile(dir+'/manifest.json','utf8')),source=root+'/'+m.sourceRevision;
 assert.equal(hash(await readFile(dir+'/audio.wav')),hash(await readFile(source+'/audio.wav')),'approved audio master must remain unchanged');
 const prior=JSON.parse(await readFile(source+'/manifest.json','utf8'));
 assert.equal(m.duration,prior.duration);assert.deepEqual(m.words,prior.words);
 const strip=cue=>{const copy={...cue};delete copy.choreography;delete copy.performanceWindow;return copy;};
 const stripScene=scene=>({...scene,...(scene.turns?{turns:scene.turns.map(strip)}:{})});
 assert.deepEqual(m.scenes.map(stripScene),prior.scenes.map(stripScene),'composition, text, cuts and identity stay fixed');
 assert.deepEqual(m.cues.map(strip),prior.cues.map(strip),'voice, mood and measured PCM/phone frames stay fixed');
 const master=pcm(dir+'/audio.wav');let peak=0,clipped=0;
 for(let i=0;i<master.length;i+=2){const n=Math.abs(master.readInt16LE(i));peak=Math.max(peak,n);if(n>=32767)clipped++;}assert.equal(clipped,0);
 const movies=[];
 for(const format of ['portrait','landscape']){
  const file=dir+'/'+format+'.mp4',probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels,sample_aspect_ratio','-of','json',file],{encoding:'utf8'}));
  const v=probe.streams.find(s=>s.codec_type==='video'),a=probe.streams.find(s=>s.codec_type==='audio');
  assert.deepEqual([v.width,v.height],format==='portrait'?[1080,1920]:[1920,1080]);assert.equal(v.codec_name,'h264');assert.equal(v.r_frame_rate,'25/1');assert.equal(v.sample_aspect_ratio,'1:1');assert.equal(a.codec_name,'aac');assert.equal(a.channels,2);assert.equal(a.sample_rate,'48000');assert.ok(Math.abs(Number(probe.format.duration)-m.duration)<.05);
  execFileSync('ffmpeg',['-v','error','-i',file,'-f','null','-'],{maxBuffer:100000});
  const correlation=correlate(master,pcm(file));assert.ok(correlation>.999,'encoded audio must match the unchanged master');
  movies.push({format,sha256:hash(await readFile(file)),correlation,probe});
 }
 report.push({revision,duration:m.duration,source:m.sourceRevision,unchangedMaster:true,clipped,peakDbfs:20*Math.log10(peak/32768),movies});
}
await writeFile(qa+'/media-verification.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.map(({movies,...r})=>({...r,movies:movies.map(({format,correlation})=>({format,correlation}))}))));
