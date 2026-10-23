/** Explicit bounded live review of a public pilot script. Never publishes. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {generateLlmJson} from '../../src/lib/podcast/llm-provider';
import {retrieveAuditEvidence} from '../../src/lib/tg/agents';
import {EDITORIAL_POLICY,dailyClosing,dailyCopyIssues,dailySummaryIssues} from '../../src/lib/tg/editorial';
import type {TgResearch,TgScript} from '../../src/lib/tg/types';
const arg=(name:string)=>process.argv.find(v=>v.startsWith('--'+name+'='))?.slice(name.length+3);
async function main(){
 const id=arg('id'),reuse=arg('reuse-live'),sourceRepair=process.argv.includes('--source-repair');
 if(!process.argv.includes('--confirm')||process.env.TG_PUBLISH_ENABLED!=='false'||!id||!/^\d{4}-\d{2}-\d{2}-it-pilot(?:-r\d+)?$/u.test(id))throw Error('Explicit isolated public pilot review required');
 const score=JSON.parse(await readFile('scripts/tg/editions/'+id+'.json','utf8'));
 const script:TgScript={title:score.title,description:score.description,headlines:score.scenes.filter((s:{id:string})=>!['apertura','chiusura'].includes(s.id)).map((s:{id:string;lines:string[]})=>({storyId:s.id,title:s.lines.join(' ')})),sentences:score.lines.map((l:{scene:string;text:string;mood:string;intensity:number;intent:string;gestureWord?:string;sourceIds:string[]})=>({...l,storyId:l.scene==='apertura'?'intro':l.scene==='chiusura'?'outro':l.scene,speaker:0}))};
 const issues=[...dailyCopyIssues(script),...dailySummaryIssues(script)];if(issues.length)throw Error(issues.join('; '));
 const stories=script.headlines!.map(h=>({id:h.storyId,headline:h.title,category:'society' as const,importance:80,sourceIds:[...new Set(script.sentences.filter(s=>s.storyId===h.storyId).flatMap(s=>s.sourceIds))],facts:script.sentences.filter(s=>s.storyId===h.storyId).map(s=>({text:s.text,sourceIds:s.sourceIds})),changedSinceYesterday:'See the explicit event dates and new developments in the cited evidence ledger.',whyItMatters:'Assess explicitly in editorial review B.',uncertainty:''}));
 if(stories.length<3||stories.length>7||script.sentences.length>60)throw Error('Review expects 3–7 justified stories and a bounded script');
 const research:TgResearch={stories,sources:score.sources.map((s:{id:string;publisher:string;url:string;date:string;evidence:string;independentGroup:string})=>({...s,title:s.publisher,publishedAt:s.date+'T00:00:00Z'})),collectedAt:new Date().toISOString(),searchCalls:0,warnings:[]};
 const hash=createHash('sha256').update(JSON.stringify(score)).digest('hex');
 const dir='docs/tg/editions/'+id;await mkdir(dir,{recursive:true});
 const evidenceFile=dir+'/'+hash.slice(0,12)+'-live-evidence.json';let live;
 if(sourceRepair){
  live=JSON.parse(await readFile(dir+'/source-repaired-live-evidence.json','utf8'));
  if(!live.sourceRepair||Date.now()-new Date(live.retrievedAt).getTime()>3600000)throw Error('No current source repair evidence');
 }else try{live=JSON.parse(await readFile(evidenceFile,'utf8'));}catch{
  let result;
  if(reuse){
   if(!/^[a-f0-9]{12}-live-evidence\.json$/u.test(reuse))throw Error('Invalid live evidence snapshot');
   const prior=JSON.parse(await readFile(dir+'/'+reuse,'utf8'));
   if(Date.now()-new Date(prior.retrievedAt).getTime()>3600000||JSON.stringify(prior.data.map((s:{storyId:string})=>s.storyId).sort())!==JSON.stringify(stories.map(s=>s.id).sort()))throw Error('Live evidence is stale or covers a different selection');
   result={...prior,reusedFrom:reuse};
  }else result=await retrieveAuditEvidence(research,script,AbortSignal.timeout(180000));
  live={sourceScoreSha256:hash,retrievedAt:new Date().toISOString(),...result};await writeFile(evidenceFile,JSON.stringify(live,null,2)+'\n');
 }
 let publicationHistory:{verified?:boolean;checkedAt?:string;edition?:string;through?:string;published?:unknown[]}|undefined;
 try{publicationHistory=JSON.parse(await readFile(dir+'/published-history-proof.json','utf8'));}catch{}
 const publicationHistoryVerified=publicationHistory?.verified===true&&publicationHistory.edition==='it'&&publicationHistory.through===score.editionDate&&Array.isArray(publicationHistory.published)&&Number.isFinite(Date.parse(publicationHistory.checkedAt??''))&&Date.now()-Date.parse(publicationHistory.checkedAt!)<3600000;
 const targets=[{key:'description',text:script.description,sourceIds:score.sources.map((s:{id:string})=>s.id)},...script.headlines!.map((h,i)=>({key:'headline_'+i,text:h.title,sourceIds:stories[i].sourceIds})),...script.sentences.map((s,i)=>({key:'sentence_'+i,text:s.text,sourceIds:s.sourceIds}))];
 const object=(properties:Record<string,unknown>)=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
 const sourceCatalog=[...new Set(['https://daily.conclavia.me',...score.sources.map((s:{url:string})=>s.url),...live.sources.map((s:{url:string})=>s.url)])] as string[];
 const citationCatalog=Object.fromEntries(sourceCatalog.map((url,i)=>['C'+i,url]));
 // Short catalog references avoid both invented UUIDs and repeating every long
 // URL inside each JSON-schema check. Resolve them locally, preserving the raw
 // references as evidence; the model cannot create a new permitted source.
 const check=object({status:{type:'string',enum:['pass','revise','unverifiable']},reason:{type:'string',maxLength:600},sourceRefs:{type:'array',maxItems:8,items:{type:'string',enum:Object.keys(citationCatalog)}}});
 const keys={A:targets.map(t=>t.key),B:['selection','opening','written_rhythm','explanation','transitions','closing','summary',...stories.map(s=>'story_'+s.id)]};
 const material={cutoff:new Date().toISOString(),scoreSha256:hash,scope:'editorial-pre-take',sourceCatalog,approvedIdentity:{name:'Conclavia Daily',website:'https://daily.conclavia.me',closing:dailyClosing('it'),optionalPreface:'Segui Conclavia Daily. Fonti e approfondimenti su daily.conclavia.me.',style:'avatar-refined-presence-20261023'},separateMediaGate:{status:'pending-recording',requiredChecks:['actual master follows measured natural speech within the bounded pilot duration','actual two-second intro pause','click-free PCM joins','downward gesture on measured commenti','mobile/landscape playback'],editorialReviewDoesNotCertifyThese:true},script,sourceLedger:score.sources,liveEvidence:{retrievedAt:live.retrievedAt,sourceRepair:live.sourceRepair,stories:live.data.map((s:{storyId:string;brief:string})=>({storyId:s.storyId,brief:s.brief}))},targets,publicationHistoryVerified,publishedArchive:publicationHistoryVerified?publicationHistory!.published:null,archiveNote:publicationHistoryVerified?'Read-only real publication ledger attached. Compare claims and genuine new developments, not just headlines.':'The real publication ledger is unavailable or unverified. An empty local pilot folder is not proof of no prior publication. Judge copy for a local pre-take pilot only; do not certify novelty against publication history or readiness to publish.'};
 const results=await Promise.allSettled((['A','B'] as const).map(async role=>{
  const file=dir+'/'+hash.slice(0,12)+'-catalog-v3-review-'+role+(sourceRepair?'-source-repair':'')+'.json';
  try{const cached=JSON.parse(await readFile(file,'utf8'));if(cached.scoreSha256===hash)return cached;}catch{}
  const schema=object({issues:{type:'array',maxItems:20,items:{type:'string',maxLength:600}},checks:object(Object.fromEntries(keys[role].map(key=>[key,check])))});
  const instructions=EDITORIAL_POLICY+(role==='A'?' You are independent fact checker A. Check every required factual claim, headline and summary against the dated immutable ledger and the separately retrieved live evidence. Do not trust the writer, your memory, a search headline, or self-reported neutrality. Preserve attribution, dates and provisional status. New developments must actually be new within 24 hours, not just refreshed old articles. Distinguish indexed excerpts from a retrieved full body. A material unsupported assertion blocks the take. Verify on the available evidence; do not invent sources.':' You are independent editorial reviewer B, in a separate request from the writer and checker A. Judge the supplied selection as a whole, its breadth and concrete relevance to the Italian general audience, nonexpert explanation, absence of political endorsement, spoken rhythm, meaningful transitions and useful detail. Duration follows the material and the actual natural take. Roughly 4–6 minutes is a test hypothesis, not an exact five-minute clock. The introduction is brief and welcoming; two production seconds separate it from the lead. Give more space to lead stories, less to briefs. Italy must have an Italian centre of gravity; world items need documented relevance or exceptional global significance, and World is a separate edition. No routine local weather filler, no numbered stories, no evening-summary framing, no free AI opinion. Check the fixed invitation and downward gesture on commenti. Check that the summary covers every selected item without new claims. Flag only material blockers as revise; optional improvements may be described in passing checks. Do not certify actual audio timing or animation before media exists.');
  const result=await generateLlmJson<{issues:string[];checks:Record<string,{status:string;reason:string;sourceRefs:string[]}>}>({model:'openai-default',schemaName:'daily_public_pilot_'+role,schema,instructions:instructions+' This is PRE-TAKE EDITORIAL REVIEW ONLY. written_rhythm judges sentence construction and flow on the page, not actual recorded speed, PCM pause or gestures. Those require a separate measured media gate after synthesis. Judge the supplied retrieved source ledger as well as the search brief. A search brief saying it did not find a statement is not a factual contradiction of a later full-body source with an explicit pertinent quotation. Prefer the latest dated direct evidence; flag an actual unresolved conflict, rather than assuming the search brief consulted every source. Do not presume full articles were read when retrievalKind says indexed-excerpt. Cite only short sourceRefs from citationCatalog, never retype URLs.',input:JSON.stringify({...material,citationCatalog}),maxOutputTokens:6500,signal:AbortSignal.timeout(150000)});
  const response={role,scoreSha256:hash,checkedAt:new Date().toISOString(),provider:result.generation.provider,model:result.generation.model,inputTokens:result.generation.inputTokens,outputTokens:result.generation.outputTokens,issues:result.data.issues,checks:Object.fromEntries(Object.entries(result.data.checks).map(([key,c])=>[key,{...c,sourceUrls:c.sourceRefs.map(ref=>citationCatalog[ref])}]))};
  const availableUrls=new Set(['https://daily.conclavia.me',...score.sources.map((s:{url:string})=>s.url),...live.sources.map((s:{url:string})=>s.url)]);
  const passed=response.issues.length===0&&keys[role].every(key=>response.checks[key]?.status==='pass'&&response.checks[key].sourceUrls.every(url=>availableUrls.has(url))&&(role!=='A'||!targets.find(t=>t.key===key)?.sourceIds.length||response.checks[key].sourceUrls.length>0));
  const report={...response,scope:'editorial-pre-take',publicationHistoryVerified,publicationReady:false,mediaTimingNotYetVerified:true,passed};await writeFile(file,JSON.stringify(report,null,2)+'\n');return report;
 }));
 for(let i=0;i<results.length;i++){const r=results[i];if(r.status==='rejected')console.log(JSON.stringify({role:i?'B':'A',error:r.reason instanceof Error?r.reason.message:'Review failed',passed:false}));else console.log(JSON.stringify({role:r.value.role,passed:r.value.passed,issues:r.value.issues,checks:r.value.checks}));}
 if(results.some(r=>r.status==='rejected'||!r.value.passed))process.exitCode=1;
}
void main().catch(e=>{console.error(e instanceof Error?e.message:'Pilot review failed');process.exitCode=1;});
