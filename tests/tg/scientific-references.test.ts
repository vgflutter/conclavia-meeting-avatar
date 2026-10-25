import assert from 'node:assert/strict';
import {test} from 'node:test';
import {verifyScientificReferences} from '../../src/lib/tg/scientific-references';
const url='https://www.nejm.org/doi/pdf/nejmoa2415160';
const title='Sotatercept in Patients with Pulmonary Arterial Hypertension at High Risk for Death';
const source={url,title:'Results of a completely different oncology trial'};
test('an existing DOI for a different paper is excluded, never treated as corroboration',async()=>{
 let calls=0;const fetcher:typeof fetch=async input=>{calls++;assert.equal(String(input),'https://api.crossref.org/works/10.1056%2Fnejmoa2415160');return Response.json({message:{title:[title],DOI:'10.1056/NEJMoa2415160'}});};
 const result=await verifyScientificReferences({brief:`Unverified paper claim [paper](${url})\nOther supported reporting.`,sources:[source,{url:'https://www.ansa.it/news',title:'Agency reporting'}]},AbortSignal.timeout(1000),fetcher);
 assert.equal(calls,1);assert.equal(result.item.sources.length,1);assert.equal(result.rejected[0].canonicalTitle,title);
 assert.ok(!result.item.brief.includes('Unverified paper claim'));assert.ok(result.item.brief.includes('Other supported reporting.'));
 const valid=await verifyScientificReferences({brief:'Matching paper.',sources:[{url,title:'NEJM — '+title}]},AbortSignal.timeout(1000),fetcher);
 assert.equal(valid.rejected.length,0);assert.equal(valid.item.sources[0].title,title);
});
test('unavailable DOI identity fails closed without discarding unrelated agency evidence',async()=>{
 const result=await verifyScientificReferences({brief:'Brief',sources:[source]},AbortSignal.timeout(1000),async()=>new Response(null,{status:404}));
 assert.equal(result.item.sources.length,0);assert.equal(result.rejected.length,1);
});
