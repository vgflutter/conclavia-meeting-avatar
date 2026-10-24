import {Types} from 'mongoose';
import {connectToDatabase} from '@/lib/mongodb';
import {TgRunModel} from '@/models/tg/TgRun';
import {serializeJob} from '@/lib/tg/store';
import {editionTextFiles} from '@/lib/tg/edition-text-files';
import {auditIsCurrent} from '@/lib/tg/review';
export const runtime='nodejs';
const allowed=new Set(['edition-dossier.md','research.json','script.json','social-summary.txt','rundown.md','social-posts.json','editorial-package.json','narration.txt','performance-score.txt']);
/** Authenticated operator route. Render from the current DB snapshot, never
 * expose stale files, a private directory listing or a public media capability. */
export async function GET(request:Request,context:{params:Promise<{id:string}>}){
  const {id}=await context.params,name=new URL(request.url).searchParams.get('name')??'';
  if(!Types.ObjectId.isValid(id)||!allowed.has(name))return new Response('Not found',{status:404});
  try{
    await connectToDatabase();const record=await TgRunModel.findById(id).lean();
    if(!record?.script||!record.research)return new Response('Not found',{status:404});
    const job=serializeJob(record),body=editionTextFiles(job)[name];
    return new Response(body,{headers:{'Content-Type':name.endsWith('.json')?'application/json; charset=utf-8':'text/plain; charset=utf-8',
      'Content-Disposition':`attachment; filename="${job.date}-${name}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
      'X-CDaily-Editorial-Status':auditIsCurrent(job)?'verified':'draft','X-CDaily-Publication':job.state==='published'?'published':'unpublished'}});
  }catch{return new Response('Testi non disponibili',{status:503});}
}
