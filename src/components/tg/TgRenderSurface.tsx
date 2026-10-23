'use client';
import { useEffect, useRef } from 'react';
import { TgStudioRenderer,loadTgStudioAssets } from '@conclavia/avatar-kit/formats/tg';
import { tgFrameAt } from '@/lib/tg/timeline';
import type { TgManifest } from '@/lib/tg/types';
import {dailyProductionStudioConfig} from './daily-production-studio';
export function TgRenderSurface() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    let renderer:TgStudioRenderer|undefined,manifest:TgManifest|undefined,portrait=false,stopped=false;
    const state=window as unknown as {conclaviaTgRender?:unknown;conclaviaTgRenderError?:string};
    void loadTgStudioAssets(dailyProductionStudioConfig).then(assets=>{
      if(stopped)return;renderer=new TgStudioRenderer(canvas,assets);
      state.conclaviaTgRender={
        prepare(input:TgManifest,vertical:boolean){manifest=input;portrait=vertical;renderer!.reset();canvas.width=vertical?1080:1920;canvas.height=vertical?1920:1080;},
        frame(seconds:number,capture=true){if(!manifest)throw new Error('Not prepared');renderer!.render(seconds,tgFrameAt(manifest,seconds,portrait));return capture?canvas.toDataURL('image/jpeg',.93).split(',')[1]:'';},
        sample(){return renderer!.sample();},
      };
      canvas.dataset.tgStyle='daily-studio';
    }).catch(()=>{if(!stopped)state.conclaviaTgRenderError='Studio artwork or fonts unavailable';});
    return()=>{stopped=true;renderer?.dispose();delete state.conclaviaTgRender;delete state.conclaviaTgRenderError;};
  }, []);
  return <canvas ref={ref} width={1920} height={1080} aria-label="Daily · studio e conduttori" />;
}
