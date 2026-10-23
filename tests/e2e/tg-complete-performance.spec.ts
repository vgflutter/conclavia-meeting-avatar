import {test,expect} from '@playwright/test';

test('complete visual rehearsal traverses all eight moods on the existing audio clock and settles to listening',async({page})=>{
 const errors:string[]=[],api:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',r=>{api.push(r.request().url());return r.abort();});
 await page.goto('/podcast/tg/performance');await expect(page.locator('[data-ready=true]')).toBeVisible();
 await page.waitForFunction(()=>Boolean(window.conclaviaActorReview?.duration));
 await page.getByRole('button',{name:'Test completo · 8 mood',exact:true}).click();await expect(page.locator('[data-mode=complete]')).toBeVisible();
 const result=await page.evaluate(()=>{
  const a=window.conclaviaActorReview!,moods:string[]=[],poses:unknown[]=[];
  const span=Math.min(32,Math.max(1,a.duration-4))/8;
  for(let i=0;i<Math.ceil(a.duration*25);i++){
   const t=i/25;a.frame(t,false);
   if(t<span*8&&Math.abs(t%span-1.8)<.025){moods.push(document.querySelector('[data-mode=complete]')!.getAttribute('data-mood')!);poses.push(a.sample());}
  }
  const last=a.sample() as {mouthOpen:boolean;motion:{left:{lift:number};right:{lift:number}}};
  a.frame(0,false);return {moods,poses,last};
 });
 expect(result.moods).toEqual(['attention','curiosity','doubt','agreement','amusement','empathy','disagreement','surprise']);
 expect(result.last.mouthOpen).toBe(false);expect(result.last.motion.left.lift).toBeLessThan(.07);expect(result.last.motion.right.lift).toBeLessThan(.07);
 await page.getByRole('button',{name:'Avvia prova',exact:true}).click();await expect.poll(()=>page.locator('audio').evaluate(a=>(a as HTMLAudioElement).currentTime)).toBeGreaterThan(.3);
 await page.getByRole('button',{name:'Pausa',exact:true}).click();
 await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
 const hold=await page.evaluate(()=>window.conclaviaActorReview!.sample());await page.waitForTimeout(150);expect(await page.evaluate(()=>window.conclaviaActorReview!.sample())).toEqual(hold);
 await page.getByRole('button',{name:'Formato 9:16'}).click();await page.setViewportSize({width:390,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.getByRole('button',{name:'Voce e conduzione',exact:true}).click();await expect(page.locator('[data-mode=voice]')).toBeVisible();
 expect(api).toEqual([]);expect(errors).toEqual([]);
});
