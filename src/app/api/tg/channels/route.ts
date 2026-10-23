import { products } from '@/lib/tg/store';
import { editionId } from '@/lib/tg/config';
import { tgReadiness } from '@/lib/tg/readiness';
import { channelDestination } from '@/lib/tg/review';
import { verifyChannel } from '@/lib/tg/publishers';
import { TgChannelCheckModel } from '@/models/tg/TgChannelCheck';
import { podcastMutationIsSameOrigin, readPodcastJson } from '@/lib/podcast/request-guard';
export const runtime='nodejs';
export async function POST(request:Request){
  if(!podcastMutationIsSameOrigin(request))return Response.json({error:'Forbidden'},{status:403});
  try{
    const body=await readPodcastJson(request,200) as {edition:unknown};
    if(!editionId(body.edition))return Response.json({error:'Edizione non valida'},{status:400});
    const product=(await products()).find(e=>e.product.edition===body.edition)!.product;
    const checks=await Promise.all(tgReadiness(product).channels.map(async channel=>{
      let ok=false,label=channel.reason;
      if(channel.configured){try{label=(await verifyChannel({edition:product.edition},channel.platform,AbortSignal.timeout(30000))).slice(0,150);ok=true;}catch{label='Collegamento non confermato: controllare account e autorizzazioni';}}
      return TgChannelCheckModel.findOneAndUpdate({edition:product.edition,platform:channel.platform},{$set:{destination:channelDestination(product.edition,channel.platform),ok,label,checkedAt:new Date()}},{upsert:true,returnDocument:'after'}).select('edition platform ok label checkedAt').lean();
    }));
    return Response.json({checks});
  }catch{return Response.json({error:'Verifica dei collegamenti non disponibile'},{status:503});}
}
