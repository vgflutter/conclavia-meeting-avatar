import type { TalkInput, TalkSettings } from "@/types/podcast";

export const VIDEO_TOPIC_MODES = ["episode", "conversation", "custom", "hidden"] as const;
export type VideoTopicMode = typeof VIDEO_TOPIC_MODES[number];
export type VideoTopicSettings = Pick<TalkSettings, "videoTopicMode" | "videoTopicText">;
export const VIDEO_TOPIC_MAX_LENGTH = 80;
export function isVideoTopicMode(value: unknown): value is VideoTopicMode {
  return VIDEO_TOPIC_MODES.some(mode => mode === value);
}
export function normalizeVideoTopicMode(value: unknown): VideoTopicMode {
  return isVideoTopicMode(value) ? value : "episode";
}
export function normalizeVideoTopicText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/gu, " ").replace(/[\u0000-\u001f\u007f]/gu, "").trim().slice(0, VIDEO_TOPIC_MAX_LENGTH) : "";
}
/** Editorial input and the actually spoken turn only; never a future generated turn. */
export function resolveVideoTopic(talk: Pick<TalkInput, "topic" | "settings">, spokenTopic?: string): string {
  const mode = normalizeVideoTopicMode(talk.settings.videoTopicMode);
  if (mode === "hidden") return "";
  if (mode === "custom") return normalizeVideoTopicText(talk.settings.videoTopicText);
  const topic = mode === "conversation" && spokenTopic?.trim() ? spokenTopic : talk.topic;
  return topic.replace(/\s+/gu, " ").trim().slice(0, 500);
}
export function videoTopicSelection(query: { topicMode?: unknown; topicText?: unknown }): VideoTopicSettings {
  return { videoTopicMode: normalizeVideoTopicMode(query.topicMode), videoTopicText: normalizeVideoTopicText(query.topicText) };
}
