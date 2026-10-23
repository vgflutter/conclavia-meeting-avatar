import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';

test('TG articulation respects PCM silence and bilabial closure; eight moods are captured for visual review',async({page},info)=>{
 // Keep Canvas on one raster backend: Chrome otherwise switches from GPU to
 // CPU after repeated readbacks, changing edge antialiasing between samples.
 await page.addInitScript(()=>{
  const original=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,...args:Parameters<typeof original>){
   return Reflect.apply(original,this,args[0]==='2d'?['2d',Object.assign({},args[1],{willReadFrequently:true})]:args);
  } as typeof original;
 });
 await page.goto('/podcast/tg/render');
 await page.waitForFunction(()=>Boolean((window as unknown as {conclaviaTgRender?:unknown}).conclaviaTgRender));
 const result=await page.evaluate(()=>{
  const api=(window as unknown as {conclaviaTgRender:{prepare:(m:unknown,p:boolean)=>void;frame:(s:number)=>string;sample:()=>{layout:{actors:{x:number;y:number;scale:number}[]};actors:{mouthOpen:boolean;mouthAmplitude:number}[]}}}).conclaviaTgRender;
  const canvas=document.querySelector('canvas')!, c=canvas.getContext('2d')!;
  const sample=(mood:string,level:number,viseme:string)=>{
   api.prepare({version:1,product:{name:'Daily · Performance fixture',edition:'it',language:'it',seconds:4,presenters:1},date:'2026-10-18',seconds:4,
    stories:[{id:'s',headline:'Prova di recitazione',whyItMatters:'Fixture grafica: nessuna notizia reale.',sourceIds:[]}],sources:[],
    cues:[{text:'Una frase campione per confrontare la recitazione.',mood,intensity:.8,speaker:0,storyId:'s',sourceIds:[],start:0,end:4,frameSeconds:1,levels:[level,level,level,level],phones:[{start:0,end:4,viseme}]}]},false);
   api.frame(1);
   // Smaller head: screen mouth is near local y=180, below the animated eyes.
   return {pixels:(()=>{const a=api.sample().layout.actors[0],x=a.x*1.5,y=(a.y+a.scale*180)*1.5;return Array.from(c.getImageData(Math.round(x-51),Math.round(y-19),102,38).data)})(),image:canvas.toDataURL('image/png')};
  };
  const quiet=sample('attention',0,'a'),closed=sample('attention',.8,'mbp'),rest=sample('attention',.8,'rest'),open=sample('attention',.8,'a');
  const rounded=sample('attention',.8,'u');
  const moods=['attention','curiosity','doubt','agreement','amusement','empathy','disagreement','surprise'];
  return {quiet:quiet.pixels,closed:closed.pixels,rest:rest.pixels,open:open.pixels,rounded:rounded.pixels,
    diagnostic:[{name:'quiet',image:quiet.image},{name:'closed',image:closed.image},{name:'rest',image:rest.image},{name:'open',image:open.image}],
    moods:moods.map(mood=>({mood,image:sample(mood,.65,'e').image}))};
 });
 for(const sample of [...result.diagnostic,...result.moods.map(s=>({name:s.mood,image:s.image}))]) await writeFile(info.outputPath(`daily-studio-${sample.name}.png`),Buffer.from(sample.image.split(',')[1],'base64'));
 expect(result.closed).toEqual(result.quiet);expect(result.rest).toEqual(result.quiet);
 const diff=(a:number[],b:number[])=>a.reduce((sum,x,i)=>sum+Math.abs(x-b[i]),0)/a.length;
 expect(diff(result.open,result.quiet)).toBeGreaterThan(.3);
 expect(diff(result.open,result.rounded)).toBeGreaterThan(.1);
});

test('Daily studio keeps full headlines, deterministic seeks and separate portrait/duo composition',async({page},info)=>{
 await page.goto('/podcast/tg/render');await page.waitForFunction(()=>Boolean((window as unknown as {conclaviaTgRender?:unknown}).conclaviaTgRender));
 const result=await page.evaluate(()=>{
  const api=(window as unknown as {conclaviaTgRender:{prepare:(m:unknown,p:boolean)=>void;frame:(s:number)=>string;sample:()=>{actors:{motion:{gazeX:number};mouthOpen:boolean}[];layout:{actors:{x:number;scale:number}[];microphones:{x:number}[];headline:{width:number}};headlineLines:string[]}}}).conclaviaTgRender;
  const title='Titolo dimostrativo: le notizie cambiano, il contesto conta e le domande aiutano a capire il mondo.';
  const manifest={version:1,demo:true,product:{name:'Daily',edition:'it',language:'it',seconds:6,presenters:2},date:'2026-10-18',seconds:6,stories:[{id:'s',headline:title,whyItMatters:'Un testo dimostrativo completo, senza notizie reali.',sourceIds:[]}],sources:[],cues:[{text:'Un testo dimostrativo.',speaker:0,storyId:'s',mood:'empathy',intensity:.8,start:0,end:6,frameSeconds:1,levels:[.4,.4,.4,.4,.4,.4],phones:[{start:0,end:6,viseme:'a'}]}]};
  api.prepare(manifest,false);const first=api.frame(1),landscape=api.sample();api.frame(4);const seek=api.frame(1);
  api.prepare(manifest,true);const portrait=api.frame(1),vertical=api.sample();
  return {title,first,seek,portrait,landscape,vertical};
 });
 expect(result.first).toBe(result.seek);expect(result.landscape.headlineLines.join(' ')).toBe(result.title);expect(result.vertical.headlineLines.join(' ')).toBe(result.title);
 expect(result.landscape.layout.actors).toHaveLength(2);expect(result.vertical.layout.actors).toHaveLength(2);expect(result.vertical.layout.headline.width).not.toBe(result.landscape.layout.headline.width);
 for(const scene of [result.landscape,result.vertical]){
  expect(scene.actors[1].motion.gazeX).toBeLessThan(-.1);expect(scene.actors[1].mouthOpen).toBe(false);
  const [left,right]=scene.layout.actors;
  expect(scene.layout.microphones[0].x).toBeLessThan(left.x-155*left.scale);
  expect(scene.layout.microphones[1].x).toBeGreaterThan(right.x+180*right.scale);
 }
 for(const [name,image] of [['duo-landscape',result.first],['duo-portrait',result.portrait]])await writeFile(info.outputPath(`daily-studio-${name}.jpg`),Buffer.from(image,'base64'));
});

test('seeking into another story makes its headline visible even while paused',async({page})=>{
 await page.goto('/podcast/tg/render');await page.waitForFunction(()=>Boolean((window as unknown as {conclaviaTgRender?:unknown}).conclaviaTgRender));
 const result=await page.evaluate(()=>{
  const api=(window as unknown as {conclaviaTgRender:{prepare:(m:unknown,p:boolean)=>void;frame:(s:number)=>string;sample:()=>{headlineReveal:number;headlineLines:string[]}}}).conclaviaTgRender;
  api.prepare({version:1,demo:true,product:{name:'Daily',edition:'it',language:'it',seconds:8,presenters:1},date:'fixture',seconds:8,sources:[],stories:[{id:'a',headline:'Prima storia',whyItMatters:'Fixture',sourceIds:[]},{id:'b',headline:'Titolo dopo il seek',whyItMatters:'Fixture',sourceIds:[]}],cues:[{speaker:0,storyId:'a',text:'Prima frase',mood:'attention',start:0,end:3},{speaker:0,storyId:'b',text:'Seconda frase',mood:'doubt',start:3,end:8}]},false);
  api.frame(1);api.frame(4);const after=api.sample();api.frame(4);return {after,paused:api.sample()};
 });
 expect(result.after.headlineLines.join(' ')).toBe('Titolo dopo il seek');expect(result.after.headlineReveal).toBe(1);expect(result.paused.headlineReveal).toBe(1);
});

test('portrait keeps the pale face readable and a complete headline legible at phone width',async({page})=>{
 await page.goto('/podcast/tg/render');await page.waitForFunction(()=>Boolean((window as unknown as {conclaviaTgRender?:unknown}).conclaviaTgRender));
 const result=await page.evaluate(()=>{
  const api=(window as unknown as {conclaviaTgRender:{prepare:(m:unknown,p:boolean)=>void;frame:(s:number)=>string;sample:()=>unknown}}).conclaviaTgRender;
  const headline='Le notizie del giorno: cosa cambia e perché conta per tutti noi';
  api.prepare({version:1,demo:true,product:{name:'Daily',edition:'it',language:'it',seconds:6,presenters:1},date:'fixture',seconds:6,sources:[],stories:[{id:'a',headline,whyItMatters:'Fixture',sourceIds:[]}],cues:[{speaker:0,storyId:'a',text:'Una frase campione.',mood:'attention',start:0,end:6}]},true);
  api.frame(1);
  const sample=api.sample() as {layout:{width:number;actors:{x:number;y:number;scale:number}[]};headlineLines:string[];headlineFontSize:number;headWidth:number};
  const canvas=document.querySelector('canvas')!,a=sample.layout.actors[0],ratio=canvas.width/sample.layout.width;
  const pixel=canvas.getContext('2d')!.getImageData(a.x*ratio,(a.y+82*a.scale)*ratio,1,1).data;
  return {title:sample.headlineLines.join(' '),headline,phoneFaceWidth:sample.headWidth*a.scale*390/sample.layout.width,
   phoneTitleSize:sample.headlineFontSize*390/sample.layout.width,luminance:pixel[0]*.2126+pixel[1]*.7152+pixel[2]*.0722};
 });
 expect(result.title).toBe(result.headline);expect(result.phoneFaceWidth).toBeGreaterThan(115);
 expect(result.phoneTitleSize).toBeGreaterThanOrEqual(21);expect(result.luminance).toBeGreaterThan(190);
});
