import type {TgResearch} from './types';

export interface SourceEditorCheck {
 coreSupported:boolean;coherentSources:boolean;fresh:boolean;italyFocus:boolean;
 scope:string;reason:string;sourceUrls:string[];
}
/** A documented major-world exception need not pretend it has Italian impact. */
export function applySourceEditorReview(research:TgResearch,checks:Record<string,SourceEditorCheck>){
 const stories=research.stories.filter(story=>{
  const c=checks[story.id];
  const scope=c&&(c.scope==='major-world'||c.italyFocus&&['italy','italy-impact'].includes(c.scope));
  return c&&scope&&c.coreSupported&&c.coherentSources&&c.fresh&&c.reason.trim().length>=30&&new Set(c.sourceUrls).size>=2;
 });
 const used=new Set(stories.flatMap(s=>s.sourceIds));
 return {...research,stories,sources:research.sources.filter(s=>used.has(s.id))};
}
