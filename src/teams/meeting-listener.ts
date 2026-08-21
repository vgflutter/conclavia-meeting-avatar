import { spawn, type ChildProcessByStdio } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";

import OpenAI from "openai";
import { OpenAIRealtimeWS } from "openai/realtime/ws";

import type { TranscriptSegment } from "../domain/protocol.js";
import {
  findAvfoundationAudioDevice,
  listAvfoundationAudioDevices,
} from "./avfoundation.js";

const pcmChunkBytes = 4_800; // 100 ms of mono PCM16 at 24 kHz.
const connectionTimeoutMs = 15_000;
const clientVadSpeechThreshold = 0.006;
const clientVadSilenceChunks = 3; // 300 ms at the current chunk size.

export function pcm16Rms(chunk: Buffer): number {
  const sampleCount = Math.floor(chunk.byteLength / 2);
  if (sampleCount === 0) return 0;
  let squareSum = 0;
  for (let offset = 0; offset + 1 < chunk.byteLength; offset += 2) {
    const sample = chunk.readInt16LE(offset) / 32_768;
    squareSum += sample * sample;
  }
  return Math.sqrt(squareSum / sampleCount);
}

export function canSpeculateAddressedTurn(text: string, wakeWord: string): boolean {
  if (!canSpeculateTurn(text)) return false;
  const escapedWakeWord = wakeWord.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`(?:^|[^\\p{L}\\p{N}_])${escapedWakeWord}(?=$|[^\\p{L}\\p{N}_])`, "iu")
    .test(text);
}

export function canSpeculateTurn(text: string): boolean {
  return text.trim().split(/\s+/u).filter(Boolean).length >= 3;
}

export type MeetingListenerPhase = "stopped" | "starting" | "running" | "stopping" | "error";

export interface MeetingListenerStatus {
  phase: MeetingListenerPhase;
  running: boolean;
  audioDevice: string;
  resolvedAudioDevice: string | null;
  speakerName: string;
  model: string;
  turnDetection: string;
  connectedAt: string | null;
  speechDetected: boolean;
  partialTranscript: string;
  completedTurns: number;
  lastSegment: TranscriptSegment | null;
  lastResult: unknown;
  lastError: string | null;
}

export interface MeetingListenerOptions {
  apiKey: string;
  audioDevice: string;
  speakerName: string;
  transcriptionModel: string;
  wakeWord: string;
  isConversationActive?: () => boolean;
  onSegment: (segment: TranscriptSegment) => Promise<unknown>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), connectionTimeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

export class MeetingListener {
  readonly #options: MeetingListenerOptions;
  #phase: MeetingListenerPhase = "stopped";
  #realtime: OpenAIRealtimeWS | null = null;
  #ffmpeg: ChildProcessByStdio<null, Readable, Readable> | null = null;
  #resolvedAudioDevice: string | null = null;
  #connectedAt: string | null = null;
  #speechDetected = false;
  #partialTranscript = "";
  #completedTurns = 0;
  #lastSegment: TranscriptSegment | null = null;
  #lastResult: unknown = null;
  #lastError: string | null = null;
  #pendingAudio = Buffer.alloc(0);
  #manualTurnDetection = false;
  #clientVadSpeechSeen = false;
  #clientVadSilentChunks = 0;
  #activePartialItemId: string | null = null;
  #partialByItem = new Map<string, string>();
  #speculativeByItem = new Map<string, TranscriptSegment>();
  #turnQueue: Promise<void> = Promise.resolve();

  constructor(options: MeetingListenerOptions) {
    this.#options = options;
  }

  get status(): MeetingListenerStatus {
    return {
      phase: this.#phase,
      running: this.#phase === "running",
      audioDevice: this.#options.audioDevice,
      resolvedAudioDevice: this.#resolvedAudioDevice,
      speakerName: this.#options.speakerName,
      model: this.#options.transcriptionModel,
      turnDetection: this.#manualTurnDetection ? "client-vad-300ms" : "server-vad-450ms",
      connectedAt: this.#connectedAt,
      speechDetected: this.#speechDetected,
      partialTranscript: this.#partialTranscript,
      completedTurns: this.#completedTurns,
      lastSegment: this.#lastSegment,
      lastResult: this.#lastResult,
      lastError: this.#lastError,
    };
  }

  async start(): Promise<MeetingListenerStatus> {
    if (this.#phase === "running" || this.#phase === "starting") return this.status;

    this.#phase = "starting";
    this.#lastError = null;
    this.#partialTranscript = "";
    this.#speechDetected = false;

    try {
      const devices = await listAvfoundationAudioDevices();
      const device = findAvfoundationAudioDevice(devices, this.#options.audioDevice);
      if (!device) {
        const available = devices.map((candidate) => candidate.name).join(", ") || "nessuno";
        throw new Error(
          `Dispositivo “${this.#options.audioDevice}” non trovato. Disponibili: ${available}.`,
        );
      }
      this.#resolvedAudioDevice = `${device.name} (indice ${device.index})`;

      const client = new OpenAI({ apiKey: this.#options.apiKey });
      const realtime = new OpenAIRealtimeWS({ intent: "transcription" }, client);
      this.#realtime = realtime;
      realtime.on("error", (error) => this.#fail(`OpenAI Realtime: ${error.message}`));
      realtime.on("input_audio_buffer.speech_started", () => {
        this.#speechDetected = true;
      });
      realtime.on("input_audio_buffer.speech_stopped", () => {
        this.#speechDetected = false;
      });
      realtime.on("conversation.item.input_audio_transcription.delta", (event) => {
        if (!event.delta) return;
        const current = `${this.#partialByItem.get(event.item_id) ?? ""}${event.delta}`;
        this.#partialByItem.set(event.item_id, current);
        this.#activePartialItemId = event.item_id;
        this.#partialTranscript = current.trimStart();
      });
      realtime.on("conversation.item.input_audio_transcription.completed", (event) => {
        this.#partialByItem.delete(event.item_id);
        if (this.#activePartialItemId === event.item_id) this.#activePartialItemId = null;
        this.#partialTranscript = "";
        const transcript = event.transcript.trim();
        if (!transcript) return;
        const speculative = this.#speculativeByItem.get(event.item_id);
        if (speculative) {
          speculative.text = transcript;
          this.#lastSegment = speculative;
          this.#speculativeByItem.delete(event.item_id);
          return;
        }
        this.#enqueueTranscript(transcript, event.item_id);
      });

      await withTimeout(
        new Promise<void>((resolve, reject) => {
          realtime.socket.once("open", resolve);
          realtime.socket.once("error", reject);
          realtime.socket.once("close", () => reject(new Error("Connessione Realtime chiusa durante l'avvio.")));
        }),
        "Timeout durante la connessione a OpenAI Realtime.",
      );

      const updated = realtime.emitted("session.updated");
      const supportsLiveHints = ["gpt-live-transcribe", "gpt-transcribe"].includes(
        this.#options.transcriptionModel,
      );
      this.#manualTurnDetection = this.#options.transcriptionModel === "gpt-live-transcribe";
      realtime.send({
        type: "session.update",
        session: {
          type: "transcription",
          audio: {
            input: {
              format: { type: "audio/pcm", rate: 24_000 },
              transcription: supportsLiveHints
                ? {
                    model: this.#options.transcriptionModel,
                  languages: ["it", "en"],
                  prompt: `Riunione di lavoro. L'assistente virtuale si chiama ${this.#options.wakeWord}.`,
                  keywords: [this.#options.wakeWord, "Conclavia", "MetaHuman", "Microsoft Teams"],
                  ...(this.#manualTurnDetection ? { delay: "minimal" as const } : {}),
                  }
                : {
                    model: this.#options.transcriptionModel,
                    language: "it",
                    prompt: `Riunione di lavoro in italiano. L'assistente virtuale si chiama ${this.#options.wakeWord}.`,
                  },
              turn_detection: this.#manualTurnDetection ? null : {
                type: "server_vad",
                create_response: false,
                interrupt_response: false,
                threshold: 0.5,
                prefix_padding_ms: 300,
                // A meeting assistant should react promptly once a speaker
                // finishes, while still tolerating short pauses inside a phrase.
                silence_duration_ms: 450,
              },
            },
          },
        },
      });
      await withTimeout(updated, "OpenAI Realtime non ha confermato la sessione di trascrizione.");

      const ffmpeg = spawn(
        "ffmpeg",
        [
          "-nostdin",
          "-hide_banner",
          "-loglevel",
          "warning",
          "-f",
          "avfoundation",
          "-i",
          `:${device.index}`,
          "-ac",
          "1",
          "-ar",
          "24000",
          "-c:a",
          "pcm_s16le",
          "-f",
          "s16le",
          "pipe:1",
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
      this.#ffmpeg = ffmpeg;
      ffmpeg.stdout.on("data", (chunk: Buffer) => this.#appendAudio(chunk));
      ffmpeg.stderr.on("data", (chunk: Buffer) => {
        const detail = chunk.toString("utf8").trim();
        if (detail) this.#lastError = detail.split("\n").at(-1) ?? detail;
      });
      ffmpeg.once("error", (error) => this.#fail(`ffmpeg: ${error.message}`));
      ffmpeg.once("close", (code, signal) => {
        if (this.#phase === "stopping" || this.#phase === "stopped") return;
        this.#fail(`ffmpeg si è fermato (codice ${String(code)}, segnale ${String(signal)}).`);
      });
      await withTimeout(
        new Promise<void>((resolve, reject) => {
          ffmpeg.once("spawn", resolve);
          ffmpeg.once("error", reject);
        }),
        "Timeout durante l'avvio di ffmpeg.",
      );

      this.#phase = "running";
      this.#connectedAt = new Date().toISOString();
      this.#lastError = null;
      return this.status;
    } catch (error: unknown) {
      this.#fail(errorMessage(error));
      throw error;
    }
  }

  async stop(): Promise<MeetingListenerStatus> {
    if (this.#phase === "stopped") return this.status;
    this.#phase = "stopping";
    this.#cleanup();
    await Promise.race([
      this.#turnQueue.catch(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, 1_500)),
    ]);
    this.#phase = "stopped";
    this.#connectedAt = null;
    this.#speechDetected = false;
    this.#partialTranscript = "";
    return this.status;
  }

  #appendAudio(chunk: Buffer): void {
    const realtime = this.#realtime;
    if (this.#phase !== "running" || !realtime || realtime.socket.readyState !== realtime.socket.OPEN) {
      return;
    }
    this.#pendingAudio = Buffer.concat([this.#pendingAudio, chunk]);
    while (this.#pendingAudio.byteLength >= pcmChunkBytes) {
      const pcm = this.#pendingAudio.subarray(0, pcmChunkBytes);
      this.#pendingAudio = this.#pendingAudio.subarray(pcmChunkBytes);
      realtime.send({ type: "input_audio_buffer.append", audio: pcm.toString("base64") });
      if (this.#manualTurnDetection) this.#detectManualTurn(pcm, realtime);
    }
  }

  #detectManualTurn(pcm: Buffer, realtime: OpenAIRealtimeWS): void {
    if (pcm16Rms(pcm) >= clientVadSpeechThreshold) {
      this.#clientVadSpeechSeen = true;
      this.#clientVadSilentChunks = 0;
      this.#speechDetected = true;
      return;
    }
    if (!this.#clientVadSpeechSeen) return;
    this.#clientVadSilentChunks += 1;
    if (this.#clientVadSilentChunks < clientVadSilenceChunks) return;

    const itemId = this.#activePartialItemId;
    const partial = itemId ? this.#partialByItem.get(itemId)?.trim() : undefined;
    if (
      itemId &&
      partial &&
      (canSpeculateAddressedTurn(partial, this.#options.wakeWord) ||
        (this.#options.isConversationActive?.() === true && canSpeculateTurn(partial))) &&
      !this.#speculativeByItem.has(itemId)
    ) {
      this.#speculativeByItem.set(itemId, this.#enqueueTranscript(partial, itemId));
    }
    realtime.send({ type: "input_audio_buffer.commit" });
    this.#clientVadSpeechSeen = false;
    this.#clientVadSilentChunks = 0;
    this.#speechDetected = false;
  }

  #enqueueTranscript(text: string, id: string = randomUUID()): TranscriptSegment {
    const segment: TranscriptSegment = {
      id,
      speakerName: this.#options.speakerName,
      text,
      isFinal: true,
      capturedAt: new Date().toISOString(),
    };
    this.#turnQueue = this.#turnQueue
      .then(async () => {
        if (this.#phase !== "running") return;
        this.#lastSegment = segment;
        this.#completedTurns += 1;
        this.#lastResult = await this.#options.onSegment(segment);
      })
      .catch((error: unknown) => {
        this.#lastError = `Elaborazione frase: ${errorMessage(error)}`;
      });
    return segment;
  }

  #fail(message: string): void {
    if (this.#phase === "stopping" || this.#phase === "stopped") return;
    this.#lastError = message;
    this.#phase = "error";
    this.#cleanup();
  }

  #cleanup(): void {
    this.#ffmpeg?.kill("SIGTERM");
    this.#ffmpeg = null;
    const realtime = this.#realtime;
    this.#realtime = null;
    if (realtime) {
      realtime.close();
      realtime.socket.terminate();
    }
    this.#pendingAudio = Buffer.alloc(0);
    this.#manualTurnDetection = false;
    this.#clientVadSpeechSeen = false;
    this.#clientVadSilentChunks = 0;
    this.#activePartialItemId = null;
    this.#partialByItem.clear();
    this.#speculativeByItem.clear();
  }
}
