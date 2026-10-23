import fs from 'node:fs/promises';
import {connectToDatabase} from '../../src/lib/mongodb';
import {TgRunModel} from '../../src/models/tg/TgRun';
import {validateResearch} from '../../src/lib/tg/editorial';
import type {TgSource} from '../../src/lib/tg/types';
async function main(){
 if(process.env.TG_PILOT_ALLOWED!=='true'||process.env.MONGODB_URI!=='mongodb://127.0.0.1:27018'||!process.env.MONGODB_DB_NAME?.startsWith('conclavia_e2e_')||process.env.TG_PUBLISH_ENABLED==='true')throw new Error('Ripristino limitato ai piloti locali senza pubblicazione');
 await connectToDatabase();
 for(const edition of ['it','world']){
  const root='.tg-artifacts/debug',files=(await fs.readdir(root)).filter(f=>f.endsWith('-catalog-'+edition+'.json')).sort();const trace=JSON.parse(await fs.readFile(root+'/'+files.at(-1),'utf8'));
  const ledger:TgSource[]=trace.ledger,stories=trace.data.stories.map((s:{sourcePair:{first:string;second:string};facts:{sourceIds:string[]}[]})=>({...s,sourceIds:[...new Set([s.sourcePair.first,s.sourcePair.second,...s.facts.flatMap(f=>f.sourceIds)])]}));
  const used=new Set(stories.flatMap((s:{sourceIds:string[]})=>s.sourceIds));const research=validateResearch({sources:ledger.filter(s=>used.has(s.id)),stories},new Set(ledger.map(s=>s.url)),new Date(),new Map(ledger.map(s=>[s.url,s.independentGroup])));
  const run=await TgRunModel.findOneAndUpdate({edition,state:'failed',approvedAt:{$exists:false}},{$set:{state:'queued',research,issues:[]},$push:{events:{$each:[{at:new Date().toISOString(),stage:'queued',detail:'Ricerca originale recuperata dal catalogo immutabile e rivalidata: nessuna nuova richiesta al modello'}],$slice:-50}}},{returnDocument:'after'});
  console.log(JSON.stringify({edition,id:run?._id.toString(),stories:research.stories.length,attempts:run?.attempts}));
 }
 const {default:mongoose}=await import('mongoose');await mongoose.disconnect();
}
void main().catch(e=>{console.error(e.message);process.exitCode=1;});
