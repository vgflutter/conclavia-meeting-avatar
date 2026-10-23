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
  { id: 'bbc-world', name: 'BBC News', group: 'bbc', edition: 'world', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { id: 'guardian-world', name: 'The Guardian', group: 'guardian', edition: 'world', url: 'https://www.theguardian.com/world/rss' },
  { id: 'npr-world', name: 'NPR', group: 'npr', edition: 'world', url: 'https://feeds.npr.org/1004/rss.xml' },
  { id: 'aljazeera-world', name: 'Al Jazeera', group: 'aljazeera', edition: 'world', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { id: 'france24-world', name: 'France 24', group: 'france24', edition: 'world', url: 'https://www.france24.com/en/rss' },
  { id: 'ecb', name: 'European Central Bank', group: 'eu', edition: 'world', url: 'https://www.ecb.europa.eu/rss/press.html', headlineOnly:true },
  { id: 'nasa', name: 'NASA', group: 'nasa.gov', edition: 'world', url: 'https://www.nasa.gov/news-release/feed/' },
] as const;
export const TG_SEARCH_DOMAINS = ['ansa.it', 'adnkronos.com', 'rainews.it', 'reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk', 'theguardian.com', 'npr.org', 'euronews.com', 'aljazeera.com', 'dw.com', 'france24.com', 'un.org', 'who.int', 'europa.eu', 'ecb.europa.eu', 'istat.it', 'bancaditalia.it', 'nasa.gov', 'regjeringen.no', 'arpal.liguria.it', 'pmi.it',
 // Dated primary/regional sources used by the 23 October edition. Restrict to
 // verified public hosts; a current local bulletin can supersede an older wire.
 'focustaiwan.tw','en.yna.co.kr','ons.gov.uk','gov.uk','consiglio.regione.umbria.it','unc.mil','mit.gov.it',
 // Direct evidence for the Italy-focused pilot. Bank host carries the MEF PDF,
 // not an extra independent confirmation of that same press release.
 'agenas.gov.it','regione.puglia.it','ingv.it','regione.sicilia.it','protezionecivile.it','protezionecivilesicilia.it','bancobpm.it','dt.mef.gov.it',
 'agi.it','ilsole24ore.com'];
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
  if (host.includes('bbc.')) return 'bbc';
  if (host.endsWith('europa.eu')) return 'eu';
  return TG_SEARCH_DOMAINS.find(d => host === d || host.endsWith('.' + d)) ?? host;
}
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
    const date = new Date(String(item.pubDate ?? item.published ?? item.updated ?? ''));
    if (!url || !title || !evidence || !Number.isFinite(date.getTime()) || date.getTime() > now.getTime() + 5 * 60_000 || date.getTime() < now.getTime() - days * 86400_000) return [];
    return [{ id: createHash('sha256').update(url).digest('hex').slice(0, 20), publisher: feed.name, independentGroup: group, url, title, evidence, publishedAt: date.toISOString() }];
  });
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
  return { sources: [...new Map(results.flatMap(r => r.status === 'fulfilled' ? r.value : []).map(source=>[source.url,source])).values()], warnings: results.flatMap((r, i) => r.status === 'rejected' ? [`Feed ${TG_FEEDS.filter(f => f.edition === edition)[i].name} non disponibile`] : []) };
}
