import {expect,test} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createPerformingAvatar} from '@conclavia/avatar-kit/performance/browser';
import {loadGeometryOnlyAvatar} from './rigged-avatar-fixture';

for(const female of [false,true])test(`expressive overlays move and hold the ${female?'female':'male'} rig without accumulating offsets`,async()=>{
  const actor=createPerformingAvatar(await loadGeometryOnlyAvatar(female),{toon:true});
  const speaker={name:'Actor',emotion:'curiosity' as const,speaking:true,viseme:'a',audioLevel:.2,performance:{progress:.4}};
  const rest=actor.update({...speaker,performance:{progress:0,durationSeconds:6}},0,0,true);
  let peak=0;
  // Body dynamics use the media clock. Repeated RAF ticks at a paused time
  // must not finish a gesture; advance the actual phrase before holding it.
  for(let i=1;i<=120;i++){
    const p=actor.update({...speaker,performance:{progress:i/360,durationSeconds:6}},i/60,1/60);
    peak=Math.max(peak,new THREE.Vector3(...p.handPositions[0]).distanceTo(new THREE.Vector3(...rest.handPositions[0])));
  }
  const first=actor.update(speaker,2,0);
  expect(peak).toBeGreaterThan(.1);
  // GLTFLoader sanitizes ':' from authored bone names.
  const head=actor.root.getObjectByName('mixamorigHead')??actor.root.getObjectByName('mixamorig:Head')??actor.root.getObjectByName('Head');
  expect(head).toBeDefined();const scale=head!.scale.clone();
  for(let i=0;i<300;i++)actor.update(speaker,2,0);
  const last=actor.update(speaker,2,0);
  expect(head!.scale.toArray()).toEqual(scale.toArray());
  last.handPositions.forEach((point,index)=>expect(new THREE.Vector3(...point).distanceTo(new THREE.Vector3(...first.handPositions[index]))).toBeLessThan(1e-6));
  const silent=actor.update({...speaker,speaking:false},3,.05);
  expect(silent.mouthOpen).toBe(false);expect(silent.mouthAmplitude).toBe(0);
  actor.dispose();
});

test('local audition plays, pauses, seeks and closes its mouth at the end',async({page})=>{
  const errors:string[]=[];const forbidden:string[]=[];const models:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/**',route=>{forbidden.push(route.request().url());return route.abort();});
  await page.route('**/avatars/rigged-v1/**',route=>{models.push(route.request().url());return route.abort();});
  await page.goto('/podcast/tg/performance');
  const viewport=page.getByTestId('actor-viewport');
  await expect(viewport.locator('[data-ready=true]')).toBeVisible();
  await expect(viewport.locator('[data-renderer=robot-2d]')).toBeVisible();
  await expect(page.getByRole('button',{name:'Avvia prova'})).toBeEnabled();
  await page.getByRole('button',{name:'Avvia prova'}).click();
  await expect.poll(()=>page.locator('audio').evaluate(audio=>(audio as HTMLAudioElement).currentTime)).toBeGreaterThan(.5);
  await page.getByRole('button',{name:'Pausa',exact:true}).click();
  const paused=await page.locator('audio').evaluate(audio=>(audio as HTMLAudioElement).currentTime);
  await page.waitForTimeout(200);
  expect(await page.locator('audio').evaluate(audio=>(audio as HTMLAudioElement).currentTime)).toBe(paused);
  await page.getByRole('button',{name:/Dubbio.*s/}).click();
  await expect(viewport.locator('[data-mood=doubt]')).toBeVisible();
  await page.getByRole('button',{name:'Formato 9:16'}).click();
  const box=await viewport.boundingBox();expect(box!.height/box!.width).toBeCloseTo(16/9,2);
  async function facePixel(){return page.evaluate(()=>{
    const canvas=document.querySelector('canvas')!;
    const sample=window.conclaviaActorReview!.sample() as {layout:{width:number;actors:{x:number;y:number;scale:number}[]}};
    const at=sample.layout.actors[0],ratio=canvas.width/sample.layout.width;
    // Forehead material, above brows: checking alpha alone missed the dark face.
    const pixel=Array.from(canvas.getContext('2d')!.getImageData(Math.floor(at.x*ratio),Math.floor((at.y+82*at.scale)*ratio),1,1).data);
    return {alpha:pixel[3],luminance:pixel[0]*.2126+pixel[1]*.7152+pixel[2]*.0722};
  });}
  await expect.poll(async()=>(await facePixel()).alpha).toBe(255);
  expect((await facePixel()).luminance).toBeGreaterThan(190);
  await page.setViewportSize({width:390,height:1000});
  await expect.poll(async()=>(await facePixel()).luminance).toBeGreaterThan(190);
  await page.getByRole('button',{name:'Formato 16:9'}).click();
  await expect.poll(async()=>(await facePixel()).luminance).toBeGreaterThan(190);
  const silent=await page.evaluate(()=>{window.conclaviaActorReview!.frame(window.conclaviaActorReview!.duration-.1,false);return window.conclaviaActorReview!.sample() as {mouthOpen:boolean;mouthAmplitude:number};});
  expect(silent.mouthOpen).toBe(false);expect(silent.mouthAmplitude).toBe(0);
  expect(forbidden).toEqual([]);expect(models).toEqual([]);expect(errors).toEqual([]);
});

test('robot face renders eight distinct moods without movement or speaking permission',async({page},info)=>{
  await page.setViewportSize({width:1440,height:1100});
  const moods=['attention','curiosity','doubt','agreement','amusement','empathy','disagreement','surprise'];
  let mood='attention';
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('**/daily-performance/sequence.json',route=>route.fulfill({json:{duration:4,voice:'fixture',cues:[{id:'fixture',mood,label:mood,text:'Fixture',start:0,end:4,lips:{durationSeconds:4,frameSeconds:1,frames:Array.from({length:4},()=>({viseme:'rest',level:0}))}}]}}));
  const hashes=[],upperFaceHashes=[];
  for(const value of moods){
    mood=value;await page.goto('/podcast/tg/performance');
    await page.waitForFunction(()=>window.conclaviaActorReview?.duration===4&&document.querySelector('[data-ready=true]'));
    const result=await page.evaluate(()=>{
      window.conclaviaActorReview!.frame(1,false);
      const canvas=document.querySelector('canvas')!;
      const sample=window.conclaviaActorReview!.sample() as {layout:{width:number;actors:{x:number;y:number;scale:number}[]}};
      const at=sample.layout.actors[0],r=canvas.width/sample.layout.width,s=at.scale;
      const pixels=canvas.getContext('2d')!.getImageData((at.x-106*s)*r,(at.y+50*s)*r,212*s*r,170*s*r).data;
      let hash=2166136261;for(const byte of pixels)hash=Math.imul(hash^byte,16777619);
      // Exclude mouth, silhouette and head movement: mood must actually move
      // the brows/lids/cheeks, not merely change a lip icon or rotate a cutout.
      const upper=canvas.getContext('2d')!.getImageData((at.x-73*s)*r,(at.y+85*s)*r,146*s*r,74*s*r).data;
      let upperHash=2166136261;for(const byte of upper)upperHash=Math.imul(upperHash^byte,16777619);
      return {hash,upperHash,sample:window.conclaviaActorReview!.sample() as {mouthOpen:boolean;acting:{leftHand:number;rightHand:number}}};
    });
    expect(result.sample.mouthOpen).toBe(false);expect(result.sample.acting.leftHand).toBe(0);expect(result.sample.acting.rightHand).toBe(0);
    hashes.push(result.hash);upperFaceHashes.push(result.upperHash);
    const image=await page.getByTestId('actor-viewport').screenshot();
    await writeFile(info.outputPath(`robot-${mood}.png`),image);
    await info.attach(`robot-${mood}`,{body:image,contentType:'image/png'});
  }
  expect(new Set(hashes).size).toBe(8);
  expect(new Set(upperFaceHashes).size).toBe(8);
});

test('actual robot pixels close on silence and M/B/P, with distinct voiced shapes',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,...args:Parameters<typeof original>){
      return Reflect.apply(original,this,args[0]==='2d'?['2d',Object.assign({},args[1],{willReadFrequently:true})]:args);
    } as typeof original;
  });
  await page.route('**/daily-performance/sequence.json',route=>route.fulfill({json:{duration:6,voice:'fixture',cues:[{id:'fixture',mood:'attention',label:'Fixture',text:'Fixture',start:0,end:6,lips:{durationSeconds:6,frameSeconds:1,frames:['rest','mbp','a','e','o','u'].map(viseme=>({viseme,level:.6}))}}]}}));
  await page.goto('/podcast/tg/performance');await page.waitForFunction(()=>window.conclaviaActorReview?.duration===6&&document.querySelector('[data-ready=true]'));
  const pixels=await page.evaluate(()=>Array.from({length:6},(_,i)=>{
    window.conclaviaActorReview!.frame(i+.25,false);
    const canvas=document.querySelector('canvas')!,sample=window.conclaviaActorReview!.sample() as {layout:{width:number;actors:{x:number;y:number;scale:number}[]}};
    const a=sample.layout.actors[0],r=canvas.width/sample.layout.width;
    return Array.from(canvas.getContext('2d')!.getImageData((a.x-45*a.scale)*r,(a.y+155*a.scale)*r,90*a.scale*r,45*a.scale*r).data);
  }));
  expect(pixels[0]).toEqual(pixels[1]);
  expect(new Set(pixels.slice(2).map(p=>JSON.stringify(p))).size).toBe(4);
  for(const open of pixels.slice(2))expect(open).not.toEqual(pixels[0]);
});

test('voice comparison uses pre-generated native Italian samples without provider calls',async({page})=>{
 const api:string[]=[];await page.route('**/api/**',route=>{api.push(route.request().url());return route.abort();});
 await page.goto('/podcast/tg/performance');await expect(page.getByTestId('actor-viewport').locator('[data-stage=daily-studio][data-ready=true]')).toBeVisible();
 await page.getByRole('button',{name:/Orietta Inworld/}).click();
 await expect(page.locator('audio')).toHaveAttribute('src','/daily-performance/voices/orietta/audio.wav');
 await page.getByRole('button',{name:'Avvia prova',exact:true}).click();await expect.poll(()=>page.locator('audio').evaluate(a=>(a as HTMLAudioElement).currentTime)).toBeGreaterThan(.3);
 await page.getByRole('button',{name:/Ingegnere Inworld/}).click();await expect(page.locator('audio')).toHaveAttribute('src','/daily-performance/voices/ingegnere/audio.wav');
 await expect(page.locator('audio').evaluate(a=>(a as HTMLAudioElement).paused)).resolves.toBe(true);expect(api).toEqual([]);
});

for(const female of [false,true])test(`shared mood engine drives actual ${female?'female':'male'} arm and finger bones`,async()=>{
 const actor=createPerformingAvatar(await loadGeometryOnlyAvatar(female));
 expect(actor.capabilities).toEqual({head:true,torso:true,arms:true,fingers:true});
 const moods=['attention','curiosity','doubt','agreement','amusement','empathy','disagreement','surprise'] as const;
 const handSignatures:string[]=[],fingerSignatures:string[]=[];
 let time=0;
 for(const emotion of moods){
  for(let i=0;i<110;i++){
   time+=1/60;
   const result=actor.update({name:'Universal',emotion,intensity:.9,speaking:true,viseme:'rest',audioLevel:0,
    performance:{cueId:'one-phrase',progress:i/160,durationSeconds:6,gaze:'camera'}},time,1/60);
   expect(result.mouthOpen).toBe(false);
   expect(result.handPositions.flat().every(Number.isFinite)).toBe(true);
   if(i===65){
    handSignatures.push(JSON.stringify(result.handPositions));
    const bones:string[]=[];
    actor.root.traverse(node=>{if(node.isObject3D&&/Hand(Index|Middle|Ring|Pinky|Thumb)[123]$/u.test(node.name))bones.push(node.quaternion.toArray().join(','));});
    fingerSignatures.push(bones.join('|'));
    expect(bones).toHaveLength(30);
    expect(result.body.left.indexCurl).not.toBe(result.body.left.littleCurl);
   }
  }
 }
 expect(new Set(handSignatures).size).toBe(8);expect(new Set(fingerSignatures).size).toBe(8);
 actor.dispose();
});

for(const female of [false,true])test(`explicit upward index also reaches upward on the ${female?'female':'male'} shared rig`,async()=>{
 for(const side of ['Left','Right'] as const){
  const actor=createPerformingAvatar(await loadGeometryOnlyAvatar(female));
  const choreography={version:1 as const,key:'upward-emphasis',durationSeconds:6,stance:.1,energy:.8,articulation:'spine' as const,restPose:.35,vitality:.9,strokes:[{kind:'point-up' as const,hand:(side==='Left'?-1:1) as -1|1,start:.5,apex:1.8,hold:1,end:4.9,strength:1,variant:.8}]};
  for(let i=0;i<=150;i++){const t=i/60;actor.update({name:'Actor',emotion:'attention',intensity:.8,speaking:true,audioLevel:0,viseme:'rest',performance:{progress:t/6,choreography}},t,1/60);}
  const find=(suffix:string)=>{let found:THREE.Object3D|undefined;actor.root.traverse(o=>{if(o.name.endsWith(suffix))found=o;});return found;};
  const root=find(side+'HandIndex1'),tip=find(side+'HandIndex3');expect(root&&tip).toBeDefined();
  const a=root!.getWorldPosition(new THREE.Vector3()),b=tip!.getWorldPosition(new THREE.Vector3());expect(b.y-a.y).toBeGreaterThan(.01);
  actor.dispose();
 }
});
