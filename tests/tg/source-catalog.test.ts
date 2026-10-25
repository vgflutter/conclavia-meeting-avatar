import test from 'node:test';
import assert from 'node:assert/strict';
import {TG_FEEDS,parseFeed,publicSourceUrl,balancedSourceLedger,independentGroup,collectFeeds,parseFeedDate} from '../../src/lib/tg/sources';
import {requireSourcePair} from '../../src/lib/tg/editorial';

const now=new Date('2026-10-24T07:00:00Z');
test('the expanded catalog admits dated official and editorial feeds in their edition',()=>{
 assert.equal(TG_FEEDS.length,38);assert.equal(new Set(TG_FEEDS.map(f=>f.id)).size,38);
 for(const id of ['agi','sole24ore-it','istat','ecb','nasa','ansa-scienza','repubblica','tgcom24','open','governo']){
  const feed=TG_FEEDS.find(f=>f.id===id)!;assert.ok(feed);assert.ok(publicSourceUrl(feed.url));
  const url=new URL('/fixture-news',feed.url).href;
  const parsed=parseFeed(`<rss><channel><item><title>Notizia sintetica</title><link>${url}</link><description>Un comunicato di test, non una notizia reale.</description><pubDate>${now.toUTCString()}</pubDate></item></channel></rss>`,feed,now);
  assert.equal(parsed.length,1);assert.equal(parsed[0].independentGroup,feed.group);
 }
});
test('section breadth does not turn one publisher into multiple independent origins',()=>{
 const make=(id:string,feedId:string,publisher:string,group:string)=>({id,feedId,publisher,independentGroup:group,url:'https://www.ansa.it/test-'+id,title:'Fixture',evidence:'Only synthetic evidence.',publishedAt:now.toISOString()});
 const rows=[...Array.from({length:30},(_,i)=>make('a'+i,'ansa-cronaca','ANSA','ansa')),make('science','ansa-scienza','ANSA','ansa'),make('other','rai','Rai News','rai')];
 const ledger=balancedSourceLedger(rows,now);
 assert.ok(ledger.some(s=>s.id==='science'));assert.ok(ledger.some(s=>s.id==='other'));
 assert.equal(new Set(ledger.map(s=>s.independentGroup)).size,2);
 assert.equal(independentGroup('https://www.ansa.it/a'),independentGroup('https://ansa.it/b'));
 assert.equal(independentGroup('https://it.euronews.com/a'),'euronews');
});
test('two syndicated copies cannot count as independent evidence; missing and stale pairs are rejected',()=>{
 const sources=TG_FEEDS.filter(f=>['agi','sole24ore-it','istat'].includes(f.id)).map((f,i)=>({...parseFeed(`<rss><channel><item><title>Fonte sintetica</title><link>${new URL('/fixture-'+i,f.url).href}</link><description>Prova con attribuzione all’agenzia.</description><source>AGI</source><pubDate>${now.toUTCString()}</pubDate></item></channel></rss>`,f,now)[0],id:String(i)}));
 assert.throws(()=>requireSourcePair({first:'0',second:'1'},sources,now),/indipendenti/);
 sources[2].independentGroup='istat.it';assert.deepEqual(requireSourcePair({first:'0',second:'2'},sources,now),['0','2']);
 assert.throws(()=>requireSourcePair({first:'0',second:'2'},sources,now,[{sourceIds:['0']}]),/citate? nei fatti|citata nei fatti/u);
 assert.deepEqual(requireSourcePair({first:'0',second:'2'},sources,now,[{sourceIds:['0','2']}]),['0','2']);
 assert.throws(()=>requireSourcePair({first:'invented',second:'2'},sources,now));
 sources[2].publishedAt='2020-01-01';assert.throws(()=>requireSourcePair({first:'0',second:'2'},sources,now));
});
test('the title-only ECB feed remains explicit headline evidence and cannot pretend to contain an article body',()=>{
 const feed=TG_FEEDS.find(f=>f.id==='ecb')!;
 const xml=`<rss><channel><item><title>Comunicato primario sintetico</title><link>https://www.ecb.europa.eu/fixture</link><pubDate>${now.toUTCString()}</pubDate></item></channel></rss>`;
 const [source]=parseFeed(xml,feed,now);assert.ok(source.evidence.startsWith('HEADLINE ONLY; no article body retrieved:'));
 assert.ok(source.evidence.endsWith('Comunicato primario sintetico'));
});

test('localised publisher dates preserve the actual time and invalid dates never become collection time',()=>{
 assert.equal(parseFeedDate('dom, 25 ott 2026 20:29:19 +0100').toISOString(),'2026-10-25T19:29:19.000Z');
 assert.equal(parseFeedDate('2026-10-25T19:21:00Z').toISOString(),'2026-10-25T19:21:00.000Z');
 assert.ok(Number.isNaN(parseFeedDate('data sconosciuta').getTime()));
 const feed=TG_FEEDS.find(f=>f.id==='messaggero')!,at=new Date('2026-10-25T20:00:00Z');
 const xml='<rss><channel><item><title>Prova sintetica</title><link>https://www.ilmessaggero.it/fixture</link><description>Solo materiale sintetico per collaudo.</description><pubDate>dom, 25 ott 2026 20:29:19 +0100</pubDate></item></channel></rss>';
 assert.equal(parseFeed(xml,feed,at).length,1);assert.equal(parseFeed(xml,feed,new Date('2026-10-24T20:00:00Z')).length,0);
});
test('collection diagnostics distinguish unavailable, stale and usable feeds without counting them as verified news',async()=>{
 const result=await collectFeeds('it',now,new AbortController().signal,7,async input=>{
  const url=String(input),feed=TG_FEEDS.find(f=>f.url===url)!;
  if(!['rai','istat'].includes(feed.id))return new Response('',{status:503});
  return new Response(`<rss><channel><item><title>Prova sintetica</title><link>${new URL('/synthetic',url).href}</link><description>Riscontro sintetico per test della raccolta.</description><pubDate>${feed.id==='rai'?now.toUTCString():'Mon, 01 Jan 2024 12:00:00 GMT'}</pubDate></item></channel></rss>`);
 });
 assert.equal(result.diagnostics.feeds.length,31);assert.equal(result.diagnostics.articles,1);assert.equal(result.diagnostics.within24Hours,1);
 assert.equal(result.diagnostics.feeds.find(f=>f.id==='rai')?.status,'ok');
 assert.equal(result.diagnostics.feeds.find(f=>f.id==='istat')?.status,'empty-or-stale');
 assert.equal(result.diagnostics.feeds.find(f=>f.id==='ansa')?.status,'unavailable');
 assert.ok(result.warnings.some(w=>w.includes('Istat')));
});
