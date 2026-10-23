import { scriptDigest } from './editorial';
import { publicationCopy } from './presentation';
import { scoredNarration } from './script-review';
import type { TgJob } from './types';
import { editionRundown } from './rundown';

/** Reuse approved words. No publisher-side summarisation or extra factual claims. */
export function editionTexts(job: Pick<TgJob,'product'|'edition'|'date'|'script'|'research'>) {
  if (!job.script || !job.research) throw new Error('Copione e fonti necessari per il pacchetto testuale');
  const { script, research } = job;
  const rundown=editionRundown(script,research);
  if (!rundown.length || !script.description.trim()) throw new Error('Scaletta o riassunto mancanti');
  const markdown=[`# ${script.title}`,`${job.date} · ${job.edition==='it'?'Italia':'World'}`,'',script.description,'',
    ...rundown.flatMap(s=>[`## ${s.position}. ${s.title}`,'',s.description,'',...s.sources.map(source=>`- ${source.publisher}: ${source.url}`),'']),
  ].join('\n');
  const narration=scoredNarration(script);
  return {version:1 as const,edition:job.edition,date:job.date,scriptSha256:scriptDigest(script),title:script.title,
    summary:script.description,rundown,markdown,...narration,
    posts:job.product.platforms.map(platform=>({platform,...publicationCopy(job,platform)})),
  };
}
