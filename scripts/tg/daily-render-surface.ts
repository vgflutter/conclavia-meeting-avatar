import {loadTgPromoAssets,TgPromoRenderer,tgPromoFrameAt} from '@conclavia/avatar-kit/formats/tg';
import {dailyVideoIdentity} from '../../src/components/tg/daily-video-identity';
import {dailyApprovedAvatar} from '../../src/components/tg/daily-avatar-preset';
import {dailyRenderSequence} from '../../src/lib/tg/daily-render-sequence';
import type {TgManifest} from '../../src/lib/tg/types';
const canvas=document.querySelector('canvas')!;
const state=window as unknown as {conclaviaTgRender?:unknown;conclaviaTgRenderError?:string};
const config={...dailyVideoIdentity,palette:{...dailyVideoIdentity.palette,...dailyApprovedAvatar}};
void loadTgPromoAssets(config).then(assets=>{
 const renderer=new TgPromoRenderer(canvas,assets);let sequence:ReturnType<typeof dailyRenderSequence>,portrait=false;
 state.conclaviaTgRender={
  prepare(manifest:TgManifest,vertical:boolean){sequence=dailyRenderSequence(manifest);portrait=vertical;canvas.width=portrait?1080:1920;canvas.height=portrait?1920:1080;renderer.reset();},
  frame(seconds:number){if(!sequence)throw Error('Missing approved sequence');renderer.render(seconds,tgPromoFrameAt(sequence,seconds,portrait));return canvas.toDataURL('image/jpeg',.93).split(',')[1];},
  sample(){return renderer.sample();},
 };
}).catch(()=>{state.conclaviaTgRenderError='Approved renderer assets unavailable';});
