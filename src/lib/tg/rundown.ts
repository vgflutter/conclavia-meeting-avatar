import type { TgResearch, TgScript } from './types';

/** Browser-safe projection of reviewed copy, in actual speaking order. */
export function editionRundown(script:TgScript,research:TgResearch) {
  const spoken=[...new Set(script.sentences.map(s=>s.storyId))].filter(id=>research.stories.some(s=>s.id===id));
  return spoken.map((storyId,index)=>{
    const sentences=script.sentences.filter(s=>s.storyId===storyId),sourceIds=new Set(sentences.flatMap(s=>s.sourceIds));
    return {position:index+1,storyId,
      title:script.headlines?.find(h=>h.storyId===storyId)?.title || sentences[0].text,
      description:script.cards?.find(c=>c.storyId===storyId)?.context || sentences[0].text,
      sourceIds:[...sourceIds],sources:research.sources.filter(s=>sourceIds.has(s.id)).map(s=>({publisher:s.publisher,url:s.url})),
    };
  });
}
