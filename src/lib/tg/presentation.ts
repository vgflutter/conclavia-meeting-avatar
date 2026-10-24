import type { TgJob, TgPlatform } from './types';

export const TG_REVIEW_CHECKS = {
  facts: 'Ho controllato fatti, numeri, date e attribuzioni',
  sources: 'Le fonti sono pertinenti e i riscontri indipendenti',
  balance: 'Selezione, contesto e incertezze sono corretti per questa edizione',
  media: 'Ho visto il video e ascoltato audio, pronunce e sottotitoli',
  publication: 'Titolo, testo social, diritti e dichiarazione AI sono corretti',
} as const;
export const TG_STATE_NAMES: Record<string, string> = {
  queued: 'In coda', researching: 'Ricerca', writing: 'Scrittura', verifying: 'Verifica', editorial_ready:'Testi verificati · media rinviati', voicing: 'Voci', rendering: 'Video', reviewing: 'Revisione finale AI',
  needs_review: 'Da revisionare', ready: 'Approvata', publishing: 'In distribuzione', published: 'Pubblicata', blocked: 'Da correggere', failed: 'Interrotta', cancelled:'Annullata',
};
export const TG_DELIVERY_NAMES: Record<string, string> = {
  waiting: 'In attesa', dispatching: 'Invio in corso', uploading: 'Caricamento riprendibile', submitted: 'Ricevuta · in verifica', polling: 'Controllo ricevuta',
  finalizing: 'Pubblicazione in corso', published: 'Pubblicata', unknown: 'Esito incerto', blocked: 'Intervento richiesto',
};

/** Same reviewed summary in the preview and adapters; no new AI copy at posting time. */
export function publicationCopy(job: Pick<TgJob,'product'|'edition'|'date'|'script'|'research'>, platform: TgPlatform) {
  const baseTitle=job.script?.title||job.product.name;
  const datedTitle=`${baseTitle} | ${job.date}`;
  const title=datedTitle.length<=100?datedTitle:baseTitle.length<=100?baseTitle:`${job.product.name} | ${job.date}`;
  const it = job.product.language === 'it';
  const disclosure = it
    ? 'Edizione preparata con AI per ricerca, stesura, presentatori e voci.'
    : 'AI used for research, script preparation, virtual presenters and voices.';
  const spokenIds = new Set(job.script?.sentences.flatMap(s => s.sourceIds) ?? []);
  const sources = job.research?.sources.filter(s => spokenIds.has(s.id)) ?? [];
  const limit = platform === 'instagram' || platform === 'tiktok' ? 2200 : 4800;
  const header=platform==='instagram'||platform==='tiktok'?title:'';
  const body=job.script?.description??'';
  const invitation=it?'Segui Conclavia Daily e scrivici cosa vuoi approfondire.':'Follow Conclavia Daily and tell us what you would like us to explore.';
  const website=it?'Fonti e approfondimenti: https://daily.conclavia.me':'Sources and further coverage: https://daily.conclavia.me';
  const footer=[invitation,website,disclosure,it?'Fonti:':'Sources:'].join('\n\n');
  // Validated editions reserve <=1100 characters for the complete summary, so it
  // always fits before credits. Old oversized drafts still need an editorial rewrite.
  // Never truncate a factual sentence or cut off the AI disclosure to fit a caption.
  let description=[header,body&&header.length+body.length+footer.length+4<=limit?body:'',footer].filter(Boolean).join('\n\n');
  for (const source of sources) {
    const credit = `\n${source.publisher}: ${source.url}`;
    if (description.length + credit.length <= limit) description += credit;
  }
  return { title, description };
}
