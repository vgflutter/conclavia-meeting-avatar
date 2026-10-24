import { createHash } from 'node:crypto';
import { sentenceDigest } from './editorial';
import type { TgFinalReview, TgJob, TgMediaCheck } from './types';
import { masterSeconds, naturalDailyClock, validMasterClock } from './media-contract';

export const FINAL_REVIEW_CHECKS = ['visual', 'headlines', 'captions', 'emotion', 'publication'] as const;
export function finalTimelineIsValid(job: TgJob) {
  const manifest=job.manifest;
  return Boolean(job.script&&manifest&&!manifest.demo&&validMasterClock(job.product,manifest)&&manifest.date===job.date
    &&manifest.product.edition===job.edition&&manifest.cues.length===job.script.sentences.length&&manifest.cues.length>0
    &&sentenceDigest(manifest.cues)===sentenceDigest(job.script.sentences)
    &&manifest.cues.every((cue,i)=>Number.isFinite(cue.start)&&Number.isFinite(cue.end)&&cue.start>=0&&cue.end>cue.start
      &&cue.end<=manifest.seconds&&(!i||cue.start>=manifest.cues[i-1].end-.01)));
}
export function finalReviewInputDigest(job: TgJob) {
  return createHash('sha256').update(JSON.stringify({
    version: 1, product: job.product, date: job.date, script: job.script, audit: job.audit, scriptReview:job.scriptReview,
    manifest: job.manifest,
    assets: [...job.assets].sort((a, b) => a.name.localeCompare(b.name)),
  })).digest('hex');
}
export function mediaCheckIssues(media: TgMediaCheck[], seconds: number, requireDaily=false) {
  const issues: string[] = [];
  for (const format of ['landscape', 'portrait'] as const) {
    const m = media.find(m => m.format === format);
    if (!m || media.filter(m => m.format === format).length !== 1) { issues.push(`Controllo media ${format} mancante`); continue; }
    const values = [m.width, m.height, m.seconds, m.rms, m.peak, m.clippedRatio, m.leadingSilence, m.trailingSilence];
    if (!values.every(Number.isFinite) || values.some(v => v < 0)) { issues.push(`Misure media ${format} non valide`); continue; }
    const expected = format === 'landscape' ? 16 / 9 : 9 / 16;
    if (Math.min(m.width, m.height) < 720 || Math.abs(m.width / m.height - expected) > .01) issues.push(`Formato video ${format} non valido`);
    if (Math.abs(m.seconds - seconds) > .1) issues.push(`Minutaggio ${format} non conforme`);
    if(requireDaily&&(m.width!==(format==='landscape'?1920:1080)||m.height!==(format==='landscape'?1080:1920)||m.fps!==50))issues.push(`Master ${format} deve essere nativo Full HD a 50 fps`);
    if (m.rms < .004 || m.peak < .02) issues.push(`Audio ${format} assente o troppo basso`);
    if (m.clippedRatio > .001) issues.push(`Audio ${format} con distorsione`);
    if (m.leadingSilence > 3 || m.trailingSilence > 4) issues.push(`Silenzio eccessivo nel video ${format}`);
  }
  return issues;
}
export function finalReviewIsBound(job: TgJob, now = new Date(), maxAge = 6 * 3600000) {
  const report = job.finalReview, checked = Date.parse(report?.checkedAt ?? '');
  return Boolean(finalTimelineIsValid(job)&&report?.version === 1 && report.passed && !report.issues.length
    && FINAL_REVIEW_CHECKS.every(key => report.checks[key] === true)
    && Number.isFinite(checked) && checked <= now.getTime() + 60000 && now.getTime() - checked < maxAge
    && report.inputSha256 === finalReviewInputDigest(job)
    && !mediaCheckIssues(report.media, masterSeconds(job),naturalDailyClock(job.product)).length
    && ['landscape', 'portrait'].every(format => report.samples.filter(s => s.format === format && Number.isFinite(s.at) && s.at >= 0 && s.at < masterSeconds(job)).length >= 3));
}
export function validateFinalReview(value: unknown): Pick<TgFinalReview, 'checks' | 'issues' | 'summary' | 'passed'> {
  const raw = value as { checks?: Record<string, unknown>; issues?: unknown; summary?: unknown } | null;
  if (!raw || !raw.checks || !FINAL_REVIEW_CHECKS.every(k => typeof raw.checks![k] === 'boolean')
    || !Array.isArray(raw.issues) || raw.issues.length > 12 || raw.issues.some(x => typeof x !== 'string' || x.length > 500)
    || typeof raw.summary !== 'string' || !raw.summary.trim() || raw.summary.length > 1500) throw new Error('Esito del revisore finale non valido');
  const checks = Object.fromEntries(FINAL_REVIEW_CHECKS.map(key => [key, raw.checks![key]])) as TgFinalReview['checks'];
  const issues = raw.issues as string[];
  if (FINAL_REVIEW_CHECKS.some(key => !checks[key]) && !issues.length) issues.push('Il revisore AI non ha superato tutti i controlli finali');
  return { checks, issues, summary: raw.summary, passed: !issues.length && FINAL_REVIEW_CHECKS.every(k => checks[k]) };
}
