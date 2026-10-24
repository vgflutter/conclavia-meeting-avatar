import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {reviewFixture,scriptReviewFixture} from './fixtures';
import {createAiApproval,approvalIsBound} from '../../src/lib/tg/review';
import {finalReviewInputDigest} from '../../src/lib/tg/final-review-policy';
import {assertSiteReady,publishEditionToSite,publicSiteEdition,publicEditionHtml,reconcileSitePublication} from '../../src/lib/tg/site-publication';
import {publishedHistory,publishedStories} from '../../src/lib/tg/history';
import type {TgJob} from '../../src/lib/tg/types';
const now=new Date('2026-10-24T08:40:00Z');
function fixture(){
 const job=reviewFixture(now);job.product={...job.product,automatic:true,siteFirst:true,productionMode:'full',productionTime:'08:00',publishTime:'09:00'};
 job.scriptReview=scriptReviewFixture(job.product,job.date,job.research!,job.script!,now);
 job.manifest={version:1,product:job.product,date:job.date,seconds:180,stories:[],sources:job.research!.sources,cues:job.script!.sentences.map((s,i)=>({...s,start:i*10,end:i*10+9}))};
 job.finalReview={version:1,checkedAt:now.toISOString(),inputSha256:finalReviewInputDigest(job),model:'fixture-only',passed:true,checks:{visual:true,headlines:true,captions:true,emotion:true,publication:true},issues:[],summary:'Synthetic verification only.',media:([{format:'landscape',width:1920,height:1080},{format:'portrait',width:1080,height:1920}] as const).map(m=>({...m,seconds:180,rms:.1,peak:.8,clippedRatio:0,leadingSilence:0,trailingSilence:1})),samples:['landscape','portrait'].flatMap(format=>[1,90,177].map(at=>({format:format as 'portrait'|'landscape',at})))};
 return job;
}
function approve(job:TgJob){job.finalReview!.inputSha256=finalReviewInputDigest(job);return{...job,...createAiApproval(job,now,{}),state:'ready' as const};}
test('website approval binds both media and AI gates without pretending social credentials exist',()=>{
 const job=approve(fixture());assert.equal(approvalIsBound(job,{},now),true);assert.equal(job.review.scope,'website');assert.deepEqual(job.publicationPlan.platforms,[]);assert.deepEqual(Object.keys(job.review.destinations!),['website']);assert.doesNotThrow(()=>assertSiteReady(job,[],now));
 for(const mutate of[(j:TgJob)=>{j.product.siteFirst=false},(j:TgJob)=>{j.assets[0].sha256='c'.repeat(64)},(j:TgJob)=>{j.script!.title='Changed'},(j:TgJob)=>{j.finalReview!.checks.visual=false},(j:TgJob)=>{j.scriptReview!.passed=false}]){const c=structuredClone(job);mutate(c);assert.throws(()=>assertSiteReady(c,[],now));}
 const demo=structuredClone(job);demo.manifest!.demo=true;assert.throws(()=>assertSiteReady(demo,[],now));
 assert.throws(()=>assertSiteReady(job,[],new Date('2026-10-24T10:00:00Z')));
});
test('public metadata is an allowlist and HTML escapes editorial text',()=>{
 const job=approve(fixture());const data=publicSiteEdition(job,now.toISOString()),json=JSON.stringify(data);
 assert.doesNotMatch(json,/inputSha256|voiceConfig|destinations|leaseOwner|evidence|fixture-only/u);assert.equal(data.media['portrait.mp4'].sha256,job.assets[1].sha256);assert.equal(data.distribution.eligible,true);
 const html=publicEditionHtml({...data,title:'<img src=x onerror=alert(1)>'});assert.match(html,/&lt;img/u);assert.doesNotMatch(html,/<img src=x/u);assert.match(html,/data-portrait=/u);assert.match(html,/data-landscape=/u);
});
test('hash mismatch or changed approval cannot commit the public index; successful publication is idempotent',async()=>{
 const base=await mkdtemp(path.join(tmpdir(),'cdaily-site-')),old=process.env.TG_ARTIFACT_DIR;process.env.TG_ARTIFACT_DIR=path.join(base,'private');
 try{
  const raw=fixture(),dir=path.join(process.env.TG_ARTIFACT_DIR,raw.id);await mkdir(dir,{recursive:true});
  for(const asset of raw.assets){const bytes=Buffer.from('synthetic fixture '+asset.name);await writeFile(path.join(dir,asset.name),bytes);asset.bytes=bytes.length;asset.sha256=createHash('sha256').update(bytes).digest('hex');}
  const job=approve(raw),root=path.join(base,'public');
  await writeFile(path.join(dir,'portrait.mp4'),'changed');await assert.rejects(publishEditionToSite(job,root,[],now,async()=>{}),/Asset cambiato/u);await assert.rejects(readFile(path.join(root,'index.json')));
  await writeFile(path.join(dir,'portrait.mp4'),'synthetic fixture portrait.mp4');await assert.rejects(publishEditionToSite(job,root,[],now,async()=>{throw Error('changed approval')}),/changed approval/u);await assert.rejects(readFile(path.join(root,'index.json')));
  let calls=0;const a=await publishEditionToSite(job,root,[],now,async()=>{calls++}),b=await publishEditionToSite(job,root,[],new Date(now.getTime()+1000),async()=>{calls++});assert.deepEqual(a,b);assert.equal(calls,2);
  const index=JSON.parse(await readFile(path.join(root,'index.json'),'utf8'));assert.equal(index.editions.length,1);assert.equal(index.editions[0].kind,'daily');assert.doesNotMatch(await readFile(path.join(root,'it',job.date,'index.html'),'utf8'),/fixture-only/u);
  const late=new Date('2026-10-24T11:00:00Z');assert.throws(()=>assertSiteReady(job,[],late));assert.deepEqual(await reconcileSitePublication(job,root,late),a);
  const changed=structuredClone(job);changed.script!.title='A later unapproved draft';assert.equal(await reconcileSitePublication(changed,root,late),undefined);
 }finally{if(old===undefined)delete process.env.TG_ARTIFACT_DIR;else process.env.TG_ARTIFACT_DIR=old;await rm(base,{recursive:true,force:true});}
});
test('a confirmed website release enters the actual published history before any social delivery',()=>{
 const job=approve(fixture());job.sitePublication={url:'https://daily.conclavia.me/edizioni/it/2026-10-24/',releaseUrl:'https://daily.conclavia.me/edizioni/it/2026-10-24/r/release.json',bundleSha256:job.review.bundleSha256!,publishedAt:now.toISOString(),stories:publishedStories(job)};
 const result=publishedHistory([job],[],new Date(now.getTime()+1000));assert.equal(result.length,1);assert.equal(result[0].stories.length,3);
 const original=result[0].stories[0].claims[0];job.manifest!.cues[0].text='A later draft that was never published';assert.equal(publishedHistory([job],[],new Date(now.getTime()+1000))[0].stories[0].claims[0],original);
});
