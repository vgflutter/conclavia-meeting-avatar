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
  type SpeechMark,
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
  #pendingController = new AbortController();

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
      durationMs: 4_500,
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
    const deliveryStartedAt = performance.now();
    const sentenceSpeech = await Promise.all(cue.sentences.map(async (sentence) => {
      const speech = await this.#synthesize({
        text: sentence.text,
        voice: sentence.language === "en-US"
          ? voice.englishVoice
          : voice.italianVoice,
        languageCode: sentence.language,
        direction: voiceDirections[voice.voiceStyle],
      });
      return speech;
    }));
    const synthesisMs = Math.round(performance.now() - deliveryStartedAt);
    const pauseBytes = 80 * 16_000 * 2 / 1_000;
    const totalBytes = sentenceSpeech.reduce(
      (total, sentence) => total + sentence.audio.byteLength,
      Math.max(0, sentenceSpeech.length - 1) * pauseBytes,
    );
    const pcm = new Uint8Array(totalBytes);
    const sentenceDurationsMs: number[] = [];
    const marks: SpeechMark[] = [];
    let cursor = 0;
    let elapsedMs = 0;
    for (const [index, sentence] of sentenceSpeech.entries()) {
      pcm.set(sentence.audio, cursor);
      cursor += sentence.audio.byteLength;
      marks.push(...sentence.marks.map((mark) => ({
        ...mark,
        time: mark.time + elapsedMs,
      })));
      const hasPause = index < sentenceSpeech.length - 1;
      if (hasPause) cursor += pauseBytes;
      const durationMs = Math.round((sentence.audio.byteLength / 2 / 16_000) * 1_000)
        + (hasPause ? 80 : 0);
      sentenceDurationsMs.push(durationMs);
      elapsedMs += durationMs;
    }

    const durationMs = Math.max(1, Math.round((pcm.byteLength / 2 / 16_000) * 1_000));
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
    const cueStartedAt = performance.now();
    const packet = this.#hub.publish(
      speechPerformancePacket({
        cue,
        avatarId: this.#avatarProfile,
        avatarName: cue.speakerName ?? "Mary",
        audio: audioTrack,
        beats: performanceBeatsForCue(cue, durationMs, sentenceDurationsMs),
        speechMarks: marks,
      }),
      {
        id: assetId,
        bytes: pcm16MonoToWav(pcm),
        mimeType: "audio/wav",
        createdAt: new Date().toISOString(),
      },
    );
    this.#activePerformanceId = packet.performanceId;
    const cueMs = Math.round(performance.now() - cueStartedAt);
    return {
      delivered: true,
      durationMs,
      sentenceCount: cue.sentences.length,
      synthesisMs,
      cueMs,
      playbackMs: 0,
      timeToFirstAudioMs: Math.round(performance.now() - deliveryStartedAt),
      voiceEngines: [...new Set(sentenceSpeech.map((sentence) => sentence.engine))],
    };
  }

  abortPending(): void {
    this.#pendingController.abort();
    this.#pendingController = new AbortController();
  }

  #requireArmed(): void {
    if (!this.#armed) throw new Error("Web performance renderer non avviato");
  }
}
