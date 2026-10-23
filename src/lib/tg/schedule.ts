import type { TgJob, TgProduct } from './types';
export function localEditionDate(now: Date, timezone: string) { return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }

export const PREPARATION_LEAD_MS = 45 * 60000;
export const PUBLICATION_GRACE_MS = 30 * 60000;
export interface TgSlot {
  edition: TgProduct['edition']; date: string; timezone: string;
  prepareAt: string; scheduledAt: string; closesAt: string;
  adjusted: boolean; enabled: boolean; automatic: boolean; jobId?: string; state?: TgJob['state'];
}
const wall = (date: Date, timezone: string) => new Intl.DateTimeFormat('sv-SE', {
  timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(date).replace(' ', 'T');
export function addCalendarDays(date: string, days: number) {
  return new Date(Date.parse(date + 'T12:00:00Z') + days * 86400000).toISOString().slice(0, 10);
}
/** Resolve a wall clock independently of the server/browser zone.
 * Autumn repeats use the first occurrence; a missing spring minute moves to
 * the first existing minute after it. Both choices are visible in the calendar.
 */
export function editionInstant(date: string, time: string, timezone: string) {
  const target = `${date}T${time}`, nominal = Date.parse(target + ':00Z');
  if (!Number.isFinite(nominal)) throw new Error('Data di programmazione non valida');
  // Offsets on either side also cover fractional-hour and DST transitions.
  const offsets = new Set([-36, -12, 0, 12, 36].map(h => {
    const at = nominal + h * 3600000;
    return Date.parse(wall(new Date(at), timezone) + ':00Z') - at;
  }));
  const matches = [...offsets].map(offset => nominal - offset).filter(at => wall(new Date(at), timezone) === target).sort((a, b) => a - b);
  if (matches.length) return { at: new Date(matches[0]), adjusted: matches.length > 1 };
  // The uncommon DST gap: inspect at most a four-hour transition window.
  const candidates = [...offsets].map(offset => nominal - offset).sort((a, b) => a - b);
  for (let at = candidates[0] - 2 * 3600000; at <= candidates.at(-1)! + 2 * 3600000; at += 60000) {
    const local = wall(new Date(at), timezone);
    if (local.slice(0, 10) === date && local >= target) return { at: new Date(at), adjusted: true };
  }
  throw new Error('Orario non disponibile in questo fuso');
}
export function editionSlot(product: TgProduct, date: string): TgSlot {
  const { at, adjusted } = editionInstant(date, product.publishTime, product.timezone);
  const production = product.productionTime ? editionInstant(date, product.productionTime, product.timezone) : undefined;
  if (production && production.at >= at) throw new Error('La produzione deve precedere la pubblicazione');
  return { edition: product.edition, date, timezone: product.timezone,
    prepareAt: production?.at.toISOString() ?? new Date(at.getTime() - PREPARATION_LEAD_MS).toISOString(), scheduledAt: at.toISOString(),
    closesAt: new Date(at.getTime() + PUBLICATION_GRACE_MS).toISOString(), adjusted: adjusted || Boolean(production?.adjusted),
    enabled: product.enabled, automatic: product.automatic };
}
export function dueSlot(product: TgProduct, now: Date) {
  if (!product.enabled) return undefined;
  const today = localEditionDate(now, product.timezone);
  // Preparation can start on the preceding day for a midnight edition.
  return [-1, 0, 1].map(d => editionSlot(product, addCalendarDays(today, d))).find(slot =>
    now.getTime() >= Date.parse(slot.prepareAt) && now.getTime() <= Date.parse(slot.closesAt));
}
export function scheduleCalendar(products: TgProduct[], jobs: TgJob[], now: Date, days = 7) {
  return products.flatMap(product => {
    const today = localEditionDate(now, product.timezone);
    return Array.from({ length: days }, (_, i) => {
      const date = addCalendarDays(today, i), job = jobs.find(j => j.edition === product.edition && j.date === date);
      const slot = editionSlot(job?.product ?? product, date);
      return { ...slot, ...(job ? { jobId: job.id, state: job.state, scheduledAt: job.publicationPlan?.scheduledAt ?? slot.scheduledAt } : {}) };
    });
  }).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}
