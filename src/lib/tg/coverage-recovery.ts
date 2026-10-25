import {createHash} from 'node:crypto';
import {dailyStoryRange} from './format';
import {requireDailyCoverage,TgCoverageError,TgEditorialError} from './editorial';
import {applySourceEditorReview,type SourceEditorCheck} from './selection-review';
import type {TgProduct,TgResearch,TgStory} from './types';

export const MAX_COVERAGE_ROUNDS=3;
export interface CoverageRound {
 round:number;status:'started'|'completed'|'invalid';at:string;candidateCount?:number;acceptedCount?:number;
 reason?:string;checks?:Record<string,SourceEditorCheck>;
}
export interface CoverageRecoveryState {
 version:1;rounds:CoverageRound[];retained:TgResearch;rejectedKeys:string[];
}
export interface CoverageRecoveryContext {
 round:number;missing:number;retained:TgResearch;rejectedKeys:string[];feedback:string;
}
export interface CoverageRecoveryPorts {
 now():Date;signal:AbortSignal;deadline?:Date;initial?:CoverageRecoveryState;
 find(context:CoverageRecoveryContext):Promise<TgResearch>;
 verify(pool:TgResearch):Promise<{checks:Record<string,SourceEditorCheck>;context?:TgResearch['retrievedContext']}>;
 save(state:CoverageRecoveryState,detail:string):Promise<void>;
}
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export const candidateKey=(s:TgStory)=>hash({headline:s.headline,facts:s.facts,sourceIds:[...s.sourceIds].sort(),development:s.changedSinceYesterday});
/** Merge evidence, never merge two contradictory snapshots of the same source.
 * Canonical candidate IDs avoid collisions between separate researcher calls. */
export function mergeCoverageCandidates(retained:TgResearch,incoming:TgResearch,rejectedKeys:readonly string[],now:Date):TgResearch{
 const sources=new Map(retained.sources.map(s=>[s.id,s]));
 for(const s of incoming.sources){
  const previous=sources.get(s.id);
  if(previous&&hash(previous)!==hash(s))throw new TgCoverageError('Fonte modificata fra i giri: aggiornare le prove esplicitamente prima di riusarla');
  sources.set(s.id,s);
 }
 const stories=new Map<string,TgStory>(),banned=new Set(rejectedKeys);
 for(const s of [...retained.stories,...incoming.stories]){
  const key=candidateKey(s);if(!banned.has(key))stories.set(key,{...s,id:`c_${key.slice(0,24)}`});
 }
 if(stories.size>26)throw new TgCoverageError('Bacino combinato oltre il budget: nessun recupero illimitato');
 const values=[...stories.values()].sort((a,b)=>b.importance-a.importance),used=new Set(values.flatMap(s=>s.sourceIds));
 return {sources:[...sources.values()].filter(s=>used.has(s.id)),stories:values,collectedAt:now.toISOString(),searchCalls:retained.searchCalls+incoming.searchCalls,warnings:[...new Set([...retained.warnings,...incoming.warnings])]};
}
/** A short selection is an intermediate result, not a failed edition. Retry
 * coverage with NEW candidates; never turn a negative source verdict positive.
 * Provider/auth/quota errors propagate immediately, without a recovery loop. */
export async function recoverDailyCoverage(product:TgProduct,ports:CoverageRecoveryPorts):Promise<TgResearch>{
 const range=dailyStoryRange(product),empty:TgResearch={sources:[],stories:[],collectedAt:ports.now().toISOString(),searchCalls:0,warnings:[]};
 const state:CoverageRecoveryState=structuredClone(ports.initial??{version:1,rounds:[],retained:empty,rejectedKeys:[]});
 if(state.version!==1||state.rounds.length>MAX_COVERAGE_ROUNDS||state.rounds.some((r,i)=>r.round!==i+1))throw new TgCoverageError('Stato del recupero non valido: non azzerare i tentativi');
 const checkWindow=()=>{ports.signal.throwIfAborted();if(ports.deadline&&ports.now().getTime()>=ports.deadline.getTime())throw new TgCoverageError('Finestra di recupero chiusa: nessuna produzione o pubblicazione fuori orario');};
 checkWindow();
 if(state.rounds.at(-1)?.status==='completed'&&state.retained.stories.length>=range.min){requireDailyCoverage(product,state.retained);return state.retained;}
 for(let round=state.rounds.length+1;round<=MAX_COVERAGE_ROUNDS;round++){
  checkWindow();
  const missing=Math.max(0,range.min-state.retained.stories.length);
  const report:CoverageRound={round,status:'started',at:ports.now().toISOString()};state.rounds.push(report);
  await ports.save(structuredClone(state),`Ricerca ${round}/${MAX_COVERAGE_ROUNDS}: ${state.retained.stories.length} notizie valide conservate, ne mancano ${missing}`);
  let incoming:TgResearch;
  try{
   incoming=await ports.find({round,missing,retained:structuredClone(state.retained),rejectedKeys:[...state.rejectedKeys],feedback:JSON.stringify({instruction:'Return ONLY new, distinct developments. The controller retains valid stories; do not return those again. do not repeat unchanged rejected candidates or relabel yesterday news. Broaden Italian economy, work, services, society, science, culture and sport before using global exceptions.',missing,previousRounds:state.rounds.slice(0,-1),retained:state.retained.stories})});
  }catch(error){
   if(!(error instanceof TgEditorialError))throw error;
   report.status='invalid';report.reason=error.message;await ports.save(structuredClone(state),`Ricerca ${round}: selezione da correggere (${error.message.slice(0,160)}); recupero successivo automatico`);continue;
  }
  checkWindow();
  const pool=mergeCoverageCandidates(state.retained,incoming,state.rejectedKeys,ports.now());
  const checked:{checks:Record<string,SourceEditorCheck>;context?:TgResearch['retrievedContext']}=pool.stories.length?await ports.verify(pool):{checks:{}};
  const accepted=applySourceEditorReview(pool,checked.checks,product);
  const kept=new Set(accepted.stories.map(s=>s.id));accepted.retrievedContext=checked.context?.filter(c=>kept.has(c.storyId));
  accepted.warnings.push(...pool.stories.filter(s=>!kept.has(s.id)&&!accepted.warnings.some(w=>w.startsWith(s.id+':'))).map(s=>`${s.id}: ${checked.checks[s.id]?.reason??'Verifica fonti mancante'}`));
  for(const s of pool.stories){
   const c=checked.checks[s.id];
   if(!c||!c.coreSupported||!c.coherentSources||!c.fresh||c.scope==='exclude')state.rejectedKeys.push(candidateKey(s));
  }
  state.rejectedKeys=[...new Set(state.rejectedKeys)];state.retained=accepted;
  report.status='completed';report.checks=checked.checks;report.candidateCount=pool.stories.length;report.acceptedCount=accepted.stories.length;
  await ports.save(structuredClone(state),accepted.stories.length<range.min?`Ricerca ${round}: ${accepted.stories.length}/${range.min} valide, ricerca integrativa immediata`:`Copertura raggiunta: ${accepted.stories.length} notizie; proseguono scrittura e controlli A/B`);
  checkWindow();
  if(accepted.stories.length>=range.min){requireDailyCoverage(product,accepted);return accepted;}
 }
 throw new TgCoverageError(`Recupero esaurito dopo ${state.rounds.length} giri: ${state.retained.stories.length}/${range.min} notizie verificate. Intervento necessario, nessuna pubblicazione incompleta`);
}
