"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { TalkResponse } from "@/types/podcast";
import type { TalkRunResponse } from "@/types/podcast-run";
import { PodcastStageView, DEFAULT_DIRECTION, resolvePodcastDirection, type PodcastDirection } from "./PodcastStageView";
import { podcastRequest, readableError, usePodcastCopy } from "./PodcastUi";
import styles from "./Podcast.module.css";
import type { PodcastPerformance } from "@/lib/podcast/performance-playback";
import { PODCAST_MOODS, resolveMessagePerformance } from "@/lib/podcast/performance";

function validDirection(value: unknown): value is PodcastDirection {
  if (!value || typeof value !== "object") return false;
  const direction = value as PodcastDirection;
  const expressions = ["attention", "curiosity", "doubt", "agreement", "amusement", "empathy", "disagreement", "surprise"];
  return ["studio", "speaker", "table", "lounge"].includes(direction.layout) && ["all", "guest", "host-1", "host-2"].includes(direction.focus) && expressions.includes(direction.emotion) && (direction.emotion2 === undefined || expressions.includes(direction.emotion2)) && typeof direction.intensity === "number" && direction.intensity >= 0 && direction.intensity <= 1 && (direction.intensity2 === undefined || typeof direction.intensity2 === "number" && direction.intensity2 >= 0 && direction.intensity2 <= 1) && typeof direction.captions === "boolean" && typeof direction.automatic === "boolean";
}
function validPerformance(value: unknown): value is PodcastPerformance {
  if (!value || typeof value !== "object") return false;
  const cue = value as PodcastPerformance;
  const unit = (number: unknown) => typeof number === "number" && Number.isFinite(number) && number >= 0 && number <= 1;
  return Number.isInteger(cue.speakerIndex) && cue.speakerIndex >= 0 && cue.speakerIndex < 5 && PODCAST_MOODS.includes(cue.mood) && PODCAST_MOODS.includes(cue.listenerMood) && unit(cue.intensity) && unit(cue.listenerIntensity) && (cue.progress === undefined || unit(cue.progress)) && (cue.phase === undefined || ["anticipation", "delivery", "settle"].includes(cue.phase)) && (cue.cueId === undefined || typeof cue.cueId === "string" && cue.cueId.length <= 100);
}

export function PodcastBroadcast({ id }: { id: string }) {
  const copy = usePodcastCopy();
  const [talk, setTalk] = useState<TalkResponse | null>(null);
  const [run, setRun] = useState<TalkRunResponse | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [direction, setDirection] = useState(DEFAULT_DIRECTION);
  const [error, setError] = useState("");
  const [performance, setPerformance] = useState<PodcastPerformance>();
  const directionReceived = useRef(false);
  useEffect(() => {
    const read = (value: unknown) => { if (!value || typeof value !== "object") return; const data = value as { direction?: unknown; runId?: unknown; performance?: unknown }; if (validDirection(data.direction)) { directionReceived.current = true; setDirection(data.direction); } if (data.performance === null) setPerformance(undefined); else if (validPerformance(data.performance)) setPerformance(data.performance); if (data.runId === null || typeof data.runId === "string" && /^[a-f\d]{24}$/iu.test(data.runId)) setSelectedRunId(data.runId); };
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
        if (active) { const currentRun = data.run?.talkId === id ? data.run : null; setTalk(project.talk); setRun(currentRun); if (!directionReceived.current) setDirection(current => ({ ...current, layout: currentRun?.talkSnapshot?.settings.studioLayout ?? project.talk.settings.studioLayout ?? "studio" })); setError(""); }
      } catch (cause) { if (active && !controller.signal.aborted) setError(readableError(cause)); }
    }
    void load(); const timer = window.setInterval(() => void load(), 3000);
    return () => { active = false; controller.abort(); window.clearInterval(timer); };
  }, [id, selectedRunId]);
  const viewTalk = run?.talkSnapshot ?? talk;
  const latest = run?.messages.at(-1);
  const cueParts = performance?.cueId?.match(/^(\d+):(\d+)$/u);
  const played = cueParts && (!selectedRunId || run?.id === selectedRunId)
    ? run?.messages.find(message => message.sequence === Number(cueParts[1]) && message.origin === "ai" && message.participantIndex === performance?.speakerIndex) : undefined;
  const activePerformance = played ? performance : undefined;
  const current = played ?? latest;
  const sentence = played && cueParts ? resolveMessagePerformance(played)?.sentences[Number(cueParts[2])] : undefined;
  const caption = sentence?.text ?? current?.content;
  const effectiveDirection = viewTalk ? resolvePodcastDirection(direction, viewTalk, current, activePerformance) : direction;
  return <div className={styles.output}><Link className={styles.outputExit} href={`/podcast/${id}/studio`}>← {copy("Torna alla regia", "Back to control room")}</Link>{viewTalk ? <div className={styles.outputStage}><PodcastStageView spokenTopic={played?.threadLabel} talk={viewTalk} direction={effectiveDirection} performance={direction.automatic ? activePerformance : undefined} />{direction.captions && caption && <div className={styles.outputCaption}>{caption.length > 260 ? caption.slice(0, 260).trimEnd() + "…" : caption}</div>}</div> : <div style={{ color: "#d7dfd0", fontSize: 14, textAlign: "center", padding: 30 }} role="status">{error || copy("Preparazione dell’uscita video…", "Preparing video output…")}</div>}</div>;
}
