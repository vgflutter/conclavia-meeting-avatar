import { playStreamingSpeech, requestStreamingSpeech, prefetchSpeechResponse } from "@conclavia/avatar-kit/lib/streaming-voice-player";
import type { SpeechAudioMixer } from "@conclavia/avatar-kit/lib/speech-audio-mixer";
import { getLlmModel } from "@/lib/podcast/llm-models";
import type { SpeechPlaybackProgress } from "@conclavia/avatar-kit/lib/streaming-voice-player";
import type { TalkRunMessageResponse, TalkRunResponse } from "@/types/podcast-run";

export type RehearsalPhase = "generating" | "buffering" | "speaking" | "pause" | "complete";
export interface RehearsalOptions {
  runId: string;
  maxTurns: number;
  signal: AbortSignal;
  audioContext: AudioContext;
  pauseMs?: number;
  afterSequence?: number;
  onRun: (run: TalkRunResponse) => void;
  onSpeech: (message: TalkRunMessageResponse | null) => void;
  onFrame: (viseme: string, level: number) => void;
  onPhase: (phase: RehearsalPhase) => void;
  onProgress?: (progress: SpeechPlaybackProgress) => void;
  onVoices?: (voices: RehearsalVoice[]) => void;
  onHeard?: (sequence: number) => void;
  mixer?: SpeechAudioMixer;
}
export interface RehearsalVoice { message: TalkRunMessageResponse; viseme: string; level: number; progress?: SpeechPlaybackProgress }
interface PlaybackCallbacks {
  destination?: AudioNode;
  signal: AbortSignal;
  audioContext: AudioContext;
  onFrame: RehearsalOptions["onFrame"];
  onStart: () => void;
  onProgress?: RehearsalOptions["onProgress"];
}
export interface RehearsalPorts {
  loadRun: (id: string, signal: AbortSignal) => Promise<TalkRunResponse>;
  advance: (id: string, signal: AbortSignal, onStored?: (run: TalkRunResponse) => void) => Promise<TalkRunResponse>;
  prepareSpeech: (run: TalkRunResponse, message: TalkRunMessageResponse, signal: AbortSignal) => Promise<Response>;
  playSpeech: (run: TalkRunResponse, message: TalkRunMessageResponse, response: Response, options: PlaybackCallbacks) => Promise<void>;
  wait: (ms: number, signal: AbortSignal) => Promise<void>;
  checkReady: (run: TalkRunResponse, signal: AbortSignal) => Promise<void>;
}

async function readRun(path: string, signal: AbortSignal, method = "GET") {
  const response = await fetch(path, { method, signal, cache: "no-store" });
  const data = await response.json();
  if (!response.ok || !data.run) throw new Error(typeof data.error === "string" ? data.error : "Podcast session unavailable");
  return data.run as TalkRunResponse;
}

const defaults: RehearsalPorts = {
  loadRun: (id, signal) => readRun(`/api/podcast/runs/${id}`, signal),
  advance: advanceRehearsalTurn,
  async prepareSpeech(run, message, signal) {
    return prefetchSpeechResponse(await requestStreamingSpeech({ endpoint: `/api/podcast/runs/${run.id}/speech`, payload: { sequence: message.sequence }, signal }), signal);
  },
  async playSpeech(run, message, response, options) {
    await playStreamingSpeech({ endpoint: `/api/podcast/runs/${run.id}/speech`, payload: { sequence: message.sequence }, response, initialBufferMs: 60, ...options });
  },
  wait(ms, signal) {
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(signal.reason ?? new DOMException("Aborted", "AbortError")); };
      const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, ms);
      signal.addEventListener("abort", abort, { once: true });
    });
  },
  async checkReady(run, signal) {
    const response = await fetch("/api/podcast/config", { signal, cache: "no-store" });
    if (!response.ok) throw new Error("Podcast services unavailable");
    const config = await response.json();
    const snapshot = run.talkSnapshot;
    const models = snapshot ? [...snapshot.participants.filter(person => person.kind === "ai").map(person => person.modelOverride ?? snapshot.settings.defaultModel), ...(snapshot.moderator.kind === "ai" ? [snapshot.moderator.modelOverride ?? snapshot.settings.defaultModel] : [])] : ["openai-default" as const];
    const aiReady = models.every(model => config.ai?.providers?.[getLlmModel(model).provider] ?? (model === "openai-default" && config.ai?.ready));
    const speechProvider = (run.talkSnapshot?.settings as { voiceProvider?: string } | undefined)?.voiceProvider ?? "inworld";
    if (!config.ai?.enabled || !aiReady ||
        !config.speech?.enabled || !(config.speech.providers?.[speechProvider] ?? config.speech.ready)) {
      throw new Error("Activate the selected AI and voice services before starting the rehearsal");
    }
  },
};

/** An early event is emitted only after validated text+moods are durably stored. */
export async function advanceRehearsalTurn(id: string, signal: AbortSignal, onStored?: (run: TalkRunResponse) => void): Promise<TalkRunResponse> {
  const response = await fetch(`/api/podcast/runs/${id}/next/stream`, { method: "POST", signal, cache: "no-store" });
  if (!response.ok || !response.body) throw new Error("Podcast generation unavailable");
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = "", bytes = 0, result: TalkRunResponse | undefined;
  try {
    while (true) {
      const chunk = await reader.read(); signal.throwIfAborted();
      bytes += chunk.value?.byteLength ?? 0;
      if (bytes > 1024 * 1024) throw new Error("Podcast event stream too long");
      buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      let separator: RegExpExecArray | null;
      while ((separator = /\r?\n\r?\n/u.exec(buffer))) {
        const block = buffer.slice(0, separator.index); buffer = buffer.slice(separator.index + separator[0].length);
        const data = block.split(/\r?\n/u).filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
        if (!data) continue;
        const event = JSON.parse(data) as { type: string; run?: TalkRunResponse; error?: string };
        if (event.type === "error") throw new Error(event.error || "Podcast generation failed");
        if (event.run && event.run.id !== id) throw new Error("Unexpected podcast session");
        if (event.type === "speech_stored" && event.run) onStored?.(event.run);
        if (event.type === "complete" && event.run) result = event.run;
      }
      if (chunk.done) break;
    }
    if (!result) throw new Error("Incomplete podcast generation stream");
    return result;
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}

type RunResult = { run: TalkRunResponse } | { error: unknown };
type PreparedTurn = { run: TalkRunResponse; message?: TalkRunMessageResponse; response?: Response; settled?: Promise<RunResult> };
type PendingTurn = Promise<{ value: PreparedTurn } | { error: unknown }>;

/** Mood/intent can permit a short handoff; never overlap a human, a closing or the same voice. */
export function overlapAllowed(current: TalkRunMessageResponse, next: TalkRunMessageResponse, progress: SpeechPlaybackProgress, settings?: { allowInterruptions?: boolean }): boolean {
  if (!settings?.allowInterruptions || !progress.complete || progress.bufferedSeconds < 1.5 || progress.bufferedSeconds - progress.seconds > .42 || progress.bufferedSeconds - progress.seconds <= .025 ||
      current.origin !== "ai" || next.origin !== "ai" || current.participantIndex === undefined || next.participantIndex === undefined || current.participantIndex === next.participantIndex ||
      current.intent === "closing" || next.intent === "closing") return false;
  const outgoing = current.performance?.sentences[progress.sentenceIndex ?? ((current.performance?.sentences.length ?? 1) - 1)];
  const incoming = next.performance?.sentences[0];
  const heated = (mood?: string, intensity = 0) => intensity >= .55 && (mood === "disagreement" || mood === "doubt");
  return next.intent === "interruption" || heated(outgoing?.mood, outgoing?.intensity) && (next.intent === "challenge" || heated(incoming?.mood, incoming?.intensity));
}

function conversationalPause(run: TalkRunResponse, message: TalkRunMessageResponse): number {
  const pace = run.talkSnapshot?.settings.pace;
  const base = pace === "deep" ? 340 : pace === "fast" ? 90 : 170;
  return message.intent === "question" || message.intent === "challenge" ? Math.max(60, base - 60) : base;
}

/** One response ahead; at most two audible voices, with bounded optional overlap. */
export async function runPodcastRehearsal(options: RehearsalOptions, overrides: Partial<RehearsalPorts> = {}): Promise<TalkRunResponse> {
  if (!Number.isInteger(options.maxTurns) || options.maxTurns < 1 || options.maxTurns > 8 ||
      !Number.isSafeInteger(options.afterSequence ?? 0) || (options.afterSequence ?? 0) < 0 ||
      options.pauseMs !== undefined && (!Number.isFinite(options.pauseMs) || options.pauseMs < 0 || options.pauseMs > 1500) || !/^[a-f\d]{24}$/i.test(options.runId)) throw new Error("Invalid rehearsal limits");
  options.signal.throwIfAborted();
  const ports = { ...defaults, ...overrides }, lifetime = new AbortController();
  const signal = AbortSignal.any([options.signal, lifetime.signal, AbortSignal.timeout(240_000)]);
  let current = await ports.loadRun(options.runId, signal);
  if (current.id !== options.runId) throw new Error("Unexpected podcast session");
  let cursor = options.afterSequence ?? 0, played = 0, foreground = 0, lastOverlap = -1;
  let pending: PendingTurn | undefined, aheadValue: PreparedTurn | undefined, tail: Promise<RunResult> | undefined;
  const voices = new Map<number, RehearsalVoice>();
  const publish = () => options.onVoices?.([...voices.values()]);
  const completed = () => { options.onPhase("complete"); return current; };
  const nextStored = (run: TalkRunResponse, after: number) => run.messages.find(message => message.sequence > after && message.origin === "ai");
  const withinBudget = (run: TalkRunResponse) => run.messages.filter(message => message.origin === "ai").length < options.maxTurns && run.estimatedAirtimeSeconds < 120;
  async function settled(prepared: PreparedTurn): Promise<TalkRunResponse> {
    if (!prepared.settled) return prepared.run;
    const result = await prepared.settled; if ("error" in result) throw result.error; return result.run;
  }
  async function prepare(run: TalkRunResponse, after: number): Promise<PreparedTurn> {
    signal.throwIfAborted();
    let message = nextStored(run, after), finalRun: Promise<RunResult> | undefined;
    if (!message) {
      if (["completed", "waiting_for_human"].includes(run.status) || !withinBudget(run)) return { run };
      if (run.status === "failed" || run.status === "generating") throw new Error("Podcast session is not ready to advance");
      let stored!: (value: TalkRunResponse) => void;
      const early = new Promise<TalkRunResponse>(resolve => { stored = resolve; });
      finalRun = ports.advance(run.id, signal, stored).then(value => { options.onRun(value); return { run: value }; }, error => ({ error }));
      run = await Promise.race([early, finalRun.then(result => { if ("error" in result) throw result.error; return result.run; })]);
      signal.throwIfAborted();
      if (run.id !== options.runId) throw new Error("Unexpected podcast session");
      options.onRun(run); message = nextStored(run, after);
      if (!message) {
        if (["completed", "waiting_for_human"].includes(run.status)) return { run, settled: finalRun };
        throw new Error("No new AI intervention was saved");
      }
    }
    if (message.sequence <= after || !message.content.trim()) throw new Error("Invalid AI intervention");
    const response = await ports.prepareSpeech(run, message, signal);
    if (signal.aborted) { await response.body?.cancel().catch(() => undefined); signal.throwIfAborted(); }
    return { run, message, response, settled: finalRun };
  }
  try {
    options.onRun(current);
    if (current.status === "waiting_for_human" && !nextStored(current, cursor)) return completed();
    const snapshot = current.talkSnapshot;
    if (snapshot && (snapshot.participants.length !== 2 || snapshot.participants.some(person => person.kind !== "ai") || snapshot.moderator.kind !== "none")) throw new Error("This rehearsal requires exactly two AI hosts");
    await ports.checkReady(current, signal);
    while (played < options.maxTurns) {
      signal.throwIfAborted(); options.onPhase("generating");
      let prepared: PreparedTurn;
      if (pending) {
        const result = await pending; pending = undefined; aheadValue = undefined;
        if ("error" in result) throw result.error;
        prepared = result.value;
      } else prepared = await prepare(current, cursor);
      current = prepared.run;
      if (!prepared.message || !prepared.response) return completed();
      const message = prepared.message, slot = message.participantIndex ?? 0;
      foreground = message.sequence;
      let requestedAhead = false, latestProgress: SpeechPlaybackProgress | undefined, yielded = false;
      let handoff!: () => void;
      const handoffReady = new Promise<"overlap">(resolve => { handoff = () => resolve("overlap"); });
      function maybeHandoff() {
        if (yielded || lastOverlap === message.sequence - 1 || voices.size !== 1 || !latestProgress || !aheadValue?.message || !aheadValue.response) return;
        if (overlapAllowed(message, aheadValue.message, latestProgress, current.talkSnapshot?.settings)) { yielded = true; handoff(); }
      }
      options.onPhase("buffering"); options.onSpeech(message); options.mixer?.start(slot);
      const playback = ports.playSpeech(current, message, prepared.response, {
        signal, audioContext: options.audioContext, destination: options.mixer?.input(slot),
        onFrame(shape, level) {
          if (foreground === message.sequence) options.onFrame(shape, level);
          const voice = voices.get(message.sequence); if (voice) { voices.set(message.sequence, { ...voice, viseme: shape, level }); publish(); }
        },
        onProgress(progress) {
          latestProgress = progress;
          if (foreground === message.sequence) options.onProgress?.(progress);
          const voice = voices.get(message.sequence); if (voice) { voices.set(message.sequence, { ...voice, progress }); publish(); }
          maybeHandoff();
        },
        onStart() {
          voices.set(message.sequence, { message, viseme: "rest", level: 0 }); publish();
          if (foreground === message.sequence) options.onPhase("speaking");
          if (requestedAhead || played + 1 >= options.maxTurns) return;
          requestedAhead = true;
          pending = settled(prepared).then(run => {
            if (nextStored(run, message.sequence) || (!['completed', 'waiting_for_human'].includes(run.status) && withinBudget(run))) return prepare(run, message.sequence);
            return { run };
          }).then(value => { aheadValue = value; maybeHandoff(); return { value }; }, error => ({ error }));
        },
      }).then(async () => {
        signal.throwIfAborted(); options.onHeard?.(message.sequence);
        return { run: await settled(prepared) } as RunResult;
      }, error => ({ error } as RunResult)).catch(error => ({ error } as RunResult)).finally(() => {
        voices.delete(message.sequence); publish(); options.mixer?.end(slot);
      });
      const outcome = await Promise.race([playback, handoffReady]);
      cursor = message.sequence; played++;
      if (outcome === "overlap") { tail = playback; lastOverlap = message.sequence; continue; }
      if ("error" in outcome) throw outcome.error;
      current = outcome.run;
      if (tail) { const previous = await tail; tail = undefined; if ("error" in previous) throw previous.error; }
      signal.throwIfAborted(); options.onSpeech(null);
      if (played >= options.maxTurns || (!pending && !nextStored(current, cursor) && (['completed', 'waiting_for_human'].includes(current.status) || !withinBudget(current)))) return completed();
      options.onPhase("pause"); await ports.wait(options.pauseMs ?? conversationalPause(current, message), signal);
    }
    if (tail) { const previous = await tail; if ("error" in previous) throw previous.error; }
    return completed();
  } finally {
    lifetime.abort(); options.onSpeech(null); options.onFrame("rest", 0); voices.clear(); publish(); options.mixer?.dispose();
    if (pending) void pending.then(result => { if ("value" in result) void result.value.response?.body?.cancel().catch(() => undefined); });
  }
}
