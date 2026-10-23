/** One evidence-retrieval repair, not an editorial rewrite-until-approved loop. */
import {readFile,writeFile} from 'node:fs/promises';
import {searchJson} from '../../src/lib/tg/agents';
async function main(){
 if(!process.argv.includes('--confirm')||process.env.TG_PUBLISH_ENABLED!=='false')throw Error('Explicit nonpublishing evidence repair required');
 const dir='docs/tg/editions/2026-10-23-it-pilot-r2';
 const old=JSON.parse(await readFile(dir+'/4c058d9bc9a8-live-evidence.json','utf8'));
 const fixes=await Promise.allSettled([
  ['taiwan','Verify the actual latest 23 October 2026 CNA/Focus Taiwan bulletin: 13 counties and cities announce school and office closures for Saturday 24 October. Inspect https://focustaiwan.tw/society/202610230019 (dated 21:29 Taiwan / 13:29 UTC) and https://focustaiwan.tw/society/202610230018 (21:08 Taiwan). The earlier morning AP/ANSA report did not yet mention Saturday. Distinguish "not found in earlier report" from "contradicted by latest direct evidence". Give the actual headline, announcement date, local day and explicitly supported closure/transport details; no hypothetical landfall.'],
  ['umbria','Verify the primary Umbria Assembly press release of 22 October 2026 19:27: https://consiglio.regione.umbria.it/informazione/notizie/comunicati/assistenza-sanitaria-alla-morte-volontaria-medicalmente-assistita . Inspect the paragraph about approved Pernazza amendments: possibility to suspend or revoke the request, palliative care information, conditions under state law and constitutional jurisprudence. Distinguish the regional vote from implementation or a nationwide change. Return actual supported text and any genuine contradiction.']
 ].map(async([storyId,request])=>{const result=await searchJson(undefined,request,AbortSignal.timeout(150000),fetch,2,1);return {storyId,brief:result.data,sources:result.sources};}));
 if(fixes.some(x=>x.status==='rejected'))throw Error('Targeted source repair did not complete');
 const resolved=fixes.flatMap(x=>x.status==='fulfilled'?[x.value]:[]);
 const data=old.data.map((entry:{storyId:string})=>resolved.find(s=>s.storyId===entry.storyId)??entry);
 const result={...old,retrievedAt:new Date().toISOString(),sourceRepair:{reason:'Original search allowlist omitted CNA, ONS and the regional primary source. No script rewrite. Only Taiwan and Umbria evidence refreshed.',previous:'4c058d9bc9a8-live-evidence.json',calls:2},data,sources:[...new Map([...old.sources,...resolved.flatMap(x=>x.sources)].map(s=>[s.url,s])).values()]};
 await writeFile(dir+'/source-repaired-live-evidence.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({targetedStories:resolved.map(x=>x.storyId),sourceCount:result.sources.length,rewrites:0}));
}
void main().catch(e=>{console.error(e instanceof Error?e.message:'Evidence repair failed');process.exitCode=1;});
