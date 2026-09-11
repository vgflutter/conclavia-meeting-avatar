import type { AssistantVoiceStyle } from "@/types/assistant-profile";

const MODEL_BASE_PATH = "/api/avatar/voice-assets";
const MODEL_STEPS = 8;

type SupertonicModule = typeof import("@/lib/vendor/supertonic-web.js");
type VoiceEngine = {
  supertonic: SupertonicModule;
  textToSpeech: InstanceType<SupertonicModule["TextToSpeech"]>;
  backend: "webgpu" | "wasm";
};

export type LocalVoiceProgress =
  | { phase: "loading"; current: number; total: number }
  | { phase: "generating"; current: number; total: number };

export type LocalSpeechResult = {
  audio: Blob;
  samples: Float32Array;
  sampleRate: number;
  durationSeconds: number;
  backend: "webgpu" | "wasm";
};

let enginePromise: Promise<VoiceEngine> | undefined;
let webGpuAllowed = true;

export function configureLocalVoiceEngine(allowWebGpu: boolean) {
  webGpuAllowed = allowWebGpu;
}
let synthesisTail: Promise<unknown> = Promise.resolve();
const stylePromises = new Map<AssistantVoiceStyle, Promise<InstanceType<SupertonicModule["Style"]>>>();

function styleFile(style: AssistantVoiceStyle): string {
  return style === "executive_clear" ? "M1.json" : "M3.json";
}

async function createEngine(onProgress?: (progress: LocalVoiceProgress) => void) {
  const ort = await import("onnxruntime-web/webgpu");
  // Explicit fallback also works on hosts that enable cross-origin isolation.
  // Multi-thread/proxy execution must pass the CPU-only browser regression
  // before being enabled: a loadable worker does not prove speech completes.
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  const supertonic = await import("@/lib/vendor/supertonic-web.js");
  const load = async (backend: "webgpu" | "wasm") => {
    const result = await supertonic.loadTextToSpeech(
      MODEL_BASE_PATH,
      {
        executionProviders: [backend],
        graphOptimizationLevel: "all",
        logSeverityLevel: 3,
      },
      (_modelName, current, total) =>
        onProgress?.({ phase: "loading", current, total }),
    );
    return { supertonic, textToSpeech: result.textToSpeech, backend } satisfies VoiceEngine;
  };

  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (webGpuAllowed && gpu && await gpu.requestAdapter().catch(() => null)) {
    try { return await load("webgpu"); } catch { /* Use the CPU fallback below. */ }
  }
  return load("wasm");
}

async function getEngine(onProgress?: (progress: LocalVoiceProgress) => void) {
  enginePromise ??= createEngine(onProgress).catch((error) => {
    enginePromise = undefined;
    throw error;
  });
  return enginePromise;
}

async function getStyle(engine: VoiceEngine, style: AssistantVoiceStyle) {
  let stylePromise = stylePromises.get(style);
  if (!stylePromise) {
    stylePromise = engine.supertonic
      .loadVoiceStyle([`${MODEL_BASE_PATH}/${styleFile(style)}`])
      .catch((error) => {
        stylePromises.delete(style);
        throw error;
      });
    stylePromises.set(style, stylePromise);
  }
  return stylePromise;
}

export async function prepareLocalVoice(
  voiceStyle: AssistantVoiceStyle,
  onProgress?: (progress: LocalVoiceProgress) => void,
) {
  const engine = await getEngine(onProgress);
  await getStyle(engine, voiceStyle);
  return engine.backend;
}

export async function generateLocalSpeech({
  text,
  language,
  voiceStyle,
  speakingRate,
  onProgress,
}: {
  text: string;
  language: "it" | "en";
  voiceStyle: AssistantVoiceStyle;
  speakingRate: number;
  onProgress?: (progress: LocalVoiceProgress) => void;
}): Promise<LocalSpeechResult> {
  const engine = await getEngine(onProgress);
  const style = await getStyle(engine, voiceStyle);
  // ONNX sessions share buffers. Serialize inference, including speculative speech.
  const synthesis = synthesisTail.catch(() => undefined).then(() => engine.textToSpeech.call(
    text.trim(),
    language,
    style,
    MODEL_STEPS,
    speakingRate,
    0.24,
    (current, total) => onProgress?.({ phase: "generating", current, total }),
  ));
  synthesisTail = synthesis.catch(() => undefined);
  const result = await synthesis;
  // The vendor concatenator already trims every phrase to its predicted length.
  // Derive time from the exact PCM count instead of rounding the duration twice.
  const wav = result.wav;
  const durationSeconds = wav.length / engine.textToSpeech.sampleRate;
  const buffer = engine.supertonic.writeWavFile(wav, engine.textToSpeech.sampleRate);

  return {
    audio: new Blob([buffer], { type: "audio/wav" }),
    samples: Float32Array.from(wav),
    sampleRate: engine.textToSpeech.sampleRate,
    durationSeconds,
    backend: engine.backend,
  };
}
