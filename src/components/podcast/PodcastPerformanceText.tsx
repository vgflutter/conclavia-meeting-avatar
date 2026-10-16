"use client";

import type { CSSProperties } from "react";
import type { TalkRunMessageResponse } from "@/types/podcast-run";
import { resolveMessagePerformance } from "@/lib/podcast/performance";
import { getPodcastMood } from "@/lib/podcast/mood-demo";
import { usePodcastCopy } from "./PodcastUi";
import styles from "./PodcastPerformance.module.css";

/** Keep editorial acting attached to its actual sentence; human words stay unannotated. */
export function PodcastPerformanceText({ message }: { message: TalkRunMessageResponse }) {
  const copy = usePodcastCopy();
  if (message.origin === "human") return <p className={styles.humanText} data-testid="podcast-human-text">{message.content}</p>;
  const performance = resolveMessagePerformance(message);
  if (!performance?.sentences.length) return <p className={styles.humanText}>{message.content}</p>;
  const legacy = performance.source === "legacy";
  return <div className={styles.performanceText} data-testid="podcast-performance-text" data-source={performance.source}>
    {performance.sentences.map((sentence, index) => {
      const mood = getPodcastMood(sentence.mood);
      const label = legacy ? copy("Direzione neutra", "Neutral direction") : copy(mood.label.it, mood.label.en);
      return <p className={styles.sentence} key={`${message.sequence}:${index}`} data-testid="podcast-performance-sentence" data-mood={legacy ? "neutral" : sentence.mood}>
        <span className={`${styles.moodChip} ${legacy ? styles.neutralChip : ""}`} style={{ "--performance-mood": legacy ? "#8a957e" : mood.color } as CSSProperties}
          aria-label={legacy ? copy("Direzione neutra per un intervento precedente, senza mood annotato", "Neutral direction for an earlier turn without an annotated mood") : `${copy("Mood", "Mood")}: ${label} · ${Math.round(sentence.intensity * 100)}%`}
          title={legacy ? copy("Questa registrazione precede le indicazioni emotive per frase.", "This recording predates sentence-level acting directions.") : copy(mood.note.it, mood.note.en)}>{label}</span>
        <span className={styles.sentenceWords}>{sentence.text}</span>
      </p>;
    })}
  </div>;
}
