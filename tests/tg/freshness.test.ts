import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reviewFixture } from './fixtures';
import { freshnessFixture } from './freshness-fixture';
import { freshnessIsCurrent, requireFreshCandidates, validateFreshness, historyDigest } from '../../src/lib/tg/freshness';
import { publishedHistory } from '../../src/lib/tg/history';
import { auditIsCurrent } from '../../src/lib/tg/review';
import { produceTg } from '../../src/lib/tg/pipeline';
import type { TgJob, TgPublishedEdition, TgState } from '../../src/lib/tg/types';
const now=new Date('2026-10-21T16:00:00Z');
function context(){
 const job=reviewFixture(now),r=job.research!,s=job.script!;
 const web=Object.fromEntries(r.stories.map(story=>[story.id,r.sources.filter(source=>story.sourceIds.includes(source.id)).map(source=>source.url)]));
 const checks=Object.fromEntries(job.audit!.freshness!.checks.map(({storyId,...check})=>[storyId,check]));
 const history:TgPublishedEdition[]=[{id:'b'.repeat(24),edition:'it',date:'2026-10-20',publishedAt:'2026-10-20T18:00:00Z',stories:[{key:'previous:transport',headline:'Vertice sui trasporti',claims:['Ieri è stato convocato un vertice sul trasporto locale.'],development:'Convocato ieri un vertice sul trasporto locale.'}]}];
 return {job,r,s,web,checks,history};
}
test('fresh sources alone cannot pass an old event, a future event, an undated fact or a paraphrased repeat',()=>{
 const {r,s,web,checks,history}=context();
 for(const patch of [{status:'duplicate',evidence:'I nuovi titoli riformulano lo stesso vertice già raccontato ieri.'},{status:'stale',eventDate:'2026-10-16'},{status:'new',eventDate:'2026-10-17'},{status:'new',eventDate:'2026-10-22'},{status:'new',eventDate:''},{status:'new',eventDate:'2026-02-31'},{status:'unverifiable'}]){
  const copy=structuredClone(checks);Object.assign(copy['story-0'],patch);
  assert.equal(validateFreshness({checks:copy},r,s,history,web,now).passed,false);
 }
});
test('same story may return only with an evidenced new development and real published references',()=>{
 const {r,s,web,checks,history}=context(),c=checks['story-0'];
 Object.assign(c,{status:'update',previousStoryKeys:['previous:transport'],development:'Il vertice si è concluso oggi con un accordo verificato dalle due fonti.'});
 assert.equal(validateFreshness({checks},r,s,history,web,now).passed,true);
 for(const references of [[],['invented:story']]){
  const copy=structuredClone(checks);copy['story-0'].previousStoryKeys=references;
  assert.equal(validateFreshness({checks:copy},r,s,history,web,now).passed,false);
 }
 c.development=history[0].stories[0].development!;
 assert.equal(validateFreshness({checks},r,s,history,web,now).passed,false);
});
test('new URLs, refreshed articles and changed IDs cannot bypass exact aired claims or source clocks',()=>{
 const {r,history}=context();
 history[0].stories[0].claims=[r.stories[0].facts[0].text.toUpperCase()+'!'];
 assert.throws(()=>requireFreshCandidates(r,now,history),/già stati raccontati/);
 for(const hours of [25,37]){
  const copy=structuredClone(r);for(const source of copy.sources)source.publishedAt=new Date(now.getTime()-hours*3600000).toISOString();
  assert.throws(()=>requireFreshCandidates(copy,now,[]),/fonte nuova|riscontri attuali/);
 }
 const old=structuredClone(r);old.sources.forEach(source=>{source.publishedAt='2026-10-21T15:00:00Z';});
 const late=structuredClone(history);late[0].publishedAt='2026-10-21T15:30:00Z';late[0].stories[0].claims=['Una storia diversa.'];
 assert.throws(()=>requireFreshCandidates(old,now,late),/nessuna fonte nuova/);
});
test('uncorroborated updates, invented URLs, omitted stories and copied publisher groups cannot pass',()=>{
 const {r,s,web,checks,history}=context();
 const missing=structuredClone(checks);delete missing['story-1'];assert.throws(()=>validateFreshness({checks:missing},r,s,history,web,now),/incompleta/);
 const invented=structuredClone(checks);invented['story-0'].webUrls=['https://www.ansa.it/not-retrieved'];assert.throws(()=>validateFreshness({checks:invented},r,s,history,web,now));
 const one=structuredClone(checks);one['story-0'].sourceIds=['source-0'];assert.equal(validateFreshness({checks:one},r,s,history,web,now).passed,false);
 const syndicated=structuredClone(r);syndicated.sources.forEach(source=>{source.independentGroup='same-original-wire';});
 assert.equal(validateFreshness({checks},syndicated,s,history,web,now).passed,false);
});
test('saved freshness expires and is bound to actual research, script and published archive',()=>{
 const {job,r,s,web,checks,history}=context();job.audit!.freshness=validateFreshness({checks},r,s,history,web,now);
 assert.equal(freshnessIsCurrent(job,now,history),true);assert.equal(auditIsCurrent(job,now),true);
 assert.equal(freshnessIsCurrent(job,new Date(now.getTime()+3600000),history),false);
 const changed=structuredClone(job);changed.research!.sources[0].publishedAt='2026-10-21T01:00:00Z';assert.equal(freshnessIsCurrent(changed,now,history),false);
 const script=structuredClone(job);script.script!.sentences[0].text='Un testo cambiato.';assert.equal(freshnessIsCurrent(script,now,history),false);
 const archive=structuredClone(history);archive[0].stories[0].claims.push('Un altro fatto effettivamente trasmesso.');
 assert.notEqual(historyDigest(history),historyDigest(archive));assert.equal(freshnessIsCurrent(job,now,archive),false);
 const legacy=structuredClone(job);delete legacy.audit!.freshness;assert.equal(auditIsCurrent(legacy,now),false);
 const malformed=structuredClone(job);malformed.audit!.freshness!.checks[0].sourceIds=undefined as unknown as string[];assert.equal(auditIsCurrent(malformed,now),false);
});
test('source windows are rechecked at release even when the one-hour report has not yet expired',()=>{
 const {job}=context();job.research!.sources.forEach(source=>{source.publishedAt=new Date(now.getTime()-23.5*3600000).toISOString();});
 job.audit!.freshness=freshnessFixture(job.research!,job.script!,now);
 assert.equal(freshnessIsCurrent(job,now),true);
 assert.equal(freshnessIsCurrent(job,new Date(now.getTime()+31*60000)),false);
});
test('published memory excludes research drafts and failed runs, but includes a confirmed partial social release',()=>{
 const {job}=context(),draft=structuredClone(job),failed=structuredClone(job),partial=structuredClone(job);
 draft.state='needs_review';failed.state='failed';partial.id='c'.repeat(24);partial.state='publishing';
 partial.research!.stories[0].facts[0].text='Questo fatto è solo nella ricerca e non è andato in onda.';
 const archive=publishedHistory([draft,failed,partial],[{jobId:partial.id,state:'published',updatedAt:now}],now);
 assert.equal(archive.length,1);assert.equal(archive[0].id,partial.id);
 assert.deepEqual(archive[0].stories[0].claims,partial.script!.sentences.filter(s=>s.storyId==='story-0').map(s=>s.text));
 assert.ok(!JSON.stringify(archive).includes('solo nella ricerca'));
 assert.throws(()=>publishedHistory([{...partial,script:undefined}],[{jobId:partial.id,state:'published',updatedAt:now}],now),/senza copione/);
});
test('stale cached research and duplicate AI verdicts stop before paid speech or rendering',async()=>{
 for(const stale of [true,false]){
  const {job}=context(),states:TgState[]=[],saved:Partial<TgJob>[]=[],calls:string[]=[];
  if(stale)job.research!.sources.forEach(source=>{source.publishedAt='2026-10-19T12:00:00Z';});
  else {job.audit!.freshness!.checks[0].status='duplicate';job.audit!.freshness!.passed=false;job.audit!.freshness!.issues=['Fatto già raccontato ieri con parole diverse.'];}
  await produceTg({...job,state:'queued'},'[]',{now:()=>now,research:async()=>job.research!,write:async()=>{calls.push('write');return job.script!;},reviewScript:async()=>{throw new Error('No second review of duplicate news');},audit:async()=>{calls.push('audit');return job.audit!;},voice:async()=>{throw Error('Speech must not be called');},render:async()=>{throw Error('Render must not be called');},checkpoint:async(state,data)=>{states.push(state);saved.push(data);}});
  assert.equal(states.at(-1),'blocked');assert.equal(calls.includes('write'),false);assert.deepEqual(saved.at(-1)?.assets,[]);
 }
});
