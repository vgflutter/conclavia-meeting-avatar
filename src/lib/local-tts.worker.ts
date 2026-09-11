import { configureLocalVoiceEngine, generateLocalSpeech, prepareLocalVoice } from "./local-tts-engine";
import type { LocalVoiceProgress } from "./local-tts-engine";
import type { VoiceWorkerRequest, VoiceWorkerResponse } from "./local-tts-protocol";

// ONNX owns its buffers in this worker, including the single-thread CPU fallback.
// Preparing the next phrase must not stop the page's lip-sync animation.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<VoiceWorkerRequest>) => void) | null;
  postMessage: (message: VoiceWorkerResponse, transfer?: Transferable[]) => void;
};
scope.onmessage = async ({ data }) => {
  const { id } = data;
  configureLocalVoiceEngine(data.allowWebGpu);
  const onProgress = (progress: LocalVoiceProgress) => scope.postMessage({ id, type: "progress", progress });
  try {
    if (data.type === "prepare") {
      const backend = await prepareLocalVoice(data.voiceStyle, onProgress);
      scope.postMessage({ id, type: "prepared", backend });
    } else {
      const result = await generateLocalSpeech({ ...data.input, onProgress });
      scope.postMessage({ id, type: "generated", result }, [result.samples.buffer as ArrayBuffer]);
    }
  } catch (error) {
    scope.postMessage({ id, type: "error", message: error instanceof Error ? error.message : "Voice generation failed" });
  }
};
