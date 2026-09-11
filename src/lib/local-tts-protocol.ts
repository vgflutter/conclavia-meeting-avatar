import type { AssistantVoiceStyle } from "@/types/assistant-profile";
import type { LocalSpeechResult, LocalVoiceProgress } from "./local-tts-engine";

export type SpeechInput = {
  text: string;
  language: "it" | "en";
  voiceStyle: AssistantVoiceStyle;
  speakingRate: number;
};

export type VoiceWorkerRequest = { id: number; allowWebGpu: boolean } & (
  | { type: "prepare"; voiceStyle: AssistantVoiceStyle }
  | { type: "generate"; input: SpeechInput }
);

export type VoiceWorkerResponse = { id: number } & (
  | { type: "progress"; progress: LocalVoiceProgress }
  | { type: "prepared"; backend: "webgpu" | "wasm" }
  | { type: "generated"; result: LocalSpeechResult }
  | { type: "error"; message: string }
);
