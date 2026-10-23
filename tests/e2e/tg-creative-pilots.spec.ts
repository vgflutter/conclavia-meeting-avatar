import {test,expect} from '@playwright/test';
import type {TgPromoSequence} from '@conclavia/avatar-kit/formats/tg';

test('three real pilots play in both formats without AI requests and preserve position',async({page,request})=>{
 const errors:string[]=[],api:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',r=>{api.push(r.request().url());return r.abort();});
 await page.goto('/podcast/tg/presentazione/prove');
 await expect(page.getByRole('heading',{name:/Tre modi di/})).toBeVisible();
 const cards=page.getByRole('navigation',{name:'Scegli un video pilota'});await expect(cards.getByRole('button')).toHaveCount(3);
 for(const [i,id] of ['dato','confronto','traccia'].entries()){
  const sequence=await (await request.get(`/daily-launch/pilots/${id}/manifest.json`)).json() as TgPromoSequence;
  expect(sequence.words.map(w=>w.text).join(' ')).toBe(sequence.cues.map(c=>c.text).join(' '));
  await cards.getByRole('button').nth(i).click();await page.getByRole('button',{name:'Reel · 9:16'}).click();
  const video=page.locator('video');await expect(video).toHaveAttribute('src',`/daily-launch/pilots/${id}/portrait.mp4?v=${sequence.mediaVersion}`);
  await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.videoWidth)).toBe(1080);
  await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.duration)).toBeCloseTo(sequence.duration,1);
  await video.evaluate(async(v:HTMLVideoElement)=>{v.muted=true;v.currentTime=5;await v.play();});
  await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeGreaterThan(5.1);
  await video.evaluate((v:HTMLVideoElement)=>v.pause());const at=await video.evaluate((v:HTMLVideoElement)=>v.currentTime);
  await page.getByRole('button',{name:'YouTube · 16:9'}).click();
  await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.videoWidth)).toBe(1920);
  expect(await video.evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeCloseTo(at,1);
  await expect(page.getByRole('link',{name:'Scarica il Reel ↓'})).toHaveAttribute('href',`/daily-launch/pilots/${id}/portrait.mp4?v=${sequence.mediaVersion}`);
  await expect(page.getByRole('navigation',{name:'Scene del pilota'}).getByRole('button')).toHaveCount(sequence.scenes.length);
 }
 await page.setViewportSize({width:390,height:1000});await page.getByRole('button',{name:'Reel · 9:16'}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 expect(api).toEqual([]);expect(errors).toEqual([]);
});

test('actual dialogue moves only the voiced mouth and updates each speaker’s discussion cue',async({page,request})=>{
 const sequence=await (await request.get('/daily-launch/pilots/confronto/manifest.json')).json() as TgPromoSequence;
 expect(sequence.scenes[0].spoken).toBe(true);expect(sequence.cues.map(c=>c.speaker)).toEqual([0,1,0,1,0,1,0]);
 await page.goto('/podcast/tg/presentazione/render');await page.waitForFunction(()=>Boolean((window as unknown as {conclaviaLaunchRender:unknown}).conclaviaLaunchRender));
 const reports=await page.evaluate(sequence=>{
  type Rect={x:number;y:number;width:number;height:number};
  type Report={actors:{mouthOpen:boolean}[];entry:number;active:0|1;bubbles:({speaker:number;text:string;name?:string}&Rect)[];regions:{head:Rect;hands:Rect[]}[];texts:{text:string;overflow:boolean;inkRows:Rect[]}[]};
  const api=(window as unknown as {conclaviaLaunchRender:{prepare(s:TgPromoSequence,p:boolean):void;frame(t:number,c?:boolean):void;sample():Report}}).conclaviaLaunchRender;
  return [true,false].map(portrait=>{api.prepare(sequence,portrait);const voiced=new Set<number>(),bubbles=new Set<string>(),names=new Set<string>(),width=portrait?720:1280,height=portrait?1280:720;
   const overlap=(a:Rect,b:Rect)=>Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)+1&&Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y)+1;
   for(let frame=0;frame<Math.floor(sequence.scenes[0].end*25);frame++){
    api.frame(frame/25,false);const sample=api.sample();
    if(sample.texts.some(t=>t.overflow))throw Error('Dialogue text overflow');
    for(const bubble of sample.bubbles){if(!bubble.text.trim())throw Error('Empty discussion bubble');if(bubble.name)names.add(bubble.name);if(frame/25<sequence.cues[1].start&&bubble.speaker===1)throw Error('Second voice summary appears before its first turn');}
    if(sample.entry>.5)for(const region of sample.regions){
     for(const text of sample.texts)if(text.inkRows.some(row=>overlap(row,region.head)))throw Error('Text covers a presenter’s head');
     for(const hand of region.hands)if(hand.x<0||hand.y<0||hand.x+hand.width>width||hand.y+hand.height>height)throw Error('A hand is clipped by the video frame');
    }
    if(sample.actors[1-sample.active].mouthOpen)throw Error('Listening avatar cannot lip sync another voice');
    if(sample.actors[sample.active].mouthOpen)voiced.add(sample.active);
    sample.texts.forEach(t=>bubbles.add(t.text));
   }
   return {voiced:[...voiced],bubbles:[...bubbles],names:[...names]};
  });
 },sequence);
 for(const report of reports){expect(report.voiced).toEqual([0,1]);expect(report.names).toEqual(['Alex','Roberta']);for(const turn of sequence.scenes[0].turns!)expect(report.bubbles).toContain(turn.text);}
});
