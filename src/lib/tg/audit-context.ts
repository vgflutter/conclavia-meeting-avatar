import {auditTargets} from './editorial';
import type {TgResearch,TgScript} from './types';
import type {TgEvidenceStory} from './evidence-cache';
type EvidenceInput={data:unknown;sources:{url:string;title:string}[];webByStory?:Record<string,string[]>};
function targetStoryId(script:TgScript,key:string){
 const match=key.match(/^(sentence|headline|context|change)_(\d+)$/u);
 const id=match?.[1]==='sentence'?script.sentences[Number(match[2])]?.storyId
  :match?.[1]==='headline'?script.headlines?.[Number(match[2])]?.storyId
  :match?script.cards?.[Number(match[2])]?.storyId:undefined;
 return id&&!['intro','outro'].includes(id)?id:undefined;
}
/** URL eligibility follows the actual story, independently of batch layout. */
export function auditCitationScopes(research:TgResearch,script:TgScript,searched:EvidenceInput){
 const global=[...new Set([...research.sources.map(s=>s.url),...searched.sources.map(s=>s.url)])];
 return Object.fromEntries(auditTargets(script).map(target=>{
  const id=targetStoryId(script,target.key);if(!id)return [target.key,global];
  const ids=new Set([...(research.stories.find(s=>s.id===id)?.sourceIds??[]),...script.sentences.filter(s=>s.storyId===id).flatMap(s=>s.sourceIds)]);
  const web=searched.webByStory?.[id]??(Array.isArray(searched.data)?(searched.data as TgEvidenceStory[]).filter(d=>d.storyId===id).flatMap(d=>d.sources.map(s=>s.url)):[]);
  return [target.key,[...new Set([...research.sources.filter(s=>ids.has(s.id)).map(s=>s.url),...web])]];
 }));
}
/** Group related checks so one source dossier is not resent for unrelated
 * headlines/cards. Preserve every original key, with a bounded response size. */
export function factAuditBatches(script:TgScript,maximum=6){
 if(!Number.isInteger(maximum)||maximum<1||maximum>6)throw Error('Invalid fact-check batch size');
 const groups=new Map<string,string[]>();
 for(const target of auditTargets(script)){
  const id=targetStoryId(script,target.key)??'__edition__';
  if(!groups.has(id))groups.set(id,[]);groups.get(id)!.push(target.key);
 }
 return [...groups.values()].flatMap(keys=>Array.from({length:Math.ceil(keys.length/maximum)},(_,i)=>keys.slice(i*maximum,(i+1)*maximum)));
}

/** Scope evidence, never the spoken context or the required check keys. The
 * global summary/title and bookends retain the entire edition. No brief or
 * source excerpt is shortened; all clauses of a relevant story stay visible. */
export function factBatchContext(research:TgResearch,script:TgScript,searched:EvidenceInput,keys:string[]){
 const all=auditTargets(script),allowed=new Set(all.map(t=>t.key));
 if(!keys.length||new Set(keys).size!==keys.length||keys.some(k=>!allowed.has(k)))throw Error('Unknown or repeated fact-check target');
 const structured=Array.isArray(searched.data)&&searched.data.every(d=>d&&typeof d.storyId==='string'&&Array.isArray(d.sources));
 const wanted=new Set<string>();let global=!structured;
 for(const key of keys){
  const storyId=targetStoryId(script,key);
  if(!storyId||!research.stories.some(s=>s.id===storyId))global=true;else wanted.add(storyId);
 }
 if(global)for(const story of research.stories)wanted.add(story.id);
 const stories=research.stories.filter(s=>wanted.has(s.id));
 const sourceIds=new Set([...stories.flatMap(s=>s.sourceIds),...script.sentences.filter(s=>wanted.has(s.storyId)).flatMap(s=>s.sourceIds)]);
 const sources=global?research.sources:research.sources.filter(s=>sourceIds.has(s.id));
 const data=structured&&!global?(searched.data as TgEvidenceStory[]).filter(d=>wanted.has(d.storyId)):searched.data;
 const webByStory=global?searched.webByStory??{}:Object.fromEntries(Object.entries(searched.webByStory??{}).filter(([id])=>wanted.has(id)));
 const webUrls=new Set([...(structured?(data as TgEvidenceStory[]).flatMap(d=>d.sources.map(s=>s.url)):[]),...Object.values(webByStory).flat()]);
 const webSources=global?searched.sources:searched.sources.filter(s=>webUrls.has(s.url));
 const consulted=[...new Map([...sources.map(s=>({url:s.url,title:s.title})),...webSources].map(s=>[s.url,s])).values()];
 const scopedResearch={...research,stories,sources};delete scopedResearch.retrievedContext;
 return {research:scopedResearch,script,targets:all.filter(t=>keys.includes(t.key)),consultedSourceCatalog:consulted,citationScopes:auditCitationScopes(research,script,searched),
  searched:{data,sources:webSources,webByStory},storyIds:stories.map(s=>s.id)};
}
