/** Explicit promotion of the requested demo; never approves a news edition. */
import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {publicEditionHtml} from '../../src/lib/tg/site-publication';
const hash=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
async function main(){
 if(!process.argv.includes('--confirm'))throw Error('Explicit demo publication required');
 const source='public/daily-launch/editions/2026-10-24-it-pilot-r1',out='.daily-agent/site-demo',m=JSON.parse(await readFile(source+'/manifest.json','utf8'));
 if(m.editionScope!=='acting-demo-not-news'||m.editionDate!=='2026-10-24'||m.voice!=='Alex 2 - daily · ElevenLabs'||m.duration!==62.2)throw Error('Unexpected demonstration');
 await mkdir(out,{recursive:true,mode:0o700});
 for(const name of ['portrait.mp4','landscape.mp4','captions.vtt'])await copyFile(source+'/'+name,out+'/'+name);
 execFileSync('ffmpeg',['-y','-v','error','-i',source+'/audio.wav','-c:a','libmp3lame','-b:a','192k',out+'/audio.mp3']);
 const assets=[];for(const name of ['portrait.mp4','landscape.mp4','audio.mp3','captions.vtt']){const bytes=await readFile(out+'/'+name);assets.push({name,bytes:bytes.length,sha256:hash(bytes)});}
 const publicationKey=hash(JSON.stringify({date:m.editionDate,text:m.cues.map((c:{text:string})=>c.text),assets})),url='https://daily.conclavia.me/edizioni/demo/'+m.editionDate+'/',base=url+publicationKey+'/';
 let publishedAt=new Date().toISOString();try{const previous=JSON.parse(await readFile(out+'/release.json','utf8'));if(previous.publicationKey===publicationKey)publishedAt=previous.publishedAt;}catch{}
 const body={schema:1,kind:'demo' as const,edition:'it',date:m.editionDate,language:'it' as const,title:'Un minuto con Alex · Demo voce e movimento',description:m.description,publicationKey,publishedAt,url,releaseUrl:base+'release.json',seconds:m.duration,
  distribution:{eligible:false,reason:'Demo del progetto, non un Daily di notizie approvato per i social'},
  review:{mode:'demo',facts:false,editorial:false,video:false},
  media:Object.fromEntries(assets.map(a=>[a.name,{url:base+a.name,bytes:a.bytes,sha256:a.sha256,...(a.name.endsWith('.mp4')?{seconds:m.duration}:{})}])),
  stories:m.scenes.map((s:{lines:string[];kicker:string;start:number})=>({title:s.lines.join(' '),summary:s.kicker,at:s.start})),sources:[],transcript:m.cues.map((c:{text:string})=>c.text).join('\n\n'),socialPosts:{}};
 const record={...body,sha256:hash(JSON.stringify(body))};await writeFile(out+'/release.json',JSON.stringify(record,null,2)+'\n',{mode:0o600});await writeFile(out+'/index.html',publicEditionHtml(record),{mode:0o600});
 const checks:Record<string,string>={};for(const name of [...assets.map(a=>a.name),'release.json','index.html'])checks[name]=hash(await readFile(out+'/'+name));await writeFile(out+'/checksums.json',JSON.stringify(checks,null,2)+'\n',{mode:0o600});
 console.log(JSON.stringify({kind:'demo',url,socialEligible:false,files:Object.keys(checks).length,providerCalls:0}));
}
void main().catch(()=>{console.error('Public demo export not completed');process.exitCode=1;});
