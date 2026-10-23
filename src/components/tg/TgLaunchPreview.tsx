'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import type {TgPromoSequence} from '@conclavia/avatar-kit/formats/tg';
import {names} from '@conclavia/avatar-kit/performance';
import {TgNavigation} from './TgNavigation';
import styles from './TgLaunchPreview.module.css';
const mediaRoot='/daily-launch/revisions/avatar-refined-presence-20261023';
export function TgLaunchPreview(){
 const [format,setFormat]=useState<'portrait'|'landscape'>('portrait'),[sequence,setSequence]=useState<TgPromoSequence|null>(null),[time,setTime]=useState(0),[error,setError]=useState('');
 const media=useRef<HTMLVideoElement>(null),head=useRef(0),resume=useRef(false),muted=useRef(false),volume=useRef(1);
 useEffect(()=>{const controller=new AbortController();void fetch(mediaRoot+'/manifest.json',{signal:controller.signal,cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(setSequence).catch(()=>{if(!controller.signal.aborted)setError('La presentazione è ancora in preparazione.');});return()=>controller.abort();},[]);
 function changeFormat(value:typeof format){if(value===format)return;head.current=media.current?.currentTime??0;resume.current=media.current?!media.current.paused:false;muted.current=media.current?.muted??false;volume.current=media.current?.volume??1;setFormat(value);}
 const scene=sequence?.scenes.find(s=>time>=s.start&&time<s.end);
 const cue=sequence?.cues.find(c=>time>=c.start&&time<c.end);
 function seek(at:number){if(media.current){media.current.currentTime=at;head.current=at;setTime(at);media.current.scrollIntoView({block:'center',behavior:'auto'});}}
 const revision=sequence?.mediaVersion?'?v='+encodeURIComponent(sequence.mediaVersion):'';
 return <main className={styles.root}>
  <TgNavigation/>
  <header className={styles.header}><p>CDAILY / UN PROGETTO CONCLAVIA</p><h1>Meno rumore.<br/><em>Più contesto.</em></h1><p>La presentazione del progetto. Un master pulito, con sottotitoli attivabili e scaricabili separatamente.</p><span className={styles.draft}>NUOVA RECITAZIONE · REVISIONE LOCALE</span></header>
  <p><a href="https://daily.conclavia.me/presentazione/" target="_blank" rel="noreferrer">Guarda la presentazione sul sito pubblico →</a></p>
  <p><Link href="/podcast/tg/presentazione/prove">Guarda i tre nuovi video pilota →</Link></p>
  {error&&<p role="status">{error}</p>}
  <section className={styles.review} aria-label="Anteprima del video di presentazione">
   <div className={styles.stage}>
    <div className={styles.formats} aria-label="Formato della presentazione"><button onClick={()=>changeFormat('portrait')} aria-pressed={format==='portrait'}>Reel · 9:16</button><button onClick={()=>changeFormat('landscape')} aria-pressed={format==='landscape'}>YouTube · 16:9</button></div>
    <video ref={media} key={format+revision} className={format==='portrait'?styles.portrait:styles.landscape} controls playsInline preload="metadata" poster={`${mediaRoot}/cover-${format}.jpg${revision}`} src={`${mediaRoot}/${format}.mp4${revision}`} onTimeUpdate={e=>setTime(e.currentTarget.currentTime)} onLoadedMetadata={e=>{if(head.current>0)e.currentTarget.currentTime=head.current;e.currentTarget.muted=muted.current;e.currentTarget.volume=volume.current;if(resume.current)void e.currentTarget.play().catch(()=>{});}}><track kind="captions" src={`${mediaRoot}/captions.vtt${revision}`} srcLang="it" label="Italiano"/><track kind="captions" src={`/daily-launch/captions-en.vtt${revision}`} srcLang="en" label="English"/></video>
    <p className={styles.progress}>{time.toFixed(1)} / {sequence?.duration.toFixed(2)??'—'} s {scene?'· '+scene.kicker:''}</p>
    <p className={styles.intent} data-testid="launch-current-mood">{cue?`Intenzione · ${names[cue.mood]}`:'Pausa · ascolto'}<span>Audio, labiale e recitazione condividono la timeline.</span></p>
   </div>
   <aside className={styles.notes}><h2>Il mondo corre.<br/>Daily fa spazio per capire.</h2><p>Notizie e approfondimenti, raccontati con curiosità e un tono informale. La voce Alex e il conduttore nello studio presentano il progetto e invitano a seguire Conclavia Daily.</p><dl><div><dt>Durata</dt><dd>{sequence?.duration.toFixed(2)??'—'} secondi</dd></div><div><dt>Voce</dt><dd>{sequence?.voice??'—'}</dd></div><div><dt>Versioni</dt><dd>1080 × 1920 e 1920 × 1080</dd></div></dl>
    <div className={styles.downloads}><a href={`${mediaRoot}/portrait.mp4${revision}`} download>Scarica il Reel ↓</a><a href={`${mediaRoot}/landscape.mp4${revision}`} download>Scarica YouTube ↓</a><a href="/daily-launch/caption.txt" download>Testo del post ↓</a><a href={`${mediaRoot}/captions.vtt${revision}`} download>Sottotitoli ↓</a></div>
    {sequence&&<nav className={styles.chapters} aria-label="Scene del video"><h3>Esplora il video</h3>{sequence.scenes.map((s,i)=><button key={s.id} aria-current={scene?.id===s.id?'step':undefined} onClick={()=>seek(s.start+Math.min(.75,(s.end-s.start)*.5))}><time>{s.start.toFixed(1)} s</time><span>{['L’apertura','Il progetto','Il conduttore','Le due edizioni','La redazione AI','Due avatar, un approfondimento','Segui Daily'][i]??s.kicker}</span></button>)}</nav>}
    <p className={styles.small}>Presentatore e voce AI. La scena a due avatar è un’anteprima del format con la narrazione Alex. Nessun invio ai social o campagna pubblicitaria avviata.</p><Link href="/podcast/tg/redazione">Apri palinsesto e redazione →</Link>
   </aside>
  </section>
  {sequence&&<details className={styles.script}><summary>Leggi il copione</summary>{sequence.cues.map((cue,i)=><button key={i} onClick={()=>seek(cue.start)}><time>{cue.start.toFixed(1)} s</time>{cue.text}</button>)}</details>}
 </main>;
}
