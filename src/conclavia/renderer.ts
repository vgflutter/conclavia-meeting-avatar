import type {
  AvatarInterventionRequest,
  AvatarListeningReaction,
  AvatarMood,
  AvatarSpeechCue,
  AvatarSpeechSentence,
} from "../domain/protocol.js";
import type {
  EnglishVoiceId,
  ItalianVoiceId,
  VoiceStyle,
} from "../config/avatar-config.js";

type UnrealMood =
  | "neutral"
  | "happiness"
  | "sadness"
  | "disgust"
  | "anger"
  | "surprise"
  | "fear"
  | "confidence"
  | "excitement"
  | "boredom"
  | "playfulness"
  | "confusion";

interface UnrealPerformanceBeat {
  atMs: number;
  mood: UnrealMood;
  intensity: number;
  focus: "camera" | "target" | "thought";
  gesture:
    | "none"
    | "nod"
    | "tilt"
    | "emphasis"
    | "settle"
    | "raise-hand"
    | "lower-hand";
}

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
}

const voiceDirections: Readonly<Record<VoiceStyle, string>> = {
  natural: "naturale, presente",
  lively: "vivace, rapida, reattiva e naturale",
  authoritative: "autorevole, chiara e misurata",
};

interface JsonError {
  error?: string;
}

const moodMap: Readonly<Record<AvatarMood, UnrealMood>> = {
  neutral: "neutral",
  attentive: "confidence",
  curious: "confusion",
  amused: "playfulness",
  confident: "confidence",
  skeptical: "disgust",
  concerned: "fear",
  surprised: "surprise",
  empathetic: "sadness",
  assertive: "anger",
  frustrated: "anger",
  reflective: "neutral",
};

function listeningMoodIntensity(
  mood: UnrealMood,
  level: AvatarListeningReaction["level"],
): number {
  if (mood === "neutral") return 0;
  const base = [0, 0.12, 0.22, 0.34, 0.48, 0.62][level] ?? 0.22;
  const scale = mood === "anger" || mood === "disgust" ? 0.72 : 1;
  return Math.round(base * scale * 100) / 100;
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

function sentenceWeight(sentence: AvatarSpeechSentence): number {
  return Math.max(1, sentence.text.trim().split(/\s+/u).length);
}

function moodIntensity(
  mood: UnrealMood,
  level: AvatarSpeechSentence["level"],
  sentenceIndex: number,
): number {
  if (mood === "neutral") return 0;
  const base = [0, 0.28, 0.46, 0.66, 0.84, 1][level] ?? 0.66;
  const moodScale = mood === "boredom" || mood === "sadness"
    ? 0.88
    : mood === "fear" || mood === "confusion"
      ? 0.92
      : sentenceIndex % 2 === 0 ? 1 : 0.96;
  return Math.round(base * moodScale * 100) / 100;
}

function moodDirection(mood: UnrealMood): Pick<UnrealPerformanceBeat, "focus" | "gesture"> {
  switch (mood) {
    case "anger":
    case "disgust":
      return { focus: "target", gesture: "emphasis" };
    case "confusion":
    case "fear":
      return { focus: "thought", gesture: "tilt" };
    case "happiness":
    case "confidence":
      return { focus: "camera", gesture: "nod" };
    case "surprise":
    case "excitement":
    case "playfulness":
      return { focus: "camera", gesture: "emphasis" };
    default:
      return { focus: "target", gesture: "settle" };
  }
}

export function performanceBeatsForCue(
  cue: AvatarSpeechCue,
  durationMs: number,
  sentenceDurationsMs?: readonly number[],
): UnrealPerformanceBeat[] {
  const safeDurationMs = Math.max(2_000, Math.min(60_000, durationMs));
  const weights = sentenceDurationsMs?.length === cue.sentences.length
    && sentenceDurationsMs.every((value) => Number.isFinite(value) && value > 0)
    ? [...sentenceDurationsMs]
    : cue.sentences.map(sentenceWeight);
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  const moods = cue.sentences.map((sentence) => moodMap[sentence.mood]);
  const levels = cue.sentences.map((sentence) => sentence.level);
  const firstMood = moods[0] ?? "neutral";
  const beats: UnrealPerformanceBeat[] = [
    {
      atMs: 0,
      mood: firstMood,
      intensity: moodIntensity(firstMood, levels[0] ?? 3, 0),
      ...moodDirection(firstMood),
    },
  ];
  let elapsedWeight = 0;

  for (let index = 0; index < weights.length - 1; index += 1) {
    elapsedWeight += weights[index] ?? 0;
    const rawBoundary = Math.round((elapsedWeight / totalWeight) * safeDurationMs);
    const nextMood = moods[index + 1];
    if (!nextMood) continue;

    const previous = beats.at(-1)!;
    const remainingWeight = weights
      .slice(index + 1)
      .reduce((total, weight) => total + weight, 0);
    const followingBoundary = index + 1 === weights.length - 1
      ? safeDurationMs
      : Math.round(((totalWeight - remainingWeight + (weights[index + 1] ?? 0)) / totalWeight) * safeDurationMs);
    const fadeAtMs = Math.max(previous.atMs + 180, rawBoundary - 420);
    const switchAtMs = Math.max(fadeAtMs + 180, rawBoundary - 70);
    const riseAtMs = Math.min(
      followingBoundary - 260,
      Math.max(switchAtMs + 240, rawBoundary + 260),
    );

    if (riseAtMs <= switchAtMs + 120 || riseAtMs >= safeDurationMs - 180) continue;
    beats.push(
      {
        atMs: fadeAtMs,
        mood: previous.mood,
        intensity: 0.18,
        focus: previous.focus,
        gesture: "none",
      },
      {
        atMs: switchAtMs,
        mood: nextMood,
        intensity: 0.18,
        focus: moodDirection(nextMood).focus,
        gesture: "none",
      },
      {
        atMs: riseAtMs,
        mood: nextMood,
        intensity: moodIntensity(nextMood, levels[index + 1] ?? 3, index + 1),
        ...moodDirection(nextMood),
      },
    );
  }

  return beats.slice(0, 12);
}

export function speechTextForCue(cue: AvatarSpeechCue): string {
  return cue.sentences.map((sentence) => sentence.text.trim()).join(" ");
}

export class ConclaviaRenderer {
  readonly #baseUrl: string | null;
  #pendingController = new AbortController();

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
        // The Next.js route performs an EC2 state check plus a bounded Unreal
        // health probe; give both operations time to finish on a cold compile.
        signal: this.#signal(20_000),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        configured?: boolean;
        available?: boolean;
        serverStatus?: string;
        playerUrl?: string;
        health?: { avatarId?: string };
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
      body: JSON.stringify({ profile: "lipsync", avatarId: avatarProfile }),
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

  async raiseHand(speakerName: string): Promise<void> {
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
          mood: "confidence",
          intensity: 0.82,
          focus: "camera",
          gesture: "raise-hand",
        },
      ],
    });
  }

  async settleRequest(speakerName: string): Promise<void> {
    await this.lowerHand(speakerName);
  }

  async reactToListening(reaction: StableListeningReaction): Promise<void> {
    const mood = moodMap[reaction.mood];
    await this.#postJson("/api/unreal/cue", {
      speakerId: "participant-1",
      targetId: "meeting-participant",
      targetName: reaction.observedSpeakerName,
      shot: "reaction",
      intent: "listen-react",
      bodyGesture: "none",
      listenerMood: mood,
      listenerMoodIntensity: listeningMoodIntensity(mood, reaction.level),
      expectedDurationMs: reaction.holdMs,
    });
  }

  async lowerHand(speakerName: string): Promise<void> {
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
    const baseUrl = this.#requireBaseUrl();
    const text = speechTextForCue(cue);
    if (!text) throw new Error("La risposta di Mary è vuota");

    const sentencePcm = await Promise.all(cue.sentences.map(async (sentence) => {
      const speechResponse = await fetch(`${baseUrl}/api/unreal/speech`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: sentence.text,
          voice: sentence.language === "en-US"
            ? voice.englishVoice
            : voice.italianVoice,
          languageCode: sentence.language,
          direction: voiceDirections[voice.voiceStyle],
        }),
        signal: this.#signal(30_000),
      });
      if (!speechResponse.ok) {
        const payload = (await speechResponse.json().catch(() => ({}))) as JsonError;
        throw new Error(payload.error || `Sintesi voce HTTP ${speechResponse.status}`);
      }
      return new Uint8Array(await speechResponse.arrayBuffer());
    }));
    const pauseBytes = 80 * 16_000 * 2 / 1_000;
    const totalBytes = sentencePcm.reduce(
      (total, sentence) => total + sentence.byteLength,
      Math.max(0, sentencePcm.length - 1) * pauseBytes,
    );
    const pcmBytes = new Uint8Array(totalBytes);
    const sentenceDurationsMs: number[] = [];
    let cursor = 0;
    for (const [index, sentence] of sentencePcm.entries()) {
      pcmBytes.set(sentence, cursor);
      cursor += sentence.byteLength;
      const hasPause = index < sentencePcm.length - 1;
      if (hasPause) cursor += pauseBytes;
      sentenceDurationsMs.push(
        Math.round((sentence.byteLength / 2 / 16_000) * 1_000)
          + (hasPause ? 80 : 0),
      );
    }
    const pcm = pcmBytes.buffer;
    const expectedDurationMs = Math.max(
      2_000,
      Math.round((pcm.byteLength / 2 / 16_000) * 1_000),
    );

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

    return {
      delivered: true,
      durationMs: playback.durationMs,
      sentenceCount: cue.sentences.length,
    };
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
