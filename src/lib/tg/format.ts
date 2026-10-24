import type {TgProduct} from './types';

/** Editorial clock, shared by research, writing and coverage checks. */
export const DAILY_SECONDS = 300;
export const DAILY_OPENING_PAUSE_SECONDS = 2;
export const DAILY_RUNDOWN = [
  {id:'intro',start:0,end:18},
  {id:'opening-pause',start:18,end:20},
  {id:'lead',start:20,end:95},
  {id:'news-2',start:95,end:143},
  {id:'news-3',start:143,end:191},
  {id:'news-4',start:191,end:239},
  {id:'news-5',start:239,end:287},
  {id:'outro',start:287,end:300},
] as const;

export function dailyRundownSummary() {
  const seconds=DAILY_RUNDOWN.map(block=>block.end-block.start);
  return `Apertura ${seconds[0]} s · pausa ${seconds[1]} s · principale ${seconds[2]} s · altre quattro notizie ${seconds[3]} s ciascuna · chiusura ${seconds[7]} s.`;
}

// Retain coverage checks for existing four-minute jobs as well as new Daily editions.
export function dailyStoryCount(product:Pick<TgProduct,'seconds'>) {
  return product.seconds===DAILY_SECONDS?5:product.seconds===240?4:3;
}
export function dailyStoryRange(product:Pick<TgProduct,'seconds'|'productionStandard'>) {
  return product.productionStandard==='cdaily-v1'?{min:5,max:7}:{min:dailyStoryCount(product),max:dailyStoryCount(product)};
}
export function requiresDailyCoverage(product:Pick<TgProduct,'seconds'|'productionStandard'>) {
  return product.productionStandard==='cdaily-v1'||product.seconds===240||product.seconds===DAILY_SECONDS;
}
export function dailyWritingStructure(product:Pick<TgProduct,'seconds'|'productionStandard'>) {
  if(product.productionStandard==='cdaily-v1')return 'The editorial aim is roughly 4–6 minutes, with justified room up to 7. The real take determines the master duration; this is not an exact 300-second slot. Develop the selected verified stories with unequal weights, a clear lead and useful context for nonexperts. Budget about 650–950 spoken words in total, including the dated greeting, brief orientation and fixed closing. Give the lead at least about 90 words and each secondary about 45 or more when evidence supports it. These minima detect headline-only copy, not permission to pad or invent facts. If evidence cannot support an accessible explanation, stop or revise selection. Reserve a measured two-second silent handoff after the complete introduction. No other filler silence, slow delivery, music in the news or forced tempo. Natural connected phrasing, several semantic mood clauses within each story, no numbered stories.';
  if(product.seconds===DAILY_SECONDS)return 'For the five-minute Daily, develop exactly five substantial corroborated news items with broader coverage and unequal weights. Budget 0:00–0:18 for the spoken opening INCLUDING the fixed greeting: a warm orientation and two or three real topic previews. Reserve 0:18–0:20 for a clean two-second pause before the lead, with no music or impact sound. Budget 0:20–1:35 (75 seconds) for the lead, then four secondary items of about 48 seconds each through 4:47. Reserve 4:47–5:00 (13 seconds, INCLUDING final recovery) for the site reference, fixed comment invitation and signature. These are editorial writing budgets: explain the verified development, who is involved, essential nonexpert context and why it matters. Vary the secondary weights when evidence warrants it, keeping the whole edition at exactly 300 seconds. Never pad weak news, speed-read extra headlines, repeat caveats or slow speech to fill the clock. The production pause must be real and measured; do not simulate it with punctuation or an extra spoken cue.';
  if(product.seconds===240)return 'For an existing four-minute Daily, develop exactly four substantial corroborated news items: 18–20 seconds of opening including the fixed greeting, unequal story weights within the remaining budget and the fixed closing with final recovery inside 240 seconds.';
  return `For this ${product.seconds}-second programme, develop ${dailyStoryCount(product)} corroborated news items, with a brief opening and the fixed closing inside the total clock. Scale explanations by importance and available evidence.`;
}
