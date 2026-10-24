import 'server-only';
import {TgChannelCheckModel} from '@/models/tg/TgChannelCheck';
import {tgReadiness} from './readiness';
import {channelDestination} from './review';
import {verifyChannel} from './publishers';
import type {TgProduct} from './types';
/** Reads remote account metadata only; it cannot upload, schedule or publish. */
export async function checkChannels(product:TgProduct){
  return Promise.all(tgReadiness(product).channels.map(async channel=>{
    let ok=false,label=channel.reason;
    if(channel.configured){try{label=(await verifyChannel({edition:product.edition},channel.platform,AbortSignal.timeout(30000))).slice(0,150);ok=true;}catch{label='Collegamento non confermato: controllare account e autorizzazioni';}}
    return TgChannelCheckModel.findOneAndUpdate({edition:product.edition,platform:channel.platform},{$set:{destination:channelDestination(product.edition,channel.platform),ok,label,checkedAt:new Date()}},{upsert:true,returnDocument:'after'}).select('edition platform ok label checkedAt').lean();
  }));
}
