import { createHash } from 'node:crypto';
import { dailyCopyIssues, dailySummaryIssues, requireDailyCoverage, scriptDigest } from './editorial';
import { localEditionDate } from './config';
import { publicationCopy, TG_REVIEW_CHECKS } from './presentation';
import { finalReviewIsBound } from './final-review-policy';
import { freshnessIsCurrent } from './freshness';
import { editionSlot } from './schedule';
import {scriptReviewIsCurrent} from './script-review';
import type { TgJob, TgPlatform, TgPublicationPlan, TgReview } from './types';

export const AUDIT_MAX_AGE_MS = 6 * 3600000;
export function factualAuditIsCurrent(job: TgJob, now = new Date()) {
  if (!job.research || !job.script) return false;
  try { requireDailyCoverage(job.product, job.research, job.script); }
  catch { return false; }
  const checked = Date.parse(job.audit?.checkedAt ?? '');
  return Boolean(freshnessIsCurrent(job,now) && job.script && !dailyCopyIssues(job.script).length && !dailySummaryIssues(job.script).length && job.audit?.passed && !job.audit.issues.length && job.audit.scriptSha256 === scriptDigest(job.script)
    && Number.isFinite(checked) && checked <= now.getTime() + 60000 && now.getTime() - checked < AUDIT_MAX_AGE_MS);
}
export function auditIsCurrent(job:TgJob,now=new Date()){
  return factualAuditIsCurrent(job,now)&&scriptReviewIsCurrent(job,now);
}
export function channelDestination(edition: TgJob['edition'], platform: TgPlatform, env: Record<string,string|undefined> = process.env) {
  const prefix = edition === 'it' ? 'TG_IT_' : 'TG_WORLD_';
  if (platform === 'youtube') return env[prefix + 'YOUTUBE_CHANNEL_ID'] || '';
  if (platform === 'instagram') return env[prefix + 'INSTAGRAM_ACCOUNT_ID'] || '';
  if (platform === 'tiktok') return env[prefix + 'METRICOOL_BLOG_ID'] && env[prefix + 'TIKTOK_USERNAME']
    ? `${env[prefix + 'METRICOOL_BLOG_ID']}/@${env[prefix + 'TIKTOK_USERNAME']!.replace(/^@/u, '')}` : '';
  if(!env[prefix+'SPOTIFY_SHOW_ID']||!env.TG_SPOTIFY_PARTNER_URL)return '';
  try{const url=new URL(env.TG_SPOTIFY_PARTNER_URL);if(url.protocol!=='https:'||url.username||url.password)return '';return `${url.origin}${url.pathname}|${env[prefix+'SPOTIFY_SHOW_ID']}`;}catch{return '';}
}
export function publicationDigest(job: TgJob, plan: TgPublicationPlan, destinations: TgReview['destinations']) {
  return createHash('sha256').update(JSON.stringify({
    edition: job.edition, date: job.date, product: job.product, script: job.script && scriptDigest(job.script),
    audit: job.audit, scriptReview:job.scriptReview, research:job.research,
    assets: [...job.assets].sort((a,b) => a.name.localeCompare(b.name)).map(a => ({name:a.name,sha:a.sha256,bytes:a.bytes,duration:a.duration})),
    plan, destinations, finalReview: job.finalReview, copy: plan.platforms.map(p => ({platform:p,...publicationCopy(job,p)})),
  })).digest('hex');
}
export function approvalIsBound(job: TgJob, env: Record<string,string|undefined> = process.env, now = new Date()) {
  if (!job.approvedAt || job.review?.decision !== 'approved' || !job.publicationPlan || !job.review.bundleSha256) return false;
  if (job.review.mode === 'ai' ? !job.product.automatic || !finalReviewIsBound(job, now, Infinity) : !Object.keys(TG_REVIEW_CHECKS).every(key => job.review?.checks[key] === true)) return false;
  const destinations = Object.fromEntries(job.publicationPlan.platforms.map(p => [p, channelDestination(job.edition,p,env)]));
  return Object.values(destinations).every(Boolean)
    && JSON.stringify(destinations) === JSON.stringify(job.review.destinations)
    && publicationDigest(job,job.publicationPlan,destinations) === job.review.bundleSha256;
}
export function parsePublicationPlan(value: unknown, job: TgJob, now = new Date()): TgPublicationPlan {
  const p = value as TgPublicationPlan;
  if (!p || !Array.isArray(p.platforms) || !p.platforms.length || new Set(p.platforms).size !== p.platforms.length
    || p.platforms.some(x => !job.product.platforms.includes(x))) throw new Error('Seleziona almeno un canale previsto per questa edizione');
  const at = Date.parse(p.scheduledAt);
  if (!Number.isFinite(at) || at < now.getTime() - 60000 || at >= Date.parse(job.audit?.checkedAt ?? '') + AUDIT_MAX_AGE_MS
    || !freshnessIsCurrent(job,new Date(at))
    || localEditionDate(new Date(at),job.product.timezone) !== job.date || localEditionDate(now,job.product.timezone) !== job.date)
    throw new Error('Scegli un’uscita di oggi entro la validità del controllo di attualità');
  return {platforms:[...p.platforms].sort(),scheduledAt:new Date(at).toISOString()};
}
function requireMediaBundle(job: TgJob) {
  for (const name of ['landscape.mp4','portrait.mp4','audio.mp3','captions.vtt','manifest.json']) {
    const a = job.assets.find(a => a.name === name);
    if (!a || a.bytes <= 0 || !/^[a-f\d]{64}$/u.test(a.sha256)) throw new Error('Pacchetto video incompleto');
    if (name.endsWith('.mp4') && (!Number.isFinite(a.duration) || Math.abs(a.duration! - job.product.seconds) > .1)) throw new Error('Durata video non verificata');
  }
}
export function createEditorialApproval(job: TgJob, input: {reviewer?: unknown; note?: unknown; checks?: unknown; plan?: unknown}, now = new Date(), env: Record<string,string|undefined> = process.env) {
  if(job.product.automatic)throw new Error('Edizione autonoma: richiedi una nuova revisione AI, senza sostituirla con un’approvazione umana');
  if (job.state !== 'needs_review' || !auditIsCurrent(job,now)) throw new Error('Serve una verifica attuale, positiva e corrispondente al copione');
  requireMediaBundle(job);
  const checks = input.checks as Record<string,boolean> | undefined;
  if (!checks || !Object.keys(TG_REVIEW_CHECKS).every(key => checks[key] === true)) throw new Error('Completa tutti i controlli editoriali');
  if (typeof input.reviewer !== 'string' || input.reviewer.trim().length < 2 || input.reviewer.length > 80) throw new Error('Indica il nome del revisore');
  if (input.note !== undefined && (typeof input.note !== 'string' || input.note.length > 1000)) throw new Error('Nota editoriale non valida');
  const plan = parsePublicationPlan(input.plan,job,now);
  const destinations = Object.fromEntries(plan.platforms.map(p => [p,channelDestination(job.edition,p,env)]));
  if (!Object.values(destinations).every(Boolean)) throw new Error('Configura la destinazione dei canali selezionati prima di approvare');
  const review: TgReview = {decision:'approved',reviewer:input.reviewer.trim(),at:now.toISOString(),note:typeof input.note==='string'?input.note.trim():'',checks:Object.fromEntries(Object.keys(TG_REVIEW_CHECKS).map(key=>[key,true])),destinations};
  review.bundleSha256 = publicationDigest(job,plan,destinations);
  return {review,publicationPlan:plan,approvedAt:now.toISOString()};
}
/** Machine approval is a distinct provenance, never fabricated human checklist attestations. */
export function createAiApproval(job: TgJob, now = new Date(), env: Record<string, string | undefined> = process.env) {
  if (!job.product.automatic || !auditIsCurrent(job, now) || !finalReviewIsBound(job, now)) throw new Error('Revisione AI finale assente, scaduta o non corrispondente ai media');
  requireMediaBundle(job);
  const slot = editionSlot(job.product, job.date), at = Math.max(Date.parse(slot.scheduledAt), now.getTime());
  if (now.getTime() < Date.parse(slot.prepareAt) || at > Date.parse(slot.closesAt)
    || at >= Date.parse(job.audit!.checkedAt) + AUDIT_MAX_AGE_MS || !freshnessIsCurrent(job,new Date(at))) throw new Error('Finestra di uscita superata: nessuna pubblicazione tardiva automatica');
  const plan = { platforms: [...job.product.platforms].sort(), scheduledAt: new Date(at).toISOString() };
  const destinations = Object.fromEntries(plan.platforms.map(p => [p, channelDestination(job.edition, p, env)]));
  if (!Object.values(destinations).every(Boolean)) throw new Error('Destinazioni non configurate: edizione AI non programmata');
  const review: TgReview = { mode: 'ai', decision: 'approved', reviewer: 'Daily · revisore AI indipendente', at: now.toISOString(),
    note: job.finalReview!.summary, checks: { ...job.finalReview!.checks }, destinations };
  review.bundleSha256 = publicationDigest(job, plan, destinations);
  return { review, publicationPlan: plan, approvedAt: now.toISOString() };
}
