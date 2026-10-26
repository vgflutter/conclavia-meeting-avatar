import { createHash } from 'node:crypto';
import { scriptDigest, TgEditorialError } from './editorial';
import type { TgFreshnessCheck, TgFreshnessReview, TgJob, TgPublishedEdition, TgResearch, TgScript } from './types';

export const NEWS_WINDOW_MS = 24 * 3600000;
export const FRESHNESS_MAX_AGE_MS = 3600000;
const SOURCE_WINDOW_MS = 36 * 3600000;
/** Require enough chronology to assess the window, not artificial clock precision. */
export const DAILY_TIMELINE_POLICY = [
  'Use proportionate temporal precision. Establish a dated, corroborated development within the edition window; an exact clock time is not a routine admission requirement.',
  'A dated account of a concluded event plus an explicit part of the day or a reliable sequence of events can establish that window. For example, yesterday afternoon can be sufficient for a morning edition without knowing the exact minute of a vote. Do not infer an event time solely from article publication or invent a missing time.',
  'Seek a more precise time only when the unresolved chronology could materially change admission at the rolling 24-hour boundary or after the last published edition. If that material uncertainty remains, mark unverifiable and explain the boundary at issue; missing minute-level precision alone is not a blocking defect.',
  'A newly corroborated announcement or disclosure within the edition window can be news even if the announced action is still pending or expected later. Date and verify the announcement, preserve attribution and the pending status, and never describe the future action as completed. The announcement need not fall on the current calendar day, but it must itself be evidenced as new within the window.',
  'This does not extend the rolling window or waive independent corroboration: refreshed articles, unchanged aired facts, old announcements and expired alerts remain insufficient.',
].join(' ');
/** Programme continuity concerns the new development, never a ban on recurring topics. */
export const DAILY_CONTINUITY_POLICY = [
  'An important ongoing story may return in consecutive Daily editions when a concrete, corroborated development is new within the edition window.',
  'Lead with what has changed and use brief, clearly dated background so a newcomer can understand it. Previously aired facts are allowed as context but cannot establish novelty. Never reject a developing story merely because its topic was covered before.',
  'Do not replay the unchanged previous report or treat a new headline, refreshed article or source URL as a new development.',
].join(' ');
const normalize = (text: string) => text.normalize('NFKC').toLocaleLowerCase('it').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function historyDigest(history: TgPublishedEdition[]) {
  return createHash('sha256').update(JSON.stringify([...history].sort((a,b)=>a.id.localeCompare(b.id)))).digest('hex');
}
export function researchDigest(research: TgResearch) {
  return createHash('sha256').update(JSON.stringify(research)).digest('hex');
}
export function newsWindowStart(now: Date, history: TgPublishedEdition[]) {
  const times=history.map(edition=>Date.parse(edition.publishedAt));
  if (times.some(time=>!Number.isFinite(time)||time>now.getTime())) throw new TgEditorialError('Archivio delle uscite con date non verificabili');
  return Math.max(now.getTime()-NEWS_WINDOW_MS,...times);
}
function sourceIssues(research:TgResearch, now:Date, history:TgPublishedEdition[],minimum=3) {
  const start=newsWindowStart(now,history),issues:string[]=[];
  if(research.stories.length<minimum||new Set(research.stories.map(s=>s.id)).size!==research.stories.length)issues.push('Scaletta senza storie sufficienti e distinte');
  for(const story of research.stories){
    const sources=research.sources.filter(s=>story.sourceIds.includes(s.id));
    const current=sources.filter(s=>Date.parse(s.publishedAt)>=now.getTime()-SOURCE_WINDOW_MS&&Date.parse(s.publishedAt)<=now.getTime());
    if(new Set(current.map(s=>s.independentGroup)).size<2)issues.push(`${story.id}: mancano due riscontri attuali e indipendenti`);
    if(!sources.some(s=>Date.parse(s.publishedAt)>=start&&Date.parse(s.publishedAt)<=now.getTime()))issues.push(`${story.id}: nessuna fonte nuova nella finestra dell’edizione`);
    for(const edition of history)for(const old of edition.stories){
      const oldClaims=new Set(old.claims.map(normalize));
      if(story.facts.length&&story.facts.every(f=>oldClaims.has(normalize(f.text))))issues.push(`${story.id}: gli stessi fatti sono già stati raccontati in ${edition.date}`);
    }
  }
  return issues;
}
/** Cheap gates before writing; timestamps alone do not establish editorial novelty. */
export function requireFreshCandidates(research:TgResearch, now:Date, history:TgPublishedEdition[],options:{allowPartial?:boolean}={}) {
  const issues=sourceIssues(research,now,history,options.allowPartial?1:3);
  if(issues.length)throw new TgEditorialError(issues.join('; '));
}
export function freshnessSchema(research:TgResearch,history:TgPublishedEdition[],webByStory:Record<string,string[]>) {
  const str={type:'string'};
  const object=<T extends Record<string,unknown>>(properties:T)=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
  const prior=history.flatMap(edition=>edition.stories.map(story=>story.key));
  return object({checks:object(Object.fromEntries(research.stories.map(story=>[story.id,object({
    status:{type:'string',enum:prior.length?['new','update','duplicate','stale','unverifiable']:['new','duplicate','stale','unverifiable']},
    development:{type:'string',maxLength:700},eventDate:{type:'string',maxLength:10},evidence:{type:'string',maxLength:1000},
    sourcePair:{anyOf:story.sourceIds.flatMap(first=>{
      const a=research.sources.find(s=>s.id===first);
      const second=story.sourceIds.filter(id=>research.sources.find(s=>s.id===id)?.independentGroup!==a?.independentGroup);
      return a&&second.length?[object({first:{type:'string',enum:[first]},second:{type:'string',enum:second}})]:[];
    })},
    sourceIds:{type:'array',maxItems:6,items:{type:'string',enum:story.sourceIds}},
    webUrls:{type:'array',maxItems:4,items:webByStory[story.id]?.length?{type:'string',enum:webByStory[story.id]}:str},
    previousStoryKeys:{type:'array',maxItems:Math.min(28,prior.length),items:prior.length?{type:'string',enum:prior}:str},
  })])))});
}
function checkIssues(checks:TgFreshnessCheck[],research:TgResearch,now:Date,start:number,previousKeys:string[]) {
  const issues:string[]=[],known=new Set(previousKeys),utcDay=now.toISOString().slice(0,10),startDay=new Date(start).toISOString().slice(0,10);
  if(checks.length!==research.stories.length||new Set(checks.map(c=>c.storyId)).size!==checks.length)issues.push('Il controllo di attualità non copre tutte le storie');
  for(const story of research.stories){
    const c=checks.find(c=>c.storyId===story.id);
    if(!c||!['new','update'].includes(c.status)){issues.push(`${story.id}: ${c?.status??'controllo mancante'} — ${c?.evidence??'attualità e novità non provate'}`);continue;}
    const ids=c.sourceIds,sources=research.sources.filter(s=>ids.includes(s.id));
    if(c.development.trim().length<20||c.evidence.trim().length<20)issues.push(`${story.id}: manca la spiegazione verificata del fatto nuovo`);
    if(!/^\d{4}-\d{2}-\d{2}$/u.test(c.eventDate)||(!Number.isFinite(Date.parse(c.eventDate+'T00:00:00Z'))||new Date(c.eventDate+'T00:00:00Z').toISOString().slice(0,10)!==c.eventDate)||c.eventDate<startDay||c.eventDate>utcDay)issues.push(`${story.id}: data dello sviluppo vecchia, futura o non verificabile`);
    if(ids.some(id=>!story.sourceIds.includes(id))||new Set(sources.filter(s=>Date.parse(s.publishedAt)>=now.getTime()-SOURCE_WINDOW_MS&&Date.parse(s.publishedAt)<=now.getTime()).map(s=>s.independentGroup)).size<2||!sources.some(s=>Date.parse(s.publishedAt)>=start&&Date.parse(s.publishedAt)<=now.getTime()))issues.push(`${story.id}: il nuovo sviluppo non ha riscontri attuali sufficienti`);
    if(!c.webUrls.length)issues.push(`${story.id}: nessuna ricerca indipendente sulla data e sullo sviluppo`);
    if(c.previousStoryKeys.some(key=>!known.has(key))||(c.status==='update'&&!c.previousStoryKeys.length)||(c.status==='new'&&c.previousStoryKeys.length))issues.push(`${story.id}: confronto con le uscite precedenti incoerente`);
  }
  return issues;
}
/** Model verdicts never select their own clock, archive or source catalog. */
export function validateFreshness(value:unknown,research:TgResearch,script:TgScript,history:TgPublishedEdition[],webByStory:Record<string,string[]>,now:Date):TgFreshnessReview {
  const raw=value as {checks?:Record<string,Omit<TgFreshnessCheck,'storyId'>>};
  if(!raw?.checks||typeof raw.checks!=='object'||Object.keys(raw.checks).length!==research.stories.length)throw new TgEditorialError('Verifica di attualità incompleta');
  const checks=research.stories.map(story=>{
    const c=raw.checks![story.id];
    const pair=(c as typeof c&{sourcePair?:{first:string;second:string}})?.sourcePair;
    if(pair)c.sourceIds=[...new Set([pair.first,pair.second,...(Array.isArray(c.sourceIds)?c.sourceIds:[])])];
    if(!c||!['new','update','duplicate','stale','unverifiable'].includes(c.status)||typeof c.eventDate!=='string'||typeof c.development!=='string'||typeof c.evidence!=='string'||c.development.length>700||c.evidence.length>1000||!Array.isArray(c.sourceIds)||c.sourceIds.length>8||c.sourceIds.some(id=>typeof id!=='string')||!Array.isArray(c.webUrls)||c.webUrls.length>4||c.webUrls.some(url=>!webByStory[story.id]?.includes(url))||!Array.isArray(c.previousStoryKeys)||c.previousStoryKeys.length>28||c.previousStoryKeys.some(key=>typeof key!=='string'))throw new TgEditorialError(`Verifica di attualità incompleta: ${story.id}`);
    return {...c,storyId:story.id};
  });
  const start=newsWindowStart(now,history),previousKeys=history.flatMap(edition=>edition.stories.map(story=>story.key));
  const issues=[...sourceIssues(research,now,history),...checkIssues(checks,research,now,start,previousKeys)];
  for(const c of checks)for(const edition of history)for(const old of edition.stories){
    if(normalize(c.development)===normalize(old.development??'')||old.claims.some(claim=>normalize(claim)===normalize(c.development)))issues.push(`${c.storyId}: lo sviluppo dichiarato è già nell’archivio pubblicato`);
  }
  return {version:1,checkedAt:now.toISOString(),researchSha256:researchDigest(research),scriptSha256:scriptDigest(script),historySha256:historyDigest(history),windowStart:new Date(start).toISOString(),previousStoryKeys:previousKeys,checks,issues,passed:!issues.length};
}
export function freshnessIsCurrent(job:Pick<TgJob,'research'|'script'|'audit'>,now=new Date(),history?:TgPublishedEdition[]) {
  try {
  const f=job.audit?.freshness,at=Date.parse(f?.checkedAt??''),start=Date.parse(f?.windowStart??'');
  if(!job.research||!job.script||!f||f.version!==1||!f.passed||f.issues.length||!Number.isFinite(at)||at>now.getTime()+60000||now.getTime()-at>=FRESHNESS_MAX_AGE_MS||!Number.isFinite(start)||start<at-NEWS_WINDOW_MS||start>at||f.researchSha256!==researchDigest(job.research)||f.scriptSha256!==scriptDigest(job.script)||history&&f.historySha256!==historyDigest(history))return false;
  const effectiveStart=Math.max(start,now.getTime()-NEWS_WINDOW_MS);
  return !sourceIssues(job.research,now,history??[]).length&&!checkIssues(f.checks,job.research,now,effectiveStart,f.previousStoryKeys).length;
  } catch { return false; }
}
