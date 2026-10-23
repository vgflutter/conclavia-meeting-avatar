'use client';
import {useEffect,useRef,useState} from 'react';
import {TgStudioRenderer,loadTgStudioAssets,type TgFrame} from '@conclavia/avatar-kit/formats/tg';
import {names,type PodcastEmotion,type PodcastSpeaker} from '@conclavia/avatar-kit/performance';
import {audioLipSyncAt,type AudioLipSync} from '@conclavia/avatar-kit/speech';
import {presenterDesigns,type PresenterDesign} from '@conclavia/avatar-kit/characters/robot';
import Link from 'next/link';
import {dailyStudioConfig,dailyStudioForDesign} from './daily-studio-theme';
import {TgNavigation} from './TgNavigation';
import styles from './TgPerformancePreview.module.css';

type Cue={id:string;mood:PodcastEmotion;label:string;text:string;start:number;end:number;lips:AudioLipSync};
type Sequence={duration:number;voice:string;audioUrl?:string;cues:Cue[]};
type Voice={id:string;label:string;provider:string;sequenceUrl:string};
type ReviewApi={frame:(time:number,capture?:boolean)=>string;sample:()=>unknown;duration:number};
declare global{interface Window{conclaviaActorReview?:ReviewApi}}
const titles:Record<PodcastEmotion,string>={attention:'I fatti, prima delle opinioni.',curiosity:'La domanda che conta.',doubt:'Prima di concludere, verifichiamo.',agreement:'Un punto su cui costruire.',amusement:'Spazio anche alle buone notizie.',empathy:'Prima di tutto, le persone.',disagreement:'Punti di vista da mettere alla prova.',surprise:'Quando cambia la prospettiva.'};
const completeMoods:PodcastEmotion[]=['attention','curiosity','doubt','agreement','amusement','empathy','disagreement','surprise'];
function reviewAt(time:number,duration:number){const seconds=Math.min(32,Math.max(1,duration-4)),slot=seconds/8,index=Math.min(7,Math.floor(time/slot));return {mood:time>=seconds?'attention' as const:completeMoods[index],index,slot,progress:time>=seconds?Math.min(1,(time-seconds)/4):(time-index*slot)/slot,listening:time>=seconds};}

const proposals:Record<PresenterDesign,{name:string;description:string}>={
 'editorial-human':{name:'01 · Ritratto editoriale',description:'Volti umani adulti, luce morbida, disegno pittorico.'},
 porcelain:{name:'02 · Ceramica viva',description:'AI dichiarata, volto minerale chiaro e proporzioni umane.'},
 'graphic-novel':{name:'03 · Inchiostro',description:'Graphic novel per adulti, segni selettivi e piani di luce.'},
 synthetic:{name:'04 · Sintesi',description:'Superfici architettoniche e costruzione industriale discreta.'},
 hybrid:{name:'06 · Umanoide',description:'Volto espressivo, materiali chiari e struttura sintetica riconoscibile.'},
 print:{name:'05 · Stampa',description:'Illustrazione editoriale, colori piani e texture sobrie.'},
};
export function TgPerformancePreview({comparison=false}:{comparison?:boolean}){
 const mount=useRef<HTMLDivElement>(null),audio=useRef<HTMLAudioElement>(null),data=useRef<Sequence|null>(null),draw=useRef<(t:number,capture?:boolean)=>string>(()=>'');
 const reviewClock=useRef<number|null>(null);
 const controls=useRef<{mood:PodcastEmotion|'audio';duo:boolean;complete:boolean}>({mood:'audio',duo:false,complete:false}),reset=useRef(()=>{});
 const [sequence,setSequence]=useState<Sequence|null>(null),[ready,setReady]=useState(false),[error,setError]=useState('');
 const [playing,setPlaying]=useState(false),[time,setTime]=useState(0),[portrait,setPortrait]=useState(false);
 const [complete,setComplete]=useState(false);
 const [voices,setVoices]=useState<Voice[]>([]),[voiceId,setVoiceId]=useState(''),[sequenceUrl,setSequenceUrl]=useState('/daily-performance/sequence.json');
 const [design,setDesign]=useState<PresenterDesign>(dailyStudioConfig.palette.design??'porcelain'),[mood,setMood]=useState<PodcastEmotion|'audio'>('audio'),[duo,setDuo]=useState(false),[identity,setIdentity]=useState<0|1>(0);
 const current=sequence?.cues.find(c=>time>=c.start&&time<c.end)??[...(sequence?.cues??[])].reverse().find(c=>time>=c.start);
 useEffect(()=>{controls.current={mood,duo,complete};if(audio.current?.paused)reset.current();draw.current(reviewClock.current??audio.current?.currentTime??0);},[mood,duo,complete]);
 useEffect(()=>{const controller=new AbortController();void fetch('/daily-performance/voices/catalog.json',{signal:controller.signal}).then(r=>r.ok?r.json():null).then(v=>{if(v&&!controller.signal.aborted){setVoices(v.voices);setVoiceId(v.defaultId);}}).catch(()=>undefined);return()=>controller.abort();},[]);
 useEffect(()=>{const controller=new AbortController();data.current=null;
  void fetch(sequenceUrl,{signal:controller.signal}).then(r=>{if(!r.ok)throw Error('Sequenza non disponibile');return r.json();}).then((s:Sequence)=>{if(controller.signal.aborted)return;data.current=s;setSequence(s);setTime(0);setError('');draw.current(0);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();
 },[sequenceUrl]);
 useEffect(()=>{
  const element=mount.current;if(!element)return;const canvas=document.createElement('canvas');element.append(canvas);
  let renderer:TgStudioRenderer|undefined,stopped=false,raf=0,last=0,report:unknown;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  function resize(){const {width,height}=element!.getBoundingClientRect();if(!width||!height)return;const ratio=Math.min(2,devicePixelRatio);const w=Math.round(width*ratio),h=Math.round(height*ratio);if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;draw.current(reviewClock.current??audio.current?.currentTime??0);}
  draw.current=(seconds:number,capture=false)=>{
   if(!renderer)return '';const s=data.current,cue=s?.cues.find(c=>seconds>=c.start&&seconds<c.end),prior=cue??[...(s?.cues??[])].reverse().find(c=>seconds>=c.start);
   const lips=cue?audioLipSyncAt(cue.lips,seconds-cue.start):{viseme:'rest',level:0};
   const duration=cue?cue.end-cue.start:Math.max(1,(s?.duration??36)-(prior?.end??0));
   const control=controls.current,review=reviewAt(seconds,s?.duration??36),progress=control.complete?review.progress:cue?(seconds-cue.start)/duration:Math.min(1,(seconds-(prior?.end??0))/duration),emotion=control.complete?review.mood:control.mood==='audio'?(prior?.mood??'attention'):control.mood;
   const speaking=Boolean(cue)&&!(control.complete&&review.listening);
   const speaker:PodcastSpeaker={name:s?.voice.split(' · ').at(-1)??'Daily',emotion,intensity:.84,speaking,viseme:lips.viseme,audioLevel:lips.level,performance:{cueId:control.complete?'review-'+review.index:cue?.id??'listening',progress,durationSeconds:control.complete?review.slot:duration,listening:!speaking,gaze:'camera',phase:progress<.15?'anticipation':progress>.82?'settle':'delivery'}};
   const frame:TgFrame={brand:'Conclavia Daily',edition:'Italia',date:'PROVA VOCALE',demo:true,headline:titles[emotion],context:'Una prova di voce ed espressioni. Stesse frasi per confrontare i timbri, senza notizie reali.',change:'',caption:cue?.text,sources:[],story:Math.max(1,(s?.cues.indexOf(cue??prior!)??0)+1),totalStories:s?.cues.length??1,seconds,duration:s?.duration??36,portrait:canvas.width/canvas.height<1,speakers:control.duo?[speaker,{...speaker,name:'Orietta',speaking:false,viseme:'rest',audioLevel:0,performance:{...speaker.performance!,listening:true,gaze:'partner',gazeDirection:-1}}]:[speaker]};
   renderer.render(seconds,frame,motion.matches);const sample=renderer.sample();report=sample?.actors[0]?{...sample.actors[0],layout:sample.layout,headWidth:sample.headWidth,design:sample.design,visibleActors:sample.visibleActors,actorCount:sample.actors.length}:undefined;
   last=seconds;element!.dataset.ready='true';element!.dataset.design=design;element!.dataset.identity=String(comparison?identity:voiceId==='orietta'?1:0);element!.dataset.count=String(frame.speakers.length);element!.dataset.renderer='robot-2d';element!.dataset.stage='daily-studio';element!.dataset.mood=emotion;element!.dataset.speaking=String(speaking);element!.dataset.viseme=lips.viseme;element!.dataset.mode=control.complete?'complete':'voice';
   return capture?canvas.toDataURL('image/png').split(',')[1]:'';
  };
  const observer=new ResizeObserver(resize);observer.observe(element);resize();
  // Offline frame review supplies a media timestamp without queueing hundreds
  // of browser audio seeks. Playback joins that timestamp with one real seek.
  window.conclaviaActorReview={frame(t,capture=true){reviewClock.current=t;setTime(t);return draw.current(t,capture);},sample:()=>report,get duration(){return data.current?.duration??0;}};
  const tick=()=>{if(stopped)return;const t=audio.current?.paused?(reviewClock.current??audio.current.currentTime):audio.current?.currentTime??last;draw.current(t);setTime(t);raf=requestAnimationFrame(tick);};
  setReady(false);element.dataset.ready='false';
  const base=dailyStudioForDesign(design),who=comparison?identity:voiceId==='orietta'?1 as const:0 as const;
  const config={...base,palette:{...(who===1?base.secondaryPalette!:base.palette),identity:who}};
  void loadTgStudioAssets(config).then(assets=>{if(stopped)return;renderer=new TgStudioRenderer(canvas,assets);reset.current=()=>renderer?.reset();resize();setReady(true);tick();}).catch(()=>{if(!stopped)setError('Studio non disponibile per questa prova.');});
  return()=>{stopped=true;cancelAnimationFrame(raf);observer.disconnect();delete window.conclaviaActorReview;draw.current=()=>'';renderer?.dispose();canvas.remove();};
 },[design,identity,voiceId,comparison]);
 async function toggle(){if(!audio.current)return;if(playing){audio.current.pause();return;}try{if(reviewClock.current!==null){audio.current.currentTime=reviewClock.current;reviewClock.current=null;}if(sequence&&audio.current.currentTime>=sequence.duration-.1)audio.current.currentTime=0;await audio.current.play();}catch{setError('Premi nuovamente Play per avviare l’audio.');}}
 function seek(t:number){reviewClock.current=null;if(audio.current){audio.current.currentTime=t;draw.current(t);setTime(t);}}
 function changeVoice(v:Voice){reviewClock.current=null;audio.current?.pause();if(audio.current)audio.current.currentTime=0;setVoiceId(v.id);setSequence(null);setTime(0);setSequenceUrl(v.sequenceUrl);}
 function changeMode(value:boolean){reviewClock.current=null;audio.current?.pause();if(audio.current)audio.current.currentTime=0;setTime(0);setMood('audio');setComplete(value);reset.current();}
 return <div className={styles.root}><TgNavigation/><header className={styles.heading}><div><p>CONCLAVIA DAILY / {comparison?'CONFRONTO DEI CARATTERI':'PROVA DI CONDUZIONE'}</p><h1>{comparison?'Sei direzioni, una stessa prova.':'Una presenza da notiziario.'}</h1><span>Un conduttore AI adulto, un volto espressivo e gesti articolati. Confronta le espressioni anche nel formato verticale.</span>{!comparison&&<Link href="/podcast/tg/proposte">Confronta le proposte animate →</Link>}</div><button type="button" onClick={()=>setPortrait(v=>!v)}>{portrait?'Formato 16:9':'Formato 9:16'}</button></header>
  {comparison&&<section className={styles.designChoice} aria-label="Proposte grafiche"><p className={styles.note}><strong>Nuova direzione Daily: 06 · Umanoide.</strong> Una presenza AI con tratti ed espressioni umani, materiali chiari e dettagli sintetici. Qui puoi confrontare tutte le alternative sullo stesso parlato.</p><div className={styles.designs}>{presenterDesigns.map(d=><button key={d} type="button" aria-pressed={design===d} onClick={()=>setDesign(d)}><strong>{proposals[d].name}</strong><span>{proposals[d].description}</span></button>)}</div><div className={styles.reviewControls}><label>Espressione<select aria-label="Espressione della proposta" value={mood} onChange={e=>{setComplete(false);setMood(e.target.value as PodcastEmotion|'audio');}}><option value="audio">Segue la frase</option>{Object.entries(names).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label><label>Inquadratura<select aria-label="Inquadratura della proposta" value={duo?'duo':String(identity)} onChange={e=>{setDuo(e.target.value==='duo');setIdentity(e.target.value==='duo'?0:Number(e.target.value) as 0|1);}}><option value="0">Primo conduttore</option><option value="1">Seconda conduttrice</option><option value="duo">In due, con ascolto</option></select></label></div></section>}
  {voices.length>0&&<section className={styles.voiceChoice} aria-label="Confronto voci"><div><strong>Ascolta le voci sullo stesso testo</strong><p>La scelta cambia questa prova. Le edizioni già prodotte conservano la loro voce.</p></div><div className={styles.cues}>{voices.map(v=><button key={v.id} type="button" aria-pressed={voiceId===v.id} onClick={()=>changeVoice(v)}>{v.label}<span>{v.provider}</span></button>)}</div></section>}
  <section className={styles.testMode} aria-label="Tipo di prova"><div className={styles.cues}><button type="button" aria-pressed={!complete} onClick={()=>changeMode(false)}>Voce e conduzione</button><button type="button" aria-pressed={complete} onClick={()=>changeMode(true)}>Test completo · 8 mood</button></div><p>{complete?'Gli otto mood si susseguono e tornano all’ascolto. La voce resta quella della prova: qui confrontiamo espressioni, gesti e transizioni.':'Il carattere e i gesti seguono le frasi della prova vocale.'}</p></section>
  <section className={`${styles.viewport} ${portrait?styles.portrait:''}`} data-testid="actor-viewport"><div ref={mount} className={styles.canvas} role="img" aria-label="Conduttore digitale animato nello studio TG"/>{!ready&&!error&&<p className={styles.loading}>Preparazione dello studio…</p>}</section>
  <audio ref={audio} src={sequence?(sequence.audioUrl??'/daily-performance/nicola.wav'):undefined} preload="metadata" onPlay={()=>{reviewClock.current=null;setPlaying(true);}} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)}/>
  <div className={styles.controls}><button type="button" onClick={()=>void toggle()} disabled={!ready||!sequence}>{playing?'Pausa':'Avvia prova'}</button><button type="button" onClick={()=>{audio.current?.pause();seek(0);}}>Ricomincia</button><label>Posizione<input aria-label="Posizione nella prova" type="range" min="0" max={sequence?.duration??36} step=".01" value={time} onChange={e=>seek(Number(e.target.value))}/></label><output>{time.toFixed(1)} / {sequence?.duration.toFixed(1)??'—'} s</output></div>
  <p className={styles.note}>Espressione: <strong>{complete?(reviewAt(time,sequence?.duration??36).listening?'Ascolto':names[reviewAt(time,sequence?.duration??36).mood]):mood==='audio'?(current?names[current.mood]:'Attenzione'):names[mood]}</strong> · Voce: {sequence?.voice??'Caricamento…'}</p>
  <div className={styles.cues}>{complete?completeMoods.map((m,i)=>{const start=i*reviewAt(0,sequence?.duration??36).slot;return <button type="button" key={m} aria-pressed={!reviewAt(time,sequence?.duration??36).listening&&reviewAt(time,sequence?.duration??36).index===i} onClick={()=>{audio.current?.pause();seek(start+1.5);}}>{names[m]}<span>{start.toFixed(1)} s</span></button>;}):sequence?.cues.map(c=><button type="button" aria-pressed={current?.id===c.id} key={c.id} onClick={()=>{audio.current?.pause();seek(c.start+Math.min(1,(c.end-c.start)*.4));}}>{c.label}<span>{c.start.toFixed(1)} s</span></button>)}</div>
  {error&&<p role="alert" className={styles.error}>{error}</p>}
  <p className={styles.note}>Testo dimostrativo originale, senza notizie reali. Il mood guida volto e corpo; il labiale segue il PCM con allineamento approssimato. Lo studio e il personaggio sono gli stessi del renderer delle puntate.</p>
 </div>;
}
