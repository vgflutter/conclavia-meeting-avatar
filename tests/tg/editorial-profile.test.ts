import assert from 'node:assert/strict';
import {test} from 'node:test';
import {editorialFixture} from './editorial-fixture';
import {parseProduct} from '../../src/lib/tg/config';
import {dailyStoryRange,dailyWritingStructure} from '../../src/lib/tg/format';
import {requireDailyCoverage,validateResearch} from '../../src/lib/tg/editorial';
import {applySourceEditorReview,type SourceEditorCheck} from '../../src/lib/tg/selection-review';
import {dailyScriptDepthIssues} from '../../src/lib/tg/script-depth';
import {minimumDailySeconds,candidateRange} from '../../src/lib/tg/editorial-profile';

const now=new Date('2026-10-25T06:00:00Z');
test('the new coverage profile survives configuration and rejects five-item editions without reinterpreting legacy snapshots',()=>{
 const job=editorialFixture(now),legacy={...job.product},product=parseProduct({...legacy,edition:'it',language:'it',editorialProfile:'italia-morning-v2'});
 assert.equal(product.editorialProfile,'italia-morning-v2');assert.deepEqual(dailyStoryRange(product),{min:6,max:9});
 assert.deepEqual(dailyStoryRange(legacy),{min:5,max:9});assert.doesNotThrow(()=>requireDailyCoverage(legacy,job.research!));
 assert.throws(()=>requireDailyCoverage(product,job.research!),/da 6 a 9/u);
 const stories=[...job.research!.stories,{...job.research!.stories[0],id:'sixth'}];
 assert.doesNotThrow(()=>requireDailyCoverage(product,{stories}));
 assert.throws(()=>requireDailyCoverage(product,{stories},job.script!),/tutte le 6/u);
 assert.equal(minimumDailySeconds(product),270);assert.equal(minimumDailySeconds(legacy),180);
 assert.deepEqual(candidateRange(product),{min:6,target:14,max:18});
 assert.match(dailyWritingStructure(product),/5–7/u);assert.match(dailyWritingStructure(product),/4:30/u);
 assert.throws(()=>parseProduct({...product,edition:'world',language:'en'}),/Configurazione/u);
 assert.throws(()=>parseProduct({...product,productionStandard:undefined}),/Configurazione/u);
});
test('a larger candidate pool cannot bypass the final coverage limit or the source provenance checks',()=>{
 const research=editorialFixture(now).research!,stories=Array.from({length:14},(_,i)=>({...research.stories[0],id:`candidate-${i}`}));
 const urls=new Set(research.sources.map(s=>s.url)),groups=new Map(research.sources.map(s=>[s.url,s.independentGroup]));
 assert.throws(()=>validateResearch({...research,stories},urls,now),/Copertura/u);
 assert.equal(validateResearch({...research,stories},urls,now,groups,{candidatePool:true}).stories.length,14);
 assert.throws(()=>validateResearch({...research,stories},new Set(),now,undefined,{candidatePool:true}),/risultati consultati/u);
 assert.throws(()=>validateResearch({...research,stories:[...stories,...stories]},urls,now,undefined,{candidatePool:true}),/Copertura/u);
});
test('one corroborated scientific exception may be admitted without fabricating Italian impact; failed evidence and extra exceptions remain excluded',()=>{
 const job=editorialFixture(now),research={...job.research!,stories:['sci-1','sci-2','sport','domestic-2','domestic-3'].map((id,i)=>({...job.research!.stories[0],id,category:i<2?'science' as const:'culture' as const}))};
 const check:SourceEditorCheck={coreSupported:true,coherentSources:true,fresh:true,italyFocus:false,scope:'shared-knowledge',reason:'New study results of public interest with population and limitations explicitly retained.',sourceUrls:['https://one.example/a','https://two.example/b']};
 const domestic={...check,scope:'italy',italyFocus:true};
 const checks={'sci-1':check,'sci-2':check,sport:check,'domestic-2':domestic,'domestic-3':domestic},product={...job.product,editorialProfile:'italia-morning-v2' as const};
 assert.deepEqual(applySourceEditorReview(research,checks,product).stories.map(s=>s.id),['sci-1','domestic-2','domestic-3']);
 assert.equal(applySourceEditorReview(research,checks,job.product).stories.length,2);
 assert.deepEqual(applySourceEditorReview(research,{...checks,'sci-1':{...check,fresh:false}},product).stories.map(s=>s.id),['sci-2','domestic-2','domestic-3']);
 assert.deepEqual(applySourceEditorReview(research,{...checks,sport:{...check,scope:'italy',italyFocus:true}},product).stories.map(s=>s.id),['sci-1','sport','domestic-2','domestic-3']);
});
test('the new written depth floor rejects short copy without stretching legacy editions',()=>{
 const job=editorialFixture(now);job.script!.sentences=job.script!.sentences.filter(s=>['intro','outro',job.research!.stories[0].id,job.research!.stories[1].id,job.research!.stories[2].id].includes(s.storyId));
 assert.ok(!dailyScriptDepthIssues(job.product,job.script!).some(s=>s.startsWith('Copione di')));
 assert.ok(dailyScriptDepthIssues({...job.product,editorialProfile:'italia-morning-v2'},job.script!).some(s=>s.startsWith('Copione di')));
});

test('the final selection keeps Italy in the majority and reserves excess global stories without falsifying their evidence verdict',()=>{
 const job=editorialFixture(now),base=job.research!.stories[0],check:SourceEditorCheck={coreSupported:true,coherentSources:true,fresh:true,italyFocus:false,scope:'major-world',reason:'Documented major event, corroborated and fresh in independent source reporting.',sourceUrls:['https://one.example/a','https://two.example/b']};
 const stories=Array.from({length:11},(_,i)=>({...base,id:`s${i}`,importance:100-i,category:i===10?'culture' as const:i<3?'world' as const:'society' as const}));
 const checks=Object.fromEntries(stories.map((s,i)=>[s.id,i<3?{...check}:{...check,scope:'italy',italyFocus:true}]));
 const before=JSON.stringify(checks),result=applySourceEditorReview({...job.research!,stories},checks,{...job.product,editorialProfile:'italia-morning-v2'});
 assert.equal(JSON.stringify(checks),before);assert.equal(result.stories.length,8);
 assert.equal(result.stories.filter(s=>s.category==='world').length,2);
 assert.ok(result.stories.some(s=>s.category==='culture'));
 assert.ok(!result.stories.some(s=>s.id==='s2'));
 assert.match(result.warnings.join(' '),/s2: riserva corroborata/u);
 const small=applySourceEditorReview({...job.research!,stories:stories.slice(0,4)},checks,{...job.product,editorialProfile:'italia-morning-v2'});
 assert.equal(small.stories.length,1); // one domestic item cannot make exceptions a national majority
});
