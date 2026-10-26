import {publicSourceUrl} from './sources';

export interface EvidenceLink {url:string;title:string}
export const AUDIT_SOURCE_POLICY='Cite only evidence that directly supports or contradicts the specific assertion being checked. Sharing a topic, person, publisher or institution is insufficient. Navigation, related-story links and incidental mentions are not corroboration. Distinguish evidence for background from evidence for the new development. Explain the actual evidentiary connection in the existing evidence field; when it is missing, use unsupported or unverifiable rather than padding sourceUrls with marginal links. Preserve relevant contrary evidence and material uncertainty.';

const identity=(value:string)=>publicSourceUrl(value);
/** A discovered search hit is not yet evidence. Keep links actually cited in
 * the brief/annotations; never invent a URL merely mentioned by the model. */
export function citedEvidenceSources(brief:unknown,discovered:EvidenceLink[],annotations:EvidenceLink[]=[]){
 const used=new Set(annotations.map(s=>identity(s.url)).filter(Boolean));
 if(typeof brief==='string')for(const match of brief.matchAll(/https?:\/\/[^\s<>"'\\`]+/gu)){
  let url=match[0].replace(/[.,;!?:]+$/u,'');
  while(url.endsWith(')')&&(url.match(/\)/gu)?.length??0)>(url.match(/\(/gu)?.length??0))url=url.slice(0,-1);
  const key=identity(url);if(key)used.add(key);
 }
 return discovered.filter(s=>used.has(identity(s.url))).filter((s,i,all)=>all.findIndex(x=>identity(x.url)===identity(s.url))===i);
}
