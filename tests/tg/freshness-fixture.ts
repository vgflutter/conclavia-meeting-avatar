import { validateFreshness } from '../../src/lib/tg/freshness';
import type { TgPublishedEdition, TgResearch, TgScript } from '../../src/lib/tg/types';
/** Synthetic editor evidence only: this fixture never calls a provider. */
export function freshnessFixture(research:TgResearch,script:TgScript,now:Date,history:TgPublishedEdition[]=[]) {
  const web=Object.fromEntries(research.stories.map(s=>[s.id,research.sources.filter(source=>s.sourceIds.includes(source.id)).map(source=>source.url)]));
  const checks=Object.fromEntries(research.stories.map(s=>[s.id,{status:'new',eventDate:now.toISOString().slice(0,10),development:`Sviluppo appena documentato per ${s.headline}.`,evidence:'Due riscontri sintetici attestano un nuovo evento nella finestra verificata.',sourceIds:s.sourceIds,webUrls:web[s.id],previousStoryKeys:[]}]));
  return validateFreshness({checks},research,script,history,web,now);
}
