import assert from 'node:assert/strict';
import { test } from 'node:test';
import { auditTargets, dailyCopyIssues, scriptDigest, validateAudit } from '../../src/lib/tg/editorial';
import { auditIsCurrent, createEditorialApproval } from '../../src/lib/tg/review';
import { freshnessFixture } from './freshness-fixture';
import { approvalInput, reviewFixture } from './fixtures';

const now = new Date('2026-10-21T07:00:00Z');
function copy(...texts: string[]) {
  const script = reviewFixture(now).script!;
  return { sentences: texts.map((text, i) => ({ ...script.sentences[i % script.sentences.length], text })) };
}

test('evening-briefing and numbered-story formulas are caught across mood clauses in IT and EN', () => {
  for (const texts of [
    ['Quattro minuti con gli aggiornamenti verificati', 'di ieri sera.'],
    ['Le notizie della serata di ieri.'],
    ["The updates from", 'last night.'],
    ["Last night's news."],
    ['Seconda', 'storia, passiamo ai negoziati.'],
    ['And now the second story.'],
  ]) assert.ok(dailyCopyIssues(copy(...texts)).length, texts.join(' '));
});

test('real event dates and ordinary topic transitions remain allowed; research metadata is not spoken copy', () => {
  const script = copy(
    'Il voto si è concluso ieri sera: il risultato è stato annunciato il 20 ottobre.',
    "L'incontro del 20 ottobre ha aperto i colloqui.",
    "Seconda notizia, passiamo all'economia.",
    'The meeting took place last night.',
    'Now to science.',
  );
  assert.deepEqual(dailyCopyIssues({ ...script, description: 'Aggiornamenti di ieri sera: cutoff interno.' } as typeof script), []);
});

test('a positive AI fact verdict cannot override excluded programme wording or authorize its reuse', () => {
  const job = reviewFixture(now), script = job.script!;
  script.sentences[0].text = 'Seconda storia, gli aggiornamenti verificati di ieri sera.';
  const citations = job.research!.sources.map(({ url, title }) => ({ url, title }));
  const result = validateAudit({ issues: [], checks: Object.fromEntries(auditTargets(script).map(target => [
    target.key, { status: 'supported', evidence: 'Riscontro sintetico esplicito nelle fonti di test.', sourceUrls: [citations[0].url] },
  ])) }, script, citations, now);
  assert.equal(result.passed, false);
  assert.equal(result.issues.filter(issue => issue.startsWith('Linea CDaily:')).length, 2);
  // A matching but older/incorrectly positive report must not bypass the current copy rules.
  job.audit = { ...result, passed: true, issues: [], scriptSha256: scriptDigest(script),
    freshness: freshnessFixture(job.research!, script, now) };
  assert.equal(auditIsCurrent(job, now), false);
  assert.throws(() => createEditorialApproval(job, approvalInput(now), now, { TG_IT_YOUTUBE_CHANNEL_ID: 'fixture-channel' }), /verifica attuale/);
});
