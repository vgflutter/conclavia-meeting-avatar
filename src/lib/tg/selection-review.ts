import {broadItalia} from './editorial-profile';
import type {TgProduct,TgResearch,TgStory} from './types';

export interface SourceEditorCheck {
 coreSupported:boolean;coherentSources:boolean;fresh:boolean;italyFocus:boolean;
 scope:string;decisionReason?:string;reason:string;sourceUrls:string[];
}
/** Evidence failures stay failures. Coverage/balance only chooses among
 * positively corroborated candidates, and records valid reserves separately. */
export function applySourceEditorReview(research:TgResearch,checks:Record<string,SourceEditorCheck>,product?:TgProduct){
 const broad=!!product&&broadItalia(product),reserves:string[]=[];
 const qualified=research.stories.filter(story=>{
  const c=checks[story.id];
  const shared=broad&&story.category==='science'&&c?.scope==='shared-knowledge';
  const scope=c&&(c.scope==='major-world'||c.italyFocus&&['italy','italy-impact'].includes(c.scope)||shared);
  return c&&scope&&c.coreSupported&&c.coherentSources&&c.fresh&&c.reason.trim().length>=30&&new Set(c.sourceUrls).size>=2;
 });
 let stories=qualified;
 if(broad){
  const order=new Map(research.stories.map((s,i)=>[s.id,i]));
  const rank=(a:TgStory,b:TgStory)=>b.importance-a.importance||order.get(a.id)!-order.get(b.id)!;
  const ranked=[...qualified].sort(rank),domestic:TgStory[]=[],exceptions:TgStory[]=[];
  let global=0,science=0;
  const reserve=(s:TgStory,why:string)=>reserves.push(`${s.id}: riserva corroborata (${why}); non è uno scarto fattuale`);
  for(const s of ranked){
   const scope=checks[s.id].scope;
   if(scope==='major-world'){if(global++<2)exceptions.push(s);else reserve(s,'massimo due eccezioni mondiali');}
   else if(scope==='shared-knowledge'){if(science++<1)exceptions.push(s);else reserve(s,'massimo una notizia scientifica senza impatto italiano specifico');}
   else domestic.push(s);
  }
  while(exceptions.length&&exceptions.length>=domestic.length)reserve(exceptions.pop()!,'il focus italiano deve restare maggioritario');
  const eligible=[...domestic,...exceptions].sort(rank);
  stories=eligible.slice(0,8);
  // Breadth is a tie-break among strong admitted stories, never a weak quota.
  for(const s of eligible.slice(8)){
   if(s.importance<50||stories.some(p=>p.category===s.category))continue;
   const replace=stories.findLastIndex(p=>stories.filter(x=>x.category===p.category).length>1&&checks[p.id].scope===checks[s.id].scope&&p.importance-s.importance<=8);
   if(replace>=0)stories[replace]=s;
  }
  const kept=new Set(stories.map(s=>s.id));
  for(const s of eligible)if(!kept.has(s.id))reserve(s,'budget e ampiezza della puntata');
  stories.sort(rank);
 }
 const used=new Set(stories.flatMap(s=>s.sourceIds));
 return {...research,stories,sources:research.sources.filter(s=>used.has(s.id)),warnings:[...research.warnings,...reserves]};
}
