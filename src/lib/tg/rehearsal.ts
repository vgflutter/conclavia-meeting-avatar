import path from 'node:path';
import {addCalendarDays,localEditionDate} from './schedule';
import type {TgProduct} from './types';

/** Extra public evidence endpoints for this private trial, never persisted in the production catalog. */
export const REHEARSAL_EXTRA_DOMAINS=Object.freeze(['lastampa.it','ilgiornale.it','csm.it','giustizia.it','iltorinese.it','festivalinternazionaledelleconomia.com','carloalberto.org']);

/** File-only rehearsal. No database registration, schedule or publication port. */
export function editorialWorkspace(root:string,date:string,rehearsal?:string){
 if(!/^\d{4}-\d{2}-\d{2}$/u.test(date)||addCalendarDays(date,0)!==date)throw Error('Data di prova non valida');
 if(rehearsal!==undefined&&!/^[a-z0-9][a-z0-9-]{2,47}$/u.test(rehearsal))throw Error('Nome prova non valido: usare 3–48 lettere minuscole, numeri o trattini');
 const directory=path.resolve(root,'.tg-artifacts',rehearsal?'rehearsals':'editorial',date,...(rehearsal?[rehearsal]:[]));
 return {directory,reviewDocument:rehearsal?path.join(directory,'review.md'):path.resolve(root,'docs/tg/editions',`${date}-it-editorial-review.md`),
  ...(rehearsal?{artifactDirectory:path.join(directory,'artifacts')}:{}),rehearsal};
}
export function rehearsalProduct(product:TgProduct,now:Date):TgProduct{
 const later=new Date(now.getTime()+90*60000),closes=new Date(later.getTime()+30*60000);
 if(localEditionDate(now,product.timezone)!==localEditionDate(closes,product.timezone))throw Error('Troppo tardi per una prova completa datata oggi');
 const time=(at:Date)=>new Intl.DateTimeFormat('en-GB',{timeZone:product.timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(at);
 return {...product,enabled:false,productionMode:'full',textReviewMode:'manual',productionTime:time(now),publishTime:time(later)};
}
