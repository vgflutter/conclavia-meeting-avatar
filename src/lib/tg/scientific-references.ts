/** Search citations are not proof that a DOI belongs to the claimed paper.
 * Crossref identity checks are read-only, bounded and provider-independent. */
export interface EvidenceLink {url:string;title:string}
const normalized=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function nejmDoi(url:string){
 try{const u=new URL(url);if(u.hostname!=='www.nejm.org'&&u.hostname!=='nejm.org')return;
  const id=u.pathname.match(/\/(?:10\.1056\/)?(NEJM[a-z]+\d+)(?:\/|$)/iu)?.[1];
  return id?'10.1056/'+id.toLowerCase():undefined;
 }catch{return;}
}
export async function verifyScientificReferences<T extends {brief:unknown;sources:EvidenceLink[]}>(item:T,signal:AbortSignal,fetcher=fetch){
 const rejected:{url:string;reason:string;canonicalTitle?:string;doi:string}[]=[],sources:EvidenceLink[]=[];
 for(const source of item.sources){
  const doi=nejmDoi(source.url);if(!doi){sources.push(source);continue;}
  try{
   const response=await fetcher('https://api.crossref.org/works/'+encodeURIComponent(doi),{redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(10000)]),headers:{Accept:'application/json'}});
   if(!response.ok){await response.body?.cancel();rejected.push({url:source.url,doi,reason:'DOI metadata unavailable'});continue;}
   const payload=await response.json() as {message?:{title?:string[];DOI?:string}};
   const title=payload.message?.title?.[0],identity=title?normalized(title):'',candidate=normalized(source.title);
   if(!identity||normalized(payload.message?.DOI??'')!==normalized(doi)||identity.length<30||!candidate.includes(identity)){
    rejected.push({url:source.url,doi,canonicalTitle:title,reason:'Search title does not establish the identity of this paper'});continue;
   }
   sources.push({...source,title:title!});
  }catch{rejected.push({url:source.url,doi,reason:'DOI identity could not be verified'});}
 }
 const brief=typeof item.brief==='string'&&rejected.length
  ?item.brief.split('\n').filter(line=>!rejected.some(r=>line.includes(r.url))).join('\n')+'\nSCIENTIFIC REFERENCE IDENTITY CHECK — excluded from usable evidence: '+JSON.stringify(rejected)+'. These links cannot support this story. Retain only claims supported by the other actual evidence.'
  :item.brief;
 return {item:{...item,brief,sources},rejected};
}
