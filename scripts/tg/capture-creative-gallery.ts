/** GET-only local GUI proof. Run after, never alongside, browser regressions. */
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
async function main(){
 const origin='http://127.0.0.1:3105',dir='docs/images/daily-launch/pilots',errors:string[]=[],blocked:string[]=[];
 const browser=await chromium.launch({channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const request=route.request();if(request.method()!=='GET'||!request.url().startsWith(origin+'/')){blocked.push(request.url());return route.abort();}return route.continue();});
  await page.goto(origin+'/podcast/tg/presentazione/prove');
  const choices=page.getByRole('navigation',{name:'Scegli un video pilota'});await expect(choices.getByRole('button')).toHaveCount(3);
  await choices.getByRole('button').nth(1).click();await page.getByRole('button',{name:'YouTube · 16:9'}).click();
  await page.getByRole('navigation',{name:'Scene del pilota'}).getByRole('button').first().click();
  const video=page.locator('video');await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.videoWidth)).toBe(1920);
  await video.evaluate(async(v:HTMLVideoElement)=>{v.muted=true;v.currentTime=5;await v.play();});
  await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeGreaterThan(5.3);
  await video.evaluate((v:HTMLVideoElement)=>v.pause());
  await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.readyState)).toBe(4);
  await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.seeking)).toBe(false);
  await page.evaluate(()=>{const cards=document.querySelector('[aria-label="Scegli un video pilota"]')!;window.scrollTo(0,cards.getBoundingClientRect().top+window.scrollY-175);});
  await mkdir(dir,{recursive:true});await page.screenshot({path:dir+'/official-gallery-desktop.png'});
  await page.setViewportSize({width:390,height:1000});await page.getByRole('button',{name:'Reel · 9:16'}).click();
  await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.videoWidth)).toBe(1080);
  await video.evaluate(async(v:HTMLVideoElement)=>{v.muted=true;await v.play();});
  await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeGreaterThan(5.6);
  await video.evaluate((v:HTMLVideoElement)=>v.pause());
  await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.readyState)).toBe(4);
  await page.evaluate(()=>{const formats=document.querySelector('[aria-label="Formato del video"]')!;window.scrollTo(0,formats.getBoundingClientRect().top+window.scrollY-175);});
  await page.screenshot({path:dir+'/official-gallery-mobile.png'});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
  const logo=await page.getByRole('link',{name:'Conclavia · Tutte le aree'}).locator('img').getAttribute('src');
  const icons=await page.locator('link[rel="icon"]').evaluateAll(nodes=>nodes.map(n=>(n as HTMLLinkElement).getAttribute('href')));
  if(errors.length||blocked.length||overflow||logo!=='/brand/logo.svg')throw Error('Local gallery proof failed');
  await writeFile(dir+'/official-gallery-proof.json',JSON.stringify({origin,errors,blocked,mobileOverflow:overflow,logo,icons,providerCalls:0,published:false},null,2));
  console.log(JSON.stringify({desktop:true,mobile:true,providerCalls:0,published:false}));
 }finally{await browser.close();}
}
void main().catch(e=>{console.error(e instanceof Error?e.message:'Gallery capture failed');process.exitCode=1;});
