import {test,expect} from '@playwright/test';
import type {TgPromoSequence} from '@conclavia/avatar-kit/formats/tg';
import type {RobotPose} from '@conclavia/avatar-kit/characters/robot';

test('a frozen edition selects its approved avatar without lab query flags and legacy manifests stay compatible',async({page,request})=>{
 const sequence=await (await request.get('/daily-launch/revisions/avatar-refined-presence-20261023/manifest.json')).json();
 await page.goto('/podcast/tg/presentazione/render');await page.waitForFunction(()=>window.conclaviaLaunchRender);
 const selected=await page.evaluate(data=>{const api=window.conclaviaLaunchRender!;api.prepare(data,true);api.frame(8.8,false);const canvas=document.querySelector('canvas')!;return{finish:canvas.dataset.finish,hands:canvas.dataset.hands,posture:canvas.dataset.posture,standing:!!(api.sample().actor as RobotPose).standingKinematics};},sequence);
 expect(selected).toEqual({finish:'sculpted',hands:'anatomical',posture:'standing',standing:true});
 delete sequence.avatarFinish;delete sequence.avatarHands;delete sequence.avatarPosture;
 await page.evaluate(data=>{window.conclaviaLaunchRender!.prepare(data,true);window.conclaviaLaunchRender!.frame(8.8,false);},sequence);
 await expect(page.locator('canvas')).toHaveAttribute('data-finish','original');await expect(page.locator('canvas')).toHaveAttribute('data-posture','legacy');
});

test('launch promo plays in both formats, preserves time and offers actual media downloads',async({page,request})=>{
 const sequence=await (await request.get('/daily-launch/revisions/avatar-refined-presence-20261023/manifest.json')).json() as TgPromoSequence;
 const revision=sequence.mediaVersion?'?v='+encodeURIComponent(sequence.mediaVersion):'';
 const errors:string[]=[],api:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',r=>{api.push(r.request().url());return r.abort();});
 await page.goto('/podcast/tg/presentazione');
 await expect(page.getByRole('heading',{name:/Meno rumore/})).toBeVisible();
 const video=page.locator('video');await expect(video).toHaveAttribute('src','/daily-launch/revisions/avatar-refined-presence-20261023/portrait.mp4'+revision);
 await expect.poll(()=>video.evaluate(v=>(v as HTMLVideoElement).duration)).toBeGreaterThan(30);
 expect(await video.evaluate(v=>[(v as HTMLVideoElement).videoWidth,(v as HTMLVideoElement).videoHeight])).toEqual([1080,1920]);
 await video.evaluate(async v=>{const a=v as HTMLVideoElement;a.muted=true;a.currentTime=7;await a.play();});
 await expect.poll(()=>video.evaluate(v=>(v as HTMLVideoElement).currentTime)).toBeGreaterThan(7.1);
 await video.evaluate(v=>(v as HTMLVideoElement).pause());const at=await video.evaluate(v=>(v as HTMLVideoElement).currentTime);
 await page.getByRole('button',{name:'YouTube · 16:9'}).click();
 await expect(video).toHaveAttribute('src','/daily-launch/revisions/avatar-refined-presence-20261023/landscape.mp4'+revision);
 await expect.poll(()=>video.evaluate(v=>(v as HTMLVideoElement).videoWidth)).toBe(1920);
 expect(await video.evaluate(v=>(v as HTMLVideoElement).currentTime)).toBeCloseTo(at,1);
 await page.getByText('Leggi il copione',{exact:true}).click();await page.getByRole('button',{name:/Segui Conclavia Daily/}).click();
 await expect.poll(()=>video.evaluate(v=>(v as HTMLVideoElement).currentTime)).toBeGreaterThan(25);
 for(const label of ['Scarica il Reel ↓','Scarica YouTube ↓','Testo del post ↓','Sottotitoli ↓'])await expect(page.getByRole('link',{name:label})).toHaveAttribute('download','');
 await expect(page.getByRole('link',{name:'Scarica il Reel ↓'})).toHaveAttribute('href','/daily-launch/revisions/avatar-refined-presence-20261023/portrait.mp4'+revision);
 await expect(page.getByRole('link',{name:'Scarica YouTube ↓'})).toHaveAttribute('href','/daily-launch/revisions/avatar-refined-presence-20261023/landscape.mp4'+revision);
 await page.setViewportSize({width:390,height:1000});await page.getByRole('button',{name:'Reel · 9:16'}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 expect(api).toEqual([]);expect(errors).toEqual([]);
});

test('the thematic podcast preview shows two independent actors under the existing narration',async({page,request})=>{
 const sequence=await (await request.get('/daily-launch/manifest.json')).json() as TgPromoSequence;
 const scene=sequence.scenes.find(s=>s.kind==='conversation');expect(scene).toBeTruthy();
 await page.goto('/podcast/tg/presentazione/render');await page.waitForFunction(()=>Boolean((window as unknown as {conclaviaLaunchRender:unknown}).conclaviaLaunchRender));
 const formats=await page.evaluate(({sequence,start,end})=>{
  type Pose={mouthOpen:boolean;seconds:number};type Report={actors:Pose[];active:0|1;texts:{overflow:boolean}[]};
  const api=(window as unknown as {conclaviaLaunchRender:{prepare(s:TgPromoSequence,p:boolean):void;frame(t:number,c?:boolean):void;sample():Report}}).conclaviaLaunchRender;
  return [false,true].map(portrait=>{
   api.prepare(sequence,portrait);const turns=new Set<number>(),mouths:boolean[]=[];
   for(let frame=0;frame<Math.floor(end*25);frame++){
    const t=frame/25;api.frame(t,false);if(t<start)continue;
    const sample=api.sample();if(sample.actors.length!==2)throw Error('Conversation needs two visible actors');
    if(sample.texts.some(v=>v.overflow))throw Error('Conversation text overflow');
    turns.add(sample.active);mouths.push(...sample.actors.map(a=>a.mouthOpen));
   }
   return {turns:[...turns],voicedPreview:mouths.some(Boolean)};
  });
 },{sequence,start:scene!.start,end:scene!.end});
 for(const f of formats){expect(f.turns).toEqual([0,1]);expect(f.voicedPreview).toBe(false);}
});

test('conversation actors fade as complete groups without opaque face or lapel fragments',async({page,request})=>{
 const sequence=await (await request.get('/daily-launch/manifest.json')).json() as TgPromoSequence;
 const scene=sequence.scenes.find(s=>s.kind==='conversation');expect(scene).toBeTruthy();
 await page.goto('/podcast/tg/presentazione/render');
 await page.waitForFunction(()=>Boolean((window as unknown as {conclaviaLaunchRender:unknown}).conclaviaLaunchRender));
 const results=await page.evaluate(async({sequence,start})=>{
  type Rect={x:number;y:number;width:number;height:number};
  type Report={entry:number;regions:{head:Rect}[];placements:{x:number;y:number;scale:number}[]};
  const api=(window as unknown as {conclaviaLaunchRender:{prepare(s:TgPromoSequence,p:boolean):void;frame(t:number,c?:boolean):void;sample():Report}}).conclaviaLaunchRender;
  const canvas=document.querySelector('canvas')!,context=canvas.getContext('2d')!;
  const reports=[];
  for(const portrait of [true,false]){
   const image=new Image();image.src=portrait?'/daily-studio/studio-portrait-v2.png':'/daily-studio/studio-landscape-v2.png';await image.decode();
   api.prepare(sequence,portrait);
   const w=portrait?720:1280,h=portrait?1280:720,ratio=canvas.width/w;
   // Independent reference for the conversation background. Sample only the
   // heads/collars/central jackets, away from titles, microphones and desk.
   const background=document.createElement('canvas');background.width=canvas.width;background.height=canvas.height;
   const back=background.getContext('2d')!;back.setTransform(ratio,0,0,ratio,0,0);
   back.fillStyle='#fafbfc';back.fillRect(0,0,w,h);
   const cover=Math.max(w/image.naturalWidth,h/image.naturalHeight);
   back.drawImage(image,(w-image.naturalWidth*cover)/2,(h-image.naturalHeight*cover)/2,image.naturalWidth*cover,image.naturalHeight*cover);
   back.fillStyle='#fafbfc58';back.fillRect(0,0,w,h);
   const frames=[];
   for(const offset of [0,.04,.10,.16,.50]){
    api.frame(start+offset,false);const sample=api.sample();
    const boxes=sample.regions.map(r=>r.head).concat(sample.placements.map(a=>({x:a.x-110*a.scale,y:a.y+250*a.scale,width:220*a.scale,height:140*a.scale})));
    let maxDifference=0,changedPixels=0;
    for(const box of boxes){
     const x=Math.max(0,Math.ceil(box.x*ratio)),y=Math.max(Math.ceil((portrait?420:270)*ratio),Math.ceil(box.y*ratio));
     const right=Math.min(canvas.width,Math.floor((box.x+box.width)*ratio)),bottom=Math.min(Math.floor((portrait?1020:640)*ratio),Math.floor((box.y+box.height)*ratio));
     if(right<=x||bottom<=y)throw Error('Empty avatar fade sample');
     const actual=context.getImageData(x,y,right-x,bottom-y).data,reference=back.getImageData(x,y,right-x,bottom-y).data;
     for(let p=0;p<actual.length;p+=4){const delta=Math.max(...[0,1,2].map(channel=>Math.abs(actual[p+channel]-reference[p+channel])));maxDifference=Math.max(maxDifference,delta);if(delta>2)changedPixels++;}
    }
    frames.push({entry:sample.entry,maxDifference,changedPixels});
   }
   reports.push({portrait,frames});
  }
  return reports;
 },{sequence,start:scene!.start});
 for(const format of results){
  expect(format.frames[0].maxDifference,'at entry zero, no actor material may bypass the group fade').toBeLessThanOrEqual(1);
  for(const frame of format.frames.slice(1,-1)){
   expect(frame.entry).toBeGreaterThan(0);expect(frame.entry).toBeLessThan(.5);
   // One composited group can change a channel by at most alpha * 255.
   // Per-material alpha replacement or repeated translucent overdraw breaks
   // this bound even when some other parts of the actor correctly fade.
   expect(frame.maxDifference,`coherent group opacity in ${format.portrait?'portrait':'landscape'}`).toBeLessThanOrEqual(Math.ceil(frame.entry*255)+2);
  }
  expect(format.frames.at(-1)!.entry).toBe(1);
  expect(format.frames.at(-1)!.maxDifference).toBeGreaterThan(40);
  expect(format.frames.at(-1)!.changedPixels,'the measured regions must contain actual avatar pixels').toBeGreaterThan(1500);
 }
});

test('every launch scene stays legible, uses the shared actor and keeps the end card silent',async({page,request})=>{
 const sequence=await (await request.get('/daily-launch/manifest.json')).json() as TgPromoSequence;
 const errors:string[]=[],mutations:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{if(r.request().method()!=='GET'){mutations.push(r.request().url());return r.abort();}return r.continue();});
 await page.goto('/podcast/tg/presentazione/render');await page.waitForFunction(()=>Boolean((window as unknown as {conclaviaLaunchRender:unknown}).conclaviaLaunchRender));
 const samples=await page.evaluate(sequence=>{
  type Rect={x:number;y:number;width:number;height:number};
  type Report={scene:string;texts:{overflow:boolean;size:number;inkRows:Rect[]}[];regions:{head:Rect;hands:Rect[]}[];actor:{mouthOpen:boolean;motion:{left:{lift:number};right:{lift:number}}}};
  const api=(window as unknown as {conclaviaLaunchRender:{prepare(s:TgPromoSequence,p:boolean):void;frame(t:number,c?:boolean):void;sample():Report}}).conclaviaLaunchRender;
  const out:Report[]=[];
  for(const portrait of [false,true]){
   api.prepare(sequence,portrait);
   for(let frame=0;frame<Math.round(sequence.duration*25);frame++){
    const t=frame/25;api.frame(t,false);
    const sample=api.sample();if(sample.texts.some(t=>t.overflow))throw Error('Overflowing promo text');
    if(sample.texts.length>1)throw Error('The clean master must keep one headline and separate captions');
    const overlaps=(a:Rect,b:Rect)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
    for(const text of sample.texts)for(const ink of text.inkRows)for(const region of sample.regions)if([region.head,...region.hands].some(r=>overlaps(ink,r)))throw Error('A title crosses the face or hands');
    if(frame%25===0)out.push(sample);
    if(t>sequence.cues.at(-1)!.end&&sample.actor.mouthOpen)throw Error('End card cannot keep speaking');
   }
  }
  return out;
 },sequence);
 expect(new Set(samples.map(s=>s.scene)).size).toBe(7);
 expect(samples.filter(s=>['purpose','trust','invitation'].includes(s.scene)).some(s=>s.actor.motion.left.lift>.1||s.actor.motion.right.lift>.1)).toBe(true);
 expect(errors).toEqual([]);expect(mutations).toEqual([]);
});

test('scene chapters seek the real promo and expose the current performance mood without provider calls',async({page})=>{
 const mutations:string[]=[];page.on('request',r=>{if(r.method()!=='GET')mutations.push(r.url());});
 await page.goto('/podcast/tg/presentazione');const chapters=page.getByRole('navigation',{name:'Scene del video'});
 await expect(chapters.getByRole('button')).toHaveCount(7);
 await chapters.getByRole('button',{name:/Due avatar, un approfondimento/}).click();
 await expect.poll(()=>page.locator('video').evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeGreaterThan(25.5);
 await expect(chapters.getByRole('button',{name:/Due avatar, un approfondimento/})).toHaveAttribute('aria-current','step');
 await expect(page.getByTestId('launch-current-mood')).toContainText('Intenzione');
 await expect(page.getByRole('link',{name:'Apri palinsesto e redazione →'})).toHaveAttribute('href','/podcast/tg/redazione');expect(mutations).toEqual([]);
});

test('directed body motion stays inside both frames with quiet clauses and independent arm trajectories',async({page,request})=>{
 const sequence=await (await request.get('/daily-launch/manifest.json')).json() as TgPromoSequence;
 await page.goto('/podcast/tg/presentazione/render');
 await page.waitForFunction(()=>Boolean((window as unknown as {conclaviaLaunchRender:unknown}).conclaviaLaunchRender));
 const results=await page.evaluate(sequence=>{
  type Rect={x:number;y:number;width:number;height:number};
  type Pose={motion:{torso:number;shift:number;chestTilt?:number;chestShift?:number;left:{lift:number};right:{lift:number}}};
  type Report={regions:{head:Rect;hands:Rect[]}[];actor:Pose;actors:Pose[]};
  const api=(window as unknown as {conclaviaLaunchRender:{prepare(s:TgPromoSequence,p:boolean):void;frame(t:number,c?:boolean):void;sample():Report}}).conclaviaLaunchRender;
  return [true,false].map(portrait=>{
   api.prepare(sequence,portrait);let quiet=0,visible=0,leftLead=0,rightLead=0;const turns:number[]=[],shifts:number[]=[];
   for(let i=0;i<Math.round(sequence.duration*25);i++){
    api.frame(i/25,false);const s=api.sample(),w=portrait?720:1280,h=portrait?1280:720;
    for(const r of s.regions)for(const box of [r.head,...r.hands])if(box.x<0||box.y<0||box.x+box.width>w||box.y+box.height>h)throw Error('Body/hand outside actual frame');
    if(s.regions.length!==1)continue;visible++;
    const m=s.actor.motion;if(m.left.lift+m.right.lift<.08)quiet++;
    if(m.left.lift-m.right.lift>.10)leftLead++;
    if(m.right.lift-m.left.lift>.10)rightLead++;
    turns.push(m.torso+(m.chestTilt??0));shifts.push(m.shift+(m.chestShift??0)*100);
   }
   return {quiet:quiet/visible,leftLead,rightLead,turnRange:Math.max(...turns)-Math.min(...turns),shiftRange:Math.max(...shifts)-Math.min(...shifts)};
  });
 },sequence);
 for(const r of results){expect(r.quiet).toBeGreaterThan(.22);expect(r.quiet).toBeLessThan(.88);expect(r.leftLead).toBeGreaterThan(5);expect(r.rightLead).toBeGreaterThan(5);expect(r.turnRange).toBeGreaterThan(.02);expect(r.shiftRange).toBeGreaterThan(2);}
});
