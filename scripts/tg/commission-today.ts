/** One explicit first Mac cycle. Preserve the previous attempt and all counters. */
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import mongoose from 'mongoose';
import {connectToDatabase} from '../../src/lib/mongodb';
import {TgEditionModel} from '../../src/models/tg/TgEdition';
import {TgRunModel} from '../../src/models/tg/TgRun';
import {TgDeliveryModel} from '../../src/models/tg/TgDelivery';
import {serializeJob} from '../../src/lib/tg/store';
import {localEditionDate} from '../../src/lib/tg/schedule';
import {firstMacCommissionProduct} from '../../src/lib/tg/manual-commission';

async function main(){
 if(!process.argv.includes('--confirm')||process.env.TG_PUBLISH_ENABLED!=='false')throw Error('Commissione esplicita senza invii social richiesta');
 await connectToDatabase();const now=new Date(),date=localEditionDate(now,'Europe/Rome');
 const saved=await TgRunModel.findOne({edition:'it',date}).select('+commissioning +publicationLeaseUntil').lean().orFail(),job=serializeJob(saved);
 if(saved.commissioning?.kind==='first-mac-cycle')return console.log(JSON.stringify({jobId:job.id,date,alreadyCommissioned:true}));
 if(saved.leaseUntil&&saved.leaseUntil>now||saved.publicationLeaseUntil&&saved.publicationLeaseUntil>now||await TgDeliveryModel.exists({jobId:job.id}))throw Error('Lavorazione o invio già in corso');
 const edition=await TgEditionModel.findOne({edition:'it'}).lean().orFail();
 const product=firstMacCommissionProduct(job,edition.product,now),snapshot=JSON.stringify(job),snapshotSha256=createHash('sha256').update(snapshot).digest('hex');
 const directory='.daily-agent/commission-'+date;await mkdir(directory,{recursive:true,mode:0o700});
 await writeFile(directory+'/before-'+job.id+'-'+job.revision+'.json',snapshot+'\n',{flag:'wx',mode:0o600}).catch(error=>{if(error.code!=='EEXIST')throw error;});
 const commissioning={kind:'first-mac-cycle',id:randomUUID(),at:now.toISOString(),reason:'Avvio straordinario odierno richiesto esplicitamente dall’utente; Mac → sito → Work',snapshotSha256,previous:job};
 const changed=await TgRunModel.updateOne({_id:saved._id,revision:saved.revision,state:'blocked',commissioning:{$exists:false}},{$set:{product,state:'queued',commissioning},$unset:{nextProductionAttemptAt:1},$inc:{revision:1},$push:{events:{$each:[{at:now.toISOString(),stage:'queued',detail:'Prima produzione Mac richiesta dall’utente: finestra straordinaria odierna, tentativo precedente conservato; contatori e controlli invariati.'}],$slice:-50}}});
 if(changed.modifiedCount!==1)throw Error('Edizione cambiata durante la commissione');
 console.log(JSON.stringify({jobId:job.id,date,productionTime:product.productionTime,publishTime:product.publishTime,timezone:product.timezone,attemptsPreserved:job.attempts}));
}
main().catch(()=>{console.error('Commissione odierna non applicata: verificare lo stato senza azzerare i controlli');process.exitCode=1;}).finally(()=>mongoose.disconnect());
