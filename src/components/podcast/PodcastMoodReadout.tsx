"use client";

import type { CSSProperties } from "react";
import type { TalkRunMessageResponse } from "@/types/podcast-run";
import type { PodcastPerformanceFrame } from "@/lib/podcast/performance-playback";
import { resolveMessagePerformance } from "@/lib/podcast/performance";
import { getPodcastMood } from "@/lib/podcast/mood-demo";
import { usePodcastCopy } from "./PodcastUi";
import styles from "./PodcastPerformance.module.css";

/** Operator-facing readout. It describes AI acting, never the real guest's feelings. */
export function PodcastMoodReadout({ message, frame }: { message: TalkRunMessageResponse; frame: PodcastPerformanceFrame }) {
  const copy = usePodcastCopy();
  if (message.origin !== "ai") return null;
  const legacy = resolveMessagePerformance(message)?.source !== "ai";
  const mood = getPodcastMood(frame.sentence.mood), listener = getPodcastMood(frame.sentence.listenerMood);
  return <section className={styles.readout} data-testid="podcast-mood-readout" data-sentence-index={frame.index} data-mood={legacy ? "neutral" : frame.sentence.mood} data-listener-mood={legacy ? "neutral" : frame.sentence.listenerMood} aria-label={copy("La battuta in corso", "The current line")} aria-live="polite" aria-atomic="true">
    <div className={styles.readoutHeading}><span>{message.speakerName}</span><span className={`${styles.moodChip} ${legacy ? styles.neutralChip : ""}`} style={{ "--performance-mood": legacy ? "#8a957e" : mood.color } as CSSProperties}>{legacy ? copy("Direzione neutra", "Neutral direction") : copy(mood.label.it, mood.label.en)}</span></div>
    <p className={styles.currentWords}>{frame.sentence.text}</p>
    <div className={styles.listenerLine}><span className={styles.listenerDot} aria-hidden="true" style={{ backgroundColor: listener.color }} /><span>{copy("L’altro AI ascolta", "The other AI listens")} · <strong>{legacy ? copy("Direzione neutra", "Neutral direction") : copy(listener.label.it, listener.label.en)}</strong></span></div>
  </section>;
}
