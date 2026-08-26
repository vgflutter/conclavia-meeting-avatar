import { randomUUID } from "node:crypto";

import type { AvatarInterventionRequest, AvatarSpeechCue } from "../domain/protocol.js";
import { synthesizePerformanceSpeech } from "../conclavia/unreal-speech.js";
import type {
  ConclaviaDelivery,
  ConclaviaRendererSession,
  ConclaviaRendererStatus,
  ConclaviaVoiceConfig,
  StableListeningReaction,
} from "../conclavia/renderer.js";
import {
  listeningMoodIntensity,
  performanceBeatsForCue,
  performanceProfileForMood,
  speechTextForCue,
} from "./performance-plan.js";
import type { PerformanceHub } from "./performance-hub.js";
import {
  controlPerformancePacket,
  gesturePerformancePacket,
  listeningPerformancePacket,
  pcm16MonoToWav,
  speechPerformancePacket,
  type PerformanceAudioTrack,
} from "./performance-packet.js";

const voiceDirections: Readonly<Record<ConclaviaVoiceConfig["voiceStyle"], string>> = {
  natural: "naturale, presente",
  lively: "vivace, rapida, reattiva e naturale",
  authoritative: "autorevole, chiara e misurata",
};

export class WebPerformanceRenderer {
  readonly #hub: PerformanceHub;
  readonly #baseUrl: string;
  readonly #synthesize: typeof synthesizePerformanceSpeech;
  #armed = false;
  #avatarProfile = "showcase";
  #sessionId = randomUUID();
  #activePerformanceId: string | null = null;
  #deliveryGeneration = 0;

  constructor(
    hub: PerformanceHub,
    baseUrl: string,
    synthesize: typeof synthesizePerformanceSpeech = synthesizePerformanceSpeech,
  ) {
    this.#hub = hub;
    this.#baseUrl = baseUrl.replace(/\/$/u, "");
    this.#synthesize = synthesize;
  }

  get configured(): boolean {
    return true;
  }

  status(): Promise<ConclaviaRendererStatus> {
    return Promise.resolve({
      configured: true,
      available: this.#armed,
      serverStatus: this.#armed ? "ready" : "stopped",
      playerUrl: `${this.#baseUrl}/web-output`,
      avatarProfile: this.#avatarProfile,
      streamId: `web-performance:${this.#sessionId}`,
    });
  }

  start(avatarProfile = "showcase"): Promise<ConclaviaRendererSession> {
    this.#avatarProfile = avatarProfile;
    this.#sessionId = randomUUID();
    this.#armed = true;
    this.#hub.publish(controlPerformancePacket({
      avatarId: avatarProfile,
      avatarName: "Mary",
      event: "ready",
    }));
    return Promise.resolve({
      playerUrl: `${this.#baseUrl}/web-output`,
      serverStatus: "ready",
    });
  }

  stop(): Promise<void> {
    this.abortPending();
    if (this.#activePerformanceId) {
      this.#hub.publish(controlPerformancePacket({
        avatarId: this.#avatarProfile,
        avatarName: "Mary",
        event: "interrupt",
        targetPerformanceId: this.#activePerformanceId,
      }));
    }
    this.#activePerformanceId = null;
    this.#armed = false;
    return Promise.resolve();
  }

  async requestToSpeak(request: AvatarInterventionRequest): Promise<void> {
    await this.raiseHand(request.speakerName);
  }

  applaud(speakerName: string, targetName?: string): Promise<void> {
    this.#requireArmed();
    this.#hub.publish(gesturePerformancePacket({
      avatarId: this.#avatarProfile,
      avatarName: speakerName,
      gesture: "applause",
      // The authored seated take contains one continuous 3.5 second applause
      // passage. Stop before its end instead of visibly jumping back to the
      // beginning for a partial second loop.
      durationMs: 3_400,
      mood: "amused",
      rendererMood: "playfulness",
      intensity: 0.58,
      ...(targetName ? { targetName } : {}),
    }));
    return Promise.resolve();
  }

  raiseHand(speakerName: string): Promise<void> {
    this.#requireArmed();
    this.#hub.publish(gesturePerformancePacket({
      avatarId: this.#avatarProfile,
      avatarName: speakerName,
      gesture: "raise-hand",
      durationMs: 8_000,
      mood: "assertive",
      rendererMood: "confidence",
      intensity: 0.46,
    }));
    return Promise.resolve();
  }

  async settleRequest(speakerName: string): Promise<void> {
    await this.lowerHand(speakerName);
  }

  lowerHand(speakerName: string): Promise<void> {
    this.#requireArmed();
    this.#hub.publish(gesturePerformancePacket({
      avatarId: this.#avatarProfile,
      avatarName: speakerName,
      gesture: "lower-hand",
      durationMs: 2_000,
      mood: "neutral",
      rendererMood: "neutral",
      intensity: 0,
    }));
    return Promise.resolve();
  }

  interruptSpeech(speakerName: string): Promise<void> {
    this.abortPending();
    this.#hub.publish(controlPerformancePacket({
      avatarId: this.#avatarProfile,
      avatarName: speakerName,
      event: "interrupt",
      ...(this.#activePerformanceId
        ? { targetPerformanceId: this.#activePerformanceId }
        : {}),
    }));
    this.#activePerformanceId = null;
    return Promise.resolve();
  }

  reactToListening(
    reaction: StableListeningReaction,
    speakerName: string,
  ): Promise<void> {
    this.#requireArmed();
    const profile = performanceProfileForMood(reaction.mood);
    this.#hub.publish(listeningPerformancePacket({
      reaction,
      avatarId: this.#avatarProfile,
      avatarName: speakerName,
      rendererMood: profile.facialMood,
      intensity: listeningMoodIntensity(reaction.mood, reaction.level),
      focus: profile.focus,
    }));
    return Promise.resolve();
  }

  async deliver(
    cue: AvatarSpeechCue,
    voice: ConclaviaVoiceConfig = {
      voiceStyle: "lively",
      italianVoice: "Bianca",
      englishVoice: "Danielle",
    },
  ): Promise<ConclaviaDelivery> {
    this.#requireArmed();
    if (!speechTextForCue(cue)) throw new Error("La risposta di Mary è vuota");
    if (!cue.sentences[0]) throw new Error("La risposta di Mary non contiene frasi");
    const deliveryId = randomUUID();
    const generation = ++this.#deliveryGeneration;
    const deliveryStartedAt = performance.now();
    const sentencePromises = cue.sentences.map(async (sentence) => {
      const speech = await this.#synthesize({
        text: sentence.text,
        voice: sentence.language === "en-US"
          ? voice.englishVoice
          : voice.italianVoice,
        languageCode: sentence.language,
        direction: voiceDirections[voice.voiceStyle],
      });
      return speech;
    });
    const remainingResult = Promise.all(sentencePromises.slice(1)).then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error }),
    );
    const pauseBytes = 80 * 16_000 * 2 / 1_000;
    let cueMs = 0;
    let timeToFirstAudioMs = 0;
    const durations: number[] = [];
    const sentenceSpeech: Awaited<(typeof sentencePromises)[number]>[] = [];
    const publishChunk = (
      index: number,
      speech: Awaited<(typeof sentencePromises)[number]>,
    ): void => {
      this.#assertDeliveryGeneration(generation);
      const sentence = cue.sentences[index];
      if (!sentence) throw new Error(`Frase ${index + 1} non disponibile`);
      const hasPause = index < cue.sentences.length - 1;
      const pcm = new Uint8Array(speech.audio.byteLength + (hasPause ? pauseBytes : 0));
      pcm.set(speech.audio);
      const durationMs = Math.max(
        1,
        Math.round((pcm.byteLength / 2 / 16_000) * 1_000),
      );
      durations[index] = durationMs;
      const assetId = randomUUID();
      const audioTrack: PerformanceAudioTrack = {
        assetId,
        url: `${this.#baseUrl}/api/performance/audio/${assetId}.wav`,
        mimeType: "audio/wav",
        sampleRate: 16_000,
        channels: 1,
        durationMs,
        clockRole: "master",
      };
      const chunkCue: AvatarSpeechCue = { ...cue, sentences: [sentence] };
      const cueStartedAt = performance.now();
      const packet = this.#hub.publish(
        speechPerformancePacket({
          cue: chunkCue,
          avatarId: this.#avatarProfile,
          avatarName: cue.speakerName ?? "Mary",
          audio: audioTrack,
          beats: performanceBeatsForCue(chunkCue, durationMs, [durationMs]),
          speechMarks: speech.marks,
          delivery: { id: deliveryId, chunkIndex: index, chunkCount: cue.sentences.length },
        }),
        {
          id: assetId,
          bytes: pcm16MonoToWav(pcm),
          mimeType: "audio/wav",
          createdAt: new Date().toISOString(),
        },
      );
      cueMs += Math.round(performance.now() - cueStartedAt);
      this.#activePerformanceId = packet.performanceId;
    };

    const firstPromise = sentencePromises[0];
    if (!firstPromise) throw new Error("Sintesi della prima frase non disponibile");
    const first = await firstPromise;
    sentenceSpeech[0] = first;
    publishChunk(0, first);
    timeToFirstAudioMs = Math.round(performance.now() - deliveryStartedAt);
    try {
      const result = await remainingResult;
      if (!result.ok) throw result.error;
      this.#assertDeliveryGeneration(generation);
      result.value.forEach((speech, offset) => {
        const index = offset + 1;
        sentenceSpeech[index] = speech;
        publishChunk(index, speech);
      });
    } catch (error) {
      await this.interruptSpeech(cue.speakerName ?? "Mary");
      throw error;
    }
    const synthesisMs = Math.round(performance.now() - deliveryStartedAt);
    const durationMs = durations.reduce((total, duration) => total + duration, 0);
    return {
      delivered: true,
      durationMs,
      sentenceCount: cue.sentences.length,
      synthesisMs,
      cueMs,
      playbackMs: 0,
      timeToFirstAudioMs,
      voiceEngines: [...new Set(sentenceSpeech.map((sentence) => sentence.engine))],
    };
  }

  abortPending(): void {
    this.#deliveryGeneration += 1;
  }

  #assertDeliveryGeneration(generation: number): void {
    if (generation !== this.#deliveryGeneration) {
      const error = new Error("Web performance delivery interrupted");
      error.name = "AbortError";
      throw error;
    }
  }

  #requireArmed(): void {
    if (!this.#armed) throw new Error("Web performance renderer non avviato");
  }
}
