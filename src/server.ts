import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  decideActivation,
  isAutonomyCandidate,
  isDialogueDismissal,
  isFloorGrant,
} from "./core/activation.js";
import { ListeningReactionStabilizer } from "./core/listening-reaction.js";
import { DialogueLease } from "./core/dialogue-lease.js";
import { chatResponseChannel, matchChatCommand } from "./core/chat-commands.js";
import { dialogueParticipantKey } from "./core/participant-identity.js";
import { ConclaviaRenderer } from "./conclavia/renderer.js";
import { synthesizeUnrealSpeech } from "./conclavia/unreal-speech.js";
import {
  isUnrealAvatarId,
  playUnrealSpeech,
  sendUnrealDirectorCue,
  sendUnrealPcm,
  standaloneRendererStatus,
  startManagedUnrealStudio,
  stopUnrealStudio,
  type UnrealDirectorCue,
  type UnrealPerformanceBeat,
} from "./conclavia/unreal-studio.js";
import {
  avatarProfiles,
  AvatarConfigStore,
  defaultChatCommandAliases,
  englishVoices,
  italianVoices,
  meetingPlatforms,
  voiceStyles,
  type AvatarConfig,
  type AvatarConfigInput,
} from "./config/avatar-config.js";
import type {
  ActivationDecision,
  AvatarInterventionRequest,
  AvatarSpeechCue,
  ChatMessageInput,
  MeetingTranscriptInput,
  OutboundChatMessage,
  TranscriptSegment,
} from "./domain/protocol.js";
import { chatPlatforms } from "./domain/protocol.js";
import {
  hasSufficientAutonomousApplauseContext,
  MeetingIntelligence,
  qualifiesAutonomousApplause,
  qualifiesAutonomousIntervention,
} from "./openai/meeting-intelligence.js";
import { runMacosPreflight } from "./preflight/macos.js";
import { MeetingListener } from "./teams/meeting-listener.js";

const publicDirectory = join(dirname(fileURLToPath(import.meta.url)), "../public");
const staticFiles: ReadonlyMap<string, readonly [string, string]> = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/output", ["output.html", "text/html; charset=utf-8"]],
  ["/output.html", ["output.html", "text/html; charset=utf-8"]],
  ["/output.js", ["output.js", "text/javascript; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
] as const);
const maxRetainedSegments = 200;
const maxSeenChatMessages = 2_000;
const maxSeenTranscriptSegments = 4_000;
const maxAudioBytes = 20 * 1024 * 1024;
const interventionRequestTtlMs = 45_000;
const autonomousInterventionCooldownMs = 60_000;
const autonomousApplauseCooldownMs = 180_000;

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  let size = 0;

  for await (const chunk of request as AsyncIterable<Uint8Array>) {
    size += chunk.byteLength;
    if (size > 65_536) {
      throw new Error("Request body too large");
    }
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function readBinaryBody(request: IncomingMessage): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let size = 0;

  for await (const chunk of request as AsyncIterable<Uint8Array>) {
    size += chunk.byteLength;
    if (size > maxAudioBytes) {
      throw new Error("Audio too large (maximum 20 MB)");
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

function parseSpeakerName(value: string | null): string | null {
  const speakerName = value?.trim() ?? "";
  return speakerName && speakerName.length <= 80 ? speakerName : null;
}

function parseSimulationInput(value: unknown): { speakerName: string; text: string } | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.speakerName !== "string" || typeof record.text !== "string") {
    return null;
  }
  const speakerName = record.speakerName.trim();
  const text = record.text.trim();
  if (!speakerName || !text || speakerName.length > 80 || text.length > 2_000) {
    return null;
  }
  return { speakerName, text };
}

function parseUnrealDirectorCue(value: unknown): UnrealDirectorCue | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.speakerId !== "string" || !record.speakerId.trim() ||
    typeof record.speakerName !== "string" || !record.speakerName.trim() ||
    typeof record.shot !== "string" || !record.shot.trim() ||
    typeof record.intent !== "string" || !record.intent.trim() ||
    typeof record.expectedDurationMs !== "number" ||
    !Number.isFinite(record.expectedDurationMs) ||
    record.expectedDurationMs < 0 || record.expectedDurationMs > 120_000
  ) return null;

  const performanceBeats: UnrealPerformanceBeat[] = [];
  if (record.performanceBeats !== undefined) {
    if (!Array.isArray(record.performanceBeats) || record.performanceBeats.length > 24) {
      return null;
    }
    for (const value of record.performanceBeats) {
      if (typeof value !== "object" || value === null) return null;
      const beat = value as Record<string, unknown>;
      if (
        typeof beat.atMs !== "number" || !Number.isFinite(beat.atMs) ||
        beat.atMs < 0 || beat.atMs > 120_000 ||
        typeof beat.mood !== "string" || !beat.mood.trim() ||
        typeof beat.intensity !== "number" || !Number.isFinite(beat.intensity) ||
        beat.intensity < 0 || beat.intensity > 1 ||
        typeof beat.focus !== "string" || !beat.focus.trim() ||
        typeof beat.gesture !== "string" || !beat.gesture.trim()
      ) return null;
      performanceBeats.push({
        atMs: beat.atMs,
        semanticMood: typeof beat.semanticMood === "string" && beat.semanticMood.trim()
          ? beat.semanticMood.trim().slice(0, 40)
          : beat.mood.slice(0, 40),
        mood: beat.mood.slice(0, 40),
        intensity: beat.intensity,
        focus: beat.focus.slice(0, 40),
        gesture: beat.gesture.slice(0, 40),
      });
    }
  }

  const optionalText = (key: string): string | undefined => {
    const candidate = record[key];
    return typeof candidate === "string" && candidate.trim()
      ? candidate.trim().slice(0, 240)
      : undefined;
  };
  const bodyGesture = record.bodyGesture === "raise-hand" ||
      record.bodyGesture === "lower-hand" || record.bodyGesture === "applause" ||
      record.bodyGesture === "none"
    ? record.bodyGesture
    : undefined;
  const listenerMoodIntensity = typeof record.listenerMoodIntensity === "number"
      && Number.isFinite(record.listenerMoodIntensity)
      && record.listenerMoodIntensity >= 0
      && record.listenerMoodIntensity <= 1
    ? record.listenerMoodIntensity
    : undefined;
  const targetId = optionalText("targetId");
  const targetName = optionalText("targetName");
  const listenerSemanticMood = optionalText("listenerSemanticMood");
  const listenerMood = optionalText("listenerMood");
  return {
    speakerId: record.speakerId.trim().slice(0, 240),
    speakerName: record.speakerName.trim().slice(0, 80),
    shot: record.shot.trim().slice(0, 80),
    intent: record.intent.trim().slice(0, 80),
    expectedDurationMs: record.expectedDurationMs,
    ...(targetId ? { targetId } : {}),
    ...(targetName ? { targetName } : {}),
    ...(bodyGesture ? { bodyGesture } : {}),
    ...(listenerSemanticMood ? { listenerSemanticMood } : {}),
    ...(listenerMood ? { listenerMood } : {}),
    ...(listenerMoodIntensity !== undefined ? { listenerMoodIntensity } : {}),
    ...(performanceBeats.length ? { performanceBeats } : {}),
  };
}

function parseChatMessageInput(value: unknown): ChatMessageInput | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.platform !== "string" ||
    !chatPlatforms.includes(record.platform as ChatMessageInput["platform"]) ||
    typeof record.meetingId !== "string" ||
    typeof record.messageId !== "string" ||
    typeof record.speakerName !== "string" ||
    typeof record.text !== "string"
  ) {
    return null;
  }
  const meetingId = record.meetingId.trim();
  const messageId = record.messageId.trim();
  const speakerName = record.speakerName.trim();
  const speakerId = typeof record.speakerId === "string"
    ? record.speakerId.trim()
    : "";
  const text = record.text.trim();
  if (
    !meetingId || meetingId.length > 240 ||
    !messageId || messageId.length > 240 ||
    !speakerName || speakerName.length > 80 ||
    !text || text.length > 4_000
  ) {
    return null;
  }
  const requestedCapturedAt = typeof record.capturedAt === "string"
    ? Date.parse(record.capturedAt)
    : Number.NaN;
  return {
    platform: record.platform as ChatMessageInput["platform"],
    meetingId,
    messageId,
    ...(speakerId && speakerId.length <= 240 ? { speakerId } : {}),
    speakerName,
    text,
    ...(Number.isFinite(requestedCapturedAt)
      ? { capturedAt: new Date(requestedCapturedAt).toISOString() }
      : {}),
    senderIsAvatar: record.senderIsAvatar === true,
  };
}

function parseMeetingTranscriptInput(value: unknown): MeetingTranscriptInput | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.platform !== "string" ||
    !chatPlatforms.includes(record.platform as MeetingTranscriptInput["platform"]) ||
    typeof record.meetingId !== "string" ||
    typeof record.segmentId !== "string" ||
    typeof record.speakerId !== "string" ||
    typeof record.speakerName !== "string" ||
    typeof record.text !== "string"
  ) {
    return null;
  }
  const meetingId = record.meetingId.trim();
  const segmentId = record.segmentId.trim();
  const speakerId = record.speakerId.trim();
  const speakerName = record.speakerName.trim();
  const text = record.text.trim();
  if (
    !meetingId || meetingId.length > 240 ||
    !segmentId || segmentId.length > 240 ||
    !speakerId || speakerId.length > 240 ||
    !speakerName || speakerName.length > 80 ||
    !text || text.length > 4_000
  ) {
    return null;
  }
  const requestedCapturedAt = typeof record.capturedAt === "string"
    ? Date.parse(record.capturedAt)
    : Number.NaN;
  return {
    platform: record.platform as MeetingTranscriptInput["platform"],
    meetingId,
    segmentId,
    speakerId,
    speakerName,
    text,
    ...(Number.isFinite(requestedCapturedAt)
      ? { capturedAt: new Date(requestedCapturedAt).toISOString() }
      : {}),
    isFinal: record.isFinal !== false,
  };
}

function audioFileDetails(contentTypeHeader: string | undefined): {
  mimeType: string;
  extension: string;
} | null {
  const mimeType = contentTypeHeader?.split(";", 1)[0]?.trim().toLowerCase();
  const extensions: Readonly<Record<string, string>> = {
    "audio/webm": "webm",
    "video/webm": "webm",
    "audio/mp4": "m4a",
    "video/mp4": "mp4",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/ogg": "ogg",
    "audio/flac": "flac",
  };
  const extension = mimeType ? extensions[mimeType] : undefined;
  return mimeType && extension ? { mimeType, extension } : null;
}

async function serveStatic(pathname: string, response: ServerResponse): Promise<boolean> {
  const file = staticFiles.get(pathname);
  if (!file) {
    return false;
  }
  const [name, contentType] = file;
  const path = join(publicDirectory, name);
  const metadata = await stat(path);
  response.writeHead(200, {
    "content-type": contentType,
    "content-length": metadata.size,
    "cache-control": "no-cache",
  });
  createReadStream(path).pipe(response);
  return true;
}

export interface ServerOptions {
  host: string;
  port: number;
  wakeWord: string;
  dialogueTimeoutMs: number;
  dialogueMaxFollowUps: number;
  configPath: string;
  openaiApiKey: string | undefined;
  responseModel: string;
  transcriptionModel: string;
  realtimeTranscriptionModel: string;
  meetingAudioDevice: string;
  meetingSpeakerName: string;
  rendererUrl: string | undefined;
}

export function startServer(options: ServerOptions): Promise<void> {
  const transcriptHistory: TranscriptSegment[] = [];
  const seenChatMessageKeys = new Set<string>();
  const activeChatMessageKeys = new Set<string>();
  const seenTranscriptSegmentKeys = new Set<string>();
  const activeTranscriptSegmentKeys = new Set<string>();
  const configStore = new AvatarConfigStore(options.configPath, {
    avatarProfile: "aera",
    name: options.wakeWord,
    apiKey: options.openaiApiKey?.trim() ?? "",
    responseModel: options.responseModel,
    purpose:
      "Aiutare il gruppo a prendere decisioni migliori con informazioni verificabili, sintesi e punti di vista utili.",
    personality:
      "Competente, curiosa, concreta e cordiale. Non monopolizza la conversazione e non finge di sapere ciò che non sa.",
    systemPrompt:
      "Agisci come una partecipante reale alla riunione. Distingui fatti, ipotesi e opinioni; sii concisa e orientata all'obiettivo.",
    webSearchEnabled: true,
    requestToSpeakEnabled: true,
    autonomousApplauseEnabled: true,
    chatEnabled: true,
    chatCommandAliases: defaultChatCommandAliases,
    voiceStyle: "lively",
    italianVoice: "Bianca",
    englishVoice: "Danielle",
    meetingPlatform: "teams",
    meetingAudioDevice: options.meetingAudioDevice,
    meetingSpeakerName: options.meetingSpeakerName,
  });
  let runtimeConfig = configStore.current;
  const createIntelligence = (config: AvatarConfig) => config.apiKey
    ? new MeetingIntelligence({
        apiKey: config.apiKey,
        responseModel: config.responseModel,
        transcriptionModel: options.transcriptionModel,
        avatarName: config.name,
        purpose: config.purpose,
        personality: config.personality,
        systemPrompt: config.systemPrompt,
        webSearchEnabled: config.webSearchEnabled,
      })
    : null;
  let intelligence = createIntelligence(runtimeConfig);
  const renderer = new ConclaviaRenderer(options.rendererUrl);
  let rendererArmed = false;
  let rendererStarting = false;
  let rendererDesiredProfile: string | null = null;
  let rendererTargetProfile: string | null = null;
  let rendererStartBeganAt = 0;
  let rendererStartError: string | null = null;
  let rendererStartGeneration = 0;
  let rendererPlayerUrl: string | undefined;
  const dialogueLease = new DialogueLease(
    options.dialogueTimeoutMs,
    options.dialogueMaxFollowUps,
  );
  let pendingRequest: AvatarInterventionRequest | null = null;
  let lastAutonomousRequestAt = 0;
  let lastAutonomousApplauseAt = 0;
  let avatarHandRaised = false;
  const listeningReactions = new ListeningReactionStabilizer();

  const markRendererReady = (playerUrl?: string): void => {
    const shouldRestoreRaisedHand = !rendererArmed && avatarHandRaised;
    if (playerUrl) rendererPlayerUrl = playerUrl;
    rendererArmed = true;
    rendererStarting = false;
    rendererTargetProfile = null;
    rendererStartError = null;
    if (shouldRestoreRaisedHand) {
      void renderer.raiseHand(runtimeConfig.name).catch((error: unknown) => {
        console.error("Conclavia pending raise-hand cue failed:", error);
      });
    }
  };

  const beginRendererStart = (avatarProfile: string): boolean => {
    if (rendererStarting && rendererTargetProfile === avatarProfile) return false;

    const generation = ++rendererStartGeneration;
    renderer.abortPending();
    rendererArmed = false;
    rendererStarting = true;
    rendererDesiredProfile = avatarProfile;
    rendererTargetProfile = avatarProfile;
    rendererStartBeganAt = Date.now();
    rendererStartError = null;

    void renderer.start(avatarProfile).then((session) => {
      if (generation !== rendererStartGeneration) return;
      markRendererReady(session.playerUrl);
    }).catch((error: unknown) => {
      if (generation !== rendererStartGeneration || rendererArmed) return;
      rendererStartError = error instanceof Error
        ? error.message
        : "Avvio MetaHuman non riuscito.";
      // A cold Unreal boot can cross the HTTP timeout while continuing on the
      // GPU host. Keep reconciling status instead of making the user start it
      // a second time. Fast failures are final and immediately retryable.
      if (Date.now() - rendererStartBeganAt < 90_000) {
        rendererStarting = false;
        rendererTargetProfile = null;
      }
      console.error("Conclavia MetaHuman background start failed:", error);
    });
    return true;
  };

  const reconcileRendererStatus = (
    status: Awaited<ReturnType<ConclaviaRenderer["status"]>>,
  ): void => {
    if (
      rendererDesiredProfile &&
      status.available &&
      status.avatarProfile === rendererDesiredProfile
    ) {
      markRendererReady(status.playerUrl);
      return;
    }
    if (
      rendererStarting &&
      rendererStartError &&
      Date.now() - rendererStartBeganAt >= 270_000
    ) {
      rendererStarting = false;
      rendererTargetProfile = null;
    }
    if (
      !rendererStarting &&
      (status.serverStatus === "stopping" || status.serverStatus === "stopped")
    ) {
      rendererArmed = false;
    }
  };

  const participationSnapshot = () => {
    if (pendingRequest && Date.now() >= Date.parse(pendingRequest.expiresAt)) {
      pendingRequest = null;
      avatarHandRaised = false;
    }
    return pendingRequest;
  };

  const retainSegment = (segment: TranscriptSegment) => {
    transcriptHistory.push(segment);
    if (transcriptHistory.length > maxRetainedSegments) {
      transcriptHistory.splice(0, transcriptHistory.length - maxRetainedSegments);
    }
  };

  const retainAvatarCue = (
    cue: AvatarSpeechCue,
    source: TranscriptSegment["source"] = "speech",
    origin?: TranscriptSegment,
  ) => {
    retainSegment({
      id: cue.id,
      speakerName: cue.speakerName ?? runtimeConfig.name,
      text: cue.sentences.map((sentence) => sentence.text).join(" "),
      isFinal: true,
      capturedAt: cue.createdAt,
      source,
      ...(origin?.platform ? { platform: origin.platform } : {}),
      ...(origin?.meetingId ? { meetingId: origin.meetingId } : {}),
    });
  };

  const contextSnapshot = () => ({
    retainedSegmentCount: transcriptHistory.length,
    recentSegments: transcriptHistory.slice(-50),
    dialogue: dialogueLease.snapshot(),
    participationRequest: participationSnapshot(),
    avatarHandRaised,
    listeningReaction: listeningReactions.snapshot,
  });

  const processSegment = async (
    segment: TranscriptSegment,
    responseChannel: "voice" | "chat" = "voice",
  ) => {
    const startedAt = performance.now();
    let llmMs: number | null = null;
    let rendererMs: number | null = null;
    let usedWebSearch = false;
    const participantKey = dialogueParticipantKey(segment);
    let decision: ActivationDecision = decideActivation(
      segment,
      runtimeConfig.name,
      participantKey !== null && dialogueLease.isActiveFor(participantKey),
    );
    if (decision.ingested) retainSegment(segment);

    let warning: string | null = null;
    let delivery: Awaited<ReturnType<ConclaviaRenderer["deliver"]>> | null = null;
    let physicalAction: {
      kind: "applause";
      reason: string;
      importance: number;
      confidence: number;
    } | null = null;
    const currentRequest = participationSnapshot();

    if (isDialogueDismissal(segment.text, runtimeConfig.name)) {
      intelligence?.abortPending();
      pendingRequest = null;
      avatarHandRaised = false;
      dialogueLease.close();
      decision = {
        ingested: decision.ingested,
        activated: false,
        reason: "conversation-observed",
      };
      if (rendererArmed) {
        try {
          await renderer.interruptSpeech(runtimeConfig.name);
        } catch {
          // The verbal command still closes the local state if Unreal is unavailable.
        }
      }
    } else if (currentRequest && isFloorGrant(segment.text, runtimeConfig.name)) {
      pendingRequest = null;
      avatarHandRaised = false;
      decision = {
        ingested: true,
        activated: true,
        reason: "conversation-follow-up",
        cue: currentRequest.proposedCue,
      };
      if (participantKey) dialogueLease.open(participantKey, segment.speakerName);
      else dialogueLease.close();
      retainAvatarCue(currentRequest.proposedCue);
    } else {
      const direct = decision.activated;
      const allowAutonomousRequest =
        !direct &&
        !currentRequest &&
        runtimeConfig.requestToSpeakEnabled &&
        Date.now() - lastAutonomousRequestAt >= autonomousInterventionCooldownMs &&
        isAutonomyCandidate(segment.text);
      const allowAutonomousApplause =
        !direct &&
        !currentRequest &&
        !avatarHandRaised &&
        runtimeConfig.autonomousApplauseEnabled &&
        Date.now() - lastAutonomousApplauseAt >= autonomousApplauseCooldownMs &&
        isAutonomyCandidate(segment.text);

      if (direct && currentRequest) pendingRequest = null;

      // Every finalized participant turn reaches the meeting intelligence.
      // Small turns still inform Mary's listening reaction, but cannot trigger
      // an autonomous request to speak unless they pass the stricter gate.
      if (decision.ingested && intelligence) {
        try {
          const llmStartedAt = performance.now();
          const turn = await intelligence.evaluateTurn(
            transcriptHistory,
            segment,
            direct ? "direct" : "observer",
            responseChannel,
            allowAutonomousRequest || allowAutonomousApplause,
          );
          llmMs = Math.round(performance.now() - llmStartedAt);
          usedWebSearch = turn.usedWebSearch;
          const qualifiedAutonomousRequest = allowAutonomousRequest &&
            qualifiesAutonomousIntervention(turn);
          const qualifiedAutonomousApplause = allowAutonomousApplause &&
            qualifiesAutonomousApplause(turn) &&
            hasSufficientAutonomousApplauseContext(
              segment.text,
              transcriptHistory
                .filter((candidate) => candidate.source === "speech")
                .slice(-6)
                .map((candidate) => candidate.text),
            );

          const shouldPerformListeningReaction = turn.action === "silence" ||
            (turn.action === "request-to-speak" && !qualifiedAutonomousRequest) ||
            (turn.action === "applaud" && !qualifiedAutonomousApplause);
          const stableReaction = shouldPerformListeningReaction
            ? listeningReactions.consider(turn.listeningReaction)
            : null;
          if (stableReaction && rendererArmed) {
            try {
              const rendererStartedAt = performance.now();
              await renderer.reactToListening(stableReaction, runtimeConfig.name);
              rendererMs = Math.round(performance.now() - rendererStartedAt);
            } catch (error: unknown) {
              console.error("Conclavia listening-reaction cue failed:", error);
            }
          }

          // The floor controller is authoritative. Observer-mode output can
          // request the floor, but it can never make Mary speak directly.
          if (turn.action === "speak" && turn.cue && direct) {
            decision = { ...decision, activated: true, cue: turn.cue };
            if (decision.reason === "wake-word" && responseChannel === "voice") {
              if (participantKey) {
                dialogueLease.open(participantKey, segment.speakerName);
              } else {
                dialogueLease.close();
              }
            } else if (
              decision.reason === "conversation-follow-up" &&
              responseChannel === "voice" &&
              participantKey
            ) {
              dialogueLease.consumeFollowUp(participantKey);
            }
            retainAvatarCue(
              turn.cue,
              responseChannel === "chat" ? "chat" : "speech",
              segment,
            );
          } else if (qualifiedAutonomousApplause) {
            lastAutonomousApplauseAt = Date.now();
            physicalAction = {
              kind: "applause",
              reason: turn.reason,
              importance: turn.importance,
              confidence: turn.confidence,
            };
            decision = {
              ingested: decision.ingested,
              activated: false,
              reason: "autonomous-applause",
            };
            if (rendererArmed) {
              try {
                const rendererStartedAt = performance.now();
                await renderer.applaud(runtimeConfig.name, segment.speakerName);
                rendererMs = Math.round(performance.now() - rendererStartedAt);
              } catch (error: unknown) {
                console.error("Conclavia autonomous applause cue failed:", error);
                warning = `${runtimeConfig.name} ha apprezzato la conclusione, ma il gesto di applauso non è riuscito.`;
              }
            } else {
              warning = `${runtimeConfig.name} ha apprezzato la conclusione, ma il renderer non è armato.`;
            }
          } else if (
            turn.action === "request-to-speak" &&
            turn.cue &&
            qualifiedAutonomousRequest
          ) {
            const createdAt = new Date();
            const request: AvatarInterventionRequest = {
              id: randomUUID(),
              kind: "request-to-speak",
              speakerName: runtimeConfig.name,
              reason: turn.reason,
              interventionType: turn.interventionType,
              importance: turn.importance,
              confidence: turn.confidence,
              proposedCue: turn.cue,
              createdAt: createdAt.toISOString(),
              expiresAt: new Date(createdAt.getTime() + interventionRequestTtlMs).toISOString(),
            };
            pendingRequest = request;
            lastAutonomousRequestAt = createdAt.getTime();
            avatarHandRaised = true;
            decision = {
              ingested: decision.ingested,
              activated: false,
              reason: "autonomous-request",
              request,
            };
            if (rendererArmed) {
              try {
                const rendererStartedAt = performance.now();
                await renderer.requestToSpeak(request);
                rendererMs = Math.round(performance.now() - rendererStartedAt);
              } catch (error: unknown) {
                console.error("Conclavia request-to-speak cue failed:", error);
                warning = `${runtimeConfig.name} ha chiesto la parola, ma il cue del MetaHuman non è riuscito.`;
              }
            }
          } else {
            if (
              decision.reason === "conversation-follow-up" &&
              responseChannel === "voice" &&
              participantKey
            ) {
              dialogueLease.consumeFollowUp(participantKey);
            }
            decision = {
              ingested: decision.ingested,
              activated: false,
              reason: direct ? "conversation-observed" : "not-addressed",
            };
          }
        } catch (error: unknown) {
          console.error("OpenAI participation decision failed:", error);
          decision = {
            ingested: decision.ingested,
            activated: false,
            reason: direct ? "conversation-observed" : "not-addressed",
          };
          warning = `${runtimeConfig.name} ha ascoltato la frase, ma la valutazione OpenAI non è riuscita.`;
        }
      }
    }

    if (
      responseChannel === "voice" &&
      rendererArmed &&
      decision.cue?.provider === "openai"
    ) {
      try {
        const rendererStartedAt = performance.now();
        delivery = await renderer.deliver(decision.cue, {
          voiceStyle: runtimeConfig.voiceStyle,
          italianVoice: runtimeConfig.italianVoice,
          englishVoice: runtimeConfig.englishVoice,
        });
        rendererMs = (rendererMs ?? 0) + Math.round(performance.now() - rendererStartedAt);
      } catch (error: unknown) {
        console.error("Conclavia MetaHuman delivery failed:", error);
        const rendererWarning =
          `${runtimeConfig.name} ha generato la risposta, ma il MetaHuman non è riuscito a riprodurla.`;
        warning = warning ? `${warning} ${rendererWarning}` : rendererWarning;
      }
    }

    return {
      segment,
      llmContext: contextSnapshot(),
      decision,
      renderer: {
        armed: rendererArmed,
        playerUrl: rendererPlayerUrl ?? null,
        delivery,
      },
      physicalAction,
      latency: {
        llmMs,
        rendererMs,
        totalMs: Math.round(performance.now() - startedAt),
      },
      usedWebSearch,
      warning,
      responseChannel,
    };
  };

  const rememberChatMessage = (key: string) => {
    seenChatMessageKeys.add(key);
    while (seenChatMessageKeys.size > maxSeenChatMessages) {
      const oldest = seenChatMessageKeys.values().next().value;
      if (!oldest) break;
      seenChatMessageKeys.delete(oldest);
    }
  };

  const rememberTranscriptSegment = (key: string) => {
    seenTranscriptSegmentKeys.add(key);
    while (seenTranscriptSegmentKeys.size > maxSeenTranscriptSegments) {
      const oldest = seenTranscriptSegmentKeys.values().next().value;
      if (!oldest) break;
      seenTranscriptSegmentKeys.delete(oldest);
    }
  };

  const processChatMessage = async (input: ChatMessageInput) => {
    const segment: TranscriptSegment = {
      id: randomUUID(),
      ...(input.speakerId ? { speakerId: input.speakerId } : {}),
      speakerName: input.speakerName,
      text: input.text,
      isFinal: true,
      capturedAt: input.capturedAt ?? new Date().toISOString(),
      source: "chat",
      platform: input.platform,
      meetingId: input.meetingId,
      externalId: input.messageId,
    };
    const isSelfMessage = input.senderIsAvatar === true ||
      input.speakerName.localeCompare(runtimeConfig.name, undefined, { sensitivity: "accent" }) === 0;
    if (isSelfMessage) {
      return {
        accepted: false,
        reason: "self-message",
        segment,
        command: null,
        turn: null,
        outboundMessages: [] as OutboundChatMessage[],
      };
    }

    const command = matchChatCommand(
      input.text,
      runtimeConfig.name,
      runtimeConfig.chatCommandAliases,
    );

    if (
      command?.kind === "raise-hand" || command?.kind === "lower-hand" ||
      command?.kind === "applaud"
    ) {
      retainSegment(segment);
      let warning: string | null = null;
      if (command.kind === "lower-hand") pendingRequest = null;
      if (command.kind !== "applaud") avatarHandRaised = command.kind === "raise-hand";
      if (rendererArmed) {
        try {
          if (command.kind === "raise-hand") {
            await renderer.raiseHand(runtimeConfig.name);
          } else if (command.kind === "lower-hand") {
            await renderer.lowerHand(runtimeConfig.name);
          } else {
            await renderer.applaud(runtimeConfig.name, input.speakerName);
          }
        } catch (error: unknown) {
          warning = error instanceof Error ? error.message : "Comando gesto non riuscito.";
        }
      } else {
        warning = "Il comando è stato acquisito, ma il renderer non è armato.";
      }
      return {
        accepted: true,
        reason: "command",
        segment,
        command,
        action: command.kind,
        warning,
        turn: null,
        outboundMessages: [] as OutboundChatMessage[],
      };
    }

    // Chat remains silent by default: an @mention receives a written reply.
    // Voice is reserved for an explicit speak command or for granting a
    // pending request to speak, so a busy meeting cannot be hijacked by a
    // harmless chat question.
    const responseChannel = chatResponseChannel(
      input.text,
      runtimeConfig.name,
      command,
      participationSnapshot() !== null,
    );
    const turn = await processSegment(segment, responseChannel);
    const outboundMessages: OutboundChatMessage[] = [];
    if (responseChannel === "chat" && turn.decision.cue?.sentences.length) {
      outboundMessages.push({
        id: randomUUID(),
        platform: input.platform,
        meetingId: input.meetingId,
        replyToMessageId: input.messageId,
        speakerName: runtimeConfig.name,
        text: turn.decision.cue.sentences.map((sentence) => sentence.text).join(" "),
        createdAt: new Date().toISOString(),
      });
    }
    return {
      accepted: true,
      reason: command ? "command" : "message",
      segment,
      command,
      action: command?.kind ?? null,
      turn,
      outboundMessages,
    };
  };

  const createListener = () => runtimeConfig.apiKey
    ? new MeetingListener({
        apiKey: runtimeConfig.apiKey,
        audioDevice: runtimeConfig.meetingAudioDevice,
        speakerName: runtimeConfig.meetingSpeakerName,
        transcriptionModel: options.realtimeTranscriptionModel,
        wakeWord: runtimeConfig.name,
        onSegment: processSegment,
      })
    : null;
  let listener = createListener();

  const handleRequest = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

      if (request.method === "GET" && url.pathname === "/api/health") {
        sendJson(response, 200, {
          status: "ok",
          service: "conclavia-meeting-avatar",
          openaiConfigured: intelligence !== null,
          responseModel: runtimeConfig.responseModel,
          transcriptionModel: options.transcriptionModel,
          realtimeTranscriptionModel: options.realtimeTranscriptionModel,
          wakeWord: runtimeConfig.name,
          webSearchEnabled: runtimeConfig.webSearchEnabled,
          requestToSpeakEnabled: runtimeConfig.requestToSpeakEnabled,
          chatEnabled: runtimeConfig.chatEnabled,
          supportedChatPlatforms: chatPlatforms,
          dialogue: contextSnapshot().dialogue,
          participationRequest: participationSnapshot(),
          listener: listener?.status ?? null,
          rendererConfigured: renderer.configured,
          rendererArmed,
          rendererStarting,
          time: new Date().toISOString(),
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/unreal/status") {
        sendJson(response, 200, await standaloneRendererStatus());
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/unreal/session") {
        const body = await readJsonBody(request) as Record<string, unknown>;
        if (!isUnrealAvatarId(body.avatarId)) {
          sendJson(response, 400, { error: "Avatar MetaHuman non supportato." });
          return;
        }
        const session = await startManagedUnrealStudio(body.avatarId);
        sendJson(response, 200, {
          ok: true,
          playerUrl: session.playerUrl,
          health: session.health,
          avatarId: body.avatarId,
          facialAnimation: "runtime-metahuman-lipsync",
          audioEngine: "polly-neural-with-generative-fallback",
        });
        return;
      }

      if (request.method === "DELETE" && url.pathname === "/api/unreal/session") {
        await stopUnrealStudio();
        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/unreal/cue") {
        const cue = parseUnrealDirectorCue(await readJsonBody(request));
        if (!cue) {
          sendJson(response, 400, { error: "Cue Unreal non valido." });
          return;
        }
        await sendUnrealDirectorCue(cue);
        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/unreal/speech") {
        const synthesisStartedAt = performance.now();
        const speech = await synthesizeUnrealSpeech(
          await readJsonBody(request) as Record<string, unknown>,
        );
        const synthesisMs = Math.round(performance.now() - synthesisStartedAt);
        response.writeHead(200, {
          "content-type": "application/octet-stream",
          "content-length": speech.audio.byteLength,
          "cache-control": "no-store",
          "x-conclavia-voice": speech.voice,
          "x-conclavia-language": speech.languageCode,
          "x-conclavia-engine": speech.engine,
          "x-conclavia-tts-ms": String(synthesisMs),
          "server-timing": `tts;dur=${synthesisMs}`,
        });
        response.end(Buffer.from(speech.audio));
        return;
      }

      if (
        request.method === "POST" &&
        (url.pathname === "/api/unreal/audio" ||
          url.pathname === "/api/unreal/audio/speech")
      ) {
        if (!request.headers["content-type"]?.startsWith("application/octet-stream")) {
          sendJson(response, 415, { error: "È richiesto audio PCM binario." });
          return;
        }
        const audio = await readBinaryBody(request);
        if (!audio.byteLength || audio.byteLength % 2 !== 0) {
          sendJson(response, 400, { error: "Audio PCM non valido." });
          return;
        }
        if (url.pathname === "/api/unreal/audio/speech") {
          const playback = await playUnrealSpeech(audio);
          sendJson(response, 200, { ok: true, ...playback });
        } else {
          if (audio.byteLength > 384_000) {
            sendJson(response, 413, { error: "Chunk audio PCM troppo grande." });
            return;
          }
          await sendUnrealPcm(audio);
          sendJson(response, 200, { ok: true });
        }
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/config") {
        sendJson(response, 200, {
          config: configStore.publicConfig,
          options: {
            avatarProfiles,
            italianVoices,
            englishVoices,
            meetingPlatforms,
            voiceStyles,
          },
        });
        return;
      }

      if (request.method === "PUT" && url.pathname === "/api/config") {
        const input = await readJsonBody(request) as AvatarConfigInput;
        const wasListening = listener?.status.running === true;
        const previousAvatarProfile = runtimeConfig.avatarProfile;
        let nextConfig: AvatarConfig;
        try {
          nextConfig = configStore.update(input);
        } catch (error: unknown) {
          sendJson(response, 400, {
            error: error instanceof Error ? error.message : "Configurazione non valida.",
          });
          return;
        }

        intelligence?.abortPending();
        await listener?.stop();
        runtimeConfig = nextConfig;
        intelligence = createIntelligence(runtimeConfig);
        listener = createListener();
        pendingRequest = null;
        avatarHandRaised = false;
        lastAutonomousRequestAt = 0;
        lastAutonomousApplauseAt = 0;
        dialogueLease.close();

        let listenerWarning: string | null = null;
        if (wasListening && listener) {
          try {
            await listener.start();
          } catch (error: unknown) {
            listenerWarning = error instanceof Error
              ? error.message
              : "Riavvio dell'ascolto del meeting non riuscito.";
          }
        }
        let rendererRestarted = false;
        const rendererWarning: string | null = null;
        if (
          (rendererArmed || rendererStarting) &&
          previousAvatarProfile !== runtimeConfig.avatarProfile
        ) {
          rendererRestarted = beginRendererStart(runtimeConfig.avatarProfile);
        }
        sendJson(response, 200, {
          ok: true,
          config: configStore.publicConfig,
          listenerRestarted: wasListening && listener?.status.running === true,
          listenerWarning,
          rendererRestarted,
          rendererWarning,
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/participation") {
        sendJson(response, 200, { request: participationSnapshot() });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/participation/grant") {
        const intervention = participationSnapshot();
        if (!intervention) {
          sendJson(response, 409, { error: "Non ci sono richieste di parola in attesa." });
          return;
        }
        pendingRequest = null;
        avatarHandRaised = false;
        // A dashboard approval grants one prepared intervention, not an open
        // dialogue with an unknown participant. A verbal grant is attributed
        // to its actual speaker and opens the short lease above.
        dialogueLease.close();
        retainAvatarCue(intervention.proposedCue);
        let delivery: Awaited<ReturnType<ConclaviaRenderer["deliver"]>> | null = null;
        if (rendererArmed) {
          try {
            delivery = await renderer.deliver(intervention.proposedCue, {
              voiceStyle: runtimeConfig.voiceStyle,
              italianVoice: runtimeConfig.italianVoice,
              englishVoice: runtimeConfig.englishVoice,
            });
          } catch (error: unknown) {
            console.error("Granted intervention delivery failed:", error);
            sendJson(response, 502, {
              error: error instanceof Error ? error.message : "Riproduzione non riuscita.",
              cue: intervention.proposedCue,
            });
            return;
          }
        }
        sendJson(response, 200, {
          ok: true,
          cue: intervention.proposedCue,
          delivery,
          rendererArmed,
        });
        return;
      }

      if (request.method === "DELETE" && url.pathname === "/api/participation") {
        const intervention = participationSnapshot();
        pendingRequest = null;
        avatarHandRaised = false;
        if (intervention && rendererArmed) {
          try {
            await renderer.settleRequest(runtimeConfig.name);
          } catch {
            // Dismissal is still valid when the visual cue endpoint is unavailable.
          }
        }
        sendJson(response, 200, { ok: true, dismissed: intervention !== null });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/listener/status") {
        sendJson(response, 200, listener?.status ?? {
          phase: "unavailable",
          running: false,
          lastError: "OpenAI non configurato.",
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/listener/start") {
        if (!listener) {
          sendJson(response, 503, {
            error: "OpenAI non configurato. Inserisci la API key nella configurazione avatar.",
          });
          return;
        }
        try {
          sendJson(response, 200, await listener.start());
        } catch (error: unknown) {
          console.error("Meeting listener start failed:", error);
          sendJson(response, 502, {
            error: error instanceof Error ? error.message : "Avvio ascolto meeting non riuscito.",
            status: listener.status,
          });
        }
        return;
      }

      if (request.method === "DELETE" && url.pathname === "/api/listener/session") {
        if (!listener) {
          sendJson(response, 200, { phase: "stopped", running: false });
          return;
        }
        sendJson(response, 200, await listener.stop());
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/preflight") {
        sendJson(response, 200, await runMacosPreflight());
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/context") {
        sendJson(response, 200, contextSnapshot());
        return;
      }

      if (request.method === "DELETE" && url.pathname === "/api/context") {
        transcriptHistory.length = 0;
        pendingRequest = null;
        avatarHandRaised = false;
        lastAutonomousRequestAt = 0;
        lastAutonomousApplauseAt = 0;
        dialogueLease.close();
        if (rendererArmed) {
          try {
            await renderer.settleRequest(runtimeConfig.name);
          } catch {
            // Resetting the local simulation must still succeed if the gesture endpoint is unavailable.
          }
        }
        sendJson(response, 200, contextSnapshot());
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/chat/status") {
        sendJson(response, 200, {
          enabled: runtimeConfig.chatEnabled,
          avatarName: runtimeConfig.name,
          platforms: chatPlatforms,
          commandAliases: runtimeConfig.chatCommandAliases,
          retainedChatMessages: transcriptHistory.filter((segment) => segment.source === "chat").length,
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/renderer/status") {
        const status = await renderer.status();
        if (status.playerUrl) rendererPlayerUrl = status.playerUrl;
        reconcileRendererStatus(status);
        sendJson(response, 200, {
          ...status,
          armed: rendererArmed,
          starting: rendererStarting,
          targetAvatarProfile: rendererTargetProfile ?? rendererDesiredProfile,
          lastError: rendererStartError,
          playerUrl: rendererPlayerUrl ?? status.playerUrl ?? null,
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/renderer/avatar") {
        const body = await readJsonBody(request) as { avatarProfile?: unknown };
        const avatarProfile = typeof body.avatarProfile === "string"
          ? body.avatarProfile.trim()
          : "";
        if (!avatarProfiles.some((profile) => profile.id === avatarProfile)) {
          sendJson(response, 400, { error: "Profilo avatar non supportato." });
          return;
        }

        runtimeConfig = configStore.update({ avatarProfile });
        pendingRequest = null;
        avatarHandRaised = false;
        if (!renderer.configured) {
          sendJson(response, 503, { error: "CONCLAVIA_RENDERER_URL non configurato" });
          return;
        }
        beginRendererStart(avatarProfile);
        sendJson(response, 202, {
          ok: true,
          avatarProfile,
          armed: false,
          starting: true,
          playerUrl: rendererPlayerUrl ?? null,
          serverStatus: "starting",
          config: configStore.publicConfig,
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/renderer/start") {
        if (!renderer.configured) {
          sendJson(response, 503, { error: "CONCLAVIA_RENDERER_URL non configurato" });
          return;
        }
        beginRendererStart(runtimeConfig.avatarProfile);
        sendJson(response, 202, {
          ok: true,
          armed: false,
          starting: true,
          avatarProfile: runtimeConfig.avatarProfile,
          playerUrl: rendererPlayerUrl ?? null,
          serverStatus: "starting",
        });
        return;
      }

      if (request.method === "DELETE" && url.pathname === "/api/renderer/session") {
        rendererStartGeneration += 1;
        rendererStarting = false;
        rendererDesiredProfile = null;
        rendererTargetProfile = null;
        rendererStartError = null;
        rendererArmed = false;
        renderer.abortPending();
        try {
          await renderer.stop();
          rendererPlayerUrl = undefined;
          sendJson(response, 200, { ok: true, armed: false });
        } catch (error: unknown) {
          console.error("Conclavia MetaHuman stop failed:", error);
          sendJson(response, 502, {
            error:
              error instanceof Error
                ? error.message
                : "Arresto MetaHuman non riuscito",
          });
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/simulate") {
        const input = parseSimulationInput(await readJsonBody(request));
        if (!input) {
          sendJson(response, 400, { error: "Invalid speakerName or text" });
          return;
        }

        const segment: TranscriptSegment = {
          id: randomUUID(),
          speakerId: input.speakerName,
          speakerName: input.speakerName,
          text: input.text,
          isFinal: true,
          capturedAt: new Date().toISOString(),
          source: "manual",
          platform: "generic",
          meetingId: "test-room",
        };
        sendJson(response, 200, await processSegment(segment));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/transcript/segments") {
        const input = parseMeetingTranscriptInput(await readJsonBody(request));
        if (!input) {
          sendJson(response, 400, { error: "Invalid meeting transcript payload" });
          return;
        }

        const key = `${input.platform}\u0000${input.meetingId}\u0000${input.segmentId}`;
        if (input.isFinal !== false && seenTranscriptSegmentKeys.has(key)) {
          sendJson(response, 200, {
            accepted: false,
            duplicate: true,
            reason: "duplicate",
          });
          return;
        }
        if (activeTranscriptSegmentKeys.has(key)) {
          sendJson(response, 202, {
            accepted: false,
            processing: true,
            reason: "processing",
          });
          return;
        }

        const segment: TranscriptSegment = {
          id: randomUUID(),
          speakerId: input.speakerId,
          speakerName: input.speakerName,
          text: input.text,
          isFinal: input.isFinal !== false,
          capturedAt: input.capturedAt ?? new Date().toISOString(),
          source: "speech",
          platform: input.platform,
          meetingId: input.meetingId,
          externalId: input.segmentId,
        };

        activeTranscriptSegmentKeys.add(key);
        try {
          const result = await processSegment(segment);
          if (segment.isFinal) rememberTranscriptSegment(key);
          sendJson(response, 200, { accepted: true, ...result });
        } finally {
          activeTranscriptSegmentKeys.delete(key);
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/chat/messages") {
        const input = parseChatMessageInput(await readJsonBody(request));
        if (!input) {
          sendJson(response, 400, { error: "Invalid chat message payload" });
          return;
        }
        if (!runtimeConfig.chatEnabled) {
          sendJson(response, 200, {
            accepted: false,
            reason: "chat-disabled",
            command: null,
            turn: null,
            outboundMessages: [],
          });
          return;
        }

        const key = `${input.platform}\u0000${input.meetingId}\u0000${input.messageId}`;
        if (seenChatMessageKeys.has(key)) {
          sendJson(response, 200, {
            accepted: false,
            duplicate: true,
            reason: "duplicate",
            command: null,
            turn: null,
            outboundMessages: [],
          });
          return;
        }
        if (activeChatMessageKeys.has(key)) {
          sendJson(response, 202, {
            accepted: false,
            processing: true,
            reason: "processing",
            outboundMessages: [],
          });
          return;
        }

        activeChatMessageKeys.add(key);
        try {
          const result = await processChatMessage(input);
          rememberChatMessage(key);
          sendJson(response, 200, result);
        } finally {
          activeChatMessageKeys.delete(key);
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/transcribe") {
        if (!intelligence) {
          sendJson(response, 503, {
            error: "OpenAI non configurato. Inserisci la API key nella configurazione avatar.",
          });
          return;
        }

        const speakerName = parseSpeakerName(url.searchParams.get("speakerName"));
        const fileDetails = audioFileDetails(request.headers["content-type"]);
        if (!speakerName || !fileDetails) {
          sendJson(response, 400, {
            error: "Partecipante o formato audio non valido. Sono supportati WebM, MP4/M4A, MP3, WAV, OGG e FLAC.",
          });
          return;
        }

        const audio = await readBinaryBody(request);
        if (audio.byteLength === 0) {
          sendJson(response, 400, { error: "La registrazione audio è vuota." });
          return;
        }

        let text: string;
        try {
          text = await intelligence.transcribe({
            bytes: audio,
            fileName: `meeting-${Date.now()}.${fileDetails.extension}`,
            mimeType: fileDetails.mimeType,
          });
        } catch (error: unknown) {
          console.error("OpenAI transcription failed:", error);
          sendJson(response, 502, {
            error: "Trascrizione OpenAI non riuscita. Controlla la chiave e il log del server.",
          });
          return;
        }

        if (!text) {
          sendJson(response, 422, { error: "Non è stato rilevato parlato nella registrazione." });
          return;
        }

        const segment: TranscriptSegment = {
          id: randomUUID(),
          speakerId: speakerName,
          speakerName,
          text,
          isFinal: true,
          capturedAt: new Date().toISOString(),
          source: "speech",
          platform: "generic",
          meetingId: "test-room",
        };
        sendJson(response, 200, {
          ...(await processSegment(segment)),
          transcription: {
            provider: "openai",
            model: intelligence.transcriptionModel,
          },
        });
        return;
      }

      if (request.method === "GET" && (await serveStatic(url.pathname, response))) {
        return;
      }

      sendJson(response, 404, { error: "Not found" });
    } catch (error: unknown) {
      console.error(error);
      sendJson(response, 500, { error: "Internal server error" });
    }
  };

  const server = createServer((request, response) => {
    void handleRequest(request, response);
  });
  const shutdown = () => {
    const forceExit = setTimeout(() => process.exit(0), 2_500);
    void (async () => {
      intelligence?.abortPending();
      renderer.abortPending();
      await listener?.stop();
      server.closeAllConnections();
      server.close(() => clearTimeout(forceExit));
    })();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  server.once("close", () => {
    process.off("SIGINT", shutdown);
    process.off("SIGTERM", shutdown);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, options.host, () => {
      console.log(`Conclavia Meeting Avatar: http://${options.host}:${options.port}`);
      console.log(`Avatar name / trigger: ${runtimeConfig.name}`);
      console.log(
        intelligence
          ? `OpenAI: ready (${options.transcriptionModel} + ${runtimeConfig.responseModel})`
          : "OpenAI: not configured (text diagnostic mode only)",
      );
      console.log(
        renderer.configured
          ? `Conclavia renderer bridge: ${options.rendererUrl}`
          : "Conclavia renderer bridge: not configured",
      );
      console.log(
        listener
          ? `Meeting listener: ready (${runtimeConfig.meetingAudioDevice} -> ${options.realtimeTranscriptionModel})`
          : "Meeting listener: not configured",
      );
      resolve();
    });
  });
}
