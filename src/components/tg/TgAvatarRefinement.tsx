'use client';
import {useEffect,useRef,useState} from 'react';
import {TgPromoRenderer,loadTgPromoAssets,tgPromoFrameAt,type TgPromoSequence} from '@conclavia/avatar-kit/formats/tg';
import {names,planPerformancePhrases,type PodcastEmotion,type PerformanceChoreography} from '@conclavia/avatar-kit/performance';
import {dailyVideoIdentity} from './daily-video-identity';
import {directDailyLaunchMotion} from './daily-launch-motion';
import {TgNavigation} from './TgNavigation';
import styles from './TgAvatarRefinement.module.css';

const source='/daily-launch/revisions/avatar-refined-presence-20261023';
type Finish='original'|'shell'|'sculpted';
type Gesture='audio'|'compare'|'fold-hands'|'steeple'|'interlace'|'offer'|'precision'|'reflect'|'point-down'|'point-up'|'explain'|'open';
const gestureLabels:Record<Gesture,string>={audio:'Gesti del copione',compare:'Spiega con entrambe','fold-hands':'Sovrapponi le mani',steeple:'Unisci i polpastrelli',interlace:'Intreccia le dita',offer:'Una mano aperta',precision:'Un dettaglio preciso',reflect:'Rifletti',
 'point-down':'Indica in basso','point-up':'Indice in alto',explain:'Spiega un punto',open:'Apri il discorso'};
type ReviewApi={frame:(time:number,capture?:boolean)=>string;sample:()=>unknown;duration:number};
declare global {interface Window{conclaviaAvatarReview?:ReviewApi}}
/** Product review only: one cached take, one clock and the canonical shared rig. */
export function TgAvatarRefinement(){
 const canvas=useRef<HTMLCanvasElement>(null),audio=useRef<HTMLAudioElement>(null),draw=useRef<(t:number,capture?:boolean)=>string>(()=>'');
 const clock=useRef<number|null>(null),mood=useRef<PodcastEmotion|'audio'>('audio'),gesture=useRef<Gesture>('audio'),reset=useRef(()=>{});
 const [posture,setPosture]=useState<'standing'|'desk'>('standing');
 const [finish,setFinish]=useState<Finish>('sculpted'),[portrait,setPortrait]=useState(false),[loaded,setLoaded]=useState(''),[error,setError]=useState('');
 const [sequence,setSequence]=useState<TgPromoSequence>(),[playing,setPlaying]=useState(false),[time,setTime]=useState(0),[emotion,setEmotion]=useState<PodcastEmotion|'audio'>('audio');
 const [movement,setMovement]=useState<Gesture>('audio');
 const ready=loaded===finish+':'+portrait+':'+posture;
 useEffect(()=>{const mediaFrame=requestAnimationFrame(()=>setPortrait(matchMedia('(max-width:700px)').matches)),controller=new AbortController();
  void fetch(source+'/manifest.json',{signal:controller.signal}).then(r=>{if(!r.ok)throw Error('Prova non disponibile');return r.json();}).then(s=>{if(!controller.signal.aborted)setSequence(s);}).catch(()=>{if(!controller.signal.aborted)setError('La prova non è disponibile.');});return()=>{cancelAnimationFrame(mediaFrame);controller.abort();};
 },[]);
 useEffect(()=>{mood.current=emotion;if(audio.current?.paused)reset.current();draw.current(clock.current??audio.current?.currentTime??0);},[emotion]);
 useEffect(()=>{
  const element=canvas.current;if(!element||!sequence)return;
  let stopped=false,raf=0,renderer:TgPromoRenderer|undefined,report:unknown,lastDrawn:number|undefined;
  element.width=portrait?1080:1920;element.height=portrait?1920:1080;
  const candidate={finish:'sculpted' as const,posture,handStyle:finish==='sculpted'?'anatomical' as const:finish==='shell'?'shell' as const:undefined};
  const config={...dailyVideoIdentity,palette:{...dailyVideoIdentity.palette,...candidate},secondaryPalette:dailyVideoIdentity.secondaryPalette?{...dailyVideoIdentity.secondaryPalette,...candidate}:undefined};
  const rehearsal=structuredClone(sequence);
  // Rehearse the same approved take under another posture; never mutate
  // the frozen published motion plan while comparing the seated direction.
  if(posture==='desk'){
   for(const cue of rehearsal.cues){delete cue.choreography;delete cue.performanceWindow;}
   for(const scene of rehearsal.scenes)for(const turn of scene.turns??[])delete turn.choreography;
  }
  const directed=directDailyLaunchMotion(rehearsal,{posture});
  const deliveryVitality=sequence.cues.find(c=>c.choreography?.vitality)?.choreography?.vitality??0;
  const moodPlans=Object.fromEntries((Object.keys(names) as PodcastEmotion[]).map(m=>[m,
   planPerformancePhrases([{cueId:'mood-rehearsal:'+m,mood:m,durationSeconds:sequence.duration,intensity:.84}],
    {seed:'avatar-mood-rehearsal',actorId:'Alex',articulated:true,vitality:deliveryVitality,phrasing:'connected'})[0]])) as Record<PodcastEmotion,PerformanceChoreography>;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  draw.current=(t,capture=false)=>{
   if(!renderer)return '';const frame=tgPromoFrameAt(directed,t,portrait),override=mood.current,move=gesture.current;
   if(override!=='audio'){
    frame.scene={...frame.scene,id:'avatar-rehearsal',kind:'host',lines:[names[override]],kicker:'PROVA DELLE ESPRESSIONI'};
    frame.progress=1;frame.speaker={...frame.speaker,emotion:override,intensity:.84,performance:{...frame.speaker.performance,
     cueId:'mood-rehearsal:'+override,progress:Math.min(1,t/sequence.duration),durationSeconds:sequence.duration,choreography:moodPlans[override]}};frame.conversation=undefined;
   }
   if(move!=='audio'){
    const contact=move==='interlace'||move==='steeple'||move==='fold-hands';
    const choreography:PerformanceChoreography={version:1,key:'avatar-two-hands:'+move,durationSeconds:8,stance:.2,energy:1,articulation:'spine',phrasing:'connected',restPose:.35,vitality:deliveryVitality,
     strokes:[{kind:contact?'fold-hands':move,contact:move==='interlace'?'interlace':move==='steeple'?'steeple':contact?'overlap':undefined,hand:move==='offer'||move==='precision'||move==='point-down'||move==='point-up'||move==='reflect'?1:0,start:.4,apex:contact?2.1:1.35,hold:contact?1.4:.9,end:contact?5.2:4.6,strength:1,variant:.8}]};
    frame.scene={...frame.scene,id:'hands-rehearsal',kind:'host',lines:[gestureLabels[move]],kicker:'PROVA DEI GESTI'};
    frame.progress=1;frame.conversation=undefined;
    frame.speaker={...frame.speaker,speaking:true,emotion:override==='audio'?'attention':override,intensity:.84,
     performance:{cueId:'hands-rehearsal',progress:Math.min(1,t/8),durationSeconds:8,choreography}};
   }
   renderer.render(t,frame,reduced.matches);lastDrawn=t;report=renderer.sample();element.dataset.ready='true';element.dataset.finish=finish;element.dataset.mood=override==='audio'?frame.speaker.emotion:override;element.dataset.gesture=move;element.dataset.posture=posture;
   return capture?element.toDataURL('image/png').split(',')[1]:'';
  };
  // A paused media clock holds the rendered pose too: do not rasterize the
  // identical hands sixty times per second while reviewing a still.
  const tick=()=>{if(stopped)return;const t=audio.current?.paused?(clock.current??audio.current.currentTime):audio.current?.currentTime??0;if(t!==lastDrawn){draw.current(t);setTime(t);}raf=requestAnimationFrame(tick);};
  void loadTgPromoAssets(config).then(assets=>{if(stopped)return;renderer=new TgPromoRenderer(element,assets);reset.current=()=>renderer?.reset();setLoaded(finish+':'+portrait+':'+posture);setError('');tick();window.conclaviaAvatarReview={frame(t,capture=true){clock.current=t;setTime(t);return draw.current(t,capture);},sample:()=>report,duration:sequence.duration};}).catch(()=>{if(!stopped)setError('Impossibile caricare lo studio.');});
  return()=>{stopped=true;cancelAnimationFrame(raf);renderer?.dispose();delete window.conclaviaAvatarReview;draw.current=()=>'';};
 },[sequence,finish,portrait,posture]);
 async function toggle(){const a=audio.current;if(!a)return;if(!a.paused){a.pause();return;}if(clock.current!==null){a.currentTime=clock.current;clock.current=null;}if(sequence&&a.currentTime>=sequence.duration-.1)a.currentTime=0;try{await a.play();}catch{setError('Premi nuovamente Play per avviare l’audio.');}}
 function seek(t:number){clock.current=null;if(audio.current)audio.current.currentTime=t;setTime(t);draw.current(t);}
 function chooseMovement(value:Gesture){gesture.current=value;setMovement(value);if(value==='interlace')setPosture('desk');audio.current?.pause();clock.current=0;if(audio.current)audio.current.currentTime=0;reset.current();setTime(0);draw.current(0);}
 function choosePosture(value:'standing'|'desk'){if(value==='standing'&&gesture.current==='interlace')chooseMovement('audio');setPosture(value);}
 return <main className={styles.root}><TgNavigation/><header className={styles.heading}><p>CDaily · Studio del personaggio</p><h1>Alex · prova di movimento.</h1><span>Recitazione più vivace: gesti più pronti, busto e spalle partecipano al discorso, mani più piene anche di profilo. La prova breve resta disponibile per controllare un singolo gesto.</span><p className={styles.exports}><a href="/daily-launch/hand-lab/index.html">Apri la prova rapida delle mani · 6 secondi ↗</a></p></header>
  <div className={styles.toolbar}><div className={styles.segment} aria-label="Postura del personaggio"><button aria-pressed={posture==='standing'} onClick={()=>choosePosture('standing')}>In piedi</button><button aria-pressed={posture==='desk'} onClick={()=>choosePosture('desk')}>Seduto · confronto</button></div><div className={styles.segment} aria-label="Finitura del personaggio"><button aria-pressed={finish==='sculpted'} onClick={()=>setFinish('sculpted')}>Mani rifinite</button><button aria-pressed={finish==='original'} onClick={()=>setFinish('original')}>Versione precedente</button><details><summary>Laboratorio delle mani</summary><div className={styles.segment}><button aria-pressed={finish==='shell'} onClick={()=>setFinish('shell')}>Gusci · prova scartata</button></div></details></div><div className={styles.segment} aria-label="Formato video"><button aria-pressed={!portrait} onClick={()=>setPortrait(false)}>16:9</button><button aria-pressed={portrait} onClick={()=>setPortrait(true)}>9:16</button></div></div>
  <div className={`${styles.viewport} ${portrait?styles.portrait:''}`}><canvas ref={canvas} aria-label="Alex animato nello studio CDaily"/>{!ready&&!error&&<p>Preparazione dello studio…</p>}</div>
  <audio ref={audio} src={source+'/audio.wav'} preload="metadata" onPlay={()=>{clock.current=null;setPlaying(true);}} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)}/>
  <div className={styles.playback}><button onClick={()=>void toggle()} disabled={!ready}>{playing?'Pausa':'Avvia prova'}</button><label>Posizione<input aria-label="Posizione della prova avatar" type="range" min="0" max={sequence?.duration??36.88} step=".01" value={time} onChange={e=>seek(Number(e.target.value))}/></label><output>{time.toFixed(1)} / {sequence?.duration.toFixed(1)??'—'} s</output></div>
  <details className={styles.moods}><summary>Prova le otto espressioni</summary><p>Il mood guida volto e corpo. La registrazione rimane la stessa, per valutare il disegno, i gesti e le transizioni.</p><div className={styles.segment}><button aria-pressed={emotion==='audio'} onClick={()=>setEmotion('audio')}>Segue il copione</button>{(Object.keys(names) as PodcastEmotion[]).map(m=><button key={m} aria-pressed={emotion===m} onClick={()=>setEmotion(m)}>{names[m]}</button>)}</div></details>
  <details className={styles.moods}><summary>Prova le pose delle mani</summary><p>Scegli una prova, poi premi Avvia prova: il movimento dura otto secondi, con ingresso e rilascio. I gesti si possono confrontare su tutte e tre le versioni. La voce rimane il take esistente.</p><div className={styles.segment}>{(Object.entries(gestureLabels) as [Gesture,string][]).map(([value,label])=><button key={value} aria-pressed={movement===value} onClick={()=>chooseMovement(value)}>{label}</button>)}</div></details>
  <p className={styles.note}>Revisione completa · voce originale Alex 2. Gesti raccordati alle parole, spalle e busto partecipano. L’intreccio è riservato alle scene da seduto. I file sotto sono gli export di questa revisione.</p>
  {sequence?.mediaVersion&&<p className={styles.exports}>Video completo aggiornato: <a href={`${source}/portrait.mp4?v=${sequence.mediaVersion}`} target="_blank" rel="noopener">Verticale 9:16 ↗</a><a href={`${source}/landscape.mp4?v=${sequence.mediaVersion}`} target="_blank" rel="noopener">Orizzontale 16:9 ↗</a></p>}
  <p className={styles.exports}><a href="/daily-launch/revisions/avatar-refined-presence-20261023/index.html">Guarda la presentazione completa nei due formati ↗</a></p>
  {error&&<p role="alert">{error}</p>}
 </main>;
}
