"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { TalkResponse } from "@/types/podcast";
import type { TalkRunResponse } from "@/types/podcast-run";
import { PodcastStageView, DEFAULT_DIRECTION, resolvePodcastDirection, type PodcastDirection } from "./PodcastStageView";
import { podcastRequest, readableError, usePodcastCopy } from "./PodcastUi";
import styles from "./Podcast.module.css";

function validDirection(value: unknown): value is PodcastDirection {
  if (!value || typeof value !== "object") return false;
  const direction = value as PodcastDirection;
  const expressions = ["attention", "curiosity", "doubt", "agreement", "amusement", "empathy", "disagreement", "surprise"];
  return ["studio", "speaker", "table"].includes(direction.layout) && ["all", "guest", "host-1", "host-2"].includes(direction.focus) && expressions.includes(direction.emotion) && (direction.emotion2 === undefined || expressions.includes(direction.emotion2)) && typeof direction.intensity === "number" && direction.intensity >= 0 && direction.intensity <= 1 && (direction.intensity2 === undefined || typeof direction.intensity2 === "number" && direction.intensity2 >= 0 && direction.intensity2 <= 1) && typeof direction.captions === "boolean" && typeof direction.automatic === "boolean";
}

export function PodcastBroadcast({ id }: { id: string }) {
  const copy = usePodcastCopy();
  const [talk, setTalk] = useState<TalkResponse | null>(null);
  const [run, setRun] = useState<TalkRunResponse | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [direction, setDirection] = useState(DEFAULT_DIRECTION);
  const [error, setError] = useState("");
  useEffect(() => {
    const read = (value: unknown) => { if (!value || typeof value !== "object") return; const data = value as { direction?: unknown; runId?: unknown }; if (validDirection(data.direction)) setDirection(data.direction); if (data.runId === null || typeof data.runId === "string" && /^[a-f\d]{24}$/iu.test(data.runId)) setSelectedRunId(data.runId); };
    try { const stored = localStorage.getItem(`conclavia-podcast-direction-${id}`); if (stored) read(JSON.parse(stored)); } catch { /* Storage is optional. */ }
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(`conclavia-podcast-${id}`);
    if (channel) channel.onmessage = (event) => read(event.data);
    const storage = (event: StorageEvent) => { if (event.key === `conclavia-podcast-direction-${id}` && event.newValue) { try { read(JSON.parse(event.newValue)); } catch { /* Ignore malformed data. */ } } };
    window.addEventListener("storage", storage);
    return () => { channel?.close(); window.removeEventListener("storage", storage); };
  }, [id]);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function load() {
      try {
        const [project, data] = await Promise.all([podcastRequest<{ talk: TalkResponse }>(`/api/podcast/talks/${id}`, { signal: controller.signal }), selectedRunId ? podcastRequest<{ run: TalkRunResponse }>(`/api/podcast/runs/${selectedRunId}`, { signal: controller.signal }) : podcastRequest<{ run: TalkRunResponse | null }>(`/api/podcast/talks/${id}/runs`, { signal: controller.signal })]);
        if (active) { setTalk(project.talk); setRun(data.run?.talkId === id ? data.run : null); setError(""); }
      } catch (cause) { if (active && !controller.signal.aborted) setError(readableError(cause)); }
    }
    void load(); const timer = window.setInterval(() => void load(), 3000);
    return () => { active = false; controller.abort(); window.clearInterval(timer); };
  }, [id, selectedRunId]);
  const viewTalk = run?.talkSnapshot ?? talk;
  const latest = run?.messages.at(-1);
  const effectiveDirection = viewTalk ? resolvePodcastDirection(direction, viewTalk, latest) : direction;
  return <div className={styles.output}><Link className={styles.outputExit} href={`/podcast/${id}/studio`}>← {copy("Torna alla regia", "Back to control room")}</Link>{viewTalk ? <div className={styles.outputStage}><PodcastStageView talk={viewTalk} direction={effectiveDirection} />{direction.captions && latest && <div className={styles.outputCaption}>{latest.content.length > 260 ? latest.content.slice(0, 260).trimEnd() + "…" : latest.content}</div>}</div> : <div style={{ color: "#d7dfd0", fontSize: 14, textAlign: "center", padding: 30 }} role="status">{error || copy("Preparazione dell’uscita video…", "Preparing video output…")}</div>}</div>;
}
