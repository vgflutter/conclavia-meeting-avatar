/** Silent six-second anatomical proof. Imports the same canonical rig as production. */
import {advanceRobotPose,paintRobot,adultPresenterArms,adultPresenterHands,type RobotPose} from '@conclavia/avatar-kit/characters/robot';
import {planPerformancePhrases,type PerformanceChoreography} from '@conclavia/avatar-kit/performance';
import {dailyPerformanceDirection} from '../../src/lib/tg/performance-direction';
import {dailyRobotPalette} from '../../src/components/tg/daily-robot-theme';
const canvas=document.querySelector('canvas')!,c=canvas.getContext('2d')!;
const params=new URLSearchParams(location.search),delivery=params.get('pose')==='delivery',interlaced=params.get('pose')==='interlace',steeple=params.get('pose')==='steeple',overlap=params.get('pose')==='overlap',pointDown=params.get('pose')==='point-down',pointUp=params.get('pose')==='point-up',fingers=params.get('pose')==='fingers',contact=interlaced||steeple||overlap;
const prayer=params.get('pose')==='palms-joined',chin=params.get('pose')==='chin-touch';
const semanticIntent=params.get('pose')==='editorial-reassure'?'reassure':params.get('pose')==='editorial-reflect'?'reflect':undefined;
const duration=semanticIntent?8:6;
const editorial=semanticIntent?{text:semanticIntent==='reassure'?'Possiamo chiarire questo punto con calma, distinguendo ciò che sappiamo da ciò che resta da verificare.':'Resta una domanda aperta: quali elementi mancano ancora per arrivare a una conclusione?',mood:semanticIntent==='reassure'?'empathy' as const:'doubt' as const,intensity:.8,intent:semanticIntent} as const:undefined;
const posture=interlaced?'desk' as const:'standing' as const;
const palette={...dailyRobotPalette,finish:'sculpted' as const,posture,handStyle:'anatomical' as const};
const detail=(contact||prayer)&&!params.has('wide')||semanticIntent==='reassure'&&params.has('detail');
const explicitPlan:PerformanceChoreography={version:1,key:pointUp?'point-up-proof':pointDown?'point-down-proof':contact?'contact-'+params.get('pose'):'human-presenter-proof',durationSeconds:6,stance:.1,energy:.8,articulation:'spine',phrasing:'connected',restPose:.35,vitality:.9,
 strokes:prayer||chin?[{kind:prayer?'palms-joined':'chin-touch',hand:prayer?0:1,start:.35,apex:1.85,hold:1.25,end:4.7,strength:.98,variant:.4}]:delivery?[{kind:'explain',hand:1,start:.12,apex:.62,hold:.06,end:1.45,strength:.78,variant:.35},{kind:'compare',hand:0,start:1.45,apex:2.15,hold:.12,end:3.4,strength:.73,variant:.8},{kind:'point-down',hand:1,start:3.82,apex:4.55,hold:.35,end:5.65,strength:.98,variant:.7}]:pointUp?[{kind:'point-up',hand:1,start:.5,apex:1.8,hold:1,end:4.9,strength:1,variant:.8}]:pointDown?[{kind:'point-down',hand:1,start:.5,apex:2,hold:1,end:5.1,strength:1,variant:.8}]:fingers?[{kind:'offer',hand:1,start:.35,apex:1.2,hold:2,end:5.4,strength:.9,variant:.3}]:contact?[{kind:'fold-hands',contact:interlaced?'interlace':steeple?'steeple':'overlap',hand:0,start:.4,apex:2.1,hold:1.4,end:5.2,strength:1,variant:.8}]:[{kind:'explain',hand:1,start:.5,apex:1.45,hold:.15,end:2.8,strength:.8,variant:.35},{kind:'compare',hand:0,start:3.05,apex:3.9,hold:.12,end:5.3,strength:.65,variant:.35}]};
const plan=editorial?planPerformancePhrases([{cueId:'sentence',durationSeconds:duration,...editorial}],{seed:'editorial-score',actorId:'presenter:0',...dailyPerformanceDirection})[0]:explicitPlan;
let pose:RobotPose|undefined,time=0,playing=false,stamp=0;
const slider=document.querySelector('input')!,button=document.querySelector('button')!,output=document.querySelector('output')!;
slider.max=String(duration);
function frame(t:number,capture=true){
 t=Math.max(0,Math.min(duration,t));
 if(!pose||t<pose.seconds||t-pose.seconds>.1){pose=undefined;for(let i=0;i<=Math.floor(t*120);i++)step(i/120);}
 if(!pose||t!==pose.seconds)step(t);
 draw();
 time=t;slider.value=String(t);output.value=t.toFixed(2)+' / '+duration+' s';
 return capture?canvas.toDataURL('image/jpeg',.92).split(',')[1]:'';
}
function step(t:number){
 const emotion=editorial?.mood??(chin?'doubt':prayer?'empathy':delivery?(t<1.45?'curiosity':t<3.8?'attention':'agreement'):'attention');
 pose=advanceRobotPose(pose,{name:'Alex',speaking:true,emotion,intensity:.8,audioLevel:0,viseme:'rest',performance:{cueId:'human-reference',durationSeconds:duration,progress:t/duration,choreography:plan}},t,pose?t-pose.seconds:0,false,posture);
}
function draw(){
 if(!pose)return;
 c.setTransform(1,0,0,1,0,0);c.fillStyle='#f0f1ef';c.fillRect(0,0,canvas.width,canvas.height);
 if(fingers){const wrist=adultPresenterHands(pose,posture,'anatomical')[1].wrist;c.translate(canvas.width/2-wrist.x*5,canvas.height*.60-wrist.y*5);c.scale(5,5);}
 else if((prayer||editorial)&&detail){c.translate(canvas.width/2,-620);c.scale(3,3);}
 else if(editorial||delivery||chin||prayer&&params.has('wide')||pointUp&&params.has('wide')){c.translate(canvas.width/2,-10);c.scale(.96,.96);}
 else{c.translate(canvas.width/2,detail?-1040:-380);c.scale(detail?3:1.65,detail?3:1.65);}
 c.lineCap='round';c.lineJoin='round';paintRobot(c,pose,palette);
}
function tick(now:number){if(playing){frame(Math.min(duration,time+(now-stamp)/1000),false);if(time>=duration){playing=false;button.textContent='Rivedi la prova';}}stamp=now;requestAnimationFrame(tick);}
button.onclick=()=>{if(!playing){if(time>=duration)time=0;playing=true;stamp=performance.now();button.textContent='Pausa';}else{playing=false;button.textContent='Riprendi';}};
slider.oninput=()=>{playing=false;button.textContent='Riprendi';frame(Number(slider.value),false);};
for(const [i,key] of [...document.querySelectorAll<HTMLButtonElement>('[data-frame]')].entries()){
 if(contact){key.dataset.frame=String([0,1.4,3.3][i]);key.textContent=['Raccolte','Avvicinamento',interlaced?'Intreccio':steeple?'Polpastrelli':'Sovrapposte'][i];}
 if(pointUp){key.dataset.frame=String([0,2.5,5.8][i]);key.textContent=['Raccolte','Indice in alto','Ritorno'][i];}
 if(pointDown){key.dataset.frame=String([0,2.7,5.8][i]);key.textContent=['Raccolte','Indica in basso','Ritorno'][i];}
 if(fingers){key.dataset.frame=String([0,1.9,3.2][i]);key.textContent=['Raccolte','Apertura','Assestamento'][i];}
 if(delivery){key.dataset.frame=String([.8,2.65,4.95][i]);key.textContent=['Spiega','Confronta','Indica i commenti'][i];}
 key.onclick=()=>{playing=false;button.textContent='Riprendi';frame(Number(key.dataset.frame),false);};
}
if(contact){document.querySelector('#description')!.textContent='Mani raccolte → avvicinamento → '+(interlaced?'dita intrecciate da seduto':steeple?'polpastrelli a contatto':'mani sovrapposte')+' → rilascio. Prova muta di sei secondi.';const video=document.querySelector<HTMLAnchorElement>('#mp4')!;video.href='hands-'+params.get('pose')+(detail?'':'-wide')+'.mp4';const view=document.createElement('a');view.href='index.html?pose='+params.get('pose')+(detail?'&wide=1':'');view.textContent=detail?'Vista ampia':'Dettaglio dita';video.after(document.createTextNode(' · '),view);}
if(pointUp){document.querySelector('#description')!.textContent='Un punto importante: preparazione del braccio → indice in alto → breve tenuta → rientro. Prova muta di sei secondi.';document.querySelector<HTMLAnchorElement>('#mp4')!.href='hands-point-up'+(params.has('wide')?'-wide':'')+'.mp4';const view=document.createElement('a');view.href='index.html?pose=point-up'+(params.has('wide')?'':'&wide=1');view.textContent=params.has('wide')?'Dettaglio del gesto':'Figura intera';document.querySelector('#mp4')!.after(document.createTextNode(' · '),view);}
if(pointDown){document.querySelector('#description')!.textContent='Mani raccolte → indice verso i commenti → breve tenuta → ritorno. Prova muta di sei secondi.';document.querySelector<HTMLAnchorElement>('#mp4')!.href='hands-point-down.mp4';}
if(fingers){document.querySelector('#description')!.textContent='Dettaglio delle dita: apertura sfalsata, assestamento del palmo e richiamo. Prova muta di sei secondi.';document.querySelector<HTMLAnchorElement>('#mp4')!.href='hands-fingers.mp4';}
if(delivery){document.querySelector('#description')!.textContent='In piedi: spiega → confronta → indica i commenti, con preparazione e recupero. Sei secondi, stesso motore della presentazione.';document.querySelector<HTMLAnchorElement>('#mp4')!.href='hands-delivery.mp4';}
if(prayer||chin){
 document.querySelector('#description')!.textContent=prayer?'Compostezza e rassicurazione: avvicinamento → palmi contrapposti → breve tenuta → rilascio. Prova muta, senza un tema di cronaca.':'Riflessione: la mano raggiunge il lato del mento seguendo testa e collo, poi torna al riposo. Prova muta, senza un tema di cronaca.';
 document.querySelector<HTMLAnchorElement>('#mp4')!.href='hands-'+params.get('pose')+(params.has('wide')?'-wide':'')+'.mp4';
 for(const [i,key] of [...document.querySelectorAll<HTMLButtonElement>('[data-frame]')].entries()){key.dataset.frame=String([.3,2.6,5.7][i]);key.textContent=['Preparazione',prayer?'Palmi uniti':'Tocco al mento','Rilascio'][i];}
}
if(editorial){
 document.querySelector('h1')!.textContent='Dal testo al gesto · prova muta';
 button.textContent='Avvia gli 8 secondi';
 document.querySelector('#description')!.textContent='Il copione contiene mood e intenzione, senza nominare mani o pose. Il planner sceglie il movimento; lo stesso intento può produrre un altro gesto o quiete in una sequenza diversa.';
 const score=document.createElement('pre');score.style.cssText='white-space:pre-wrap;background:#edf0f2;border-radius:8px;padding:16px;font-size:14px;line-height:1.5';
 score.textContent=JSON.stringify(editorial,null,2);canvas.before(score);
 document.querySelector<HTMLAnchorElement>('#mp4')!.href='hands-editorial-'+semanticIntent+(detail?'-detail':'')+'.mp4';
 if(semanticIntent==='reassure'){const view=document.createElement('a');view.href='index.html?pose=editorial-reassure'+(detail?'':'&detail=1');view.textContent=detail?'Figura intera':'Dettaglio delle dita';document.querySelector('#mp4')!.after(document.createTextNode(' · '),view);}
 for(const [i,key] of [...document.querySelectorAll<HTMLButtonElement>('[data-frame]')].entries()){key.dataset.frame=String([.3,semanticIntent==='reassure'?2.25:2.6,6.5][i]);key.textContent=['Preparazione','Espressione','Quiete'][i];}
}
// The proof is rebuilt in place. Version the video as well as the bundle so
// a previous MP4 in the browser cache cannot disguise a movement revision.
const source=document.querySelector<HTMLScriptElement>('script[src*="preview.js"]'),revision=source?new URL(source.src).searchParams.get('v'):undefined;
if(revision){const link=document.querySelector<HTMLAnchorElement>('#mp4')!,url=new URL(link.href);url.searchParams.set('v',revision);link.href=url.href;}
Object.assign(window,{conclaviaHandProof:{frame,sample:()=>{const hands=pose?adultPresenterHands(pose,posture,'anatomical'):[];return{posture,pose,arms:pose?adultPresenterArms(pose,posture,'anatomical').map((a,i)=>({arm:a,hand:hands[i]})):[]};},duration,score:editorial,plan}});
frame(0,false);requestAnimationFrame(tick);
