import test from 'node:test';
import assert from 'node:assert/strict';
import {TG_FEEDS,parseFeed,publicSourceUrl} from '../../src/lib/tg/sources';
import {requireSourcePair} from '../../src/lib/tg/editorial';

const now=new Date('2026-10-24T07:00:00Z');
test('the expanded catalog admits dated official and editorial feeds in their edition',()=>{
 assert.equal(TG_FEEDS.length,14);assert.equal(new Set(TG_FEEDS.map(f=>f.id)).size,14);
 for(const id of ['agi','sole24ore-it','istat','ecb','nasa']){
  const feed=TG_FEEDS.find(f=>f.id===id)!;assert.ok(feed);assert.ok(publicSourceUrl(feed.url));
  const url=new URL('/fixture-news',feed.url).href;
  const parsed=parseFeed(`<rss><channel><item><title>Notizia sintetica</title><link>${url}</link><description>Un comunicato di test, non una notizia reale.</description><pubDate>${now.toUTCString()}</pubDate></item></channel></rss>`,feed,now);
  assert.equal(parsed.length,1);assert.equal(parsed[0].independentGroup,feed.group);
 }
});
test('two syndicated copies cannot count as independent evidence; missing and stale pairs are rejected',()=>{
 const sources=TG_FEEDS.filter(f=>['agi','sole24ore-it','istat'].includes(f.id)).map((f,i)=>({...parseFeed(`<rss><channel><item><title>Fonte sintetica</title><link>${new URL('/fixture-'+i,f.url).href}</link><description>Prova con attribuzione all’agenzia.</description><source>AGI</source><pubDate>${now.toUTCString()}</pubDate></item></channel></rss>`,f,now)[0],id:String(i)}));
 assert.throws(()=>requireSourcePair({first:'0',second:'1'},sources,now),/indipendenti/);
 sources[2].independentGroup='istat.it';assert.deepEqual(requireSourcePair({first:'0',second:'2'},sources,now),['0','2']);
 assert.throws(()=>requireSourcePair({first:'invented',second:'2'},sources,now));
 sources[2].publishedAt='2020-01-01';assert.throws(()=>requireSourcePair({first:'0',second:'2'},sources,now));
});
test('the title-only ECB feed remains explicit headline evidence and cannot pretend to contain an article body',()=>{
 const feed=TG_FEEDS.find(f=>f.id==='ecb')!;
 const xml=`<rss><channel><item><title>Comunicato primario sintetico</title><link>https://www.ecb.europa.eu/fixture</link><pubDate>${now.toUTCString()}</pubDate></item></channel></rss>`;
 const [source]=parseFeed(xml,feed,now);assert.ok(source.evidence.startsWith('HEADLINE ONLY; no article body retrieved:'));
 assert.ok(source.evidence.endsWith('Comunicato primario sintetico'));
});
