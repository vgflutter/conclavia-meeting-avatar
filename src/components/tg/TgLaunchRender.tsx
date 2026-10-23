'use client';
import {useEffect,useRef} from 'react';
import {TgPromoRenderer,loadTgPromoAssets,tgPromoFrameAt,type TgPromoSequence} from '@conclavia/avatar-kit/formats/tg';
import {dailyVideoIdentity} from './daily-video-identity';
import {directDailyLaunchMotion} from './daily-launch-motion';
import {dailyAvatarAppearance,type DailyAvatarMetadata} from './daily-avatar-preset';
export const dailyLaunchConfig=dailyVideoIdentity;
export function TgLaunchRender(){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const canvas=ref.current;if(!canvas)return;
  const sculpted=new URLSearchParams(window.location.search).get('finish')==='sculpted';
  const requestedPosture=new URLSearchParams(window.location.search).get('posture');
  const posture=requestedPosture==='desk'?'desk' as const:requestedPosture==='standing'?'standing' as const:undefined;
  const hands=new URLSearchParams(window.location.search).get('hands');
  const handStyle=hands==='shell'?'shell' as const:hands==='anatomical'?'anatomical' as const:undefined;
  const config={...dailyLaunchConfig,palette:{...dailyLaunchConfig.palette,...(sculpted?{finish:'sculpted' as const}:{}),posture,handStyle},secondaryPalette:dailyLaunchConfig.secondaryPalette?{...dailyLaunchConfig.secondaryPalette,...(sculpted?{finish:'sculpted' as const}:{}),posture,handStyle}:undefined};
  let renderer:TgPromoRenderer|undefined,sequence:TgPromoSequence|undefined,portrait=true,stopped=false;
  const state=window as unknown as {conclaviaLaunchRender?:unknown;conclaviaLaunchError?:string};
  void loadTgPromoAssets(config).then(assets=>{
   if(stopped)return;renderer=new TgPromoRenderer(canvas,assets);
   state.conclaviaLaunchRender={
    prepare(data:TgPromoSequence,vertical:boolean){
     const appearance=dailyAvatarAppearance(data as TgPromoSequence&DailyAvatarMetadata,new URLSearchParams(window.location.search));
     const selected={...config,palette:{...config.palette,...appearance},secondaryPalette:config.secondaryPalette?{...config.secondaryPalette,...appearance}:undefined};
     renderer?.dispose();renderer=new TgPromoRenderer(canvas,{...assets,config:selected,studio:{...assets.studio,config:{...assets.studio.config,palette:selected.palette,secondaryPalette:selected.secondaryPalette}}});
     sequence=directDailyLaunchMotion(data,{posture:appearance.posture});portrait=vertical;
     canvas.width=vertical?1080:1920;canvas.height=vertical?1920:1080;
     canvas.dataset.finish=appearance.finish??'original';canvas.dataset.posture=appearance.posture??'legacy';canvas.dataset.hands=appearance.handStyle??'legacy';renderer.reset();
    },
    frame(t:number,capture=true){if(!sequence)throw Error('Prepare the launch sequence first');renderer!.render(t,tgPromoFrameAt(sequence,t,portrait));return capture?canvas.toDataURL('image/jpeg',.95).split(',')[1]:'';},
    sample(){return renderer!.sample();},
   };canvas.dataset.ready='true';
  }).catch(()=>{if(!stopped)state.conclaviaLaunchError='Artwork or fonts unavailable';});
  return()=>{stopped=true;renderer?.dispose();delete state.conclaviaLaunchRender;delete state.conclaviaLaunchError;};
 },[]);
 return <canvas ref={ref} width={1080} height={1920} aria-label="Presentazione Daily · renderer"/>;
}
