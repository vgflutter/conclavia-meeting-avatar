import type {TgProduct} from './types';

/** Editorial policy is versioned separately from the approved avatar identity.
 * Frozen editions without the field retain their original acceptance limits. */
export const BROAD_ITALIA_PROFILE='italia-morning-v2' as const;
export const broadItalia=(product:Pick<TgProduct,'editorialProfile'>)=>product.editorialProfile===BROAD_ITALIA_PROFILE;
export const minimumDailySeconds=(product:TgProduct)=>broadItalia(product)?270:180;
export const candidateRange=(product:TgProduct)=>broadItalia(product)?{min:6,target:14,max:18}:undefined;
export const BROAD_ITALIA_SCOPE=`Italy includes public life, economy, work, justice, health, society, nationally relevant sport, culture and science. Italian sport and culture do not need a legislative or economic consequence to be newsworthy: assess significance, novelty and public interest; routine fixtures and celebrity schedules remain weak. Attributed expert warnings can be news without a newly enacted policy, but are not established outcomes. At most two exceptionally major international events may stand on their own; Italian stories must remain a strict majority. Never invent Italian effects. One shared-knowledge science/health item per edition is allowed when newly disclosed and well corroborated, even without a specific Italian consequence: explain its actual relevance and scientific limits. Early clinical results are not an approved treatment or advice. Neither a national focus nor a relevance judgement can replace factual corroboration, freshness or independence.`;
