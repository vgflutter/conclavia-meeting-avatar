import type {TgStudioConfig} from '@conclavia/avatar-kit/formats/tg';
import {dailyRobotPalette} from './daily-robot-theme';
import type {PresenterDesign} from '@conclavia/avatar-kit/characters/robot';

/** Conclavia Daily owns the room, brand and palette; the kit owns the stage. */
export const dailyStudioConfig:TgStudioConfig={
  landscapeUrl:'/daily-studio/studio-landscape-v2.png',
  portraitUrl:'/daily-studio/studio-portrait-v2.png',
  logoUrl:'/daily-studio/conclavia-logo.svg',
  palette:dailyRobotPalette,programmeLabel:'Daily',
  secondaryPalette:{...dailyRobotPalette,identity:1,shell:'#a6b4ad',shellLight:'#e0e5dc',jacket:'#5d716c',jacketLight:'#87988d',jacketShade:'#405750',accent:'#f0e9da',accentShade:'#c3c7b4'},
  ink:'#203944',paper:'#faf9f6',accent:'#216e80',desk:'#d8dfdd',
  fontFamily:'Daily Sans',displayFontFamily:'Daily Display',
  fonts:[{family:'Daily Sans',url:'/daily-studio/dm-sans.woff2',weight:'100 900'},
    {family:'Daily Display',url:'/daily-studio/instrument-serif-italic.woff2',style:'italic',weight:'400'}],
};

/** Product art direction, kept out of the shared anatomy/performance engine. */
export function dailyStudioForDesign(design:PresenterDesign):TgStudioConfig{
 const first={...dailyStudioConfig.palette,design},second={...dailyStudioConfig.secondaryPalette!,design};
 if(design==='graphic-novel'){Object.assign(second,{jacket:'#6c645e',jacketLight:'#94887b',jacketShade:'#494c4b',accent:'#f0e3d0',accentShade:'#d1c1aa'});}
 if(design==='editorial-human'){Object.assign(first,{jacket:'#405867',jacketLight:'#657c87',jacketShade:'#2e434f',accent:'#f1eee4',accentShade:'#d1d8d2'});Object.assign(second,{jacket:'#3b625e',jacketLight:'#65827a',jacketShade:'#2e4848',accent:'#e8e4d5',accentShade:'#c5c5b5'});}
 if(design==='porcelain'){Object.assign(first,{jacket:'#5b6b63',jacketLight:'#839087',jacketShade:'#3f514c',accent:'#ebe8db',accentShade:'#c6c9bb'});Object.assign(second,{jacket:'#536a70',jacketLight:'#7c9195',jacketShade:'#374e56',accent:'#efeee3',accentShade:'#c8d0c6'});}
 if(design==='synthetic'){Object.assign(first,{jacket:'#315b64',jacketLight:'#5e8086',jacketShade:'#26444f',accent:'#dce7e2',accentShade:'#a4bdb6'});Object.assign(second,{jacket:'#72776a',jacketLight:'#949b87',jacketShade:'#535e55',accent:'#ede7d8',accentShade:'#c5c6ad'});}
 if(design==='print'){Object.assign(first,{jacket:'#535c5c',jacketLight:'#7c8380',jacketShade:'#384a4d',accent:'#e9e3d5',accentShade:'#bfc8b9'});Object.assign(second,{jacket:'#8b6c48',jacketLight:'#ae9069',jacketShade:'#65553d',accent:'#efe3cf',accentShade:'#d1bd98'});}
 return {...dailyStudioConfig,palette:first,secondaryPalette:second};
}
