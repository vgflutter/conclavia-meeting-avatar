/** Prepare only the four approved public assets. No generation or social API. */
import {mkdir,writeFile,copyFile,lstat} from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import {connectToDatabase} from '../../src/lib/mongodb';
import {TgRunModel} from '../../src/models/tg/TgRun';
import {serializeJob} from '../../src/lib/tg/store';
import {loadPublishedHistory} from '../../src/lib/tg/history';
import {assertSiteReady} from '../../src/lib/tg/site-publication';
import {inspectArtifact,jobDirectory} from '../../src/lib/tg/artifacts';
import {localEditionDate} from '../../src/lib/tg/schedule';
const names=['portrait.mp4','landscape.mp4','audio.mp3','captions.vtt'] as const;
async function main(){
 if(process.env.TG_PUBLISH_ENABLED==='true')throw Error('Website handoff only');
 const requested=process.argv.find(a=>a.startsWith('--job='))?.slice(6),today=localEditionDate(new Date(),'Europe/Rome');
 if(requested&&!/^[a-f0-9]{24}$/u.test(requested))throw Error('Invalid job');
 await connectToDatabase();
 const record=await TgRunModel.findOne(requested?{_id:requested}:{edition:'it',date:today}).lean();
 if(!record)return console.log(JSON.stringify({ready:false,date:today,state:'waiting'}));
 const job=serializeJob(record);
 if(job.edition!=='it'||job.date!==today)throw Error('Current Italy edition required');
 if(job.sitePublication&&job.sitePublication.bundleSha256===job.review?.bundleSha256)return console.log(JSON.stringify({ready:true,alreadyPublished:true,date:today,url:job.sitePublication.url}));
 if(!['ready','publishing'].includes(job.state))return console.log(JSON.stringify({ready:false,date:today,state:job.state,issues:job.issues}));
 assertSiteReady(job,await loadPublishedHistory(job.edition,job.date,new Date()),new Date());
 const directory=path.resolve('.daily-agent/site-upload',job.id,job.review!.bundleSha256!);await mkdir(directory,{recursive:true,mode:0o700});
 const assets=[];
 for(const name of names){
  const source=path.join(jobDirectory(job.id),name);if(!(await lstat(source)).isFile())throw Error('Regular asset required');
  const actual=await inspectArtifact(job.id,name),expected=job.assets.find(a=>a.name===name);
  if(!expected||actual.sha256!==expected.sha256||actual.bytes!==expected.bytes)throw Error('Asset differs from approval');
  await copyFile(source,path.join(directory,name));assets.push({name,bytes:actual.bytes,sha256:actual.sha256});
 }
 await writeFile(path.join(directory,'transfer.json'),JSON.stringify({schema:1,jobId:job.id,publicationKey:job.review!.bundleSha256,date:job.date,assets}),{mode:0o600});
 console.log(JSON.stringify({ready:true,jobId:job.id,date:job.date,publicationKey:job.review!.bundleSha256}));
}
main().catch(()=>{console.error('Pacchetto sito non verificato: nessun caricamento');process.exitCode=1;}).finally(()=>mongoose.disconnect());
