import { connectToDatabase } from '../../src/lib/mongodb';
import { queueEdition } from '../../src/lib/tg/store';
import { TG_PRODUCTS } from '../../src/lib/tg/config';
async function main() {
  if (process.env.TG_PILOT_ALLOWED !== 'true' || process.env.TG_PUBLISH_ENABLED === 'true' || process.env.MONGODB_URI !== 'mongodb://127.0.0.1:27018' || !process.env.MONGODB_DB_NAME?.startsWith('conclavia_e2e_')) throw new Error('Pilot requires the isolated local database and publication disabled');
  await connectToDatabase();
  const wanted = process.argv.includes('--world') ? ['world'] : process.argv.includes('--it') ? ['it'] : ['it','world'];
  for (const product of TG_PRODUCTS.filter(p => wanted.includes(p.edition))) { const run = await queueEdition({...product,enabled:false,automatic:false}); console.log(JSON.stringify({id:run._id.toString(),edition:run.edition,state:run.state})); }
  const {default:mongoose}=await import('mongoose');await mongoose.disconnect();
}
void main().catch(()=>{console.error('Pilot TG non accodato');process.exitCode=1;});
