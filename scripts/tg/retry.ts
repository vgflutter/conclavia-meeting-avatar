import { Types } from 'mongoose';
import { connectToDatabase } from '../../src/lib/mongodb';
import { TgRunModel } from '../../src/models/tg/TgRun';
import { TgDeliveryModel } from '../../src/models/tg/TgDelivery';
import { parseProduct } from '../../src/lib/tg/config';
import { scriptDigest } from '../../src/lib/tg/editorial';
async function main(){
 const id=process.argv.find(x=>x.startsWith('--id='))?.slice(5),reason=process.argv.find(x=>x.startsWith('--reason='))?.slice(9);
 const resumeVerification=process.argv.includes('--from=verification');
 const resumeMedia=process.argv.includes('--from=media');
 const secondsArg=process.argv.find(x=>x.startsWith('--seconds='))?.slice(10);
 if(!id||!Types.ObjectId.isValid(id)||!reason||reason.length<15||!process.argv.includes('--confirm'))throw new Error('Specificare id, motivo della correzione e --confirm');
 await connectToDatabase();if(await TgDeliveryModel.exists({jobId:id}))throw new Error('Esistono invii: riconciliare i canali, non ripetere la produzione');
 const existing=await TgRunModel.findById(id).lean();if(!existing)throw new Error('Edizione non trovata');
 if(resumeMedia&&(!existing.script||!existing.research||!existing.audit?.passed||existing.audit.scriptSha256!==scriptDigest(existing.script)||Date.now()-new Date(existing.audit.checkedAt).getTime()>6*3600000))throw new Error('Ripresa media richiede un copione verificato e attuale');
 const product=secondsArg?parseProduct({...existing.product,seconds:Number(secondsArg)}):existing.product;
 const run=await TgRunModel.findOneAndUpdate({_id:id,state:{$in:['failed','blocked']},approvedAt:{$exists:false},...(resumeVerification||resumeMedia?{research:{$exists:true},script:{$exists:true}}:{})},{$set:{state:'queued',attempts:0,issues:[],assets:[],product},$unset:resumeMedia?{manifest:1}:resumeVerification?{audit:1,manifest:1}:{research:1,script:1,audit:1,manifest:1,coverageRecovery:1},$push:{...(!resumeMedia&&!resumeVerification&&existing.coverageRecovery?{coverageRecoveryHistory:existing.coverageRecovery}:{}),events:{$each:[{at:new Date().toISOString(),stage:'queued',detail:`Riavvio manuale ${resumeMedia?'dai media':resumeVerification?'dalla verifica':'completo'}${secondsArg?` con minutaggio ${existing.product.seconds} → ${product.seconds} s`:''} dopo correzione: `+reason.slice(0,400)}],$slice:-50}}},{returnDocument:'after'});
 if(!run)throw new Error('Edizione non riprocessabile');console.log(JSON.stringify({id:run._id.toString(),edition:run.edition,state:run.state}));
 const {default:mongoose}=await import('mongoose');await mongoose.disconnect();
}
void main().catch(e=>{console.error(e instanceof Error?e.message:'Riavvio non riuscito');process.exitCode=1;});
