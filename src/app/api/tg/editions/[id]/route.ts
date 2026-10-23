import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { authoritativeJob, editorialAction, TgNewsroomError } from '@/lib/tg/newsroom';
import { podcastMutationIsSameOrigin, readPodcastJson, PodcastRequestError } from '@/lib/podcast/request-guard';
export const runtime='nodejs';
type Context={params:Promise<{id:string}>};
export async function GET(_request:Request,context:Context){
  const {id}=await context.params;if(!Types.ObjectId.isValid(id))return Response.json({error:'Edizione non trovata'},{status:404});
  try{await connectToDatabase();return Response.json({job:await authoritativeJob(id)},{headers:{'Cache-Control':'no-store'}});}
  catch(error){return Response.json({error:error instanceof TgNewsroomError?error.message:'Archivio non disponibile'},{status:error instanceof TgNewsroomError?error.status:503});}
}
export async function POST(request:Request,context:Context){
  if(!podcastMutationIsSameOrigin(request))return Response.json({error:'Forbidden'},{status:403});
  const {id}=await context.params;if(!Types.ObjectId.isValid(id))return Response.json({error:'Edizione non trovata'},{status:404});
  try{const body=await readPodcastJson(request,6000);if(!body||typeof body!=='object')throw new TgNewsroomError('Azione non valida',400);await connectToDatabase();return Response.json({job:await editorialAction(id,body as Record<string,unknown>)});}
  catch(error){return Response.json({error:error instanceof TgNewsroomError||error instanceof PodcastRequestError?error.message:'Azione TG non riuscita'},{status:error instanceof TgNewsroomError||error instanceof PodcastRequestError?error.status:503});}
}
