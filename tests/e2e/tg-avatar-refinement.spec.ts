import {test,expect,type Page} from '@playwright/test';
import type {RobotPose} from '@conclavia/avatar-kit/characters/robot';
import {names} from '@conclavia/avatar-kit/performance';
type Rect={x:number;y:number;width:number;height:number};
type Sample={actor:RobotPose;texts:{overflow:boolean}[];regions:{head:Rect;hands:Rect[]}[]};
async function selectAnatomicalTrial(page:Page){
 await page.getByRole('button',{name:'Mani rifinite',exact:true}).click();
 await expect(page.locator('canvas')).toHaveAttribute('data-finish','sculpted');
}

test('Alex finish comparison preserves the rig and cached audio; every mood remains expressive in both formats',async({page})=>{
 const errors:string[]=[],writes:string[]=[],external:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const q=r.request();if(q.method()!=='GET'){writes.push(q.method()+' '+new URL(q.url()).pathname);return r.abort();}if(new URL(q.url()).origin!=='http://127.0.0.1:3101'){external.push(q.url());return r.abort();}return r.continue();});
 await page.goto('/podcast/tg/avatar');await page.waitForFunction(()=>window.conclaviaAvatarReview);
 const audio=await page.locator('audio').getAttribute('src');
 await expect(page.locator('canvas')).toHaveAttribute('data-finish','sculpted');
 await expect(page.getByRole('button',{name:'Mani rifinite',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('button',{name:'Gusci · prova scartata',exact:true})).not.toBeVisible();
 await page.getByRole('button',{name:'Versione precedente',exact:true}).click();
 await expect(page.locator('canvas')).toHaveAttribute('data-finish','original');
 const old=await page.evaluate(()=>{const a=window.conclaviaAvatarReview!;return {image:a.frame(8.8),sample:a.sample()};});
 await selectAnatomicalTrial(page);
 const before=await page.evaluate(()=>{const a=window.conclaviaAvatarReview!;return {image:a.frame(8.8),sample:a.sample()};});
 expect((old.sample as Sample).actor).toEqual((before.sample as Sample).actor);expect(old.image).not.toBe(before.image);
 await page.getByText('Prova le otto espressioni',{exact:true}).click();
 const poses:RobotPose[]=[];
 for(const [mood,label] of Object.entries(names)){
  await page.getByRole('button',{name:label,exact:true}).click();await expect(page.locator('canvas')).toHaveAttribute('data-mood',mood);
  const sample=await page.evaluate(()=>{window.conclaviaAvatarReview!.frame(8.8,false);return window.conclaviaAvatarReview!.sample();}) as Sample;
  poses.push(sample.actor);expect(sample.texts.every(t=>!t.overflow)).toBe(true);
 }
 expect(new Set(poses.map(p=>JSON.stringify(p.face))).size).toBe(8);
 for(const p of poses)expect(Object.values(p.face).every(Number.isFinite)).toBe(true);
 await page.getByRole('button',{name:'9:16',exact:true}).click();await page.setViewportSize({width:390,height:1000});
 await expect(page.locator('canvas')).toHaveJSProperty('width',1080);await expect(page.locator('canvas')).toHaveJSProperty('height',1920);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 expect(await page.locator('audio').getAttribute('src')).toBe(audio);expect(writes).toEqual([]);expect(external).toEqual([]);expect(errors).toEqual([]);
});

test('Alex refinement uses the audio clock through mood transitions and holds a paused pose',async({page})=>{
 await page.goto('/podcast/tg/avatar');await page.waitForFunction(()=>window.conclaviaAvatarReview);
 await selectAnatomicalTrial(page);
 await page.getByText('Prova le otto espressioni',{exact:true}).click();
 await page.evaluate(()=>{window.conclaviaAvatarReview!.frame(8.8,false);});
 await page.getByRole('button',{name:'Avvia prova',exact:true}).click();await expect.poll(()=>page.locator('audio').evaluate(a=>(a as HTMLAudioElement).currentTime)).toBeGreaterThan(8.85);
 await page.getByRole('button',{name:names.empathy,exact:true}).click();
 await expect(page.locator('canvas')).toHaveAttribute('data-mood','empathy');
 await page.getByRole('button',{name:'Pausa',exact:true}).click();
 await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));
 const pose=await page.evaluate(()=>window.conclaviaAvatarReview!.sample());await page.waitForTimeout(120);
 expect(await page.evaluate(()=>window.conclaviaAvatarReview!.sample())).toEqual(pose);
});

test('standing hands and forearms remain inside both compositions and below the moving face throughout each mood',async({page})=>{
 await page.goto('/podcast/tg/avatar');await page.waitForFunction(()=>window.conclaviaAvatarReview);
 await selectAnatomicalTrial(page);
 await page.getByText('Prova le otto espressioni',{exact:true}).click();
 for(const portrait of [false,true]){
  await page.getByRole('button',{name:portrait?'9:16':'16:9',exact:true}).click();
  await expect(page.locator('canvas')).toHaveJSProperty('height',portrait?1920:1080);
  await page.waitForFunction(()=>Boolean(window.conclaviaAvatarReview));
  for(const [mood,label] of Object.entries(names)){
   await page.getByRole('button',{name:label,exact:true}).click();await expect(page.locator('canvas')).toHaveAttribute('data-mood',mood);
   const frames=await page.evaluate(()=>{const a=window.conclaviaAvatarReview!,frames:unknown[]=[];for(let i=0;i<=40;i++){a.frame(7.5+i/25,false);frames.push(a.sample());}return frames;}) as Sample[];
   for(const f of frames){
    expect(f.texts.every(t=>!t.overflow)).toBe(true);
    for(const actor of f.regions)for(const hand of actor.hands){
     expect(hand.x).toBeGreaterThan(0);expect(hand.x+hand.width).toBeLessThan(portrait?720:1280);
     expect(hand.y).toBeGreaterThan(actor.head.y+actor.head.height-10);
     expect(hand.y+hand.height).toBeLessThan(portrait?1280:720);
    }
   }
  }
 }
});

test('standing delivery is the default and the seated comparison preserves the cached voice',async({page})=>{
 await page.goto('/podcast/tg/avatar');await page.waitForFunction(()=>window.conclaviaAvatarReview);
 await expect(page.getByRole('button',{name:'In piedi',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('canvas')).toHaveAttribute('data-posture','standing');
 const audio=await page.locator('audio').getAttribute('src');
 const free=await page.evaluate(()=>{const a=window.conclaviaAvatarReview!;for(let i=0;i<=40;i++)a.frame(i/25,false);return a.sample();}) as Sample;
 expect(free.actor.standingKinematics).toBeDefined();
 await page.getByRole('button',{name:'Seduto · confronto',exact:true}).click();
 await expect(page.locator('canvas')).toHaveAttribute('data-posture','desk');
 const desk=await page.evaluate(()=>{window.conclaviaAvatarReview!.frame(1.6,false);return window.conclaviaAvatarReview!.sample();}) as Sample;
 expect(desk.actor.standingKinematics).toBeUndefined();expect(desk.actor.seatedKinematics).toBeDefined();
 expect(await page.locator('audio').getAttribute('src')).toBe(audio);
 await page.getByRole('button',{name:'In piedi',exact:true}).click();
 await expect(page.locator('canvas')).toHaveAttribute('data-posture','standing');
});

test('two-hand rehearsals open both arms and overlap/release once in both formats without changing audio',async({page})=>{
 await page.goto('/podcast/tg/avatar');await page.waitForFunction(()=>window.conclaviaAvatarReview);
 await selectAnatomicalTrial(page);
 const audio=await page.locator('audio').getAttribute('src');
 await page.getByText('Prova le pose delle mani',{exact:true}).click();
 for(const portrait of [false,true]){
  await page.getByRole('button',{name:portrait?'9:16':'16:9',exact:true}).click();
  await expect(page.locator('canvas')).toHaveJSProperty('height',portrait?1920:1080);
  await page.waitForFunction(()=>Boolean(window.conclaviaAvatarReview));
  for(const [label,kind] of [['Spiega con entrambe','compare'],['Una mano aperta','offer'],['Sovrapponi le mani','fold-hands'],['Unisci i polpastrelli','steeple'],['Intreccia le dita','interlace'],['Indica in basso','point-down']] as const){
   if(kind!=='interlace'){await page.getByRole('button',{name:'In piedi',exact:true}).click();}
   await page.getByRole('button',{name:label,exact:true}).click();
   await expect(page.locator('canvas')).toHaveAttribute('data-gesture',kind);
   await expect(page.locator('canvas')).toHaveAttribute('data-posture',kind==='interlace'?'desk':'standing');
   const frames=await page.evaluate(()=>{const a=window.conclaviaAvatarReview!,out:unknown[]=[];for(let i=0;i<=200;i++){a.frame(i/25,false);out.push(a.sample());}return out;}) as Sample[];
   expect(frames.every(f=>f.texts.every(t=>!t.overflow))).toBe(true);
   if(kind==='fold-hands'||kind==='steeple'||kind==='interlace'){
    expect(Math.max(...frames.map(f=>Math.abs(f.actor.motion.handsFold??0)))).toBeGreaterThan(.97);
    expect(Math.abs(frames.at(-1)!.actor.motion.handsFold??0)).toBeLessThan(.03);
    if(kind!=='fold-hands'){
     const key=kind==='steeple'?'handsSteeple':'handsInterlace';
     expect(Math.max(...frames.map(f=>f.actor.motion[key]??0))).toBeGreaterThan(.97);
     expect(frames.at(-1)!.actor.motion[key]??0).toBeLessThan(.03);
    }
   }else if(kind==='point-down'){
    expect(Math.max(...frames.map(f=>f.actor.motion.right.pointDown??0))).toBeGreaterThan(.97);
    expect(frames.at(-1)!.actor.motion.right.pointDown??0).toBeLessThan(.03);
   }else if(kind==='compare')expect(frames.some(f=>f.actor.motion.left.lift>.3&&f.actor.motion.right.lift>.3)).toBe(true);
   else expect(frames.some(f=>f.actor.motion.right.lift>.3&&f.actor.motion.left.lift<.2)).toBe(true);
   for(const f of frames)for(const a of f.regions)for(const hand of a.hands){
    expect(hand.x).toBeGreaterThan(0);expect(hand.x+hand.width).toBeLessThan(portrait?720:1280);
    expect(hand.y).toBeGreaterThan(a.head.y+a.head.height-10);
   }
  }
 }
 expect(await page.locator('audio').getAttribute('src')).toBe(audio);
});

test('the six-second interlace proof is optional, silent and keeps independent fingers on mobile',async({page})=>{
 const errors:string[]=[],writes:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{if(r.request().method()!=='GET'){writes.push(r.request().url());return r.abort();}return r.continue();});
 await page.setViewportSize({width:390,height:950});
 await page.goto('/daily-launch/hand-lab/index.html?pose=interlace');
 await page.waitForFunction(()=>Boolean((window as unknown as {conclaviaHandProof?:unknown}).conclaviaHandProof));
 await page.getByRole('button',{name:'Intreccio',exact:true}).click();
 const sample=await page.evaluate(()=>{
  const a=(window as unknown as {conclaviaHandProof:{sample:()=>{posture:string;pose:RobotPose;arms:{hand:{digits:{joints:{x:number;y:number;z:number}[]}[]} }[]}}}).conclaviaHandProof;
  const s=a.sample();return {posture:s.posture,weight:s.pose.motion.handsInterlace,mouth:s.pose.mouthOpen,wrists:s.arms.map(a=>a.hand.digits.map(d=>d.joints[3])),json:JSON.stringify(s)};
 });
 expect(sample.posture).toBe('desk');expect(sample.weight).toBeGreaterThan(.98);expect(sample.mouth).toBe(false);
 expect(new Set(sample.wrists[0].map(p=>p.y.toFixed(2))).size).toBe(5);
 await page.waitForTimeout(100);
 expect(await page.evaluate(()=>JSON.stringify((window as unknown as {conclaviaHandProof:{sample:()=>unknown}}).conclaviaHandProof.sample()))).toBe(sample.json);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await expect(page.locator('audio')).toHaveCount(0);
 await page.getByRole('link',{name:'Gesti liberi',exact:true}).click();
 await expect(page.getByRole('button',{name:'Una mano',exact:true})).toBeVisible();
 expect(errors).toEqual([]);expect(writes).toEqual([]);
});


test('the complete six-second acting proof links three gestures and mood transitions on mobile without writes',async({page})=>{
 await page.setViewportSize({width:390,height:950});
 const errors:string[]=[],writes:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{if(r.request().method()!=='GET'){writes.push(r.request().url());return r.abort();}return r.continue();});
 await page.goto('/daily-launch/hand-lab/index.html?pose=delivery');
 await page.waitForFunction(()=>Boolean((window as unknown as {conclaviaHandProof?:unknown}).conclaviaHandProof));
 const sample=()=>page.evaluate(()=>(window as unknown as {conclaviaHandProof:{sample:()=>{pose:RobotPose}}}).conclaviaHandProof.sample().pose);
 await page.getByRole('button',{name:'Spiega',exact:true}).click();
 expect((await sample()).motion.right.lift).toBeGreaterThan(.2);
 await page.getByRole('button',{name:'Confronta',exact:true}).click();
 const comparison=await sample();expect(comparison.motion.left.lift).toBeGreaterThan(.2);expect(comparison.motion.right.lift).toBeGreaterThan(.2);expect(comparison.motion.handsInterlace??0).toBe(0);
 await page.getByRole('button',{name:'Indica i commenti',exact:true}).click();
 const held=await sample();expect(held.motion.right.pointDown).toBeGreaterThan(.8);expect(held.mouthOpen).toBe(false);
 await page.waitForTimeout(100);expect(await sample()).toEqual(held);
 await expect(page.locator('audio')).toHaveCount(0);
 await expect(page.locator('#mp4')).toHaveAttribute('href',/\/hands-delivery\.mp4\?v=[a-f0-9]{12}$/u);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 expect(errors).toEqual([]);expect(writes).toEqual([]);
});

test('the comment gesture is a silent six-second proof with a readable downward index and a frozen pause',async({page})=>{
 await page.setViewportSize({width:390,height:950});
 await page.goto('/daily-launch/hand-lab/index.html?pose=point-down');
 await page.waitForFunction(()=>Boolean((window as unknown as {conclaviaHandProof?:unknown}).conclaviaHandProof));
 await page.getByRole('button',{name:'Indica in basso',exact:true}).click();
 const sample=await page.evaluate(()=>{
  const p=(window as unknown as {conclaviaHandProof:{sample:()=>{pose:RobotPose;arms:{hand:{digits:{joints:{x:number;y:number}[]}[]} }[]}}}).conclaviaHandProof,s=p.sample();
  const digits=s.arms[1].hand.digits,index=digits[0].joints;
  return {down:index[3].y-index[0].y,side:Math.abs(index[3].x-index[0].x),clearance:index[3].y-Math.max(...digits.slice(1,4).flatMap(d=>d.joints.map(p=>p.y))),json:JSON.stringify(s),mouth:s.pose.mouthOpen};
 });
 expect(sample.down).toBeGreaterThan(17);expect(sample.down).toBeGreaterThan(sample.side*2);expect(sample.clearance).toBeGreaterThan(7);expect(sample.mouth).toBe(false);
 await page.waitForTimeout(100);
 expect(await page.evaluate(()=>JSON.stringify((window as unknown as {conclaviaHandProof:{sample:()=>unknown}}).conclaviaHandProof.sample()))).toBe(sample.json);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await expect(page.locator('audio')).toHaveCount(0);
 await expect(page.getByRole('link',{name:'Apri il breve video MP4'})).toHaveAttribute('href',/\/hands-point-down\.mp4\?v=[a-f0-9]{12}$/u);
 await page.getByRole('button',{name:'Ritorno',exact:true}).click();
 expect(await page.evaluate(()=>(window as unknown as {conclaviaHandProof:{sample:()=>{pose:RobotPose}}}).conclaviaHandProof.sample().pose.motion.right.pointDown??0)).toBeLessThan(.01);
});

test('the new fingertip contact is distinct from the other two holds and is usable on mobile without voice or writes',async({page})=>{
 await page.setViewportSize({width:390,height:950});
 const writes:string[]=[];await page.route('**/*',r=>{if(r.request().method()!=='GET'){writes.push(r.request().url());return r.abort();}return r.continue();});
 await page.goto('/daily-launch/hand-lab/index.html?pose=steeple');
 await page.waitForFunction(()=>Boolean((window as unknown as {conclaviaHandProof?:unknown}).conclaviaHandProof));
 await page.getByRole('button',{name:'Polpastrelli',exact:true}).click();
 const sample=await page.evaluate(()=>{
  const a=(window as unknown as {conclaviaHandProof:{sample:()=>{pose:RobotPose;arms:{hand:{digits:{joints:{x:number;y:number;z:number}[];radii:number[]}[]} }[]}}}).conclaviaHandProof,s=a.sample(),[left,right]=s.arms.map(a=>a.hand);
  return {weight:s.pose.motion.handsSteeple,mouth:s.pose.mouthOpen,gaps:left.digits.slice(0,4).map((d,i)=>{const p=d.joints[3],q=right.digits[i].joints[3];return Math.hypot(p.x-q.x,p.y-q.y,p.z-q.z)-d.radii[3]-right.digits[i].radii[3];}),json:JSON.stringify(s)};
 });
 expect(sample.weight).toBeGreaterThan(.98);expect(sample.mouth).toBe(false);
 for(const gap of sample.gaps){expect(gap).toBeGreaterThan(-1.5);expect(gap).toBeLessThan(3);}
 await page.waitForTimeout(100);
 expect(await page.evaluate(()=>JSON.stringify((window as unknown as {conclaviaHandProof:{sample:()=>unknown}}).conclaviaHandProof.sample()))).toBe(sample.json);
 await expect(page.getByRole('link',{name:'Mani sovrapposte',exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'Intreccio delle dita',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await expect(page.locator('audio')).toHaveCount(0);expect(writes).toEqual([]);
});

test('the complete review offers one mobile-first player, both formats and the measured Daily closing',async({page})=>{
 await page.setViewportSize({width:390,height:950});
 await page.goto('/daily-launch/revisions/avatar-palm-20261022/index.html');
 const video=page.locator('video');await expect(video).toHaveCount(1);
 await expect.poll(()=>video.evaluate(v=>(v as HTMLVideoElement).videoWidth)).toBe(1080);
 await expect.poll(()=>video.evaluate(v=>(v as HTMLVideoElement).duration)).toBeGreaterThan(36);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.getByRole('button',{name:'Orizzontale · 16:9',exact:true}).click();
 await expect.poll(()=>video.evaluate(v=>(v as HTMLVideoElement).videoWidth)).toBe(1920);
 await page.getByRole('button',{name:'Chiusura Daily',exact:true}).click();
 await expect.poll(()=>video.evaluate(v=>(v as HTMLVideoElement).duration)).toBeLessThan(9);
 await expect(video).toHaveAttribute('src',/avatar-palm-closing-20261022\/landscape\.mp4\?v=/u);
 await expect(video.locator('track')).toHaveAttribute('srclang','it');
});

test('interlaced rehearsal selects a seat and returning to standing restores the script direction',async({page})=>{
 await page.goto('/podcast/tg/avatar');await page.waitForFunction(()=>window.conclaviaAvatarReview);
 await page.getByText('Prova le pose delle mani',{exact:true}).click();
 await page.getByRole('button',{name:'Intreccia le dita',exact:true}).click();
 await expect(page.locator('canvas')).toHaveAttribute('data-posture','desk');
 await page.evaluate(()=>{for(let i=0;i<=170;i++)window.conclaviaAvatarReview!.frame(i/50,false);});
 const seated=await page.evaluate(()=>window.conclaviaAvatarReview!.sample()) as Sample;
 expect(seated.actor.seatedKinematics).toBeDefined();expect(seated.actor.motion.handsInterlace).toBeGreaterThan(.97);
 await page.getByRole('button',{name:'In piedi',exact:true}).click();
 await expect(page.locator('canvas')).toHaveAttribute('data-posture','standing');
 await expect(page.locator('canvas')).toHaveAttribute('data-gesture','audio');
 const frames=await page.evaluate(()=>{const a=window.conclaviaAvatarReview!,out:unknown[]=[];for(let i=0;i<=500;i++){a.frame(i/25,false);out.push(a.sample());}return out;}) as Sample[];
 expect(frames.every(f=>(f.actor.motion.handsInterlace??0)===0)).toBe(true);
});

test('the new complete presentation has both HD formats, original audible voice and one mobile player',async({page})=>{
 await page.setViewportSize({width:390,height:950});
 await page.goto('/daily-launch/revisions/avatar-standing-word-20261023/index.html');
 const video=page.locator('video');await expect(video).toHaveCount(1);
 await expect.poll(()=>video.evaluate(v=>(v as HTMLVideoElement).videoWidth)).toBe(1080);
 await expect.poll(()=>video.evaluate(v=>(v as HTMLVideoElement).duration)).toBe(36.88);
 expect(await video.evaluate(v=>(v as HTMLVideoElement).muted)).toBe(false);
 await video.evaluate(v=>(v as HTMLVideoElement).play());
 await expect.poll(()=>video.evaluate(v=>(v as HTMLVideoElement).currentTime)).toBeGreaterThan(.2);
 await video.evaluate(v=>(v as HTMLVideoElement).pause());
 await page.getByRole('button',{name:'Orizzontale · 16:9',exact:true}).click();
 await expect.poll(()=>video.evaluate(v=>(v as HTMLVideoElement).videoWidth)).toBe(1920);
 await expect(video.locator('track')).toHaveAttribute('srclang','it');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('upward index rehearsal carries the whole arm, keeps a readable finger and stays within both compositions',async({page})=>{
 const errors:string[]=[],writes:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{if(r.request().method()!=='GET'){writes.push(r.request().url());return r.abort();}return r.continue();});
 await page.setViewportSize({width:390,height:950});await page.goto('/podcast/tg/avatar');await page.waitForFunction(()=>window.conclaviaAvatarReview);
 const audio=await page.locator('audio').getAttribute('src');await page.getByText('Prova le pose delle mani',{exact:true}).click();
 for(const portrait of [true,false]){
  await page.getByRole('button',{name:portrait?'9:16':'16:9',exact:true}).click();
  await expect(page.locator('canvas')).toHaveJSProperty('width',portrait?1080:1920);
  await page.getByRole('button',{name:'Indice in alto',exact:true}).click();
  await expect(page.locator('canvas')).toHaveAttribute('data-gesture','point-up');
  const frames=await page.evaluate(()=>{const a=window.conclaviaAvatarReview!,out:unknown[]=[];for(let i=0;i<=200;i++){a.frame(i/25,false);out.push(a.sample());}return out;}) as Sample[];
  expect(Math.max(...frames.map(f=>f.actor.motion.right.pointUp??0))).toBeGreaterThan(.97);
  expect(frames.at(-1)!.actor.motion.right.pointUp??0).toBeLessThan(.01);
  for(const f of frames){expect(f.texts.every(t=>!t.overflow)).toBe(true);for(const a of f.regions)for(const h of a.hands){expect(h.x).toBeGreaterThan(0);expect(h.x+h.width).toBeLessThan(portrait?720:1280);expect(h.y).toBeGreaterThan(a.head.y+a.head.height-10);}}
 }
 expect(await page.locator('audio').getAttribute('src')).toBe(audio);expect(errors).toEqual([]);expect(writes).toEqual([]);
});

test('the upward-index proof is six seconds, silent and shows the extended finger before returning',async({page})=>{
 await page.setViewportSize({width:390,height:950});await page.goto('/daily-launch/hand-lab/index.html?pose=point-up&wide=1');
 await page.waitForFunction(()=>Boolean((window as unknown as {conclaviaHandProof?:unknown}).conclaviaHandProof));
 await page.getByRole('button',{name:'Indice in alto',exact:true}).click();
 const sample=await page.evaluate(()=>{const s=(window as unknown as {conclaviaHandProof:{sample:()=>{pose:RobotPose;arms:{hand:{digits:{joints:{x:number;y:number}[]}[]} }[]}}}).conclaviaHandProof.sample();const d=s.arms[1].hand.digits[0];return {up:s.pose.motion.right.pointUp,direction:d.joints[0].y-d.joints[3].y,mouth:s.pose.mouthOpen,json:JSON.stringify(s)};});
 expect(sample.up).toBeGreaterThan(.97);expect(sample.direction).toBeGreaterThan(20);expect(sample.mouth).toBe(false);
 await expect(page.locator('audio')).toHaveCount(0);await expect(page.locator('#mp4')).toHaveAttribute('href',/hands-point-up-wide\.mp4\?v=[a-f0-9]{12}$/u);
 await page.getByRole('button',{name:'Ritorno',exact:true}).click();
 expect(await page.evaluate(()=>(window as unknown as {conclaviaHandProof:{sample:()=>{pose:RobotPose}}}).conclaviaHandProof.sample().pose.motion.right.pointUp??0)).toBeLessThan(.01);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
