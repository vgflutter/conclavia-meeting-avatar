"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TalkInput } from "@/types/podcast";
import { PodcastStageView, type PodcastDirection } from "./PodcastStageView";

/** Capture one canonical frame, then release the animation in library cards. */
export function PodcastThumbnail({ talk, direction }: { talk: Pick<TalkInput, "title" | "topic" | "participants" | "settings">; direction?: PodcastDirection }) {
  const [snapshot, setSnapshot] = useState("");
  const frame = useRef(0);
  const ready = useCallback((canvas: HTMLCanvasElement | null) => {
    cancelAnimationFrame(frame.current);
    if (!canvas) return;
    frame.current = requestAnimationFrame(() => { frame.current = requestAnimationFrame(() => { try { setSnapshot(canvas.toDataURL("image/jpeg", 0.8)); } catch { /* Keep the canonical stage if capture is unavailable. */ } }); });
  }, []);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  return snapshot ? <Image src={snapshot} alt={[talk.title, ...talk.participants.map((person) => person.name)].join(" · ")} width={1920} height={1080} unoptimized style={{ display: "block", width: "100%", height: "auto" }} /> : <PodcastStageView talk={talk} direction={direction} onCanvasReady={ready} />;
}
