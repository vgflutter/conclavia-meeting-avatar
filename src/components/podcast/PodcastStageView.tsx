"use client";
import { resolveVideoTopic } from "@/lib/podcast/video-topic";

import { PodcastStage } from "@conclavia/avatar-kit/components/PodcastStage";
import type { TalkInput } from "@/types/podcast";
import type { PodcastGuest } from "@conclavia/avatar-kit/types/podcast";
import type { TalkRunMessageResponse } from "@/types/podcast-run";
import { getStudioTheme, normalizeStudioCast, normalizeStudioGuest } from "@/lib/podcast/studio-themes";
import { podcastPerformanceFrame, type PodcastPerformance } from "@/lib/podcast/performance-playback";
import type { RehearsalVoice } from "@/lib/podcast/rehearsal-player";
export type { PodcastPerformance } from "@/lib/podcast/performance-playback";

export type PodcastEmotion = "attention" | "curiosity" | "doubt" | "agreement" | "amusement" | "empathy" | "disagreement" | "surprise";
export type PodcastShot = "all" | "guest" | "host-1" | "host-2";
export type PodcastLayout = "studio" | "speaker" | "table" | "lounge";
export interface PodcastDirection {
  layout: PodcastLayout;
  focus: PodcastShot;
  emotion: PodcastEmotion;
  intensity: number;
  emotion2?: PodcastEmotion;
  intensity2?: number;
  captions: boolean;
  automatic: boolean;
}
export const DEFAULT_DIRECTION: PodcastDirection = { layout: "studio", focus: "all", emotion: "attention", intensity: 0.65, emotion2: "curiosity", intensity2: 0.55, captions: true, automatic: true };

/** Editorial intent drives visual reaction; this does not infer a guest's emotions. */
export function resolvePodcastDirection(direction: PodcastDirection, talk: Pick<TalkInput, "participants">, message?: TalkRunMessageResponse, performance?: PodcastPerformance): PodcastDirection {
  if (!direction.automatic) return direction;
  if (!message) return { ...direction, focus: "all", emotion: "attention", emotion2: "curiosity" };
  const aiIndices = talk.participants.map((person, index) => person.kind === "ai" ? index : -1).filter((index) => index >= 0);
  const isGuest = message.participantIndex !== undefined && talk.participants[message.participantIndex]?.kind === "human";
  const focus: PodcastShot = message.participantIndex === undefined ? "all" : isGuest ? "guest" : message.participantIndex === aiIndices[0] ? "host-1" : message.participantIndex === aiIndices[1] ? "host-2" : "all";
  const cue = performance ?? podcastPerformanceFrame(message)?.cue;
  if (!isGuest && cue) {
    const second = cue.speakerIndex === aiIndices[1];
    return { ...direction, focus, emotion: second ? cue.listenerMood : cue.mood,
      emotion2: second ? cue.mood : cue.listenerMood, intensity: second ? cue.listenerIntensity : cue.intensity,
      intensity2: second ? cue.intensity : cue.listenerIntensity };
  }
  const speakingEmotion: PodcastEmotion = message.intent === "challenge" ? "doubt" : message.intent === "partial_agreement" ? "agreement" : message.intent === "question" ? "curiosity" : message.intent === "closing" ? "empathy" : "attention";
  return { ...direction, focus,
    emotion: isGuest ? "empathy" : focus === "host-2" ? "curiosity" : speakingEmotion,
    emotion2: isGuest ? "curiosity" : focus === "host-2" ? speakingEmotion : message.intent === "challenge" ? "attention" : message.intent === "partial_agreement" ? "empathy" : "doubt" };
}

export function PodcastStageView({ talk, direction = DEFAULT_DIRECTION, guestStream, guestPresentation, guestAvatar, speakingIndex, audioLevel = 0, viseme = "rest", onCanvasReady, performance, reserveGuest, voices, spokenTopic }: {
  talk: Pick<TalkInput, "title" | "topic" | "participants" | "settings">;
  direction?: PodcastDirection;
  guestStream?: MediaStream | null;
  guestPresentation?: "video" | "avatar";
  guestAvatar?: PodcastGuest["avatar"];
  speakingIndex?: number;
  audioLevel?: number;
  viseme?: string;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
  performance?: PodcastPerformance;
  reserveGuest?: boolean;
  voices?: readonly RehearsalVoice[];
  spokenTopic?: string;
}) {
  const ai = talk.participants.map((participant, index) => ({ participant, index })).filter(({ participant }) => participant.kind === "ai");
  const guest = talk.participants.find((participant) => participant.kind === "human");
  const guestMode = normalizeStudioGuest(talk.settings.studioGuest);
  const showGuest = Boolean(guestStream) || Boolean(guestAvatar) || reserveGuest === true || (reserveGuest !== false && guestMode !== "hidden" && (Boolean(guest) || guestMode === "reserve"));
  const focus = direction.focus === "guest" && !showGuest ? "all" : direction.focus;
  return <PodcastStage cast={normalizeStudioCast(talk.settings.studioCast)} title={talk.title} topic={talk.topic} headline={resolveVideoTopic(talk, spokenTopic)} visualStyle={getStudioTheme(talk.settings.studioTheme).visualStyle}
    layout={direction.layout} focus={focus} onCanvasReady={onCanvasReady}
    speakers={ai.slice(0, 2).map(({ participant, index }, position) => {
      const voice = voices?.find(entry => entry.message.participantIndex === index);
      const ownCue = voice && direction.automatic ? podcastPerformanceFrame(voice.message, voice.progress)?.cue : undefined;
      const cue = ownCue ?? performance;
      const speaking = voices ? Boolean(voice) : speakingIndex === index;
      return { id: String(index), name: participant.name, role: participant.role, appearance: participant.sex,
        emotion: cue ? index === cue.speakerIndex ? cue.mood : cue.listenerMood : position === 1 ? direction.emotion2 ?? direction.emotion : direction.emotion,
        intensity: cue ? index === cue.speakerIndex ? cue.intensity : cue.listenerIntensity : position === 1 ? direction.intensity2 ?? direction.intensity : direction.intensity, speaking,
        performance: cue ? { cueId: cue.cueId, phase: cue.phase, progress: cue.progress,
          listening: index !== cue.speakerIndex, gaze: focus === "guest" ? "guest" as const : "partner" as const } : undefined,
        audioLevel: voice?.level ?? (speaking ? audioLevel : 0), viseme: voice?.viseme ?? (speaking ? viseme : "rest") };
    })}
    guest={showGuest ? { name: guest?.name ?? "Ospite", presentation: guestPresentation, stream: guestPresentation === "avatar" ? undefined : guestStream, avatar: guestAvatar } : undefined} />;
}
