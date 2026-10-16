"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { getPodcastMood, MOOD_DEMO_DURATION_MS, MOOD_DEMO_SENTENCES, moodDemoPhase } from "@/lib/podcast/mood-demo";
import { usePodcastCopy } from "./PodcastUi";
import styles from "./Podcast.module.css";
import design from "./PodcastStyles.module.css";

type Transport = { index: number; position: number; playing: boolean; revision: number };
export function usePodcastMoodRehearsal() {
  const [transport, setTransport] = useState<Transport>({ index: 0, position: 1700, playing: false, revision: 0 });
  useEffect(() => {
    if (!transport.playing) return;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now(), delta = Math.min(300, now - last);
      last = now;
      setTransport(current => {
        if (!current.playing) return current;
        const position = current.position + delta;
        if (position < MOOD_DEMO_DURATION_MS) return { ...current, position };
        if (current.index === MOOD_DEMO_SENTENCES.length - 1) return { ...current, position: MOOD_DEMO_DURATION_MS, playing: false };
        return { ...current, index: current.index + 1, position: 0 };
      });
    }, 100);
    const pauseWhenHidden = () => { if (document.hidden) setTransport(current => ({ ...current, playing: false })); };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", pauseWhenHidden); };
  }, [transport.playing]);
  const sentence = MOOD_DEMO_SENTENCES[transport.index];
  const phase = moodDemoPhase(transport.position);
  return {
    ...transport, sentence, ...phase,
    cueId: `mood-demo-${transport.index}-${transport.revision}`,
    play: () => setTransport(current => current.playing ? { ...current, playing: false } : { ...current, playing: true,
      ...(current.position >= MOOD_DEMO_DURATION_MS ? { index: 0, position: 0, revision: current.revision + 1 } : {}) }),
    pause: () => setTransport(current => ({ ...current, playing: false })),
    select: (index: number) => setTransport(current => ({ index: Math.max(0, Math.min(MOOD_DEMO_SENTENCES.length - 1, index)), position: 1700, playing: false, revision: current.revision + 1 })),
    next: () => setTransport(current => ({ index: (current.index + 1) % MOOD_DEMO_SENTENCES.length, position: 1700, playing: false, revision: current.revision + 1 })),
    stop: () => setTransport(current => ({ index: 0, position: 0, playing: false, revision: current.revision + 1 })),
    seek: (position: number) => setTransport(current => ({ ...current, position: Math.max(0, Math.min(MOOD_DEMO_DURATION_MS, position)), playing: false })),
  };
}

export type PodcastMoodRehearsal = ReturnType<typeof usePodcastMoodRehearsal>;

export function PodcastMoodRehearsalLab({ demo, hostNames, manual = false, onActivate }: {
  demo: PodcastMoodRehearsal;
  hostNames: string[];
  manual?: boolean;
  onActivate: () => void;
}) {
  const copy = usePodcastCopy();
  const mood = getPodcastMood(demo.sentence.mood), listeningMood = getPodcastMood(demo.sentence.listenerMood);
  const speaker = hostNames[demo.sentence.speakerIndex], listener = hostNames[1 - demo.sentence.speakerIndex];
  const phaseLabel = demo.phase === "anticipation" ? copy("Si prepara", "Preparing") : demo.phase === "delivery" ? copy("Esprime l’idea", "Expressing the idea") : copy("Lascia spazio", "Making room");
  return <section className={design.moodLab} data-testid="podcast-mood-lab" data-mode={manual ? "manual" : "scripted"} aria-label={copy("Prova delle emozioni", "Emotion rehearsal")}>
    <div className={design.labHeading}><div><div className={styles.eyebrow}>{copy("UNA FRASE, UN’INTENZIONE", "ONE SENTENCE, ONE INTENTION")}</div><h2>{copy("La conversazione si vede.", "See the conversation unfold.")}</h2></div><span className={design.silentBadge}>{copy("DEMO VISIVA · SENZA AUDIO", "VISUAL DEMO · NO AUDIO")}</span></div>
    <p className={design.labIntro}>{copy("Otto battute preparate per osservare espressioni, gesti e ascolto. Chi ascolta reagisce in modo diverso da chi prende la parola.", "Eight prepared lines to explore expressions, gestures, and listening. The listener reacts differently from the person taking the floor.")}</p>
    <div className={`${design.lineCard} ${manual ? design.manualLine : ""}`} data-testid="mood-demo-sentence" data-mood={demo.sentence.mood} data-listener-mood={demo.sentence.listenerMood} data-speaker={demo.sentence.speakerIndex} data-phase={demo.phase}>
      <div className={design.lineMeta}><span>{speaker}</span><span className={design.moodBadge} style={{ "--mood-color": mood.color } as CSSProperties}>{copy(mood.label.it, mood.label.en)}</span><span className={design.lineNumber}>{String(demo.index + 1).padStart(2, "0")} / 08</span></div>
      <blockquote>{copy(demo.sentence.text.it, demo.sentence.text.en)}</blockquote>
      <div className={design.lineReaction}><span>{copy("Ascolta", "Listening")}: <strong>{listener}</strong> · {copy(listeningMood.label.it, listeningMood.label.en)}</span><span className={design.phaseBadge} data-testid="mood-demo-phase">{manual ? copy("Espressioni libere", "Free expressions") : phaseLabel}</span></div>
      {manual && <p className={design.manualHint}>{copy("Stai modificando le espressioni a mano. Scegli una battuta per tornare alla sequenza.", "You are adjusting expressions by hand. Choose a line to return to the sequence.")}</p>}
    </div>
    <div className={design.transport}>
      <button className={styles.primary} data-testid="mood-demo-play" type="button" aria-pressed={demo.playing} onClick={() => { onActivate(); demo.play(); }}>{demo.playing ? copy("Ⅱ Pausa", "Ⅱ Pause") : copy("▷ Avvia sequenza", "▷ Play sequence")}</button>
      <button className={styles.secondary} data-testid="mood-demo-next" type="button" onClick={() => { onActivate(); demo.next(); }}>{copy("Battuta successiva", "Next line")} →</button>
      <button className={styles.quiet} data-testid="mood-demo-stop" type="button" onClick={() => { onActivate(); demo.stop(); }}>{copy("Ricomincia", "Reset")}</button>
    </div>
    <label className={design.timeline}><span>{copy("Momento della battuta", "Position within the line")}<output>{Math.round(demo.position / MOOD_DEMO_DURATION_MS * 100)}%</output></span><input data-testid="mood-demo-seek" type="range" min={0} max={MOOD_DEMO_DURATION_MS} step={100} value={Math.round(demo.position)} onChange={event => { onActivate(); demo.seek(Number(event.target.value)); }} aria-valuetext={`${phaseLabel} · ${Math.round(demo.position / MOOD_DEMO_DURATION_MS * 100)}%`} /></label>
    <div className={design.moodChoices} role="group" aria-label={copy("Le otto battute e i loro mood", "The eight lines and their moods")}>{MOOD_DEMO_SENTENCES.map((line, index) => {
      const itemMood = getPodcastMood(line.mood);
      return <button type="button" key={line.mood} data-testid={`mood-demo-option-${line.mood}`} aria-pressed={!manual && demo.index === index} className={`${design.moodChoice} ${!manual && demo.index === index ? design.activeMoodChoice : ""}`} onClick={() => { onActivate(); demo.select(index); }}><span aria-hidden="true" style={{ backgroundColor: itemMood.color }} /><span>{copy(itemMood.label.it, itemMood.label.en)}</span><small>{String(index + 1).padStart(2, "0")}</small></button>;
    })}</div>
    <p className={design.note}>{copy("Questa prova mostra il linguaggio del corpo e mantiene le bocche a riposo. La prova vocale usa invece l’audio reale per il movimento delle labbra.", "This rehearsal shows body language and keeps mouths at rest. The spoken rehearsal uses actual audio to drive the lips.")}</p>
  </section>;
}
