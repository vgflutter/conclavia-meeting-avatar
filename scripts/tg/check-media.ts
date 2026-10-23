/** Read-only technical acceptance. No database, TTS, AI or social requests. */
import {copyFile,mkdir,mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {inspectArtifact,jobDirectory} from '../../src/lib/tg/artifacts';
import {inspectFinalMedia} from '../../src/lib/tg/final-review-media';
import {TG_PRODUCTS} from '../../src/lib/tg/config';
import type {TgJob,TgManifest} from '../../src/lib/tg/types';
import {creativePilot} from '../../src/components/tg/daily-creative-pilots';
async function main(){
const launch=process.argv.includes('--launch'),id=process.argv.find(a=>a.startsWith('--id='))?.slice(5),pilot=process.argv.find(a=>a.startsWith('--pilot='))?.slice(8),creative=launch||Boolean(pilot);
if(Number(launch)+Number(Boolean(id))+Number(Boolean(pilot))!==1)throw Error('Scegli --launch, --pilot=dato|confronto|traccia oppure --id=<edizione>');
if(pilot)creativePilot(pilot);
const controller=new AbortController();process.on('SIGINT',()=>controller.abort());process.on('SIGTERM',()=>controller.abort());
let temporary:string|undefined;
try{
 let manifest:TgManifest,jobId=id!;
 if(creative){
  const source=path.join(process.cwd(),'public/daily-launch',...(pilot?['pilots',pilot]:[])),sequence=JSON.parse(await readFile(path.join(source,'manifest.json'),'utf8'));
  temporary=await mkdtemp(path.join(tmpdir(),'conclavia-daily-media-'));process.env.TG_ARTIFACT_DIR=temporary;jobId='0'.repeat(24);
  const dir=jobDirectory(jobId);await mkdir(dir);for(const name of ['landscape.mp4','portrait.mp4'])await copyFile(path.join(source,name),path.join(dir,name));
  manifest={version:1,product:{...TG_PRODUCTS[0],seconds:sequence.duration},date:new Date().toISOString().slice(0,10),seconds:sequence.duration,stories:[],sources:[],cues:sequence.cues.map((c:Record<string,unknown>)=>({...c,speaker:0,sourceIds:[],storyId:'promo'}))};
 }else manifest=JSON.parse(await readFile(path.join(jobDirectory(jobId),'manifest.json'),'utf8'));
 const names=creative?['landscape.mp4','portrait.mp4'] as const:['landscape.mp4','portrait.mp4','audio.mp3','captions.vtt','manifest.json'] as const;
 const assets=await Promise.all(names.map(name=>inspectArtifact(jobId,name)));
 const job:TgJob={id:jobId,edition:manifest.product.edition,date:manifest.date,product:manifest.product,manifest,state:'needs_review',assets,issues:[],events:[],attempts:0,deliveries:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
 const result=await inspectFinalMedia(job,controller.signal,{bundle:!creative});
 console.log(JSON.stringify({scope:'technical-media-only',pilot,passed:true,aiCalled:false,publicationStarted:false,media:result.media,samples:result.frames.map(({format,at})=>({format,at})),assets},null,2));
}finally{if(temporary)await rm(temporary,{recursive:true,force:true});}

}
void main().catch(error=>{console.error(error instanceof Error?error.message:"Verifica media non riuscita");process.exitCode=1;});
