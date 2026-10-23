// Compare refreshed local pilots with their latest archived master, read-only.
import {createHash} from 'node:crypto';
import {readFile,readdir,access,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
const root=resolve(process.env.TG_ARTIFACT_DIR??'.tg-artifacts');
const ids=process.argv.filter(a=>a.startsWith('--id=')).map(a=>a.slice(5));
if(!ids.length||ids.some(id=>!/^[a-f0-9]{24}$/u.test(id)))throw Error('Explicit pilot IDs required');
const report=[];
for(const id of ids){
 const archives=(await readdir(join(root,'.studio-backups'))).sort().reverse();let backup;
 for(const stamp of archives){const candidate=join(root,'.studio-backups',stamp,id);try{await access(join(candidate,'manifest.json'));backup=candidate;break;}catch{}}
 if(!backup)throw Error('Missing previous master');
 const current=join(root,id),old=JSON.parse(await readFile(join(backup,'manifest.json'),'utf8')),next=JSON.parse(await readFile(join(current,'manifest.json'),'utf8'));
 const unchanged=Object.fromEntries(['product','stories','sources','cues','speech'].map(key=>[key,isDeepStrictEqual(old[key],next[key])]));
 for(const name of ['track.wav','audio.mp3','captions.vtt']){
  const hash=async dir=>createHash('sha256').update(await readFile(join(dir,name))).digest('hex');
  unchanged[name]=(await hash(backup))===(await hash(current));
 }
 if(Object.values(unchanged).some(v=>!v))throw Error('Refresh changed audio or editorial content');
 const videos=[];
 for(const portrait of [false,true]){
  const name=portrait?'portrait.mp4':'landscape.mp4';
  const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_name,width,height,avg_frame_rate,sample_aspect_ratio,nb_frames','-of','json',join(current,name)],{encoding:'utf8'}));
  const video=probe.streams.find(s=>s.codec_name==='h264'),audio=probe.streams.find(s=>s.codec_name==='aac');
  if(!video||!audio||Math.abs(Number(probe.format.duration)-next.seconds)>.1||video.width!==(portrait?1080:1920)||video.height!==(portrait?1920:1080)||video.avg_frame_rate!=='25/1'||video.sample_aspect_ratio!=='1:1')throw Error('Invalid refreshed video');
  videos.push({name,seconds:Number(probe.format.duration),...video,audio:audio.codec_name});
 }
 report.push({id,edition:next.product.edition,backup:backup.slice(root.length+1),unchanged,videos});
}
await writeFile('docs/images/daily-studio/acting-export-verification.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({pilots:report.length,videos:report.flatMap(r=>r.videos).length,audioAndEditorialContentPreserved:true}));
