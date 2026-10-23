import {test,expect} from '@playwright/test';

test('resting forearms stay visibly connected to the cuffs above the desk in both formats',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/podcast/tg/performance');await expect(page.locator('[data-ready=true]')).toBeVisible();
 for(const portrait of [false,true]){
  if(portrait)await page.getByRole('button',{name:'Formato 9:16'}).click();
  await expect.poll(()=>page.locator('canvas').evaluate(c=>(c as HTMLCanvasElement).width<(c as HTMLCanvasElement).height)).toBe(portrait);
  const probes=await page.evaluate(()=>{
   window.conclaviaActorReview!.frame(0,false);
   const sample=window.conclaviaActorReview!.sample() as {layout:{width:number;actors:{x:number;y:number;scale:number}[]}};
   const c=document.querySelector('canvas')!,a=sample.layout.actors[0],ratio=c.width/sample.layout.width;
   // The desktop used to hide this distal sleeve, leaving a white gap before
   // the foreground hand. These probes sit in the centre of its dark cloth.
   return [-1,1].flatMap(side=>[.78,.84].map(t=>{
    const x=(a.x+side*(194+(108-194)*t)*a.scale)*ratio,y=(a.y+(402.5+(478-402.5)*t)*a.scale)*ratio;
    const p=c.getContext('2d')!.getImageData(Math.round(x),Math.round(y),1,1).data;
    return {side,t,r:p[0],g:p[1],b:p[2]};
   }));
  });
  for(const p of probes)expect((p.r+p.g+p.b)/3,`${portrait?'portrait':'landscape'} cuff connection ${p.side}/${p.t}`).toBeLessThan(160);
 }
});

test('six adult designs expose eight real facial expressions and two identities without provider requests',async({page})=>{
 const requests:string[]=[],errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',r=>{requests.push(r.request().url());return r.abort();});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/podcast/tg/proposte');await expect(page.locator('[data-ready=true]')).toBeVisible();
 const designs=[['editorial-human','01 · Ritratto editoriale'],['porcelain','02 · Ceramica viva'],['graphic-novel','03 · Inchiostro'],['synthetic','04 · Sintesi'],['print','05 · Stampa'],['hybrid','06 · Umanoide']];
 const moods=['attention','curiosity','doubt','agreement','amusement','empathy','disagreement','surprise'];
 for(const [id,label] of designs){
  await page.getByRole('button',{name:label}).click();await expect(page.locator(`[data-design="${id}"][data-ready=true]`)).toBeVisible();
  const hashes=[];
  for(const mood of moods){
   await page.getByLabel('Espressione della proposta').selectOption(mood);await expect(page.locator(`[data-mood="${mood}"]`)).toBeVisible();
   hashes.push(await page.evaluate(()=>{
    window.conclaviaActorReview!.frame(1.5,false);
    const c=document.querySelector('canvas')!,s=window.conclaviaActorReview!.sample() as {layout:{width:number;actors:{x:number;y:number;scale:number}[]}};
    const a=s.layout.actors[0],r=c.width/s.layout.width;
    const pixels=c.getContext('2d')!.getImageData((a.x-63*a.scale)*r,(a.y+92*a.scale)*r,126*a.scale*r,67*a.scale*r).data;
    let hash=2166136261;for(const b of pixels)hash=Math.imul(hash^b,16777619);return hash;
   }));
  }
  expect(new Set(hashes).size,`${id}: brows/lids/cheeks must express all eight moods`).toBe(8);
  const first=await page.evaluate(()=>window.conclaviaActorReview!.frame(1.5));
  await page.getByLabel('Inquadratura della proposta').selectOption('1');await expect(page.locator('[data-ready=true]')).toBeVisible();
  const second=await page.evaluate(()=>window.conclaviaActorReview!.frame(1.5));expect(second).not.toBe(first);
  await page.getByLabel('Inquadratura della proposta').selectOption('0');
 }
 await page.getByLabel('Inquadratura della proposta').selectOption('1');await expect(page.locator('[data-identity="1"][data-ready=true]')).toBeVisible();
 await page.getByLabel('Inquadratura della proposta').selectOption('duo');await expect(page.locator('[data-identity="0"][data-count="2"][data-ready=true]')).toBeVisible();
 await page.getByLabel('Inquadratura della proposta').selectOption('0');await expect(page.locator('[data-count="1"][data-ready=true]')).toBeVisible();
 expect(await page.evaluate(()=>(window.conclaviaActorReview!.sample() as {actorCount:number}).actorCount)).toBe(1);
 await page.setViewportSize({width:390,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 expect(requests).toEqual([]);expect(errors).toEqual([]);
});

test('vertical two-host news uses a readable close shot and cuts to the actual speaking host on seeks',async({page})=>{
 await page.goto('/podcast/tg/render');await page.waitForFunction(()=>Boolean((window as unknown as {conclaviaTgRender?:unknown}).conclaviaTgRender));
 const result=await page.evaluate(()=>{
  type Sample={visibleActors:number[];headWidth:number;actors:{mouthOpen:boolean}[];layout:{width:number;actors:{scale:number}[]}};
  const api=(window as unknown as {conclaviaTgRender:{prepare:(m:unknown,p:boolean)=>void;frame:(s:number)=>string;sample:()=>Sample}}).conclaviaTgRender;
  api.prepare({version:1,demo:true,product:{name:'Daily',edition:'it',language:'it',seconds:4,presenters:2},date:'fixture',seconds:4,sources:[],stories:[{id:'a',headline:'Due conduttori, un volto leggibile sul telefono',whyItMatters:'Fixture',sourceIds:[]}],cues:[0,1].map(speaker=>({speaker,storyId:'a',text:'Una frase campione.',mood:speaker?'empathy':'attention',start:speaker*2,end:speaker*2+2,frameSeconds:1,levels:[.6,.6],phones:[{start:0,end:2,viseme:'a'}]}))},true);
  const first=api.frame(1),a=api.sample();const second=api.frame(3),b=api.sample();api.frame(1);const seek=api.frame(3);return {first,second,seek,a,b};
 });
 expect(result.a.visibleActors).toEqual([0]);expect(result.b.visibleActors).toEqual([1]);
 expect(result.a.actors[0].mouthOpen).toBe(true);expect(result.a.actors[1].mouthOpen).toBe(false);
 expect(result.b.actors[0].mouthOpen).toBe(false);expect(result.b.actors[1].mouthOpen).toBe(true);
 expect(result.second).toBe(result.seek);expect(result.first).not.toBe(result.second);
 expect(result.b.headWidth*result.b.layout.actors[1].scale*390/result.b.layout.width).toBeGreaterThan(115);
});
