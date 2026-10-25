import type {TgPromoSequence,TgPromoScene} from '@conclavia/avatar-kit/formats/tg';
import type {TgManifest} from './types';
import {dailyApprovedAvatar,dailyApprovedStyleRevision} from '../../components/tg/daily-avatar-preset';

/** Product composition only. Avatar, typography layout and motion stay in the
 * canonical kit renderer used by the approved presentation. */
export function dailyRenderSequence(manifest:TgManifest):TgPromoSequence{
 const ids=[...new Set(manifest.cues.map(c=>c.storyId))];
 const scenes:TgPromoScene[]=ids.map((id,index)=>{
  const cue=manifest.cues.find(c=>c.storyId===id)!,next=manifest.cues.find(c=>c.storyId===ids[index+1]),story=manifest.stories.find(s=>s.id===id);
  const intro=id==='intro',outro=id==='outro';
  return {id,kind:'host',start:index===0?0:cue.start,end:next?.start??manifest.seconds,
   kicker:manifest.date+' · '+(manifest.product.edition==='it'?'ITALIA':'WORLD'),
   lines:[intro?'Le notizie per iniziare la giornata.':outro?'Cosa vuoi approfondire?':story?.headline??manifest.product.name],
   support:intro?'Meno rumore. Più contesto.':outro?'Scrivici nei commenti.':story?.whyItMatters??'',
   ...(story?{source:manifest.sources.filter(s=>story.sourceIds.includes(s.id)).map(s=>s.publisher).filter((s,i,a)=>a.indexOf(s)===i).slice(0,3).join(' · ')}:{})};
 });
 return {version:1,duration:manifest.seconds,brandLabel:'CDaily',claim:'Meno rumore. Più contesto.',cta:'Seguici per notizie e approfondimenti',url:'daily.conclavia.me',disclosure:'',
  voice:'Alex 2 - daily',title:manifest.product.name,description:'',words:[],scenes,
  cues:manifest.cues.map(c=>({...c,scene:c.storyId,frameSeconds:c.frameSeconds??.02,levels:c.levels??[],phones:c.phones??[]})),
  ...{visualStyle:'clean',captionMode:'separate',styleReference:dailyApprovedStyleRevision,avatarFinish:dailyApprovedAvatar.finish,avatarPosture:dailyApprovedAvatar.posture,avatarHands:dailyApprovedAvatar.handStyle}};
}
