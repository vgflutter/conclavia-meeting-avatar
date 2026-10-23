import assert from 'node:assert/strict';
import { test } from 'node:test';
import { auditSchema, auditTargets, dailySummaryIssues, scriptDigest, validateAudit } from '../../src/lib/tg/editorial';
import { publicationCopy } from '../../src/lib/tg/presentation';
import { auditIsCurrent } from '../../src/lib/tg/review';
import { freshnessFixture } from './freshness-fixture';
import { reviewFixture } from './fixtures';

const now = new Date('2026-10-21T07:00:00Z');
test('the full reviewed summary precedes credits and survives every channel caption budget in both languages', () => {
  for (const language of ['it', 'en'] as const) {
    const job = reviewFixture(now);
    job.product.language = language;
    const summary = [
      language === 'it' ? 'I fatti della puntata.' : 'The facts in this edition.',
      ...Array.from({ length: 4 }, (_, i) => `• ${language === 'it' ? 'Notizia' : 'News item'} ${i + 1}: ${'Un fatto attribuito e documentato. '.repeat(6)}`),
    ].join('\n');
    assert.ok(summary.length <= 1100);
    job.script!.description = summary;
    job.research!.sources.push({ ...job.research!.sources[0], id: 'not-spoken', url: 'https://www.ansa.it/unspoken' });
    for (const platform of ['instagram', 'tiktok', 'youtube', 'spotify'] as const) {
      const copy = publicationCopy(job, platform);
      assert.ok(copy.description.includes(summary));
      assert.ok(copy.description.indexOf(summary) < copy.description.indexOf(language === 'it' ? 'Fonti:' : 'Sources:'));
      assert.ok(copy.description.length <= (['instagram', 'tiktok'].includes(platform) ? 2200 : 4800));
      assert.match(copy.description, /https:\/\/daily\.conclavia\.me/u);
      assert.match(copy.description, language === 'it' ? /Segui Conclavia Daily/ : /Follow Conclavia Daily/);
      assert.doesNotMatch(copy.description, /unspoken/u);
    }
  }
});

test('missing or oversized summaries cannot reuse a positive matching audit', () => {
  for (const description of ['', '   ', 'x'.repeat(1101)]) {
    const job = reviewFixture(now); job.script!.description = description;
    job.audit!.scriptSha256 = scriptDigest(job.script!);
    job.audit!.freshness = freshnessFixture(job.research!, job.script!, now);
    assert.ok(dailySummaryIssues(job.script!).length);
    assert.equal(auditIsCurrent(job, now), false);
  }
});

test('the social summary is factual public copy: a provider pass without consulted evidence fails', () => {
  const job = reviewFixture(now), script = job.script!;
  const citations = job.research!.sources.map(({ url, title }) => ({ url, title }));
  const checks = Object.fromEntries(auditTargets(script).map(target => [target.key, {
    status: 'supported', evidence: 'Riscontro sintetico nel materiale consultato.', sourceUrls: [citations[0].url],
  }]));
  checks.description.sourceUrls = [];
  const result = validateAudit({ issues: [], checks }, script, citations, now);
  assert.equal(result.passed, false);
  assert.ok(result.issues.some(issue => issue.startsWith('description:')));
  const schema = auditSchema(script, citations.map(c => c.url));
  const fields = schema.properties as { checks: { properties: { description: { properties: { sourceUrls: { maxItems: number } } } } } };
  assert.ok(fields.checks.properties.description.properties.sourceUrls.maxItems >= 4);
});
