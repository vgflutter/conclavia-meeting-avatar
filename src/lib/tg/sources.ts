import { XMLParser } from 'fast-xml-parser';
import { createHash } from 'node:crypto';
import type { TgEdition, TgSource } from './types';
export const TG_FEEDS = [
  { id: 'ansa', name: 'ANSA', group: 'ansa', edition: 'it', url: 'https://www.ansa.it/sito/notizie/topnews/topnews_rss.xml' },
  { id: 'rai', name: 'Rai News', group: 'rai', edition: 'it', url: 'https://www.rainews.it/rss/tutti' },
  { id: 'euronews-it', name: 'Euronews Italia', group: 'euronews', edition: 'it', url: 'https://it.euronews.com/rss' },
  { id: 'adnkronos', name: 'Adnkronos', group: 'adnkronos', edition: 'it', url: 'https://www.adnkronos.com/RSS_PrimaPagina.xml' },
  { id: 'agi', name: 'AGI', group: 'agi', edition: 'it', url: 'https://www.agi.it/cronaca/rss.xml' },
  { id: 'sole24ore-it', name: 'Il Sole 24 Ore', group: 'ilsole24ore.com', edition: 'it', url: 'https://www.ilsole24ore.com/rss/italia.xml' },
  { id: 'istat', name: 'Istat', group: 'istat.it', edition: 'it', url: 'https://www.istat.it/feed/' },
  // Verified against publisher endpoints on 25 October. ANSA channels remain
  // ONE origin; additional feeds increase coverage, never independence counts.
  { id: 'ansa-home', name: 'ANSA', group: 'ansa', edition: 'it', url: 'https://www.ansa.it/sito/ansait_rss.xml' },
  { id: 'ansa-cronaca', name: 'ANSA', group: 'ansa', edition: 'it', url: 'https://www.ansa.it/sito/notizie/cronaca/cronaca_rss.xml' },
  { id: 'ansa-politica', name: 'ANSA', group: 'ansa', edition: 'it', url: 'https://www.ansa.it/sito/notizie/politica/politica_rss.xml' },
  { id: 'ansa-economia', name: 'ANSA', group: 'ansa', edition: 'it', url: 'https://www.ansa.it/sito/notizie/economia/economia_rss.xml' },
  { id: 'ansa-scienza', name: 'ANSA', group: 'ansa', edition: 'it', url: 'https://www.ansa.it/canale_scienza_tecnica/notizie/scienzaetecnica_rss.xml' },
  { id: 'ansa-salute', name: 'ANSA', group: 'ansa', edition: 'it', url: 'https://www.ansa.it/canale_saluteebenessere/notizie/saluteebenessere_rss.xml' },
  { id: 'ansa-tecnologia', name: 'ANSA', group: 'ansa', edition: 'it', url: 'https://www.ansa.it/canale_tecnologia/notizie/tecnologia_rss.xml' },
  { id: 'repubblica', name: 'la Repubblica', group: 'repubblica.it', edition: 'it', url: 'https://www.repubblica.it/rss/homepage/rss2.0.xml' },
  { id: 'tgcom24', name: 'TGcom24', group: 'mediaset.it', edition: 'it', url: 'https://www.tgcom24.mediaset.it/rss/homepage.xml' },
  { id: 'open', name: 'Open', group: 'open.online', edition: 'it', url: 'https://www.open.online/feed/' },
  { id: 'governo', name: 'Governo italiano', group: 'governo.it', edition: 'it', url: 'https://www.governo.it/it/rss.xml' },
  // Additional endpoints fetched and parsed on 25 October; sections retain their publisher origin.
  { id: 'ilfatto', name: 'Il Fatto Quotidiano', group: 'ilfattoquotidiano.it', edition: 'it', url: 'https://www.ilfattoquotidiano.it/feed/' },
  { id: 'today', name: 'Today', group: 'citynews.it', edition: 'it', url: 'https://www.today.it/rss' },
  { id: 'manifesto', name: 'il manifesto', group: 'ilmanifesto.it', edition: 'it', url: 'https://cms.ilmanifesto.it/feed' },
  { id: 'domani', name: 'Domani', group: 'editorialedomani.it', edition: 'it', url: 'https://www.editorialedomani.it/rss' },
  { id: 'libero', name: 'Libero', group: 'liberoquotidiano.it', edition: 'it', url: 'https://www.liberoquotidiano.it/rss.xml' },
  { id: 'qn', name: 'Quotidiano Nazionale', group: 'quotidiano.net', edition: 'it', url: 'https://www.quotidiano.net/rss' },
  { id: 'messaggero', name: 'Il Messaggero', group: 'ilmessaggero.it', edition: 'it', url: 'https://www.ilmessaggero.it/rss/home.xml' },
  { id: 'punto-informatico', name: 'Punto Informatico', group: 'punto-informatico.it', edition: 'it', url: 'https://www.punto-informatico.it/feed/' },
  { id: 'quotidiano-sanita', name: 'Quotidiano Sanità', group: 'quotidianosanita.it', edition: 'it', url: 'https://www.quotidianosanita.it/feed/' },
  { id: 'hdblog', name: 'HDblog', group: 'hdblog.it', edition: 'it', url: 'https://www.hdblog.it/feed/' },
  { id: 'ansa-sport', name: 'ANSA', group: 'ansa', edition: 'it', url: 'https://www.ansa.it/sito/notizie/sport/sport_rss.xml' },
  { id: 'ansa-cultura', name: 'ANSA', group: 'ansa', edition: 'it', url: 'https://www.ansa.it/sito/notizie/cultura/cultura_rss.xml' },
  { id: 'sole24ore-economia', name: 'Il Sole 24 Ore', group: 'ilsole24ore.com', edition: 'it', url: 'https://www.ilsole24ore.com/rss/economia.xml' },
  { id: 'bbc-world', name: 'BBC News', group: 'bbc', edition: 'world', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { id: 'guardian-world', name: 'The Guardian', group: 'guardian', edition: 'world', url: 'https://www.theguardian.com/world/rss' },
  { id: 'npr-world', name: 'NPR', group: 'npr', edition: 'world', url: 'https://feeds.npr.org/1004/rss.xml' },
  { id: 'aljazeera-world', name: 'Al Jazeera', group: 'aljazeera', edition: 'world', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { id: 'france24-world', name: 'France 24', group: 'france24', edition: 'world', url: 'https://www.france24.com/en/rss' },
  { id: 'ecb', name: 'European Central Bank', group: 'eu', edition: 'world', url: 'https://www.ecb.europa.eu/rss/press.html', headlineOnly:true },
  { id: 'nasa', name: 'NASA', group: 'nasa.gov', edition: 'world', url: 'https://www.nasa.gov/news-release/feed/' },
] as const;
export const TG_SEARCH_DOMAINS = ['ilfattoquotidiano.it','today.it','ilmanifesto.it','editorialedomani.it','liberoquotidiano.it','quotidiano.net','ilmessaggero.it','punto-informatico.it','quotidianosanita.it','hdblog.it','ansa.it', 'adnkronos.com', 'rainews.it', 'reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk', 'theguardian.com', 'npr.org', 'euronews.com', 'aljazeera.com', 'dw.com', 'france24.com', 'un.org', 'who.int', 'europa.eu', 'ecb.europa.eu', 'istat.it', 'bancaditalia.it', 'nasa.gov', 'regjeringen.no', 'arpal.liguria.it', 'pmi.it',
 // Dated primary/regional sources used by the 23 October edition. Restrict to
 // verified public hosts; a current local bulletin can supersede an older wire.
 'focustaiwan.tw','en.yna.co.kr','ons.gov.uk','gov.uk','consiglio.regione.umbria.it','unc.mil','mit.gov.it',
 // Direct evidence for the Italy-focused pilot. Bank host carries the MEF PDF,
 // not an extra independent confirmation of that same press release.
 'agenas.gov.it','regione.puglia.it','ingv.it','regione.sicilia.it','protezionecivile.it','protezionecivilesicilia.it','bancobpm.it','dt.mef.gov.it',
 'agi.it','ilsole24ore.com','repubblica.it','tgcom24.mediaset.it','open.online','governo.it',
 'mef.gov.it','inps.it','cgiamestre.com',
 // Primary evidence endpoints, not additional wire/publisher independence.
 'gazzettaufficiale.it','srbija.gov.rs','tse.jus.br','formula1.com','esmo.org','nejm.org','dana-farber.org',
 'romacinemafest.it','fidal.it','european-athletics.com','swiss-athletics.ch'];
const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, processEntities: false });
export function plain(value: unknown, max = 800): string {
  const s = typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
  let decoded = s;
  for (let i = 0; i < 2; i++) decoded = decoded.replace(/&(amp|lt|gt|quot|apos);/gu, (_, key: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[key] ?? '');
  return decoded.replace(/<[^>]*>/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, max);
}
export function publicSourceUrl(value: unknown): string | undefined {
  try { const u = new URL(String(value).replace(/&amp;/gu, '&'));  if (u.protocol !== 'https:' || u.username || u.password || u.port && u.port !== '443' || !TG_SEARCH_DOMAINS.some(d => u.hostname === d || u.hostname.endsWith('.' + d))) return; u.hash = ''; for (const key of [...u.searchParams.keys()]) if (/^(?:utm_|at_)/u.test(key) || ['gclid','fbclid'].includes(key)) u.searchParams.delete(key); return u.toString(); } catch { return; }
}
export function independentGroup(url: string) {
  const host = new URL(url).hostname;
  if(host==='today.it'||host.endsWith('.today.it'))return 'citynews.it';
  if(host==='ansa.it'||host.endsWith('.ansa.it'))return 'ansa';
  if(host==='rainews.it'||host.endsWith('.rainews.it'))return 'rai';
  if(host==='agi.it'||host.endsWith('.agi.it'))return 'agi';
  if(host==='adnkronos.com'||host.endsWith('.adnkronos.com'))return 'adnkronos';
  if(host==='euronews.com'||host.endsWith('.euronews.com'))return 'euronews';
  if(host==='mediaset.it'||host.endsWith('.mediaset.it'))return 'mediaset.it';
  if (host.includes('bbc.')) return 'bbc';
  if (host.endsWith('europa.eu')) return 'eu';
  return TG_SEARCH_DOMAINS.find(d => host === d || host.endsWith('.' + d)) ?? host;
}
/** Some Italian publishers localise RFC-style month/day names. Keep the
 * original timezone and reject invalid dates; never substitute collection time. */
export function parseFeedDate(value:unknown){
 const raw=String(value??'').trim();
 const direct=new Date(raw);if(Number.isFinite(direct.getTime()))return direct;
 const months:Record<string,string>={gen:'Jan',feb:'Feb',mar:'Mar',apr:'Apr',mag:'May',giu:'Jun',lug:'Jul',ago:'Aug',set:'Sep',ott:'Oct',nov:'Nov',dic:'Dec'};
 const cleaned=raw.replace(/^(lun|mar|mer|gio|ven|sab|dom),?\s+/iu,'').replace(/\b(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)\b/iu,m=>months[m.toLowerCase()]);
 return new Date(cleaned);
}
export interface FeedHealth {id:string;publisher:string;group:string;status:'ok'|'empty-or-stale'|'unavailable';articles:number;within24Hours:number;within36Hours:number}
export interface FeedCollectionHealth {collectedAt:string;feeds:FeedHealth[];articles:number;origins:number;within24Hours:number}
export function parseFeed(xml: string, feed: typeof TG_FEEDS[number], now: Date, days = 1): TgSource[] {
  if (Buffer.byteLength(xml) > 1_000_000 || /<!DOCTYPE|<!ENTITY/iu.test(xml)) throw new Error('Feed XML non consentito');
  const data = parser.parse(xml);
  const raw = data?.rss?.channel?.item ?? data?.feed?.entry;
  const entries: Record<string, unknown>[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return entries.slice(0, 100).flatMap(item => {
    const links = Array.isArray(item.link) ? item.link : [item.link];
    const link = links.find(x => typeof x === 'string' || x?.['@_rel'] === 'alternate') ?? links[0];
    const url = publicSourceUrl(typeof link === 'object' && link ? link['@_href'] : link);
    const title = plain(item.title, 240), summary=plain(item.description ?? item.summary ?? item['content:encoded'],900);
    // Some official feeds publish only titles and dates. Preserve the exact
    // scope of that evidence; never invent an abstract or unseen article body.
    const evidence=summary||('headlineOnly' in feed&&feed.headlineOnly?`HEADLINE ONLY; no article body retrieved: ${title}`:'');
    const feedSource=typeof item.source==='object'&&item.source?(item.source as Record<string,unknown>)['#text']:item.source;
    const author = [plain(item['dc:creator'] ?? item.author,100),plain(feedSource,100),plain(item['dc:publisher'],100)].join(' ');
    const group = /Associated Press|\bAP\b/iu.test(author) ? 'apnews.com' : /Reuters/iu.test(author) ? 'reuters.com' : /ANSA/iu.test(author) ? 'ansa' : /Adnkronos/iu.test(author) ? 'adnkronos' : /\bAGI\b/iu.test(author)?'agi':feed.group;
    const date = parseFeedDate(item.pubDate ?? item.published ?? item.updated);
    if (!url || !title || !evidence || !Number.isFinite(date.getTime()) || date.getTime() > now.getTime() + 5 * 60_000 || date.getTime() < now.getTime() - days * 86400_000) return [];
    return [{ id: createHash('sha256').update(url).digest('hex').slice(0, 20), publisher: feed.name, independentGroup: group, url, title, evidence, publishedAt: date.toISOString(),feedId:feed.id }];
  });
}
/** Preserve different sections within one publisher without counting them as
 * independent origins. Recent evidence precedes background from the past week. */
export function balancedSourceLedger(sources:TgSource[],now:Date,maximum=240,perPublisher=24){
 const roundRobin=(groups:TgSource[][],limit:number)=>Array.from({length:Math.max(0,...groups.map(g=>g.length))},(_,i)=>groups.flatMap(g=>g[i]?[g[i]]:[])).flat().slice(0,limit);
 const publishers=[...new Set(sources.map(s=>s.publisher))].map(p=>{
  const own=sources.filter(s=>s.publisher===p),feeds=[...new Set(own.map(s=>s.feedId??p))];
  return roundRobin(feeds.map(f=>own.filter(s=>(s.feedId??p)===f).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt))),perPublisher);
 });
 const ledger=roundRobin(publishers,maximum);
 return [...ledger.filter(s=>Date.parse(s.publishedAt)>=now.getTime()-36*3600000),...ledger.filter(s=>Date.parse(s.publishedAt)<now.getTime()-36*3600000)];
}
export async function collectFeeds(edition: TgEdition, now: Date, signal: AbortSignal, days = 1, fetcher = fetch) {
  const results = await Promise.allSettled(TG_FEEDS.filter(feed => feed.edition === edition).map(async feed => {
    const response = await fetcher(feed.url, { signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]), redirect: 'error', headers: { 'User-Agent': 'ConclaviaTG/1.0 (+https://conclavia.me)' } });
    if (!response.ok || !response.body) throw new Error(feed.id);
    const reader = response.body.getReader(); let bytes = 0; const chunks: Uint8Array[] = [];
    try { while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength; if (bytes > 1_000_000) throw new Error('Feed troppo grande'); chunks.push(part.value); } }
    finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
    return parseFeed(Buffer.concat(chunks).toString('utf8'), feed, now, days);
  }));
  const sources=[...new Map(results.flatMap(r=>r.status==='fulfilled'?r.value:[]).map(source=>[source.url,source])).values()];
  const feeds:FeedHealth[]=results.map((r,i)=>{
    const feed=TG_FEEDS.filter(f=>f.edition===edition)[i],items=r.status==='fulfilled'?r.value:[];
    return {id:feed.id,publisher:feed.name,group:feed.group,status:r.status==='rejected'?'unavailable':items.length?'ok':'empty-or-stale',articles:items.length,within24Hours:items.filter(s=>Date.parse(s.publishedAt)>=now.getTime()-86400000).length,within36Hours:items.filter(s=>Date.parse(s.publishedAt)>=now.getTime()-36*3600000).length};
  });
  const diagnostics:FeedCollectionHealth={collectedAt:now.toISOString(),feeds,articles:sources.length,origins:new Set(sources.map(s=>s.independentGroup)).size,within24Hours:sources.filter(s=>Date.parse(s.publishedAt)>=now.getTime()-86400000).length};
  return {sources,diagnostics,warnings:feeds.flatMap(f=>f.status==='unavailable'?[`Feed ${f.publisher} non disponibile`]:f.status==='empty-or-stale'?[`Feed ${f.publisher} (${f.id}): nessun articolo datato nella finestra di raccolta`]:[])};
}
