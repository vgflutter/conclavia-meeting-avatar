import type {
  avatarMoods,
  AvatarInterventionRequest,
  AvatarListeningReaction,
  AvatarSpeechSentence,
  AvatarSpeechCue,
} from "../domain/protocol.js";
import { resolveSpeechLanguage } from "../core/speech-language.js";
import type {
  EnglishVoiceId,
  ItalianVoiceId,
  VoiceStyle,
} from "../config/avatar-config.js";
import {
  listeningMoodIntensity,
  moodPreviewMoods,
  moodPreviewStepMs,
  performanceBeatsForCue,
  performanceProfileForMood,
  speechTextForCue,
} from "../performance/performance-plan.js";

export { performanceBeatsForCue, speechTextForCue } from "../performance/performance-plan.js";

export interface StableListeningReaction extends AvatarListeningReaction {
  holdMs: number;
}

export interface ConclaviaVoiceConfig {
  voiceStyle: VoiceStyle;
  italianVoice: ItalianVoiceId;
  englishVoice: EnglishVoiceId;
}

export interface ConclaviaRendererStatus {
  configured: boolean;
  available: boolean;
  serverStatus: string;
  playerUrl?: string;
  avatarProfile?: string;
  streamId?: string;
  error?: string;
}

export interface ConclaviaRendererSession {
  playerUrl: string;
  serverStatus: "ready";
}

export interface ConclaviaDelivery {
  delivered: true;
  durationMs: number;
  sentenceCount: number;
  synthesisMs: number;
  cueMs: number;
  playbackMs: number;
  timeToFirstAudioMs: number;
  voiceEngines: string[];
}

const voiceDirections: Readonly<Record<VoiceStyle, string>> = {
  natural: "naturale, presente",
  lively: "vivace, rapida, reattiva e naturale",
  authoritative: "autorevole, chiara e misurata",
};

interface JsonError {
  error?: string;
}

function configuredBaseUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString().replace(/\/$/u, "");
  } catch {
    return null;
  }
}

export class ConclaviaRenderer {
  readonly #baseUrl: string | null;
  #pendingController = new AbortController();
  #moodPreviewGeneration = 0;

  constructor(baseUrl: string | undefined) {
    this.#baseUrl = configuredBaseUrl(baseUrl);
  }

  get configured(): boolean {
    return this.#baseUrl !== null;
  }

  async status(): Promise<ConclaviaRendererStatus> {
    if (!this.#baseUrl) {
      return {
        configured: false,
        available: false,
        serverStatus: "unconfigured",
      };
    }

    try {
      const response = await fetch(`${this.#baseUrl}/api/unreal/status`, {
        headers: { accept: "application/json" },
        // The companion route performs an EC2 state check plus a bounded
        // Unreal health probe; give both operations time to finish.
        signal: this.#signal(20_000),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        configured?: boolean;
        available?: boolean;
        serverStatus?: string;
        playerUrl?: string;
        health?: {
          avatarId?: string;
          processId?: number;
          runtimeRevision?: string;
        };
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || `Conclavia status HTTP ${response.status}`);
      }
      return {
        configured: payload.configured === true,
        available: payload.available === true,
        serverStatus: payload.serverStatus ?? "unknown",
        ...(payload.playerUrl ? { playerUrl: payload.playerUrl } : {}),
        ...(payload.health?.avatarId ? { avatarProfile: payload.health.avatarId } : {}),
        ...(payload.health?.processId
          ? {
              streamId: [
                payload.health.runtimeRevision ?? "unreal",
                payload.health.processId,
              ].join(":"),
            }
          : {}),
      };
    } catch (error: unknown) {
      return {
        configured: true,
        available: false,
        serverStatus: "unreachable",
        error:
          error instanceof Error ? error.message : "Conclavia non raggiungibile",
      };
    }
  }

  async start(avatarProfile = "aera"): Promise<ConclaviaRendererSession> {
    const baseUrl = this.#requireBaseUrl();
    const response = await fetch(`${baseUrl}/api/unreal/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile: "meeting", avatarId: avatarProfile }),
      signal: this.#signal(185_000),
    });
    const payload = (await response.json().catch(() => ({}))) as JsonError & {
      playerUrl?: string;
    };
    if (!response.ok || !payload.playerUrl) {
      throw new Error(payload.error || `Avvio MetaHuman HTTP ${response.status}`);
    }
    return { playerUrl: payload.playerUrl, serverStatus: "ready" };
  }

  async stop(): Promise<void> {
    const baseUrl = this.#requireBaseUrl();
    const response = await fetch(`${baseUrl}/api/unreal/session`, {
      method: "DELETE",
      signal: this.#signal(20_000),
    });
    const payload = (await response.json().catch(() => ({}))) as JsonError;
    if (!response.ok) {
      throw new Error(payload.error || `Arresto MetaHuman HTTP ${response.status}`);
    }
  }

  async requestToSpeak(request: AvatarInterventionRequest): Promise<void> {
    await this.raiseHand(request.speakerName);
  }

  async applaud(speakerName: string, targetName?: string): Promise<void> {
    this.#cancelMoodPreview();
    await this.#postJson("/api/unreal/cue", {
      speakerId: "participant-1",
      targetId: "meeting-participant",
      speakerName,
      ...(targetName ? { targetName } : {}),
      shot: "wide",
      intent: "applause",
      bodyGesture: "applause",
      listenerSemanticMood: "amused",
      // The runtime owns a dedicated curve-only closed-mouth smile for
      // applause. Do not feed silence into the commercial happiness preset.
      listenerMood: "neutral",
      listenerMoodIntensity: 0,
      expectedDurationMs: 4_500,
      performanceBeats: [],
    });
  }

  async raiseHand(speakerName: string): Promise<void> {
    this.#cancelMoodPreview();
    await this.#postJson("/api/unreal/cue", {
      speakerId: "participant-1",
      targetId: "meeting-participant",
      speakerName,
      shot: "wide",
      intent: "request-to-speak",
      bodyGesture: "raise-hand",
      expectedDurationMs: 8_000,
      performanceBeats: [
        {
          atMs: 0,
          semanticMood: "assertive",
          mood: "confidence",
          intensity: 0.46,
          focus: "camera",
          gesture: "raise-hand",
        },
      ],
    });
  }

  async settleRequest(speakerName: string): Promise<void> {
    await this.lowerHand(speakerName);
  }

  async interruptSpeech(speakerName: string): Promise<void> {
    // Cancel synthesis or delivery still in flight, then tell Unreal to stop
    // any PCM that has already been accepted for playback.
    this.abortPending();
    this.#cancelMoodPreview();
    await this.#postJson("/api/unreal/cue", {
      speakerId: "participant-1",
      targetId: "meeting-participant",
      speakerName,
      shot: "close-up",
      intent: "interrupt",
      bodyGesture: "lower-hand",
      expectedDurationMs: 0,
      performanceBeats: [],
    });
  }

  async reactToListening(
    reaction: StableListeningReaction,
    speakerName: string,
  ): Promise<void> {
    this.#cancelMoodPreview();
    const profile = performanceProfileForMood(reaction.mood);
    await this.#postJson("/api/unreal/cue", {
      speakerId: "participant-1",
      targetId: "meeting-participant",
      speakerName,
      targetName: reaction.observedSpeakerName,
      shot: "reaction",
      intent: "listen-react",
      bodyGesture: "none",
      listenerSemanticMood: reaction.mood,
      // Use the native full-face solve. The former neutral base plus a small
      // hand-authored overlay made distinct moods look like the same face.
      listenerMood: profile.facialMood,
      listenerMoodIntensity: listeningMoodIntensity(reaction.mood, reaction.level),
      expectedDurationMs: reaction.holdMs,
    });
  }

  async previewMoods(
    speakerName: string,
    voice: ConclaviaVoiceConfig = {
      voiceStyle: "lively",
      italianVoice: "Bianca",
      englishVoice: "Danielle",
    },
    options: { stepMs?: number; waitForCompletion?: boolean } = {},
  ): Promise<void> {
    // The diagnostic is deliberately silent. Tying each pose to a one-word
    // TTS clip reduced the useful hold to a few hundred milliseconds and made
    // the twelve moods look like the same neutral face with twitching brows.
    void voice;
    const stepMs = Math.max(1, options.stepMs ?? moodPreviewStepMs);
    const generation = ++this.#moodPreviewGeneration;
    const continuation = this.#continueHeldMoodPreview(
      speakerName,
      moodPreviewMoods,
      stepMs,
      generation,
    );
    if (options.waitForCompletion) {
      await continuation;
    } else {
      void continuation.catch((error: unknown) => {
        console.error("Conclavia Unreal mood preview failed:", error);
      });
    }
  }

  async #continueHeldMoodPreview(
    speakerName: string,
    moods: readonly (typeof avatarMoods)[number][],
    stepMs: number,
    generation: number,
  ): Promise<void> {
    for (const mood of moods) {
      if (generation !== this.#moodPreviewGeneration) return;
      const profile = performanceProfileForMood(mood);
      const intensity = mood === "neutral"
        ? 0
        : Math.min(0.76, Math.max(0.58, listeningMoodIntensity(mood, 5) * 1.45));
      await this.#postJson("/api/unreal/cue", {
        speakerId: "participant-1",
        targetId: "meeting-participant",
        speakerName,
        shot: "reaction",
        intent: "listen-react",
        bodyGesture: "none",
        listenerSemanticMood: mood,
        listenerMood: profile.facialMood,
        listenerMoodIntensity: intensity,
        expectedDurationMs: Math.max(2_400, stepMs - 120),
        performanceBeats: [{
          atMs: 0,
          semanticMood: mood,
          mood: profile.facialMood,
          intensity,
          focus: profile.focus,
          gesture: "none",
        }],
      });
      await new Promise<void>((resolve) => setTimeout(resolve, stepMs));
    }
  }

  #cancelMoodPreview(): void {
    this.#moodPreviewGeneration += 1;
  }

  async lowerHand(speakerName: string): Promise<void> {
    this.#cancelMoodPreview();
    await this.#postJson("/api/unreal/cue", {
      speakerId: "participant-1",
      targetId: "meeting-participant",
      speakerName,
      shot: "close-up",
      intent: "listen",
      bodyGesture: "lower-hand",
      expectedDurationMs: 2_000,
      performanceBeats: [{
        atMs: 0,
        semanticMood: "neutral",
        mood: "neutral",
        intensity: 0,
        focus: "target",
        gesture: "lower-hand",
      }],
    });
  }

  async deliver(
    cue: AvatarSpeechCue,
    voice: ConclaviaVoiceConfig = {
    voiceStyle: "lively",
    italianVoice: "Bianca",
    englishVoice: "Danielle",
  },
  ): Promise<ConclaviaDelivery> {
    return this.#deliver(cue, voice, true);
  }

  async #deliver(
    cue: AvatarSpeechCue,
    voice: ConclaviaVoiceConfig,
    cancelMoodPreview: boolean,
  ): Promise<ConclaviaDelivery> {
    if (cancelMoodPreview) this.#cancelMoodPreview();
    const baseUrl = this.#requireBaseUrl();
    const text = speechTextForCue(cue);
    if (!text) throw new Error("La risposta di Mary è vuota");

    const deliveryStartedAt = performance.now();
    const sentencePcm = await Promise.all(cue.sentences.map(async (sentence) => {
      const requestStartedAt = performance.now();
      const language = resolveSpeechLanguage(sentence.language, sentence.text);
      const speechResponse = await fetch(`${baseUrl}/api/unreal/speech`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: sentence.text,
          voice: language === "en-US"
            ? voice.englishVoice
            : voice.italianVoice,
          languageCode: language,
          direction: voiceDirections[voice.voiceStyle],
        }),
        signal: this.#signal(30_000),
      });
      if (!speechResponse.ok) {
        const payload = (await speechResponse.json().catch(() => ({}))) as JsonError;
        throw new Error(payload.error || `Sintesi voce HTTP ${speechResponse.status}`);
      }
      const pcm = new Uint8Array(await speechResponse.arrayBuffer());
      const reportedMs = Number(speechResponse.headers.get("x-conclavia-tts-ms"));
      return {
        pcm,
        engine: speechResponse.headers.get("x-conclavia-engine") ?? "unknown",
        ttsMs: Number.isFinite(reportedMs) && reportedMs >= 0
          ? reportedMs
          : Math.round(performance.now() - requestStartedAt),
      };
    }));
    const synthesisMs = Math.round(performance.now() - deliveryStartedAt);
    const pauseBytes = 80 * 16_000 * 2 / 1_000;
    const totalBytes = sentencePcm.reduce(
      (total, sentence) => total + sentence.pcm.byteLength,
      Math.max(0, sentencePcm.length - 1) * pauseBytes,
    );
    const pcmBytes = new Uint8Array(totalBytes);
    const sentenceDurationsMs: number[] = [];
    let cursor = 0;
    for (const [index, sentence] of sentencePcm.entries()) {
      pcmBytes.set(sentence.pcm, cursor);
      cursor += sentence.pcm.byteLength;
      const hasPause = index < sentencePcm.length - 1;
      if (hasPause) cursor += pauseBytes;
      sentenceDurationsMs.push(
        Math.round((sentence.pcm.byteLength / 2 / 16_000) * 1_000)
          + (hasPause ? 80 : 0),
      );
    }
    const pcm = pcmBytes.buffer;
    const expectedDurationMs = Math.max(
      2_000,
      Math.round((pcm.byteLength / 2 / 16_000) * 1_000),
    );

    const cueStartedAt = performance.now();
    await this.#postJson("/api/unreal/cue", {
      speakerId: "participant-1",
      targetId: "meeting-participant",
      speakerName: cue.speakerName ?? "Mary",
      targetName: cue.addressedTo,
      shot: "close-up",
      intent: "answer",
      bodyGesture: "lower-hand",
      expectedDurationMs,
      performanceBeats: performanceBeatsForCue(
        cue,
        expectedDurationMs,
        sentenceDurationsMs,
      ),
    });
    const cueMs = Math.round(performance.now() - cueStartedAt);

    const playbackStartedAt = performance.now();
    const playbackResponse = await fetch(`${baseUrl}/api/unreal/audio/speech`, {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: pcm,
      signal: this.#signal(15_000),
    });
    const playback = (await playbackResponse.json().catch(() => ({}))) as
      JsonError & { durationMs?: number };
    if (!playbackResponse.ok || typeof playback.durationMs !== "number") {
      throw new Error(
        playback.error || `Riproduzione MetaHuman HTTP ${playbackResponse.status}`,
      );
    }
    const playbackMs = Math.round(performance.now() - playbackStartedAt);

    return {
      delivered: true,
      durationMs: playback.durationMs,
      sentenceCount: cue.sentences.length,
      synthesisMs,
      cueMs,
      playbackMs,
      timeToFirstAudioMs: Math.round(performance.now() - deliveryStartedAt),
      voiceEngines: [...new Set(sentencePcm.map((sentence) => sentence.engine))],
    };
  }

  async prefetchSpeech(
    sentence: AvatarSpeechSentence,
    voice: ConclaviaVoiceConfig,
  ): Promise<void> {
    const baseUrl = this.#requireBaseUrl();
    const language = resolveSpeechLanguage(sentence.language, sentence.text);
    const response = await fetch(`${baseUrl}/api/unreal/speech`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: sentence.text,
        voice: language === "en-US" ? voice.englishVoice : voice.italianVoice,
        languageCode: language,
        direction: voiceDirections[voice.voiceStyle],
      }),
      signal: this.#signal(30_000),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as JsonError;
      throw new Error(payload.error || `Precaricamento voce HTTP ${response.status}`);
    }
    await response.arrayBuffer();
  }

  #requireBaseUrl(): string {
    if (!this.#baseUrl) {
      throw new Error("CONCLAVIA_RENDERER_URL non configurato");
    }
    return this.#baseUrl;
  }

  abortPending(): void {
    this.#pendingController.abort();
    this.#pendingController = new AbortController();
  }

  #signal(timeoutMs: number): AbortSignal {
    return AbortSignal.any([
      this.#pendingController.signal,
      AbortSignal.timeout(timeoutMs),
    ]);
  }

  async #postJson(path: string, body: unknown): Promise<void> {
    const response = await fetch(`${this.#requireBaseUrl()}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      // Director cues normally complete in well under a second. Failing fast
      // prevents a stopped renderer from blocking the live transcript queue.
      signal: this.#signal(3_000),
    });
    const payload = (await response.json().catch(() => ({}))) as JsonError;
    if (!response.ok) {
      throw new Error(payload.error || `Conclavia HTTP ${response.status}`);
    }
  }
}
