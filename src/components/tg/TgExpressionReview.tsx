'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {TgStudioRenderer, loadTgStudioAssets} from '@conclavia/avatar-kit/formats/tg';
import {dailyStudioConfig} from './daily-studio-theme';
import {TgNavigation} from './TgNavigation';
import {expressionStates, expressionNames, expressionDetails, bodyDetails, expressionPairs, expressionTiming, expressionReviewFrame, type ExpressionState} from './expression-review';
import styles from './TgExpressionReview.module.css';

type Pair = {from: ExpressionState; to: ExpressionState};
type ReviewApi = {frame: (time: number, capture?: boolean) => string; selectPair: (from: ExpressionState, to: ExpressionState) => void; sample: () => unknown; duration: number};
declare global {interface Window {conclaviaExpressionReview?: ReviewApi}}

export function TgExpressionReview() {
  const framing=useRef<'face'|'body'>('face');
  const [view,setView]=useState<'face'|'body'>('face');
  const face = useRef<HTMLCanvasElement>(null);
  const inspector = useRef<HTMLElement>(null);
  const draw = useRef<(time: number, capture?: boolean) => string>(() => '');
  const restart = useRef(() => {});
  const clock = useRef(0);
  const selection = useRef<Pair>({from: 'attention', to: 'curiosity'});
  const running = useRef(false), all = useRef(false), rate = useRef(1);
  const [pair, setPair] = useState<Pair>({from: 'attention', to: 'curiosity'});
  const [identity, setIdentity] = useState<0 | 1>(0);
  const [playing, setPlaying] = useState(false), [playAll, setPlayAll] = useState(false);
  const [speed, setSpeed] = useState(1), [time, setTime] = useState(0);
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  const [portraits, setPortraits] = useState<Partial<Record<ExpressionState, string>>>({});
  const [expanded, setExpanded] = useState(false);
  const duration = playAll ? expressionPairs.length * expressionTiming.duration : expressionTiming.duration;
  const index = playAll ? Math.min(expressionPairs.length - 1, Math.floor(time / expressionTiming.duration)) : expressionPairs.findIndex(p => p.from === pair.from && p.to === pair.to);
  const current = playAll ? expressionPairs[index] : pair;
  const localTime = playAll ? time - index * expressionTiming.duration : time;

  const stop = useCallback(() => {running.current = false; setPlaying(false);}, []);
  const choose = useCallback((from: ExpressionState, to: ExpressionState) => {
    stop(); all.current = false; setPlayAll(false);
    selection.current = {from, to}; setPair({from, to});
    clock.current = 0; setTime(0); restart.current(); draw.current(0);
  }, [stop]);
  function showPair(from: ExpressionState, to: ExpressionState) {
    choose(from, to); inspector.current?.scrollIntoView({block: 'start', behavior: 'auto'});
  }
  function seek(value: number) {clock.current = value; setTime(value); draw.current(value);}
  function toggle() {
    if (running.current) {stop(); return;}
    if (clock.current >= duration) seek(0);
    running.current = true; setPlaying(true);
  }
  function startAll() {
    all.current = true; setPlayAll(true); clock.current = 0; setTime(0);
    restart.current(); draw.current(0); running.current = true; setPlaying(true);
  }

  useEffect(() => {
    const output = face.current;
    if (!output) return;
    let disposed = false, raf = 0, renderer: TgStudioRenderer | undefined;
    let last = -1, lastIndex = -1, lastTick = 0, lastUi = 0;
    const source = document.createElement('canvas'); source.width = 2560; source.height = 1440;
    let report: unknown;
    const reset = () => {renderer?.reset(); last = -1; lastIndex = -1;};
    restart.current = reset;
    function paint(seconds: number, capture = false) {
      if (!renderer || !output) return '';
      const max = all.current ? expressionPairs.length * expressionTiming.duration : expressionTiming.duration;
      seconds = Math.max(0, Math.min(max, seconds));
      const i = all.current ? Math.min(expressionPairs.length - 1, Math.floor(seconds / expressionTiming.duration)) : -1;
      const selected = all.current ? expressionPairs[i] : selection.current;
      const local = all.current ? seconds - i * expressionTiming.duration : seconds;
      // Rebuild seeks at a fixed step, using the engine's real transition
      // history. Jumping directly to the destination would hide the blend.
      if (i !== lastIndex || local < last || local - last > .15) reset();
      lastIndex = i;
      for (let step = Math.max(0, Math.floor(last * expressionTiming.fps + 1e-7) + 1); step / expressionTiming.fps < local - 1e-7; step++) {
        const t = step / expressionTiming.fps;
        renderer.render(t, expressionReviewFrame(selected.from, selected.to, t, framing.current==='body'));
      }
      renderer.render(local, expressionReviewFrame(selected.from, selected.to, local, framing.current==='body')); last = local;
      const sample = renderer.sample(), at = sample?.layout.actors[0];
      if (!sample || !at) return '';
      const c = output.getContext('2d')!;
      c.clearRect(0, 0, output.width, output.height);
      const pixels = source.width / sample.layout.width;
      if(framing.current==='body')c.drawImage(source,(at.x-240*at.scale)*pixels,(at.y+5*at.scale)*pixels,480*at.scale*pixels,582*at.scale*pixels,0,0,output.width,output.height);
      else c.drawImage(source, (at.x - 110 * at.scale) * pixels, (at.y + 20 * at.scale) * pixels, 220 * at.scale * pixels, 290 * at.scale * pixels, 0, 0, output.width, output.height);
      const state = local < expressionTiming.change ? selected.from : selected.to;
      report = {framing:framing.current,from: selected.from, to: selected.to, state, identity, seconds, localTime: local, actor: sample.actors[0]};
      output.dataset.framing=framing.current;
      output.dataset.from = selected.from; output.dataset.to = selected.to;
      output.dataset.state = state; output.dataset.identity = String(identity);
      return capture ? output.toDataURL('image/png').split(',')[1] : '';
    }
    draw.current = paint;
    window.conclaviaExpressionReview = {frame(t, capture = true) {clock.current = t; setTime(t); return paint(t, capture);}, selectPair: choose, sample: () => report, get duration() {return all.current ? expressionPairs.length * expressionTiming.duration : expressionTiming.duration;}};
    function tick(now: number) {
      if (disposed) return;
      if (running.current && !document.hidden) {
        const dt = lastTick ? Math.min(.08, (now - lastTick) / 1000) : 0;
        const max = all.current ? expressionPairs.length * expressionTiming.duration : expressionTiming.duration;
        clock.current = Math.min(max, clock.current + dt * rate.current); paint(clock.current);
        if (now - lastUi > 70 || clock.current === max) {setTime(clock.current); lastUi = now;}
        if (clock.current >= max) {running.current = false; setPlaying(false);}
      }
      lastTick = now; raf = requestAnimationFrame(tick);
    }
    const base = dailyStudioConfig;
    const config = {...base, palette: {...(identity ? base.secondaryPalette! : base.palette), identity}};
    void loadTgStudioAssets(config).then(assets => {
      if (disposed) return;
      renderer = new TgStudioRenderer(source, assets);
      const thumbnails: Partial<Record<ExpressionState, string>> = {};
      const original = selection.current, wasAll = all.current, wasFraming=framing.current;
      framing.current='face';
      all.current = false;
      for (const state of expressionStates) {
        selection.current = {from: state, to: state}; reset(); paint(1.12);
        thumbnails[state] = 'data:image/png;base64,' + paint(1.12, true);
      }
      selection.current = original; all.current = wasAll;framing.current=wasFraming; reset(); paint(clock.current);
      setPortraits(thumbnails); setReady(true); setError(''); raf = requestAnimationFrame(tick);
    }).catch(() => {if (!disposed) setError('Impossibile caricare i volti. Riprova ricaricando la pagina.');});
    return () => {disposed = true; cancelAnimationFrame(raf); renderer?.dispose(); delete window.conclaviaExpressionReview; draw.current = () => '';};
  }, [identity, choose]);

  function changeView(value:'face'|'body'){
    stop();framing.current=value;setView(value);restart.current();
    // Resize before drawing; changing the canvas attributes clears its bitmap.
    if(face.current){face.current.width=value==='body'?528:396;face.current.height=value==='body'?640:522;}
    draw.current(clock.current);
  }

  useEffect(()=>{draw.current(clock.current);},[view]);

  function changeIdentity(value: 0 | 1) {
    if (value === identity) return;
    stop(); setReady(false); setPortraits({}); clock.current = 0; setTime(0); setIdentity(value);
  }

  return <main className={styles.root}>
    <TgNavigation/>
    <header className={styles.heading}>
      <p>CONCLAVIA DAILY / ESPRESSIONI E CORPO</p>
      <h1>Ogni mood, dal viso alle mani.</h1>
      <p>8 mood e l’ascolto neutro, con una vista del viso e una del corpo. 56 passaggi tra i mood, più 16 da e verso l’ascolto: <strong>72 transizioni per ciascun volto.</strong></p>
    </header>
    <div className={styles.identities} aria-label="Volto da esaminare">
      <button type="button" aria-pressed={identity === 0} onClick={() => changeIdentity(0)}>Riccardo · primo volto</button>
      <button type="button" aria-pressed={identity === 1} onClick={() => changeIdentity(1)}>Sofia · secondo volto</button>
    </div>
    <div className={styles.identities} aria-label="Inquadratura della prova">
      <button type="button" aria-pressed={view==='face'} onClick={()=>changeView('face')}>Viso</button>
      <button type="button" aria-pressed={view==='body'} onClick={()=>changeView('body')}>Corpo e gesti</button>
    </div>
    <section ref={inspector} className={styles.inspector} aria-label="Riproduzione della transizione">
      <div className={styles.face}>
        <canvas ref={face} width={view==='body'?528:396} height={view==='body'?640:522} data-testid="expression-face" data-ready={ready} role="img" aria-label={`${view==='body'?'Corpo e mani':'Primo piano'}: ${expressionNames[current.from]} verso ${expressionNames[current.to]}`}/>
        {!ready && !error && <p>Preparazione del volto…</p>}
      </div>
      <div className={styles.player}>
        <p className={styles.eyebrow}>{playAll ? `TRANSIZIONE ${index + 1} / 72` : 'TRANSIZIONE SELEZIONATA'}</p>
        <h2>{expressionNames[current.from]} <span>→</span> {expressionNames[current.to]}</h2>
        <p className={styles.description}>{localTime < expressionTiming.change ? 'Partenza: ' + (view==='body'?bodyDetails:expressionDetails)[current.from] : 'Arrivo: ' + (view==='body'?bodyDetails:expressionDetails)[current.to]}</p>
        <div className={styles.selects}>
          <label>Da<select aria-label="Espressione di partenza" value={current.from} onChange={e => {const from = e.target.value as ExpressionState; choose(from, current.to === from ? expressionStates.find(s => s !== from)! : current.to);}}>{expressionStates.map(s => <option key={s} value={s}>{expressionNames[s]}</option>)}</select></label>
          <label>A<select aria-label="Espressione di arrivo" value={current.to} onChange={e => choose(current.from, e.target.value as ExpressionState)}>{expressionStates.filter(s => s !== current.from).map(s => <option key={s} value={s}>{expressionNames[s]}</option>)}</select></label>
        </div>
        <div className={styles.actions}>
          <button type="button" disabled={!ready} onClick={toggle}>{playing ? 'Pausa' : 'Riproduci passaggio'}</button>
          <button type="button" disabled={!ready} onClick={() => {stop(); seek(0);}}>Ricomincia</button>
          <label>Velocità<select aria-label="Velocità della transizione" value={speed} onChange={e => {rate.current = Number(e.target.value); setSpeed(rate.current);}}><option value={1}>Normale · 1×</option><option value={.5}>Rallentata · 0,5×</option></select></label>
        </div>
        <label className={styles.scrubber}>Posizione nella prova<input aria-label="Posizione nella prova delle espressioni" type="range" min={0} max={duration} step={.01} value={time} disabled={!ready} onChange={e => {stop(); seek(Number(e.target.value));}}/></label>
        <output className={styles.time}>{time.toFixed(1)} / {duration.toFixed(1)} s</output>
        <p className={styles.note}>Ogni passaggio dura 4,4 s: il cambio inizia a 1,3 s. Puoi fermarlo o trascinarlo fotogramma per fotogramma. Ogni clip riparte dal proprio stato iniziale. La prova è senza audio: la bocca resta chiusa. In «Corpo e gesti» viene simulata la gestualità del parlato; «Ascolto» mostra invece una reazione contenuta.</p>
        <button type="button" className={styles.allButton} disabled={!ready} onClick={startAll}>Riproduci tutte le 72 transizioni</button>
        <Link href="/podcast/tg/performance">Prova viso e corpo con la voce →</Link>
      </div>
    </section>
    {error && <p role="alert">{error}</p>}
    <section className={styles.gallery} aria-label="Tutte le espressioni">
      <h2>Le espressioni, una accanto all’altra.</h2>
      <p>Seleziona una scheda per passare dall’ascolto a quel mood.</p>
      <div className={styles.cards}>{expressionStates.map(state => <button type="button" key={state} className={styles.card} data-expression-card={state} disabled={!ready} onClick={() => showPair(state === 'listening' ? 'attention' : 'listening', state)}>
        {portraits[state] && <Image src={portraits[state]!} width={198} height={261} unoptimized alt={`Espressione ${expressionNames[state]}`}/>}
        <strong>{expressionNames[state]}</strong><span>{expressionDetails[state]}</span>
      </button>)}</div>
    </section>
    <section className={styles.catalogue} aria-label="Elenco completo delle transizioni">
      <div className={styles.catalogueTitle}><h2>Tutte le transizioni, elencate.</h2><button type="button" onClick={() => setExpanded(v => !v)}>{expanded ? 'Chiudi elenco' : 'Espandi elenco completo'}</button></div>
      <p>Il verso conta: dubbio → accordo e accordo → dubbio sono due passaggi diversi. Seleziona una voce, poi premi Riproduci passaggio.</p>
      {expressionStates.map(from => <details key={`${from}-${expanded}`} open={expanded || undefined} className={styles.group}>
        <summary>Da {expressionNames[from]} <span>8 passaggi</span></summary>
        <div className={styles.pairs}>{expressionPairs.filter(p => p.from === from).map(p => <button type="button" key={p.id} data-transition={p.id} aria-pressed={current.from === p.from && current.to === p.to} onClick={() => showPair(p.from, p.to)}>{expressionNames[p.from]} <span>→</span> {expressionNames[p.to]}</button>)}</div>
      </details>)}
    </section>
  </main>;
}
