import type { AssistantVoiceStyle } from "@/types/assistant-profile";
import type { LocalSpeechResult, LocalVoiceProgress } from "./local-tts-engine";
import type { SpeechInput, VoiceWorkerRequest, VoiceWorkerResponse } from "./local-tts-protocol";

export type { LocalSpeechResult, LocalVoiceProgress } from "./local-tts-engine";

let worker: Worker | undefined;
let nextId = 0;
type CompletedResponse = Extract<VoiceWorkerResponse, { type: "prepared" | "generated" }>;
const pending = new Map<number, {
  resolve: (response: CompletedResponse) => void;
  reject: (error: Error) => void;
  onProgress?: (progress: LocalVoiceProgress) => void;
}>();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./local-tts.worker.ts", import.meta.url), { type: "module", name: "conclavia-voice" });
  worker.onmessage = ({ data }: MessageEvent<VoiceWorkerResponse>) => {
    const request = pending.get(data.id);
    if (!request) return;
    if (data.type === "progress") { request.onProgress?.(data.progress); return; }
    pending.delete(data.id);
    if (data.type === "error") request.reject(new Error(data.message));
    else request.resolve(data);
  };
  const fail = () => {
    worker?.terminate();
    worker = undefined;
    for (const request of pending.values()) request.reject(new Error("Voice worker unavailable"));
    pending.clear();
  };
  worker.onerror = fail;
  worker.onmessageerror = fail;
  return worker;
}

function requestVoice(
  input: { type: "prepare"; voiceStyle: AssistantVoiceStyle } | { type: "generate"; input: SpeechInput },
  onProgress?: (progress: LocalVoiceProgress) => void,
): Promise<CompletedResponse> {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    try {
      const current = getWorker();
      pending.set(id, { resolve, reject, onProgress });
      // Honor browser capability/policy on both main and worker contexts.
      const allowWebGpu = Boolean((navigator as Navigator & { gpu?: unknown }).gpu);
      current.postMessage({ ...input, id, allowWebGpu } satisfies VoiceWorkerRequest);
    } catch (error) {
      pending.delete(id);
      reject(error);
    }
  });
}

export async function prepareLocalVoice(voiceStyle: AssistantVoiceStyle, onProgress?: (progress: LocalVoiceProgress) => void) {
  const response = await requestVoice({ type: "prepare", voiceStyle }, onProgress);
  if (response.type !== "prepared") throw new Error("Unexpected voice response");
  return response.backend;
}

export async function generateLocalSpeech({ onProgress, ...input }: SpeechInput & {
  onProgress?: (progress: LocalVoiceProgress) => void;
}): Promise<LocalSpeechResult> {
  const response = await requestVoice({ type: "generate", input }, onProgress);
  if (response.type !== "generated") throw new Error("Unexpected voice response");
  return response.result;
}
