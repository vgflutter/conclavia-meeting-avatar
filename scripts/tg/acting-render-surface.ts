/** Offline proof surface using the production renderer and approved identity. */
import {loadTgPromoAssets,TgPromoRenderer,tgPromoFrameAt,type TgPromoSequence} from '@conclavia/avatar-kit/formats/tg';
import {dailyVideoIdentity} from '../../src/components/tg/daily-video-identity';
import {dailyAvatarAppearance,type DailyAvatarMetadata} from '../../src/components/tg/daily-avatar-preset';
const canvas=document.querySelector('canvas')!;
const state=window as unknown as {conclaviaLaunchRender?:unknown;conclaviaLaunchError?:string};
void loadTgPromoAssets(dailyVideoIdentity).then(assets=>{
 let renderer:TgPromoRenderer|undefined,sequence:TgPromoSequence|undefined,portrait=true,last=-Infinity;
 state.conclaviaLaunchRender={
  prepare(data:TgPromoSequence,vertical:boolean){
   const appearance=dailyAvatarAppearance(data as TgPromoSequence&DailyAvatarMetadata,new URLSearchParams()),config={...dailyVideoIdentity,palette:{...dailyVideoIdentity.palette,...appearance}};
   renderer?.dispose();renderer=new TgPromoRenderer(canvas,{...assets,config,studio:{...assets.studio,config:{...assets.studio.config,palette:config.palette}}});
   sequence=data;portrait=vertical;canvas.width=portrait?1080:1920;canvas.height=portrait?1920:1080;last=-Infinity;
  },
  frame(seconds:number,capture=true){
   if(!renderer||!sequence)throw Error('Prepare the sequence first');
   // Seek/proof clips receive a short real-media pre-roll, so the first
   // visible frame is not a solver snap into the middle of a hand stroke.
   if(seconds<last||seconds-last>.25){
    renderer.reset();
    for(let t=Math.max(0,seconds-3);t<seconds-1e-7;t+=.02)renderer.render(t,tgPromoFrameAt(sequence,t,portrait));
   }
   renderer.render(seconds,tgPromoFrameAt(sequence,seconds,portrait));last=seconds;
   return capture?canvas.toDataURL('image/jpeg',.95).split(',')[1]:'';
  },
  sample:()=>renderer?.sample(),
 };
}).catch(error=>{state.conclaviaLaunchError=error instanceof Error?error.message:'Render assets unavailable';});
