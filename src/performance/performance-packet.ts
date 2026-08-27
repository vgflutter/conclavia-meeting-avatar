import { randomUUID } from "node:crypto";

import type {
  AvatarListeningReaction,
  AvatarMood,
  AvatarSpeechCue,
} from "../domain/protocol.js";
import type {
  PerformanceBeat,
  PerformanceFocus,
  PerformanceGesture,
  RendererMood,
} from "./performance-plan.js";

export const performancePacketSchema = "conclavia.performance" as const;
export const performancePacketVersion = 1 as const;

export type PerformanceKind = "speech" | "listening" | "gesture" | "control";
export type PerformanceEventType =
  | "ready"
  | "speech-start"
  | "speech-end"
  | "interrupt"
  | "raise-hand"
  | "lower-hand"
  | "applause";

export interface SpeechMark {
  time: number;
  type: "sentence" | "ssml" | "viseme" | "word";
  value: string;
  start?: number;
  end?: number;
}

export interface PerformanceAudioTrack {
  assetId: string;
  url: string;
  mimeType: "audio/wav";
  sampleRate: 16_000;
  channels: 1;
  durationMs: number;
  clockRole: "master";
}

export interface TimedViseme {
  atMs: number;
  value: string;
  weight: number;
}

export interface TimedExpression {
  atMs: number;
  semanticMood: AvatarMood;
  rendererMood: RendererMood;
  level: number;
}

export interface TimedGaze {
  atMs: number;
  target: PerformanceFocus;
  blendMs: number;
}

export interface TimedGesture {
  atMs: number;
  clip: PerformanceGesture;
  weight: number;
  blendInMs: number;
  blendOutMs: number;
}

export interface PerformanceEvent {
  atMs: number;
  type: PerformanceEventType;
  targetPerformanceId?: string;
}

export interface PerformancePacket {
  schema: typeof performancePacketSchema;
  version: typeof performancePacketVersion;
  sequence: number;
  performanceId: string;
  avatar: {
    id: string;
    name: string;
    assetVersion: string;
  };
  kind: PerformanceKind;
  priority: number;
  interruptible: boolean;
  clock: {
    source: "audio" | "timeline";
    durationMs: number;
  };
  audio?: PerformanceAudioTrack;
  tracks: {
    visemes: TimedViseme[];
    expressions: TimedExpression[];
    gaze: TimedGaze[];
    gestures: TimedGesture[];
  };
  events: PerformanceEvent[];
  metadata: {
    addressedTo?: string;
    sourceCueId?: string;
    sourceSegmentIds?: string[];
    observedSpeakerName?: string;
    deliveryId?: string;
    chunkIndex?: number;
    chunkCount?: number;
  };
  createdAt: string;
}

export type PerformancePacketDraft = Omit<PerformancePacket, "sequence">;

export interface SpeechPerformanceInput {
  cue: AvatarSpeechCue;
  avatarId: string;
  avatarName: string;
  assetVersion?: string;
  audio: PerformanceAudioTrack;
  beats: readonly PerformanceBeat[];
  speechMarks: readonly SpeechMark[];
  delivery?: {
    id: string;
    chunkIndex: number;
    chunkCount: number;
  };
}

// The licensed MetaHuman viseme clips are intentionally expressive probes.
// Driving every probe at full strength makes plosives and open vowels read as
// facial spasms in a conversational close-up. These calibrated gains preserve
// articulation while leaving room for the sentence mood layer.
const conversationalVisemeWeight: Readonly<Record<string, number>> = {
  p: 0.86,
  t: 0.7,
  S: 0.68,
  T: 0.66,
  f: 0.72,
  k: 0.68,
  i: 0.62,
  r: 0.58,
  s: 0.58,
  u: 0.68,
  "@": 0.54,
  a: 0.74,
  e: 0.64,
  E: 0.68,
  o: 0.66,
  O: 0.72,
};

function emptyTracks(): PerformancePacket["tracks"] {
  return { visemes: [], expressions: [], gaze: [], gestures: [] };
}

export function speechPerformancePacket(
  input: SpeechPerformanceInput,
): PerformancePacketDraft {
  const tracks = emptyTracks();
  tracks.visemes = input.speechMarks
    .filter((mark) => mark.type === "viseme")
    .map((mark) => ({
      atMs: mark.time,
      value: mark.value,
      weight: conversationalVisemeWeight[mark.value] ?? 0.64,
    }));
  tracks.expressions = input.beats.map((beat) => ({
    atMs: beat.atMs,
    semanticMood: beat.semanticMood,
    rendererMood: beat.mood,
    level: beat.intensity,
  }));
  tracks.gaze = input.beats.map((beat) => ({
    atMs: beat.atMs,
    target: beat.focus,
    blendMs: 240,
  }));
  tracks.gestures = input.beats
    .filter((beat) => beat.gesture !== "none")
    .map((beat) => ({
      atMs: beat.atMs,
      clip: beat.gesture,
      weight: Math.max(0.2, beat.intensity),
      blendInMs: 320,
      blendOutMs: 480,
    }));

  return {
    schema: performancePacketSchema,
    version: performancePacketVersion,
    performanceId: input.audio.assetId,
    avatar: {
      id: input.avatarId,
      name: input.avatarName,
      assetVersion: input.assetVersion ?? "web-lod-pending",
    },
    kind: "speech",
    priority: 70,
    interruptible: true,
    clock: { source: "audio", durationMs: input.audio.durationMs },
    audio: input.audio,
    tracks,
    events: [
      { atMs: 0, type: "lower-hand" },
      { atMs: 0, type: "speech-start" },
      { atMs: input.audio.durationMs, type: "speech-end" },
    ],
    metadata: {
      addressedTo: input.cue.addressedTo,
      sourceCueId: input.cue.id,
      sourceSegmentIds: [...input.cue.sourceSegmentIds],
      ...(input.delivery
        ? {
            deliveryId: input.delivery.id,
            chunkIndex: input.delivery.chunkIndex,
            chunkCount: input.delivery.chunkCount,
          }
        : {}),
    },
    createdAt: new Date().toISOString(),
  };
}

export function listeningPerformancePacket(input: {
  reaction: AvatarListeningReaction & { holdMs: number };
  avatarId: string;
  avatarName: string;
  rendererMood: RendererMood;
  intensity: number;
  focus: PerformanceFocus;
}): PerformancePacketDraft {
  const performanceId = randomUUID();
  return {
    schema: performancePacketSchema,
    version: performancePacketVersion,
    performanceId,
    avatar: {
      id: input.avatarId,
      name: input.avatarName,
      assetVersion: "web-lod-pending",
    },
    kind: "listening",
    priority: 20,
    interruptible: true,
    clock: { source: "timeline", durationMs: input.reaction.holdMs },
    tracks: {
      visemes: [],
      expressions: [{
        atMs: 0,
        semanticMood: input.reaction.mood,
        rendererMood: input.rendererMood,
        level: input.intensity,
      }],
      gaze: [{ atMs: 0, target: input.focus, blendMs: 420 }],
      gestures: [],
    },
    events: [],
    metadata: {
      sourceSegmentIds: [input.reaction.sourceSegmentId],
      observedSpeakerName: input.reaction.observedSpeakerName,
    },
    createdAt: new Date().toISOString(),
  };
}

export function gesturePerformancePacket(input: {
  avatarId: string;
  avatarName: string;
  gesture: Extract<PerformanceGesture, "raise-hand" | "lower-hand" | "applause">;
  durationMs: number;
  mood: AvatarMood;
  rendererMood: RendererMood;
  intensity: number;
  targetName?: string;
}): PerformancePacketDraft {
  const performanceId = randomUUID();
  const eventType = input.gesture === "raise-hand"
    ? "raise-hand"
    : input.gesture === "lower-hand"
      ? "lower-hand"
      : "applause";
  return {
    schema: performancePacketSchema,
    version: performancePacketVersion,
    performanceId,
    avatar: {
      id: input.avatarId,
      name: input.avatarName,
      assetVersion: "web-lod-pending",
    },
    kind: "gesture",
    priority: 60,
    interruptible: input.gesture !== "raise-hand",
    clock: { source: "timeline", durationMs: input.durationMs },
    tracks: {
      visemes: [],
      expressions: [{
        atMs: 0,
        semanticMood: input.mood,
        rendererMood: input.rendererMood,
        level: input.intensity,
      }],
      gaze: [{ atMs: 0, target: "camera", blendMs: 300 }],
      gestures: [{
        atMs: 0,
        clip: input.gesture,
        weight: 1,
        blendInMs: 420,
        blendOutMs: 560,
      }],
    },
    events: [{ atMs: 0, type: eventType }],
    metadata: {
      ...(input.targetName ? { observedSpeakerName: input.targetName } : {}),
    },
    createdAt: new Date().toISOString(),
  };
}

export function controlPerformancePacket(input: {
  avatarId: string;
  avatarName: string;
  event: Extract<PerformanceEventType, "ready" | "interrupt">;
  targetPerformanceId?: string;
}): PerformancePacketDraft {
  return {
    schema: performancePacketSchema,
    version: performancePacketVersion,
    performanceId: randomUUID(),
    avatar: {
      id: input.avatarId,
      name: input.avatarName,
      assetVersion: "web-lod-pending",
    },
    kind: "control",
    priority: input.event === "interrupt" ? 100 : 10,
    interruptible: false,
    clock: { source: "timeline", durationMs: 0 },
    tracks: emptyTracks(),
    events: [{
      atMs: 0,
      type: input.event,
      ...(input.targetPerformanceId
        ? { targetPerformanceId: input.targetPerformanceId }
        : {}),
    }],
    metadata: {},
    createdAt: new Date().toISOString(),
  };
}

export function pcm16MonoToWav(pcm: Uint8Array, sampleRate = 16_000): Uint8Array {
  if (pcm.byteLength % 2 !== 0) throw new Error("PCM16 payload must contain complete samples");
  const headerSize = 44;
  const output = new Uint8Array(headerSize + pcm.byteLength);
  const view = new DataView(output.buffer);
  const ascii = (offset: number, value: string): void => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, pcm.byteLength, true);
  output.set(pcm, headerSize);
  return output;
}
