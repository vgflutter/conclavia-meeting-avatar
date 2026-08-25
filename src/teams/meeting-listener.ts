import { spawn, type ChildProcessByStdio } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";

import OpenAI, { toFile } from "openai";
import { OpenAIRealtimeWS } from "openai/realtime/ws";

import {
  isAddressedToAvatar,
  isDialogueFollowUpCandidate,
} from "../core/activation.js";
import type { TranscriptSegment } from "../domain/protocol.js";
import {
  findAvfoundationAudioDevice,
  listAvfoundationAudioDevices,
} from "./avfoundation.js";

const pcmChunkBytes = 4_800; // 100 ms of mono PCM16 at 24 kHz.
const connectionTimeoutMs = 15_000;
const clientVadSpeechThreshold = 0.0025;
const clientVadHoldThreshold = 0.0005;
const clientVadSilenceChunks = 9; // 900 ms keeps natural pauses inside one utterance.
const clientVadPrerollChunks = 4; // Preserve 400 ms before the first detected syllable.
const clientVadMaxTurnChunks = 120; // Never leave a noisy meeting turn open beyond 12 seconds.
const reconnectInitialDelayMs = 1_000;
const reconnectMaxDelayMs = 30_000;
const ffmpegForceKillDelayMs = 750;

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

export function pcm16MonoToWav(pcm: Buffer, sampleRate = 24_000): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.byteLength, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.byteLength, 40);
  return Buffer.concat([header, pcm]);
}

export function canSpeculateAddressedTurn(text: string, wakeWord: string): boolean {
  if (!canSpeculateTurn(text)) return false;
  return isAddressedToAvatar(text, wakeWord);
}

export function canSpeculateTurn(text: string): boolean {
  return text.trim().split(/\s+/u).filter(Boolean).length >= 3;
}

function normalizedTranscript(value: string): string {
  return value
    .toLocaleLowerCase("it-IT")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function isTranscriptionPromptEcho(text: string, wakeWord: string): boolean {
  const normalized = normalizedTranscript(text);
  const name = normalizedTranscript(wakeWord);
  const promptEchoes = [
    `riunione di lavoro in italiano l assistente virtuale si chiama ${name}`,
    `riunione di lavoro l assistente virtuale si chiama ${name}`,
    `riunione di lavoro in italiano il nome dell assistente virtuale e ${name}`,
    `riunione di lavoro il nome dell assistente virtuale e ${name}`,
  ];
  return promptEchoes.includes(normalized);
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
  capturedAudioBytes: number;
  audibleAudioChunks: number;
  audioRms: number;
  lastAudioAt: string | null;
  committedAudioTurns: number;
  confirmedAudioTurns: number;
  transcriptionFailures: number;
  lastRealtimeEvent: string | null;
  lastRawTranscript: string | null;
  ignoredTranscriptionTurns: number;
  lastIgnoredTranscriptReason: "empty" | "prompt-echo" | null;
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
  #openai: OpenAI | null = null;
  #ffmpeg: ChildProcessByStdio<null, Readable, Readable> | null = null;
  #resolvedAudioDevice: string | null = null;
  #connectedAt: string | null = null;
  #speechDetected = false;
  #partialTranscript = "";
  #capturedAudioBytes = 0;
  #audibleAudioChunks = 0;
  #audioRms = 0;
  #lastAudioAt: string | null = null;
  #committedAudioTurns = 0;
  #confirmedAudioTurns = 0;
  #transcriptionFailures = 0;
  #lastRealtimeEvent: string | null = null;
  #lastRawTranscript: string | null = null;
  #ignoredTranscriptionTurns = 0;
  #lastIgnoredTranscriptReason: "empty" | "prompt-echo" | null = null;
  #completedTurns = 0;
  #lastSegment: TranscriptSegment | null = null;
  #lastResult: unknown = null;
  #lastError: string | null = null;
  #pendingAudio = Buffer.alloc(0);
  #manualTurnDetection = false;
  #clientVadSpeechSeen = false;
  #clientVadSilentChunks = 0;
  #clientVadPreroll: Buffer[] = [];
  #clientVadTurnChunks = 0;
  #clientVadPeakRms = 0;
  #localFileTranscription = false;
  #localAudioChunks: Buffer[] = [];
  #transcriptionQueue: Promise<void> = Promise.resolve();
  #activePartialItemId: string | null = null;
  #partialByItem = new Map<string, string>();
  #speculativeByItem = new Map<string, TranscriptSegment>();
  #turnQueue: Promise<void> = Promise.resolve();
  #desiredRunning = false;
  #reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  #reconnectDelayMs = reconnectInitialDelayMs;

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
      turnDetection: this.#manualTurnDetection
        ? `client-vad-${clientVadSilenceChunks * 100}ms`
        : "server-vad-350ms",
      connectedAt: this.#connectedAt,
      speechDetected: this.#speechDetected,
      partialTranscript: this.#partialTranscript,
      capturedAudioBytes: this.#capturedAudioBytes,
      audibleAudioChunks: this.#audibleAudioChunks,
      audioRms: this.#audioRms,
      lastAudioAt: this.#lastAudioAt,
      committedAudioTurns: this.#committedAudioTurns,
      confirmedAudioTurns: this.#confirmedAudioTurns,
      transcriptionFailures: this.#transcriptionFailures,
      lastRealtimeEvent: this.#lastRealtimeEvent,
      lastRawTranscript: this.#lastRawTranscript,
      ignoredTranscriptionTurns: this.#ignoredTranscriptionTurns,
      lastIgnoredTranscriptReason: this.#lastIgnoredTranscriptReason,
      completedTurns: this.#completedTurns,
      lastSegment: this.#lastSegment,
      lastResult: this.#lastResult,
      lastError: this.#lastError,
    };
  }

  async start(): Promise<MeetingListenerStatus> {
    this.#desiredRunning = true;
    if (this.#phase === "running" || this.#phase === "starting") return this.status;

    this.#clearReconnectTimer();

    this.#phase = "starting";
    this.#lastError = null;
    this.#partialTranscript = "";
    this.#speechDetected = false;
    this.#capturedAudioBytes = 0;
    this.#audibleAudioChunks = 0;
    this.#audioRms = 0;
    this.#lastAudioAt = null;
    this.#committedAudioTurns = 0;
    this.#confirmedAudioTurns = 0;
    this.#transcriptionFailures = 0;
    this.#lastRealtimeEvent = null;
    this.#lastRawTranscript = null;
    this.#ignoredTranscriptionTurns = 0;
    this.#lastIgnoredTranscriptReason = null;

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
      this.#openai = client;
      const realtime = new OpenAIRealtimeWS({ intent: "transcription" }, client);
      this.#realtime = realtime;
      realtime.on("event", (event) => {
        this.#lastRealtimeEvent = event.type;
      });
      realtime.on("error", (error) => this.#fail(`OpenAI Realtime: ${error.message}`));
      realtime.socket.on("close", () => {
        if (this.#phase === "running") {
          this.#fail("La sessione OpenAI Realtime si è chiusa; riconnessione automatica in corso.");
        }
      });
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
        this.#lastRawTranscript = transcript;
        if (!transcript) {
          this.#ignoredTranscriptionTurns += 1;
          this.#lastIgnoredTranscriptReason = "empty";
          return;
        }
        if (isTranscriptionPromptEcho(transcript, this.#options.wakeWord)) {
          this.#ignoredTranscriptionTurns += 1;
          this.#lastIgnoredTranscriptReason = "prompt-echo";
          return;
        }
        this.#lastIgnoredTranscriptReason = null;
        const speculative = this.#speculativeByItem.get(event.item_id);
        if (speculative) {
          speculative.text = transcript;
          this.#lastSegment = speculative;
          this.#speculativeByItem.delete(event.item_id);
          return;
        }
        this.#enqueueTranscript(transcript, event.item_id);
      });
      realtime.on("input_audio_buffer.committed", () => {
        this.#confirmedAudioTurns += 1;
      });
      realtime.on("conversation.item.input_audio_transcription.failed", (event) => {
        this.#transcriptionFailures += 1;
        this.#lastError = `Trascrizione Realtime: ${event.error.message}`;
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
      this.#manualTurnDetection = [
        "gpt-live-transcribe",
        "gpt-transcribe",
        "gpt-4o-mini-transcribe",
      ].includes(
        this.#options.transcriptionModel,
      );
      this.#localFileTranscription = ["gpt-transcribe", "gpt-4o-mini-transcribe"].includes(
        this.#options.transcriptionModel,
      );
      realtime.send({
        type: "session.update",
        session: {
          type: "transcription",
          audio: {
            input: {
              format: { type: "audio/pcm", rate: 24_000 },
              transcription: supportsLiveHints
                ? this.#options.transcriptionModel === "gpt-live-transcribe"
                  ? {
                    model: this.#options.transcriptionModel,
                    languages: ["it", "en"],
                    prompt: `Riunione di lavoro. L'assistente virtuale si chiama ${this.#options.wakeWord}.`,
                    keywords: [
                      this.#options.wakeWord,
                      "Conclavia",
                      "MetaHuman",
                      "Microsoft Teams",
                      "Google Meet",
                    ],
                    delay: "minimal" as const,
                  }
                  : { model: this.#options.transcriptionModel }
                : {
                    model: this.#options.transcriptionModel,
                    language: "it",
                    prompt: `Riunione di lavoro in italiano. L'assistente virtuale si chiama ${this.#options.wakeWord}.`,
                  },
              turn_detection: this.#manualTurnDetection ? null : {
                type: "server_vad",
                create_response: false,
                interrupt_response: false,
                threshold: 0.12,
                prefix_padding_ms: 600,
                silence_duration_ms: 350,
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
          "-af",
          "pan=mono|c0=c0",
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
      ffmpeg.stdout.on("data", (chunk: Buffer) => {
        if (this.#ffmpeg !== ffmpeg) return;
        this.#appendAudio(chunk);
      });
      ffmpeg.stderr.on("data", (chunk: Buffer) => {
        if (this.#ffmpeg !== ffmpeg) return;
        const detail = chunk.toString("utf8").trim();
        if (detail) this.#lastError = detail.split("\n").at(-1) ?? detail;
      });
      ffmpeg.once("error", (error) => {
        if (this.#ffmpeg !== ffmpeg) return;
        this.#fail(`ffmpeg: ${error.message}`);
      });
      ffmpeg.once("close", (code, signal) => {
        if (this.#ffmpeg !== ffmpeg) return;
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
      this.#reconnectDelayMs = reconnectInitialDelayMs;
      return this.status;
    } catch (error: unknown) {
      this.#fail(errorMessage(error));
      throw error;
    }
  }

  async stop(): Promise<MeetingListenerStatus> {
    this.#desiredRunning = false;
    this.#clearReconnectTimer();
    if (this.#phase === "stopped") return this.status;
    this.#phase = "stopping";
    this.#cleanup();
    await Promise.race([
      Promise.all([
        this.#transcriptionQueue.catch(() => undefined),
        this.#turnQueue.catch(() => undefined),
      ]).then(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, 1_500)),
    ]);
    this.#phase = "stopped";
    this.#connectedAt = null;
    this.#speechDetected = false;
    this.#partialTranscript = "";
    return this.status;
  }

  #appendAudio(chunk: Buffer): void {
    this.#capturedAudioBytes += chunk.byteLength;
    this.#lastAudioAt = new Date().toISOString();
    const realtime = this.#realtime;
    if (this.#phase !== "running" || !realtime || realtime.socket.readyState !== realtime.socket.OPEN) {
      return;
    }
    this.#pendingAudio = Buffer.concat([this.#pendingAudio, chunk]);
    while (this.#pendingAudio.byteLength >= pcmChunkBytes) {
      const pcm = this.#pendingAudio.subarray(0, pcmChunkBytes);
      this.#pendingAudio = this.#pendingAudio.subarray(pcmChunkBytes);
      this.#audioRms = pcm16Rms(pcm);
      if (this.#audioRms >= clientVadSpeechThreshold) this.#audibleAudioChunks += 1;
      if (this.#manualTurnDetection) {
        this.#appendManualAudio(pcm, this.#audioRms, realtime);
      } else {
        realtime.send({ type: "input_audio_buffer.append", audio: pcm.toString("base64") });
      }
    }
  }

  #appendManualAudio(pcm: Buffer, rms: number, realtime: OpenAIRealtimeWS): void {
    if (!this.#clientVadSpeechSeen) {
      if (rms < clientVadSpeechThreshold) {
        this.#clientVadPreroll.push(Buffer.from(pcm));
        if (this.#clientVadPreroll.length > clientVadPrerollChunks) {
          this.#clientVadPreroll.shift();
        }
        return;
      }

      this.#clientVadSpeechSeen = true;
      this.#clientVadSilentChunks = 0;
      this.#clientVadTurnChunks = 1;
      this.#clientVadPeakRms = rms;
      this.#speechDetected = true;
      for (const prefix of this.#clientVadPreroll) {
        this.#appendTurnAudio(prefix, realtime);
      }
      this.#clientVadPreroll = [];
      this.#appendTurnAudio(pcm, realtime);
      return;
    }

    this.#appendTurnAudio(pcm, realtime);
    this.#clientVadTurnChunks += 1;
    this.#clientVadPeakRms = Math.max(this.#clientVadPeakRms, rms);
    // Once speech starts, keep a fixed low floor. A relative floor tied to the
    // loudest syllable truncates quieter words after a transient or plosive.
    if (rms >= clientVadHoldThreshold) {
      this.#clientVadSilentChunks = 0;
      this.#speechDetected = true;
      if (this.#clientVadTurnChunks < clientVadMaxTurnChunks) return;
    } else {
      this.#clientVadSilentChunks += 1;
      if (
        this.#clientVadSilentChunks < clientVadSilenceChunks
        && this.#clientVadTurnChunks < clientVadMaxTurnChunks
      ) return;
    }

    const itemId = this.#activePartialItemId;
    const partial = itemId ? this.#partialByItem.get(itemId)?.trim() : undefined;
    if (
      itemId &&
      partial &&
      (canSpeculateAddressedTurn(partial, this.#options.wakeWord) ||
        (this.#options.isConversationActive?.() === true &&
          canSpeculateTurn(partial) &&
          isDialogueFollowUpCandidate(partial))) &&
      !this.#speculativeByItem.has(itemId)
    ) {
      this.#speculativeByItem.set(itemId, this.#enqueueTranscript(partial, itemId));
    }
    this.#committedAudioTurns += 1;
    if (this.#localFileTranscription) {
      const audio = Buffer.concat(this.#localAudioChunks);
      this.#localAudioChunks = [];
      this.#confirmedAudioTurns += 1;
      this.#queueLocalTranscription(audio);
    } else {
      realtime.send({ type: "input_audio_buffer.commit" });
    }
    this.#clientVadSpeechSeen = false;
    this.#clientVadSilentChunks = 0;
    this.#clientVadPreroll = [];
    this.#clientVadTurnChunks = 0;
    this.#clientVadPeakRms = 0;
    this.#speechDetected = false;
  }

  #appendTurnAudio(pcm: Buffer, realtime: OpenAIRealtimeWS): void {
    if (this.#localFileTranscription) {
      this.#localAudioChunks.push(Buffer.from(pcm));
      return;
    }
    realtime.send({ type: "input_audio_buffer.append", audio: pcm.toString("base64") });
  }

  #queueLocalTranscription(pcm: Buffer): void {
    this.#transcriptionQueue = this.#transcriptionQueue
      .then(async () => {
        if (this.#phase !== "running" || pcm.byteLength === 0 || !this.#openai) return;
        const wav = pcm16MonoToWav(pcm);
        const file = await toFile(wav, `meeting-turn-${Date.now()}.wav`, { type: "audio/wav" });
        const transcription = await this.#openai.audio.transcriptions.create({
          file,
          model: this.#options.transcriptionModel,
          language: "it",
          response_format: "json",
        });
        const transcript = transcription.text.trim();
        this.#lastRawTranscript = transcript;
        if (!transcript) {
          this.#ignoredTranscriptionTurns += 1;
          this.#lastIgnoredTranscriptReason = "empty";
          return;
        }
        if (isTranscriptionPromptEcho(transcript, this.#options.wakeWord)) {
          this.#ignoredTranscriptionTurns += 1;
          this.#lastIgnoredTranscriptReason = "prompt-echo";
          return;
        }
        this.#lastIgnoredTranscriptReason = null;
        this.#enqueueTranscript(transcript);
      })
      .catch((error: unknown) => {
        this.#transcriptionFailures += 1;
        this.#lastError = `Trascrizione turno: ${errorMessage(error)}`;
      });
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
    if (this.#phase === "error" && this.#reconnectTimer) return;
    this.#lastError = message;
    this.#phase = "error";
    this.#cleanup();
    this.#scheduleReconnect();
  }

  #scheduleReconnect(): void {
    if (!this.#desiredRunning || this.#reconnectTimer) return;
    const delayMs = this.#reconnectDelayMs;
    this.#reconnectDelayMs = Math.min(this.#reconnectDelayMs * 2, reconnectMaxDelayMs);
    this.#reconnectTimer = setTimeout(() => {
      this.#reconnectTimer = null;
      if (!this.#desiredRunning || this.#phase !== "error") return;
      void this.start().catch(() => {
        // start() records the error and schedules the next bounded retry.
      });
    }, delayMs);
    this.#reconnectTimer.unref();
  }

  #clearReconnectTimer(): void {
    if (!this.#reconnectTimer) return;
    clearTimeout(this.#reconnectTimer);
    this.#reconnectTimer = null;
  }

  #cleanup(): void {
    const ffmpeg = this.#ffmpeg;
    this.#ffmpeg = null;
    if (ffmpeg) {
      ffmpeg.kill("SIGTERM");
      const forceKillTimer = setTimeout(() => {
        if (ffmpeg.exitCode === null && ffmpeg.signalCode === null) ffmpeg.kill("SIGKILL");
      }, ffmpegForceKillDelayMs);
      forceKillTimer.unref();
      ffmpeg.once("close", () => clearTimeout(forceKillTimer));
    }
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
    this.#clientVadPreroll = [];
    this.#clientVadTurnChunks = 0;
    this.#clientVadPeakRms = 0;
    this.#localFileTranscription = false;
    this.#localAudioChunks = [];
    this.#activePartialItemId = null;
    this.#partialByItem.clear();
    this.#speculativeByItem.clear();
  }
}
