// GET-only evidence from the actual face inspector. No AI, speech or DB calls.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';

const origin = process.env.TG_RENDER_ORIGIN ?? 'http://127.0.0.1:3105';
if (!/^http:\/\/127\.0\.0\.1:31\d\d$/u.test(origin)) throw Error('Local review only');
const dir = 'docs/images/daily-expression-review', publicDir = 'public/daily-performance/expressions';
await mkdir(dir, {recursive:true}); await mkdir(publicDir, {recursive:true});
const browser = await chromium.launch({channel:'chrome'}), errors = [], mutations = [], transitions = [];
try {
  const page = await browser.newPage({viewport:{width:1440,height:1100}});
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', r => {
    if (r.request().method() !== 'GET') {mutations.push(r.request().url()); return r.abort();}
    return r.request().url().startsWith(origin) ? r.continue() : r.abort();
  });
  await page.goto(origin + '/podcast/tg/espressioni');
  const face = page.getByTestId('expression-face');
  await face.waitFor();
  for (const identity of [0,1]) {
    if (identity) await page.getByRole('button',{name:'Sofia · secondo volto'}).click();
    await page.waitForFunction(i => document.querySelector('[data-testid=expression-face][data-ready=true]')?.dataset.identity === String(i), identity);
    await page.locator('[data-expression-card] img').evaluateAll(nodes => Promise.all(nodes.map(n => n.decode())));
    const atlas = await page.evaluate(identity => {
      const c = document.createElement('canvas'); c.width = 720; c.height = 1100;
      const x = c.getContext('2d'); x.fillStyle = '#f5f7f3'; x.fillRect(0,0,c.width,c.height);
      x.fillStyle = '#203944'; x.font = '600 26px Arial'; x.fillText(`${identity ? 'Sofia' : 'Riccardo'} · espressioni`,18,35);
      x.font = '14px Arial'; x.fillText('Conclavia Daily · 8 mood + ascolto neutro',18,62);
      [...document.querySelectorAll('[data-expression-card]')].forEach((card,i) => {
        const left = 18+(i%3)*234, top = 85+Math.floor(i/3)*333;
        x.drawImage(card.querySelector('img'),left,top,216,285);
        x.fillStyle = '#203944'; x.font = '600 16px Arial'; x.fillText(card.querySelector('strong').textContent,left+4,top+310);
      });
      return c.toDataURL('image/png').split(',')[1];
    }, identity);
    const bytes = Buffer.from(atlas,'base64');
    await writeFile(`${dir}/faces-${identity}.png`,bytes); await writeFile(`${publicDir}/faces-${identity}.png`,bytes);
    const groups = await page.locator('[data-expression-card]').evaluateAll(nodes => nodes.map(n => ({state:n.dataset.expressionCard,name:n.querySelector('strong').textContent})));
    for (const from of groups) {
      const sheet = await page.evaluate(({from,groups,identity}) => {
        const a = window.conclaviaExpressionReview, face = document.querySelector('[data-testid=expression-face]');
        const c = document.createElement('canvas'); c.width = 1050; c.height = 1540;
        const x = c.getContext('2d'); x.fillStyle='#f5f7f3'; x.fillRect(0,0,c.width,c.height); x.fillStyle='#203944'; x.font='600 23px Arial';
        x.fillText(`${identity ? 'Sofia' : 'Riccardo'} · da ${from.name}`,18,34);
        const times=[1.2,1.3,1.5,1.8,2.3,3.6], rows=[];
        x.font='13px Arial'; times.forEach((t,i)=>x.fillText(`${t.toFixed(1)} s`,228+i*134,65));
        groups.filter(to=>to.state!==from.state).forEach((to,row)=>{
          const y=85+row*180; x.fillStyle='#203944'; x.font='600 15px Arial'; x.fillText('→ '+to.name,18,y+80);
          a.selectPair(from.state,to.state); let before, jump=0;
          times.forEach((t,i)=>{
            a.frame(t,false); const sample=a.sample();
            if(sample.actor.mouthOpen)throw Error('Silent face review opened its mouth');
            if(t===1.2)before=sample.actor.face;
            if(t===1.3)jump=Math.max(...Object.keys(before).map(k=>Math.abs(sample.actor.face[k]-before[k])));
            x.drawImage(face,220+i*134,y,128,169);
          });
          rows.push({identity,from:from.state,to:to.state,jump});
        });
        return {image:c.toDataURL('image/png').split(',')[1],rows};
      },{from,groups,identity});
      await writeFile(`${dir}/transitions-${identity}-${from.state}.png`,Buffer.from(sheet.image,'base64')); transitions.push(...sheet.rows);
    }
  }
  assert.equal(transitions.length,144); assert.equal(new Set(transitions.map(t=>`${t.identity}:${t.from}:${t.to}`)).size,144);
  await page.getByRole('button',{name:'Riccardo · primo volto'}).click();
  await page.waitForFunction(()=>document.querySelector('[data-testid=expression-face][data-ready=true]')?.dataset.identity==='0');
  await page.evaluate(()=>{const a=window.conclaviaExpressionReview;a.selectPair('attention','curiosity');a.frame(2.3,false);});
  await page.screenshot({path:`${dir}/desktop.png`,fullPage:true});
  await page.getByRole('region',{name:'Riproduzione della transizione'}).screenshot({path:`${dir}/desktop-player.png`});
  await page.getByRole('button',{name:'Espandi elenco completo'}).click();
  assert.equal(await page.locator('[data-transition]:visible').count(),72);
  await page.setViewportSize({width:390,height:1000});
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:`${dir}/mobile.png`,fullPage:true});
  await page.locator('[data-transition="doubt--agreement"]').click();
  await page.waitForTimeout(400);
  await page.screenshot({path:`${dir}/mobile-player.png`});
  assert.ok(await face.evaluate(c=>c.getBoundingClientRect().top>=document.querySelector('[data-testid=workspace-header]').getBoundingClientRect().bottom));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=390));
  assert.deepEqual(errors,[]); assert.deepEqual(mutations,[]);
  await writeFile(`${dir}/report.json`,JSON.stringify({origin,identities:2,states:9,moodPairs:56,listeningPairs:16,transitions,errors,mutations},null,2)+'\n');
  console.log('Two face atlases, all 144 directed transitions, desktop/mobile GUI and no mutations captured.');
} finally {await browser.close();}
