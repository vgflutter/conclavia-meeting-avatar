import { playStreamingSpeech, requestStreamingSpeech } from "@conclavia/avatar-kit/lib/streaming-voice-player";
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
}
interface PlaybackCallbacks {
  signal: AbortSignal;
  audioContext: AudioContext;
  onFrame: RehearsalOptions["onFrame"];
  onStart: () => void;
  onProgress?: RehearsalOptions["onProgress"];
}
export interface RehearsalPorts {
  loadRun: (id: string, signal: AbortSignal) => Promise<TalkRunResponse>;
  advance: (id: string, signal: AbortSignal) => Promise<TalkRunResponse>;
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
  advance: (id, signal) => readRun(`/api/podcast/runs/${id}/next`, signal, "POST"),
  prepareSpeech: (run, message, signal) => requestStreamingSpeech({ endpoint: `/api/podcast/runs/${run.id}/speech`, payload: { sequence: message.sequence }, signal }),
  async playSpeech(run, message, response, options) {
    await playStreamingSpeech({ endpoint: `/api/podcast/runs/${run.id}/speech`, payload: { sequence: message.sequence }, response, ...options });
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
    const provider = run.talkSnapshot?.settings.defaultModel.startsWith("gemini") ? "gemini" : "openai";
    const speechProvider = (run.talkSnapshot?.settings as { voiceProvider?: string } | undefined)?.voiceProvider ?? "inworld";
    if (!config.ai?.enabled || !(config.ai.providers?.[provider] ?? config.ai.ready) ||
        !config.speech?.enabled || !(config.speech.providers?.[speechProvider] ?? config.speech.ready)) {
      throw new Error("Activate the selected AI and voice services before starting the rehearsal");
    }
  },
};

type PreparedTurn = { run: TalkRunResponse; message?: TalkRunMessageResponse; response?: Response };
type PendingTurn = Promise<{ value: PreparedTurn } | { error: unknown }>;

/** Two hosts, one utterance ahead, and a hard eight-turn/120-second editorial budget. */
export async function runPodcastRehearsal(options: RehearsalOptions, overrides: Partial<RehearsalPorts> = {}): Promise<TalkRunResponse> {
  const pauseMs = options.pauseMs ?? 550;
  if (!Number.isInteger(options.maxTurns) || options.maxTurns < 1 || options.maxTurns > 8 ||
      !Number.isSafeInteger(options.afterSequence ?? 0) || (options.afterSequence ?? 0) < 0 ||
      !Number.isFinite(pauseMs) || pauseMs < 0 || pauseMs > 1500 || !/^[a-f\d]{24}$/i.test(options.runId)) {
    throw new Error("Invalid rehearsal limits");
  }
  options.signal.throwIfAborted();
  const ports = { ...defaults, ...overrides };
  const lifetime = new AbortController();
  const signal = AbortSignal.any([options.signal, lifetime.signal, AbortSignal.timeout(240_000)]);
  let current = await ports.loadRun(options.runId, signal);
  if (current.id !== options.runId) throw new Error("Unexpected podcast session");
  let cursor = options.afterSequence ?? 0;
  let played = 0;
  let pending: PendingTurn | undefined;
  const completed = () => { options.onPhase("complete"); return current; };
  const nextStored = (run: TalkRunResponse, after: number) => run.messages.find(message => message.sequence > after && message.origin === "ai");
  const withinBudget = (run: TalkRunResponse) => run.messages.filter(message => message.origin === "ai").length < options.maxTurns && run.estimatedAirtimeSeconds < 120;

  async function prepare(run: TalkRunResponse, after: number): Promise<PreparedTurn> {
    signal.throwIfAborted();
    let message = nextStored(run, after);
    if (!message) {
      if (["completed", "waiting_for_human"].includes(run.status) || !withinBudget(run)) return { run };
      if (run.status === "failed" || run.status === "generating") throw new Error("Podcast session is not ready to advance");
      run = await ports.advance(run.id, signal);
      signal.throwIfAborted();
      if (run.id !== options.runId) throw new Error("Unexpected podcast session");
      options.onRun(run);
      message = nextStored(run, after);
      if (!message) {
        if (["completed", "waiting_for_human"].includes(run.status)) return { run };
        throw new Error("No new AI intervention was saved");
      }
    }
    if (message.sequence <= after || !message.content.trim()) throw new Error("Invalid AI intervention");
    const response = await ports.prepareSpeech(run, message, signal);
    if (signal.aborted) {
      await response.body?.cancel().catch(() => undefined);
      signal.throwIfAborted();
    }
    return { run, message, response };
  }

  try {
    options.onRun(current);
    if (current.status === "waiting_for_human" && !nextStored(current, cursor)) return completed();
    const snapshot = current.talkSnapshot;
    if (snapshot && (snapshot.participants.length !== 2 || snapshot.participants.some(person => person.kind !== "ai") || snapshot.moderator.kind !== "none")) {
      throw new Error("This rehearsal requires exactly two AI hosts");
    }
    await ports.checkReady(current, signal);
    while (played < options.maxTurns) {
      signal.throwIfAborted();
      options.onPhase("generating");
      let prepared: PreparedTurn;
      if (pending) {
        const result = await pending;
        pending = undefined;
        if ("error" in result) throw result.error;
        prepared = result.value;
      } else prepared = await prepare(current, cursor);
      current = prepared.run;
      if (!prepared.message || !prepared.response) return completed();
      const message = prepared.message;
      let requestedAhead = false;
      options.onPhase("buffering");
      options.onSpeech(message);
      await ports.playSpeech(current, message, prepared.response, {
        signal, audioContext: options.audioContext, onFrame: options.onFrame, onProgress: options.onProgress,
        onStart() {
          options.onPhase("speaking");
          if (requestedAhead || played + 1 >= options.maxTurns) return;
          requestedAhead = true;
          // Keep at most one LLM request and one unheard voice response in flight.
          if (nextStored(current, message.sequence) || (!['completed', 'waiting_for_human'].includes(current.status) && withinBudget(current))) {
            pending = prepare(current, message.sequence).then(value => ({ value }), error => ({ error }));
          }
        },
      });
      signal.throwIfAborted();
      cursor = message.sequence;
      played++;
      options.onSpeech(null);
      if (played >= options.maxTurns || (!pending && !nextStored(current, cursor) && (['completed', 'waiting_for_human'].includes(current.status) || !withinBudget(current)))) return completed();
      options.onPhase("pause");
      await ports.wait(pauseMs, signal);
    }
    return completed();
  } finally {
    lifetime.abort();
    options.onSpeech(null);
    options.onFrame("rest", 0);
    // A prefetched response may already be fulfilled when the operator presses Stop.
    if (pending) void pending.then(result => { if ("value" in result) void result.value.response?.body?.cancel().catch(() => undefined); });
  }
}
