import type {TgProduct,TgSentence,TgSpeechPlan} from './types';

/** Daily's casting/direction policy. Transport and synthesis remain in the kit. */
export function tgSpeechPlan(product:TgProduct):TgSpeechPlan {
  if(product.productionStandard==='cdaily-v1') return {provider:'elevenlabs',model:'eleven_v4',speakingRate:1,direction:'alex2-connected-v1',voices:['Alex 2 - daily']};
  return {provider:'inworld',model:'inworld-tts-2',speakingRate:1.08,direction:'daily-brisk-v3',
    voices:(product.language==='it'?['Gianni','Orietta']:['Dennis','Olivia']).slice(0,product.presenters)};
}

/** Keep a news paragraph fluent while its individual clauses carry moods. */
export function tgSpeechPassages(sentences:TgSentence[]) {
  const groups:TgSentence[][]=[];
  for(const sentence of sentences){
    const last=groups.at(-1),first=last?.[0];
    if(first&&first.speaker===sentence.speaker&&first.storyId===sentence.storyId&&last!.reduce((n,s)=>n+s.text.length+1,0)+sentence.text.length<1600&&[...last!,sentence].reduce((n,s)=>n+s.text.split(/\s+/u).length,0)<=80)last!.push(sentence);
    else groups.push([sentence]);
  }
  return groups;
}
export function directedTgPassage(sentences:TgSentence[],language:TgProduct['language']) {
  if(sentences.length===1)return directedTgText(sentences[0],language);
  const serious=sentences.some(s=>s.mood==='empathy');
  const tone=serious?'sober and compassionate, without dramatizing':'brisk, warm and engaged, with varied emphasis and short natural breaths';
  return `[Speak in native ${language==='it'?'Italian':'English'} as an experienced news podcast host: ${tone}. Read this as one flowing paragraph, not separate announcements. Keep momentum, link clauses and avoid long staged pauses. Natural breaths and connected phrasing, never robotic, theatrical or a commercial announcer] ${sentences.map(s=>s.text).join(' ')}`;
}
export function directedTgText(sentence:TgSentence,language:TgProduct['language']) {
  const care=sentence.mood==='empathy'?'sober and compassionate, without dramatizing':sentence.mood==='curiosity'?'engaged and curious':sentence.mood==='doubt'||sentence.mood==='disagreement'?'measured and thoughtful':sentence.mood==='amusement'||sentence.mood==='agreement'?'warm and lightly upbeat':'clear, brisk and engaged';
  // Supported TTS-2 inline direction is not part of the public script/captions.
  return `[Speak in native ${language==='it'?'Italian':'English'} as an experienced news podcast host: ${care}, conversational, with connected phrasing, varied emphasis and no long staged pauses, never a commercial announcer] ${sentence.text}`;
}
