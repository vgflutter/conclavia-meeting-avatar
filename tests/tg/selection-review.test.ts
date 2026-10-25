import assert from 'node:assert/strict';
import {test} from 'node:test';
import {applySourceEditorReview,type SourceEditorCheck} from '../../src/lib/tg/selection-review';
import type {TgResearch} from '../../src/lib/tg/types';
test('major global exception retains its true absence of Italian impact; missing corroboration still blocks',()=>{
 const research={stories:[{id:'global',sourceIds:['a','b']}],sources:[{id:'a'},{id:'b'},{id:'unused'}],collectedAt:'',searchCalls:0,warnings:[]} as unknown as TgResearch;
 const check:SourceEditorCheck={coreSupported:true,coherentSources:true,fresh:true,italyFocus:false,scope:'major-world',reason:'Exceptional global event justified by documented international public relevance.',sourceUrls:['https://one.example/news','https://two.example/news']};
 assert.equal(applySourceEditorReview(research,{global:check}).stories.length,1);
 assert.equal(applySourceEditorReview(research,{global:check}).sources.length,2);
 for(const change of [{scope:'exclude'},{scope:'italy-impact'},{fresh:false},{coherentSources:false},{coreSupported:false},{sourceUrls:['https://one.example/news','https://one.example/news']}]){
  assert.equal(applySourceEditorReview(research,{global:{...check,...change}}).stories.length,0);
 }
});
