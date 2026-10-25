import type { TgProduct, TgScript } from './types';

/** Cheap warning gates, never a proxy for the two AI content/form reviews.
 * Scope only the new CDaily contract; archived formats keep their old rules. */
export function dailyScriptDepthIssues(product: TgProduct, script: TgScript) {
  if(product.productionStandard!=='cdaily-v1')return [];
  const words=(text:string)=>(text.match(/\S+/gu)??[]).length;
  const total=script.sentences.reduce((n,s)=>n+words(s.text),0), issues:string[]=[];
  if(total<480)issues.push(`Copione di ${total} parole troppo breve per il Daily spiegato: sviluppare il contesto verificato, senza riempitivi`);
  if(total>1350)issues.push(`Copione di ${total} parole oltre il budget sotto i dieci minuti: selezionare ciò che conta, senza accelerare la voce`);
  const ids=[...new Set(script.sentences.filter(s=>!['intro','outro'].includes(s.storyId)).map(s=>s.storyId))];
  for(const [index,id]of ids.entries()){
    const count=script.sentences.filter(s=>s.storyId===id).reduce((n,s)=>n+words(s.text),0);
    if(count<(index===0?90:45))issues.push(`Notizia ${index+1} troppo compressa (${count} parole): spiegare il fatto e il contesto pertinente o rivedere la selezione`);
  }
  return issues;
}
