'use client';

import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import type {TgPromoSequence} from '@conclavia/avatar-kit/formats/tg';
import {names} from '@conclavia/avatar-kit/performance';
import {creativePilots,type CreativePilotId} from './daily-creative-pilots';
import {TgNavigation} from './TgNavigation';
import styles from './TgCreativePilots.module.css';

type Format='portrait'|'landscape';
export function TgCreativePilots(){
 const [selected,setSelected]=useState<CreativePilotId>('dato'),[format,setFormat]=useState<Format>('portrait');
 const [sequences,setSequences]=useState<Partial<Record<CreativePilotId,TgPromoSequence>>>({}),[error,setError]=useState(''),[time,setTime]=useState(0);
 const media=useRef<HTMLVideoElement>(null),head=useRef(0),resume=useRef(false),mute=useRef(false),volume=useRef(1);
 useEffect(()=>{const controller=new AbortController();void Promise.all(creativePilots.map(async p=>{const response=await fetch(`/daily-launch/pilots/${p.id}/manifest.json`,{signal:controller.signal,cache:'no-store'});if(!response.ok)throw Error();return [p.id,await response.json()] as const;})).then(entries=>setSequences(Object.fromEntries(entries))).catch(()=>{if(!controller.signal.aborted)setError('Non riesco a caricare tutte le prove. Ricarica la pagina per riprovare.');});return()=>controller.abort();},[]);
 const pilot=creativePilots.find(p=>p.id===selected)!,sequence=sequences[selected];
 const root=`/daily-launch/pilots/${selected}`,revision=sequence?.mediaVersion?`?v=${encodeURIComponent(sequence.mediaVersion)}`:'';
 const cue=sequence?.cues.find(c=>time>=c.start&&time<c.end),scene=sequence?.scenes.find(s=>time>=s.start&&time<s.end);
 function remember(){mute.current=media.current?.muted??false;volume.current=media.current?.volume??1;}
 function choose(id:CreativePilotId){if(id===selected)return;remember();media.current?.pause();head.current=0;resume.current=false;setTime(0);setSelected(id);}
 function changeFormat(value:Format){if(value===format)return;remember();head.current=media.current?.currentTime??0;resume.current=media.current?!media.current.paused:false;setFormat(value);}
 function seek(at:number){if(media.current){media.current.currentTime=at;head.current=at;setTime(at);}}
 return <main className={styles.root}>
  <TgNavigation/>
  <header className={styles.header}><p>CONCLAVIA DAILY / LABORATORIO CREATIVO</p><h1>Tre modi di<br/><em>farsi seguire.</em></h1><p>Tre video completi, tre intenzioni diverse. La stessa identità, la voce Alex e una seconda interlocutrice per mettere alla prova il dialogo.</p><span className={styles.draft}>PILOTI · NON PUBBLICATI · NESSUNA CAMPAGNA ATTIVA</span></header>
  {error&&<p role="alert">{error}</p>}
  <nav className={styles.cards} aria-label="Scegli un video pilota">{creativePilots.map((p,i)=>{
   const s=sequences[p.id],v=s?.mediaVersion?`?v=${encodeURIComponent(s.mediaVersion)}`:'';
   return <button key={p.id} onClick={()=>choose(p.id)} aria-pressed={selected===p.id}>
    <span className={styles.number}>0{i+1}</span><strong>{p.format}</strong><span>{p.title}</span><small>{s?`${s.duration.toFixed(1)} s`:'In caricamento'} · {p.voices.length===2?'Due voci':'Alex'}</small>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {s&&<img src={`/daily-launch/pilots/${p.id}/cover-portrait.jpg${v}`} alt="" width={92} height={164}/>}
   </button>;
  })}</nav>
  <section className={styles.review} aria-label="Visione e confronto dei piloti">
   <div className={styles.stage}>
    <div className={styles.formats} aria-label="Formato del video"><button aria-pressed={format==='portrait'} onClick={()=>changeFormat('portrait')}>Reel · 9:16</button><button aria-pressed={format==='landscape'} onClick={()=>changeFormat('landscape')}>YouTube · 16:9</button></div>
    {sequence&&<video key={selected+format+revision} ref={media} className={format==='portrait'?styles.portrait:styles.landscape} controls playsInline preload="metadata" poster={`${root}/cover-${format}.jpg${revision}`} src={`${root}/${format}.mp4${revision}`} onTimeUpdate={e=>setTime(e.currentTarget.currentTime)} onLoadedMetadata={e=>{if(head.current>0)e.currentTarget.currentTime=head.current;e.currentTarget.muted=mute.current;e.currentTarget.volume=volume.current;if(resume.current)void e.currentTarget.play().catch(()=>{});}}/>}
    <p className={styles.progress}>{time.toFixed(1)} / {sequence?.duration.toFixed(2)??'—'} s · {scene?.kicker??pilot.format}</p>
    <p className={styles.intent} data-testid="pilot-current-mood">{cue?`${selected==='confronto'?(cue.speaker===1?'Roberta':'Alex')+' · ':''}${names[cue.mood]}`:'Pausa · ascolto'}<span>Parole, labiale e gesti seguono la registrazione. Il cambio di formato conserva il punto di visione.</span></p>
   </div>
   <aside className={styles.notes}><p className={styles.eyebrow}>PROVA {creativePilots.indexOf(pilot)+1} / 3</p><h2>{pilot.title}</h2><p>{pilot.hypothesis}</p>
    <dl><div><dt>Durata</dt><dd>{sequence?.duration.toFixed(2)??'—'} secondi</dd></div><div><dt>Voci</dt><dd>{pilot.voices.join(' + ')}</dd></div><div><dt>Recitazione</dt><dd>{sequence?new Set(sequence.cues.map(c=>c.mood)).size:'—'} intenzioni · transizioni di viso e corpo</dd></div></dl>
    {selected==='dato'?<p className={styles.verdict}><strong>Da cui partire</strong>Un contenuto utile prima della presentazione del marchio. Il dato e il suo limite danno una ragione concreta per seguire Daily.</p>:selected==='confronto'?<p className={styles.verdict}><strong>La direzione da sviluppare</strong>Il secondo avatar mette alla prova la lettura del primo. Domande brevi, fonte comune e nessuna polemica costruita.</p>:<p className={styles.verdict}><strong>Da fissare sul profilo</strong>Una promessa editoriale riconoscibile: seguire ciò che cambia e rendere visibili le correzioni. È una presentazione del progetto.</p>}
    <div className={styles.downloads}><a href={`${root}/portrait.mp4${revision}`} download>Scarica il Reel ↓</a><a href={`${root}/landscape.mp4${revision}`} download>Scarica YouTube ↓</a><a href={`${root}/caption.txt`} download>Testo del post ↓</a><a href={`${root}/captions.vtt`} download>Sottotitoli ↓</a></div>
    {pilot.sources.length>0&&<div className={styles.sources}><h3>La fonte, con la data</h3>{pilot.sources.map(s=><a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.label} · 20 maggio 2025 ↗</a>)}<p>Approfondimento su uno studio del 2025. Questo pilota non è un notiziario di oggi.</p></div>}
    <p className={styles.small}>Presentatori e voci AI. La revisione AI autonoma e la pubblicazione quotidiana restano un percorso da validare. Questi video non misurano ancora l’interesse del pubblico.</p>
   </aside>
  </section>
  {sequence&&<nav className={styles.chapters} aria-label="Scene del pilota">{sequence.scenes.map(s=><button key={s.id} aria-current={scene?.id===s.id?'step':undefined} onClick={()=>seek(s.start+Math.min(.75,(s.end-s.start)*.5))}><time>{s.start.toFixed(1)} s</time><span>{s.kicker}</span></button>)}</nav>}
  {sequence&&<details className={styles.script}><summary>Copione e intenzioni</summary>{sequence.cues.map((c,i)=><button key={i} onClick={()=>seek(c.start)}><time>{c.start.toFixed(1)} s</time><span><small>{names[c.mood]}</small>{c.text}</span></button>)}</details>}
  <footer className={styles.footer}><p>La prossima misura è reale: quanto si guarda, che cosa si salva e quanti tornano. Nessuna stima di follower inventata.</p><Link href="/podcast/tg/presentazione">Presentazione originale →</Link><Link href="/podcast/tg/redazione">Palinsesto e redazione →</Link></footer>
 </main>;
}
