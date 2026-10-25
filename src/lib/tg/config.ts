import type { TgEdition, TgProduct } from './types';
import { dueSlot } from './schedule';
import {DAILY_SECONDS} from './format';
export { localEditionDate } from './schedule';
export const TG_PRODUCTS: TgProduct[] = [
  { edition: 'it', name: 'Conclavia TG · Italia', language: 'it', seconds: DAILY_SECONDS, presenters: 1, publishTime: '19:15', timezone: 'Europe/Rome', enabled: false, automatic: false, platforms: ['youtube', 'instagram', 'tiktok', 'spotify'] },
  { edition: 'world', name: 'Conclavia TG · World', language: 'en', seconds: DAILY_SECONDS, presenters: 1, publishTime: '18:00', timezone: 'UTC', enabled: false, automatic: false, platforms: ['youtube', 'instagram', 'tiktok', 'spotify'] },
];
export const TG_PIPELINE = ['researching', 'writing', 'verifying', 'voicing', 'rendering', 'reviewing', 'needs_review', 'publishing'] as const;
export function editionId(value: unknown): value is TgEdition { return value === 'it' || value === 'world'; }
export function parseProduct(value: unknown): TgProduct {
  if (!value || typeof value !== 'object') throw new Error('Configurazione TG non valida');
  const p = value as TgProduct;
  if (!editionId(p.edition) || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 70 ||
    p.language !== (p.edition === 'it' ? 'it' : 'en') || !Number.isInteger(p.seconds) || p.seconds < 60 || p.seconds > 600 ||
    ![1, 2].includes(p.presenters) || !/^([01]\d|2[0-3]):[0-5]\d$/u.test(p.publishTime) ||
    (p.productionStandard !== undefined && p.productionStandard !== 'cdaily-v1') ||
    (p.editorialProfile !== undefined && (p.editorialProfile !== 'italia-morning-v2' || p.productionStandard !== 'cdaily-v1' || p.edition !== 'it')) ||
    (p.productionMode !== undefined && !['editorial','full'].includes(p.productionMode)) ||
    (p.textReviewMode !== undefined && !['manual','ai'].includes(p.textReviewMode)) ||
    (p.productionTime !== undefined && (!/^([01]\d|2[0-3]):[0-5]\d$/u.test(p.productionTime) || p.productionTime >= p.publishTime)) ||
    (p.publicationDriver !== undefined && !['worker','chatgpt-work'].includes(p.publicationDriver)) ||
    (p.siteFirst !== undefined && typeof p.siteFirst !== 'boolean') ||
    typeof p.enabled !== 'boolean' || typeof p.automatic !== 'boolean' || !Array.isArray(p.platforms) ||
    !p.platforms.length || new Set(p.platforms).size !== p.platforms.length || p.platforms.some(x => !['youtube', 'instagram', 'tiktok', 'spotify'].includes(x))) throw new Error('Configurazione TG non valida');
  try { new Intl.DateTimeFormat('en', { timeZone: p.timezone }).format(); } catch { throw new Error('Fuso orario non valido'); }
  return { edition: p.edition, name: p.name.trim(), language: p.language, seconds: p.seconds, presenters: p.presenters, ...(p.editorialProfile===undefined?{}:{editorialProfile:p.editorialProfile}), ...(p.textReviewMode===undefined?{}:{textReviewMode:p.textReviewMode}), ...(p.siteFirst===undefined?{}:{siteFirst:p.siteFirst}), ...(p.productionMode === undefined ? {} : {productionMode:p.productionMode}), ...(p.productionStandard === undefined ? {} : {productionStandard:p.productionStandard}), ...(p.productionTime === undefined ? {} : {productionTime:p.productionTime}), ...(p.publicationDriver === undefined ? {} : {publicationDriver:p.publicationDriver}), publishTime: p.publishTime, timezone: p.timezone, enabled: p.enabled, automatic: p.automatic, platforms: [...p.platforms] };
}
export const TG_PLATFORM_LABELS = {youtube:'YouTube',instagram:'Instagram',tiktok:'TikTok',spotify:'Spotify'} as const;
export function isDue(product: TgProduct, now: Date) {
  return Boolean(dueSlot(product, now));
}
