/** Persistent website-only publisher. No LLM, TTS, rendering or social API. */
import mongoose from 'mongoose';
import {connectToDatabase} from '../../src/lib/mongodb';
import {TgRunModel} from '../../src/models/tg/TgRun';
import {TgEditionModel} from '../../src/models/tg/TgEdition';
import {serializeJob} from '../../src/lib/tg/store';
import {loadPublishedHistory} from '../../src/lib/tg/history';
import {assertSiteReady,publishEditionToSite,reconcileSitePublication} from '../../src/lib/tg/site-publication';
async function main(){
 if(process.env.TG_SITE_PUBLISH_ENABLED!=='true'||!process.env.TG_SITE_PUBLIC_DIR||process.env.TG_PUBLISH_ENABLED==='true')throw Error('Website-only runtime required');
 await connectToDatabase();
 const action=process.argv[2]??'status';if(!['status','tick','configure','validate-upload'].includes(action))throw Error('Invalid website publisher action');
 const jobId=process.argv.find(a=>a.startsWith('--job='))?.slice(6);
 if(jobId&&!/^[a-f0-9]{24}$/u.test(jobId))throw Error('Invalid upload job');
 if(action==='validate-upload'){
  if(!jobId)throw Error('Upload job required');
  const job=serializeJob(await TgRunModel.findById(jobId).lean().orFail());
  if(job.sitePublication?.bundleSha256===job.review?.bundleSha256&&job.sitePublication)return console.log(JSON.stringify({alreadyPublished:true,url:job.sitePublication.url}));
  assertSiteReady(job,await loadPublishedHistory(job.edition,job.date,new Date()),new Date());
  return console.log(JSON.stringify({schema:1,jobId,publicationKey:job.review!.bundleSha256,date:job.date,assets:['portrait.mp4','landscape.mp4','audio.mp3','captions.vtt'].map(name=>{const a=job.assets.find(a=>a.name===name);if(!a)throw Error('Missing approved asset');return{name:a.name,bytes:a.bytes,sha256:a.sha256};})}));
 }
 if(action==='configure'){
  if(!process.argv.includes('--confirm'))throw Error('Explicit website handoff configuration required');
  const edition=await TgEditionModel.findOne({edition:'it','product.productionStandard':'cdaily-v1','product.publicationDriver':'chatgpt-work'}).lean().orFail();
  if(edition.product.siteFirst)return console.log(JSON.stringify({configured:true,siteFirst:true,productionMode:edition.product.productionMode,changed:false}));
  const update=await TgEditionModel.updateOne({_id:edition._id,revision:edition.revision},{$set:{'product.siteFirst':true},$inc:{revision:1}});
  if(update.matchedCount!==1)throw Error('Product changed');
  return console.log(JSON.stringify({configured:true,siteFirst:true,productionMode:edition.product.productionMode,changed:true,mediaEnabled:false}));
 }
 if(action==='status')return console.log(JSON.stringify({database:'connected',website:true,social:false,generation:false}));
 const records=await TgRunModel.find({... (jobId?{_id:jobId}:{}),'product.siteFirst':true,'product.productionMode':{$ne:'editorial'},'review.scope':'website',state:{$in:['ready','publishing','blocked']},sitePublication:{$exists:false}}).sort({date:-1}).limit(4).lean();
 const results=[];
 for(const record of records){
  const job=serializeJob(record),now=new Date();
  try{
   const recovered=await reconcileSitePublication(job,process.env.TG_SITE_PUBLIC_DIR,now);
   const history=recovered?[]:await loadPublishedHistory(job.edition,job.date,now);
   const receipt=recovered??await publishEditionToSite(job,process.env.TG_SITE_PUBLIC_DIR,history,now,async()=>{
    const latest=await TgRunModel.findById(job.id).lean().orFail(),fresh=serializeJob(latest);
    if(fresh.review?.bundleSha256!==job.review?.bundleSha256||fresh.revision!==job.revision)throw Error('Edition changed before publication');
    assertSiteReady(fresh,await loadPublishedHistory(job.edition,job.date,new Date()),new Date());
   });
   const update=await TgRunModel.updateOne({_id:job.id,'review.bundleSha256':receipt.bundleSha256,revision:job.revision},{$set:{sitePublication:receipt}});
   if(update.matchedCount!==1)throw Error('Website receipt requires reconciliation');
   results.push({date:job.date,state:'website-published',url:receipt.url});
  }catch{results.push({date:job.date,state:'website-blocked',reason:'Controlli, finestra o file non verificati; nessun invio social'});}
 }
 console.log(JSON.stringify({results,website:true,social:false,generation:false}));
}
main().catch(()=>{console.error(JSON.stringify({state:'blocked',website:true,social:false}));process.exitCode=1;}).finally(()=>mongoose.disconnect());
