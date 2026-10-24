import {reviewFixture,scriptReviewFixture} from './fixtures';
import {freshnessFixture} from './freshness-fixture';
import {dailyClosing,dailyGreeting,scriptDigest} from '../../src/lib/tg/editorial';

export function editorialFixture(now:Date){
  const job=reviewFixture(now);job.product={...job.product,productionStandard:'cdaily-v1',publicationDriver:'chatgpt-work',productionMode:'editorial',automatic:true};
  job.research!.stories.push(...[3,4].map(i=>({...job.research!.stories[0],id:`story-${i}`})));
  const source=job.script!.sentences[0];
  job.script!.sentences=[{...source,text:dailyGreeting('it',job.date),storyId:'intro',intent:'acknowledge'},
    ...job.research!.stories.flatMap(s=>Array.from({length:4},()=>({...source,storyId:s.id,sourceIds:s.sourceIds,intent:'explain' as const,
      text:'Questo testo sintetico serve soltanto alla prova del percorso tecnico e non racconta fatti reali. Il contesto viene esposto in frasi collegate che chiariscono chi è coinvolto e perché il passaggio richiede una spiegazione accessibile a tutte le persone.'}))),...dailyClosing('it')];
  job.audit!.scriptSha256=scriptDigest(job.script!);job.audit!.freshness=freshnessFixture(job.research!,job.script!,now);
  job.scriptReview=scriptReviewFixture(job.product,job.date,job.research!,job.script!,now);
  return job;
}
