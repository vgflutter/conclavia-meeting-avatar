"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";

import {
  BusinessAvatar,
  type AvatarGesture,
  type AvatarMood,
} from "@/components/BusinessAvatar";
import type { AssistantAppearance } from "@/types/assistant-profile";
import type { Locale } from "@/i18n/locale";
import type { AvatarViseme } from "@/lib/avatar-visemes";
import { createMeetingVoicePlayer, type MeetingVoiceState } from "@/lib/meeting-voice-player";
import {
  parseRecallOutputTranscript,
  type RecallOutputTranscript,
} from "@/lib/recall-transcript";
import type { MeetingTtsProvider } from "@/lib/meeting-tts-config";
import type {
  MeetingBotProvider,
  MeetingCommandKind,
  MeetingStatus,
} from "@/types/meeting";

import styles from "./MeetingOutputSurface.module.css";

type SpokenCommand = {
  id: string;
  kind: MeetingCommandKind;
  response: string;
};

function performanceFor(kind: MeetingCommandKind): {
  mood: AvatarMood;
  gesture: AvatarGesture;
} {
  if (kind === "correct") return { mood: "focused", gesture: "rest" };
  if (kind === "inform") return { mood: "confident", gesture: "rest" };
  if (kind === "summary") return { mood: "confident", gesture: "rest" };
  return { mood: "friendly", gesture: "rest" };
}

export function MeetingOutputSurface({
  outputToken,
  outputAttemptId,
  initialStatus,
  initialCommandId,
  initialInterventionId,
  displayName,
  appearance,
  role,
  locale,
  inMeeting,
  meetingProvider,
  tts,
}: {
  outputToken: string;
  outputAttemptId?: string;
  initialStatus: MeetingStatus;
  initialCommandId?: string;
  initialInterventionId?: string;
  displayName: string;
  appearance: AssistantAppearance;
  role: string;
  locale: Locale;
  inMeeting: boolean;
  meetingProvider: MeetingBotProvider;
  tts: { provider: MeetingTtsProvider; ready: boolean };
}) {
  const [status, setStatus] = useState(initialStatus);
  const [viseme, setViseme] = useState<AvatarViseme>("rest");
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [mood, setMood] = useState<AvatarMood>("friendly");
  const [gesture, setGesture] = useState<AvatarGesture>(
    initialInterventionId ? "hand_raise" : "rest",
  );
  const [voiceState, setVoiceState] = useState<MeetingVoiceState>("ready");
  const [voicePrepared, setVoicePrepared] = useState(!inMeeting);
  const [connected, setConnected] = useState(false);
  const voiceReadyRef = useRef(false);
  const voiceStateRef = useRef(voiceState);
  useEffect(() => { voiceStateRef.current = voiceState; }, [voiceState]);
  const [participantAppearance, setParticipantAppearance] = useState(appearance);
  const [participantName, setParticipantName] = useState(displayName);
  const [completedCommandId, setCompletedCommandId] = useState<string>();
  const speaking = voiceState === "speaking";
  const pendingInterventionRef = useRef(initialInterventionId);
  const lastReceivedCommandRef = useRef(initialCommandId);
  const isPresent = status === "live" && voicePrepared && connected && voiceState !== "error";
  const isItalian = locale === "it";

  useEffect(() => {
    let active = true;
    let polling = false;
    let transcriptSocket: WebSocket | undefined;
    let reconnectTimer: number | undefined;
    let utteranceTimer: number | undefined;
    let bufferedTranscript: RecallOutputTranscript | undefined;
    let meetingAudioStream: MediaStream | undefined;
    let lastHeartbeat = 0;
    let lastConnectedAt = Date.now();
    let currentVoiceCommandId: string | undefined;
    let playback: { commandId: string; state: "speaking" | "completed" | "error" } | undefined;
    let reporting = Promise.resolve();

    function reportReadiness() {
      if (!active || !inMeeting || !outputAttemptId) return;
      const report = { attemptId: outputAttemptId, voiceReady: voiceReadyRef.current && voiceStateRef.current !== "error", playback };
      // Serialize reports so a delayed "speaking" event cannot overtake "completed".
      reporting = reporting.then(async () => {
        if (!active) return;
        await fetch(`/api/meeting-room/${encodeURIComponent(outputToken)}/state`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(report), signal: AbortSignal.timeout(5_000),
        });
      }).catch(() => undefined);
    }

    const voicePlayer = createMeetingVoicePlayer({
      remote: {
        endpoint: `/api/meeting-room/${encodeURIComponent(outputToken)}/speech`,
        attemptId: outputAttemptId || "",
      },
      onState: (nextState) => {
        setVoiceState(nextState);
        voiceStateRef.current = nextState;
        if (currentVoiceCommandId && (nextState === "speaking" || nextState === "error")) {
          playback = { commandId: currentVoiceCommandId, state: nextState };
          reportReadiness();
        }
      },
      onFrame: (nextViseme, level) => { setViseme(nextViseme); setVoiceLevel(level); },
      onCommand: (command) => {
        currentVoiceCommandId = command.id;
        setMood(performanceFor(command.kind).mood);
        setGesture("rest");
      },
      onComplete: (id) => {
        playback = { commandId: id, state: "completed" };
        reportReadiness();
        setCompletedCommandId(id);
        setMood(pendingInterventionRef.current ? "focused" : "friendly");
        setGesture(pendingInterventionRef.current ? "hand_raise" : "rest");
      },
    });

    async function pollMeeting() {
      if (polling) return;
      polling = true;
      try {
        const response = await fetch(
          `/api/meeting-room/${encodeURIComponent(outputToken)}/state?after=${encodeURIComponent(lastReceivedCommandRef.current || "")}`,
          { cache: "no-store", signal: AbortSignal.timeout(5_000) },
        );
        const payload = (await response.json()) as {
          status?: MeetingStatus;
          command?: SpokenCommand;
          commands?: SpokenCommand[];
          displayName?: string;
          appearance?: AssistantAppearance;
          pendingIntervention?: { id: string; response?: string };
        };
        if (!active) return;
        if (!response.ok || !payload.status) throw new Error("Output state unavailable");
        lastConnectedAt = Date.now();
        setConnected(true);
        setStatus(payload.status);
        if (inMeeting && outputAttemptId && Date.now() - lastHeartbeat >= 5_000) {
          lastHeartbeat = Date.now();
          // Only a mounted meeting renderer reports readiness; previews and HTTP probes never do.
          reportReadiness();
        }
        if (payload.appearance) setParticipantAppearance(payload.appearance);
        if (payload.displayName) setParticipantName(payload.displayName);
        if (inMeeting && payload.status !== "live") {
          if (["failed", "processing", "completed", "cancelled"].includes(payload.status)) voicePlayer.dispose();
          return;
        }
        const nextInterventionId = payload.pendingIntervention?.id;
        if (nextInterventionId !== pendingInterventionRef.current) {
          pendingInterventionRef.current = nextInterventionId;
          if (nextInterventionId) {
            setMood("focused");
            setGesture("hand_raise");
          } else {
            setMood("friendly");
            setGesture("rest");
          }
        }
        const commands = payload.commands || (payload.command ? [payload.command] : []);
        for (const command of commands) {
          voicePlayer.enqueue(command);
          lastReceivedCommandRef.current = command.id;
        }
      } catch {
        if (active && Date.now() - lastConnectedAt >= 5_000) setConnected(false);
      } finally {
        polling = false;
      }
    }

    async function flushTranscript() {
      if (utteranceTimer) window.clearTimeout(utteranceTimer);
      utteranceTimer = undefined;
      const transcript = bufferedTranscript;
      bufferedTranscript = undefined;
      if (!active || !transcript) return;

      try {
        const response = await fetch(
          `/api/meeting-room/${encodeURIComponent(outputToken)}/transcript`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(transcript),
          },
        );
        const payload = (await response.json()) as { command?: SpokenCommand };
        if (!active || !response.ok || !payload.command) return;
        voicePlayer.enqueue(payload.command);
      } catch {
        // The next finalized utterance will retry through the active meeting connection.
      }
    }

    function queueTranscript(next: RecallOutputTranscript) {
      if (
        bufferedTranscript &&
        bufferedTranscript.speakerName.toLocaleLowerCase() ===
          next.speakerName.toLocaleLowerCase()
      ) {
        bufferedTranscript = {
          ...bufferedTranscript,
          text: `${bufferedTranscript.text} ${next.text}`.trim().slice(-10_000),
          language: next.language || bufferedTranscript.language,
          endMs: next.endMs || bufferedTranscript.endMs,
        };
      } else {
        void flushTranscript();
        bufferedTranscript = next;
      }
      if (utteranceTimer) window.clearTimeout(utteranceTimer);
      utteranceTimer = window.setTimeout(() => void flushTranscript(), 1_100);
    }

    function connectTranscript() {
      if (!active || !inMeeting) return;
      transcriptSocket = new WebSocket(
        "wss://meeting-data.bot.recall.ai/api/v1/transcript",
      );
      transcriptSocket.onmessage = (event) => {
        try {
          const transcript = parseRecallOutputTranscript(JSON.parse(String(event.data)));
          if (transcript) queueTranscript(transcript);
        } catch {
          // Ignore malformed frames and keep the live connection open.
        }
      };
      transcriptSocket.onclose = () => {
        if (!active) return;
        reconnectTimer = window.setTimeout(connectTranscript, 2_000);
      };
    }

    if (inMeeting) {
      void (tts.ready ? Promise.resolve() : Promise.reject(new Error("Voice not configured")))
        .then(() => { if (active) { voiceReadyRef.current = true; setVoicePrepared(true); } })
        .catch(() => { if (active) setVoiceState("error"); });
      if (meetingProvider === "recall") connectTranscript();
      if (meetingProvider === "attendee" && navigator.mediaDevices?.getUserMedia) {
        void navigator.mediaDevices
          .getUserMedia({ audio: true, video: false })
          .then((stream) => {
            if (!active) {
              stream.getTracks().forEach((track) => track.stop());
              return;
            }
            meetingAudioStream = stream;
          })
          .catch(() => undefined);
      }
    }
    void pollMeeting();
    const timer = window.setInterval(pollMeeting, 650);

    return () => {
      active = false;
      voicePlayer.dispose();
      window.clearInterval(timer);
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (utteranceTimer) window.clearTimeout(utteranceTimer);
      transcriptSocket?.close();
      meetingAudioStream?.getTracks().forEach((track) => track.stop());
    };
  }, [inMeeting, meetingProvider, outputToken, outputAttemptId, tts.provider, tts.ready]);

  const stageStyle = {
    "--voice-level": voiceLevel,
  } as CSSProperties;

  const statusLabel = !connected
    ? isItalian ? "COLLEGAMENTO…" : "CONNECTING…"
    : inMeeting && status !== "live"
    ? ["joining", "scheduled"].includes(status)
      ? isItalian ? "INGRESSO IN CORSO" : "JOINING"
      : status === "waiting_room"
        ? isItalian ? "IN SALA D’ATTESA" : "IN THE LOBBY"
        : isItalian ? "NON OPERATIVO" : "INACTIVE"
    : voiceState === "error"
    ? isItalian ? "VOCE NON DISPONIBILE" : "VOICE UNAVAILABLE"
    : inMeeting && !voicePrepared
      ? isItalian ? "PREPARAZIONE…" : "PREPARING…"
    : voiceState === "preparing"
      ? isItalian ? "PREPARA LA RISPOSTA" : "PREPARING RESPONSE"
      : speaking
    ? isItalian
      ? "STA PARLANDO"
      : "SPEAKING"
    : gesture === "hand_raise"
      ? isItalian
        ? "CHIEDE LA PAROLA"
        : "REQUESTING TO SPEAK"
    : status === "waiting_room"
      ? isItalian
        ? "IN ATTESA"
        : "WAITING"
      : status === "live"
        ? isItalian
          ? "OPERATIVO"
          : "ACTIVE"
        : isItalian
          ? "PRONTO"
          : "READY";

  return (
    <div className={styles.output} style={stageStyle} data-output-runtime="conclavia-v1" data-in-meeting={inMeeting} data-live={isPresent} data-speaking={speaking} data-voice-state={voiceState} data-spoken-command={completedCommandId}>
      <div className={styles.grid} />
      <div className={styles.statusBadge} data-testid="meeting-status-badge">
        <i /> {statusLabel}
      </div>
      <div className={styles.avatarWrap}>
        <BusinessAvatar
          appearance={participantAppearance}
          viseme={viseme}
          mood={mood}
          gesture={gesture}
          voiceLevel={voiceLevel}
          ariaLabel={isItalian ? "Avatar del collega digitale in abito business" : "Business-style digital colleague avatar"}
        />
      </div>
      <div className={styles.lowerThird} data-testid="meeting-identity">
        <span>{participantName}</span>
        <strong>{role}</strong>
      </div>
      {!inMeeting && (
        <div className={styles.mockNotice}>
          {isItalian ? "Anteprima dell’aspetto nel meeting" : "Preview of the meeting appearance"}
        </div>
      )}
    </div>
  );
}
