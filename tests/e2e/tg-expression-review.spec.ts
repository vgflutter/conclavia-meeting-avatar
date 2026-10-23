import {test, expect} from '@playwright/test';

test('face atlas covers every directed transition on both identities, using continuous silent acting', async ({page}) => {
  const errors: string[] = [], api: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/api/**', r => {api.push(r.request().url()); return r.abort();});
  await page.goto('/podcast/tg/espressioni');
  const face = page.getByTestId('expression-face');
  await expect(face).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('[data-expression-card] img')).toHaveCount(9);
  await page.getByRole('button', {name: 'Espandi elenco completo'}).click();
  const entries = page.locator('[data-transition]');
  await expect(entries).toHaveCount(72);
  expect(new Set(await entries.evaluateAll(nodes => nodes.map(n => n.getAttribute('data-transition')))).size).toBe(72);
  await expect(entries.first()).toBeVisible(); await expect(entries.last()).toBeVisible();
  await page.locator('[data-transition="doubt--agreement"]').click();
  await expect(page.getByLabel('Espressione di partenza', {exact: true})).toHaveValue('doubt');
  await expect(page.getByLabel('Espressione di arrivo', {exact: true})).toHaveValue('agreement');
  await expect(face).toBeInViewport({ratio: .8});

  // Exercise the actual controls, not only the offline sampling interface.
  await page.getByLabel('Espressione di partenza', {exact: true}).selectOption('listening');
  await page.getByLabel('Espressione di arrivo', {exact: true}).selectOption('empathy');
  await page.getByLabel('Velocità della transizione').selectOption('0.5');
  await page.getByRole('button', {name: 'Riproduci passaggio', exact: true}).click();
  await expect.poll(() => page.evaluate(() => (window.conclaviaExpressionReview!.sample() as {seconds: number}).seconds)).toBeGreaterThan(.15);
  await page.getByRole('button', {name: 'Pausa', exact: true}).click();
  const paused = await page.evaluate(() => window.conclaviaExpressionReview!.sample());
  await page.waitForTimeout(160); expect(await page.evaluate(() => window.conclaviaExpressionReview!.sample())).toEqual(paused);

  for (const identity of [0, 1]) {
    if (identity) await page.getByRole('button', {name: 'Sofia · secondo volto'}).click();
    await expect(face).toHaveAttribute('data-ready', 'true');
    await expect(face).toHaveAttribute('data-identity', String(identity));
    const review = await page.evaluate(() => {
      type State = Parameters<NonNullable<Window['conclaviaExpressionReview']>['selectPair']>[0];
      const states: State[] = ['attention','curiosity','doubt','agreement','amusement','empathy','disagreement','surprise','listening'];
      const a = window.conclaviaExpressionReview!, pairs: {from: string; to: string; jump: number; change: number}[] = [];
      for (const from of states) for (const to of states) {
        if (from === to) continue;
        a.selectPair(from, to);
        const sampleAt = (t: number) => {a.frame(t, false); return a.sample() as {state: string; actor: {face: Record<string, number>; mouthOpen: boolean; acting: Record<string, number>}};};
        const source = sampleAt(1.3 - 1 / 60), boundary = sampleAt(1.3), target = sampleAt(4.2);
        if (source.state !== from || target.state !== to) throw Error('Incorrect transition direction');
        if ([source,boundary,target].some(s => s.actor.mouthOpen)) throw Error('Silent review must keep the mouth closed');
        const keys = ['browLeft','browRight','browPinch','innerBrow','eyeOpen','cornerLeft','cornerRight'];
        const values = [source,boundary,target].flatMap(s => keys.map(k => s.actor.face[k]));
        if (values.some(v => !Number.isFinite(v))) throw Error('Non-finite face channel');
        const jump = Math.max(...keys.map(k => Math.abs(source.actor.face[k] - boundary.actor.face[k])));
        const change = Math.max(...keys.map(k => Math.abs(source.actor.face[k] - target.actor.face[k])));
        pairs.push({from,to,jump,change});
      }
      return pairs;
    });
    expect(review).toHaveLength(72);
    // A 60 Hz muscle blend may move ~3% in its first frame. It must remain
    // a small fraction of the complete expression change, never a pose cut.
    expect(Math.max(...review.map(r => r.jump))).toBeLessThan(.05);
    expect(Math.max(...review.map(r => r.jump / r.change))).toBeLessThan(.08);
    expect(Math.min(...review.map(r => r.change))).toBeGreaterThan(.025);
    const images = await page.locator('[data-expression-card] img').evaluateAll(nodes => nodes.map(n => (n as HTMLImageElement).src));
    expect(new Set(images).size).toBe(9);
  }
  await page.getByRole('button', {name: 'Riproduci tutte le 72 transizioni'}).click();
  expect(await page.evaluate(() => window.conclaviaExpressionReview!.duration)).toBeCloseTo(316.8);
  await page.evaluate(() => window.conclaviaExpressionReview!.frame(4.4 + 1.6, false));
  await expect(face).toHaveAttribute('data-from', 'attention'); await expect(face).toHaveAttribute('data-to', 'doubt');
  await page.getByRole('button', {name: 'Pausa', exact: true}).click();
  await page.setViewportSize({width:390,height:1000});
  await page.locator('[data-transition="attention--empathy"]').click();
  await expect.poll(() => face.evaluate(c => c.getBoundingClientRect().top >= document.querySelector('[data-testid=workspace-header]')!.getBoundingClientRect().bottom)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(api).toEqual([]); expect(errors).toEqual([]);
});

test('full-body review displays all mood gestures and holds every channel on pause',async({page})=>{
 const calls:string[]=[],errors:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',r=>{calls.push(r.request().url());return r.abort();});
 await page.goto('/podcast/tg/espressioni');
 const canvas=page.getByTestId('expression-face');await expect(canvas).toHaveAttribute('data-ready','true');
 await page.getByRole('button',{name:'Corpo e gesti',exact:true}).click();
 await expect(canvas).toHaveAttribute('data-framing','body');
 const results=await page.evaluate(()=>{
  const a=window.conclaviaExpressionReview!;
  const moods=['attention','curiosity','doubt','agreement','amusement','empathy','disagreement','surprise'] as const;
  return moods.map(m=>{
   a.selectPair('listening',m);a.frame(2.35,false);
   const p=a.sample() as {framing:string;actor:{motion:{left:{lift:number};right:{lift:number}};mouthOpen:boolean}};
   const c=document.querySelector('[data-testid=expression-face]') as HTMLCanvasElement;
   const bytes=c.getContext('2d')!.getImageData(0,c.height*.45,c.width,c.height*.55).data;
   let hash=2166136261;for(const byte of bytes)hash=Math.imul(hash^byte,16777619);
   return {mood:m,...p,hash};
  });
 });
 expect(new Set(results.map(p=>p.hash)).size).toBe(8);
 for(const p of results){expect(p.framing).toBe('body');expect(p.actor.mouthOpen).toBe(false);expect(Math.max(p.actor.motion.left.lift,p.actor.motion.right.lift)).toBeGreaterThan(.06);}
 await page.getByRole('button',{name:'Riproduci passaggio',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window.conclaviaExpressionReview!.sample() as {seconds:number}).seconds)).toBeGreaterThan(2.5);
 await page.getByRole('button',{name:'Pausa',exact:true}).click();
 const held=await page.evaluate(()=>window.conclaviaExpressionReview!.sample());await page.waitForTimeout(180);
 expect(await page.evaluate(()=>window.conclaviaExpressionReview!.sample())).toEqual(held);
 await page.setViewportSize({width:390,height:1000});
 await page.getByRole('button',{name:'Viso',exact:true}).click();await expect(canvas).toHaveAttribute('data-framing','face');
 await page.getByRole('button',{name:'Corpo e gesti',exact:true}).click();await expect(canvas).toHaveAttribute('data-framing','body');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 expect(calls).toEqual([]);expect(errors).toEqual([]);
});
