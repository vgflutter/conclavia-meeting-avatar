import { products } from '@/lib/tg/store';
import { editionId } from '@/lib/tg/config';
import {checkChannels} from '@/lib/tg/channel-checks';
import { podcastMutationIsSameOrigin, readPodcastJson } from '@/lib/podcast/request-guard';
export const runtime='nodejs';
export async function POST(request:Request){
  if(!podcastMutationIsSameOrigin(request))return Response.json({error:'Forbidden'},{status:403});
  try{
    const body=await readPodcastJson(request,200) as {edition:unknown};
    if(!editionId(body.edition))return Response.json({error:'Edizione non valida'},{status:400});
    const product=(await products()).find(e=>e.product.edition===body.edition)!.product;
    const checks=await checkChannels(product);
    return Response.json({checks});
  }catch{return Response.json({error:'Verifica dei collegamenti non disponibile'},{status:503});}
}
