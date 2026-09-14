import { randomUUID } from "node:crypto";
import { classifyTranscriptSource, transcriptEventIndex } from "@/lib/meeting-transcript-source";

import {
  executeMeetingCommand,
} from "@/lib/execute-meeting-command";
import {
  detectElementaryArithmetic,
  isMeetingWakePhrase,
  meetingInvocationNameOccurs,
  statementBeforeMeetingAddress,
} from "@/lib/meeting-command";
import { MeetingModel, type MeetingDocument } from "@/models/Meeting";
import type { MeetingCommandKind } from "@/types/meeting";
import { isMeetingTopicBoundary, recentMeetingFollowUp } from "@/lib/meeting-follow-up";
import { meetingParticipantStatus, sameTranscriptSpeaker } from "@/lib/meeting-participants";
import type { SpeakingTurnDecision } from "@/lib/meeting-speaking-turn";
import { resolveMeetingSpeakingTurn } from "@/lib/resolve-meeting-speaking-turn";
import { consumeMeetingIntervention } from "@/lib/consume-meeting-intervention";
import { sanitizeDiagnosticText } from "@/lib/diagnostic-redaction.mjs";
import { enqueueMeetingIntervention } from "@/lib/meeting-intervention-queue";

export interface IncomingMeetingTranscript {
  speakerId?: string;
  speakerName: string;
  text: string;
  language?: "it" | "en";
  startMs?: number;
  endMs?: number;
}

export interface SpokenMeetingCommand {
  id: string;
  kind: MeetingCommandKind;
  response: string;
}

export async function storeMeetingTranscript(
  meeting: MeetingDocument,
  transcript: IncomingMeetingTranscript,
): Promise<{ duplicate: boolean; segmentId?: string }> {
  const duplicate = meeting.transcript.slice(-8).some(
    (segment) =>
      sameTranscriptSpeaker(segment, transcript) &&
      (!segment.entryAttemptId || segment.entryAttemptId === meeting.bot.entryAttemptId) &&
      segment.text === transcript.text &&
      (transcript.startMs === undefined || segment.startMs === transcript.startMs),
  );
  if (duplicate) return { duplicate: true };

  const previousSequence = meeting.transcript.at(-1)?.sequence || 0;
  const createdAt = new Date();
  const segmentId = randomUUID();
  const entryAttemptId = meeting.bot.entryAttemptId;
  meeting.transcript.push({
    segmentId,
    speakerId: transcript.speakerId,
    entryAttemptId,
    ...classifyTranscriptSource(meeting, { ...transcript, createdAt, entryAttemptId }),
    sequence: previousSequence + 1,
    speakerName: transcript.speakerName,
    text: transcript.text,
    language: transcript.language,
    startMs: transcript.startMs,
    endMs: transcript.endMs,
    createdAt,
  });
  if (
    !meeting.participants.some(
      (name) => name.toLocaleLowerCase() === transcript.speakerName.toLocaleLowerCase(),
    )
  ) {
    meeting.participants.push(transcript.speakerName);
  }
  if (meeting.transcript.length > 4_000) {
    meeting.transcript.splice(0, meeting.transcript.length - 4_000);
  }
  await meeting.save();
  return { duplicate: false, segmentId };
}

export async function processMeetingTranscriptAutomation(
  meeting: MeetingDocument,
  text: string,
  segmentId?: string,
): Promise<SpokenMeetingCommand | undefined> {
  // Reload after ingress: an asynchronous callback must not use an old hand,
  // roster or lifecycle snapshot. Claim the exact caption once across workers.
  const fresh = await MeetingModel.findById(meeting._id).exec();
  if (!fresh || fresh.bot.stopRequestedAt || ["processing", "completed", "cancelled", "failed"].includes(fresh.status)) return undefined;
  meeting = fresh;
  const wakeWord = meeting.assistant.wakeWord || "Conclavia";
  const index = transcriptEventIndex(meeting.transcript, text, segmentId);
  const currentSegment = meeting.transcript[index];
  if (!currentSegment || currentSegment.text !== text ||
    classifyTranscriptSource(meeting, currentSegment).source !== "participant") return undefined;
  if (currentSegment.entryAttemptId !== meeting.bot.entryAttemptId) return undefined;
  const eventId = currentSegment.segmentId;
  if (!eventId) return undefined;
  const claimed = await MeetingModel.updateOne({ _id: meeting._id,
    transcript: { $elemMatch: { segmentId: eventId, automationClaimedAt: { $exists: false } } },
  }, { $set: { "transcript.$.automationClaimedAt": new Date() } });
  if (!claimed.modifiedCount) return undefined;
  const recordDecision = async (decision: SpeakingTurnDecision) => {
    await MeetingModel.updateOne({ _id: meeting._id, "transcript.segmentId": eventId }, {
      $set: { "transcript.$.turnDecision": { action: decision.action, reason: decision.reason,
        method: decision.method, decidedAt: new Date() } },
    });
  };
  // Management-only diagnostics. No change to the provider payload, cadence,
  // permission rules or original transcript text.
  const recordIntervention = async (
    state: "checking" | "raised" | "none" | "skipped" | "error", reason: string, detail?: string,
  ) => {
    await MeetingModel.updateOne({ _id: meeting._id, "bot.entryAttemptId": currentSegment.entryAttemptId,
      "transcript.segmentId": eventId }, { $set: { "transcript.$.interventionDecision": {
      state, reason, ...(detail ? { detail: sanitizeDiagnosticText(detail).slice(0, 500) } : {}), decidedAt: new Date(),
    } } });
  };
  const previousSegment = meeting.transcript[index - 1];
  const continuesWakePhrase = Boolean(
    currentSegment &&
      previousSegment &&
      classifyTranscriptSource(meeting, previousSegment).source === "participant" &&
      sameTranscriptSpeaker(currentSegment, previousSegment) &&
      currentSegment.entryAttemptId === previousSegment.entryAttemptId &&
      currentSegment.createdAt.getTime() - previousSegment.createdAt.getTime() <= 8_000 &&
      currentSegment.createdAt.getTime() >= previousSegment.createdAt.getTime() &&
      isMeetingWakePhrase(previousSegment.text, wakeWord),
  );
  const actionableText = continuesWakePhrase && previousSegment
    ? `${previousSegment.text} ${text}`
    : text;

  // A shared invocation name is not enough to decide whom a human addressed.
  // Keep the transcript without executing (or dismissing) ambiguous commands.
  // Explicit management-GUI commands use a separate endpoint.
  const expiredPending = Boolean(
    meeting.pendingIntervention &&
    meeting.pendingIntervention.expiresAt.getTime() <= Date.now()
  );
  const blocked = meetingParticipantStatus(meeting).voiceBlocked;
  if (blocked) {
    await recordIntervention("skipped", "ambiguous_recipient");
    if (meetingInvocationNameOccurs(actionableText, wakeWord)) await recordDecision({ action: "ignore", reason: "ambiguous_recipient", method: "rules" });
    return undefined;
  }
  if (meeting.pendingIntervention && (expiredPending ||
      meeting.assistant.correctionPolicy !== "important_only" || isMeetingTopicBoundary(text))) {
    meeting.set("pendingIntervention", undefined);
    await meeting.save();
  }

  const pending = meeting.pendingIntervention;
  const turn = await resolveMeetingSpeakingTurn(meeting, {
    text: actionableText, wakeWord, blocked,
    pending: pending ? { id: pending.id, statement: pending.sourceStatement, response: pending.response } : undefined,
    recent: meeting.transcript.slice(Math.max(0, index - 8), index)
      .filter(segment => segment.entryAttemptId === currentSegment.entryAttemptId &&
        currentSegment.createdAt.getTime() - segment.createdAt.getTime() <= 90_000 &&
        currentSegment.createdAt >= segment.createdAt &&
        classifyTranscriptSource(meeting, segment).source === "participant")
      .map(segment => ({ speakerName: segment.speakerName, text: segment.text.slice(0, 2_000) })),
  });
  if (turn.reason !== "unnamed") await recordDecision(turn);
  const permission = turn.action;
  const currentTurn = async () => {
    const latest = await MeetingModel.findById(meeting._id).exec();
    const latestIndex = latest ? transcriptEventIndex(latest.transcript, text, eventId) : -1;
    const superseded = latest && latest.transcript.slice(latestIndex + 1).some(segment =>
      segment.entryAttemptId === currentSegment.entryAttemptId &&
      classifyTranscriptSource(latest, segment).source === "participant" &&
      (meetingInvocationNameOccurs(segment.text, wakeWord) || isMeetingTopicBoundary(segment.text)));
    if (!latest || latestIndex < 0 || latest.status !== "live" || latest.bot.stopRequestedAt || latest.bot.leftAt ||
        classifyTranscriptSource(latest, latest.transcript[latestIndex]).source !== "participant" ||
        latest.bot.entryAttemptId !== currentSegment.entryAttemptId ||
        latest.assistant.wakeWord !== wakeWord ||
        Date.now() - currentSegment.createdAt.getTime() > 90_000 || superseded ||
        latest.pendingIntervention?.id !== pending?.id) {
      await recordDecision({ action: "ignore", reason: "stale_turn", method: turn.method });
      return null;
    }
    if (meetingParticipantStatus(latest).voiceBlocked) {
      await recordDecision({ action: "ignore", reason: "ambiguous_recipient", method: turn.method });
      return null;
    }
    return latest;
  };
  const canRespond = async () => {
    const latest = await currentTurn();
    const kind = turn.command?.kind || "ask";
    return Boolean(latest && !(kind === "ask" && latest.assistant.answerQuestions === false) &&
      !(kind === "remember" && latest.assistant.captureMemory === false) &&
      !(kind === "summary" && latest.assistant.summarizeOnRequest === false));
  };
  if (["grant", "request", "decline", "defer"].includes(permission)) {
    const latest = await currentTurn();
    if (!latest) return undefined;
    meeting = latest;
  }
  const inlineStatement = permission === "grant" ? statementBeforeMeetingAddress(text, wakeWord) : undefined;
  if (meeting.pendingIntervention && inlineStatement && detectElementaryArithmetic(inlineStatement) &&
      inlineStatement !== meeting.pendingIntervention.sourceStatement) {
    meeting.set("pendingIntervention", undefined);
    await meeting.save();
  }

  if (permission === "defer") return undefined;
  if (permission === "decline") {
    if (pending) {
      await MeetingModel.updateOne({ _id: meeting._id, "pendingIntervention.id": pending.id,
        "bot.entryAttemptId": currentSegment.entryAttemptId, status: "live", "bot.stopRequestedAt": { $exists: false },
      }, { $unset: { pendingIntervention: 1 } });
    }
    return undefined;
  }
  if (meeting.pendingIntervention && permission === "grant") {
    const command = await consumeMeetingIntervention(meeting, meeting.pendingIntervention.id);
    if (!command) {
      await recordDecision({ action: "ignore", reason: "stale_turn", method: turn.method });
      return undefined;
    }
    return { id: command.id, kind: command.kind, response: command.response };
  }
  if (permission === "grant") {
    if (meeting.assistant.answerQuestions === false) return undefined;
    const followUp = expiredPending && !inlineStatement ? undefined : recentMeetingFollowUp(meeting, index);
    const response = await executeMeetingCommand(meeting, "ask", followUp?.text || actionableText, { followUp: followUp || null, canRespond });
    if (response === undefined) return undefined;
    const latest = meeting.commandHistory.at(-1);
    return latest ? { id: latest.id, kind: latest.kind, response: latest.response } : undefined;
  }

  const voiceCommand = turn.command;
  if (voiceCommand) {
    if ((voiceCommand.kind === "ask" && meeting.assistant.answerQuestions === false) ||
        (voiceCommand.kind === "remember" && meeting.assistant.captureMemory === false) ||
        (voiceCommand.kind === "summary" && meeting.assistant.summarizeOnRequest === false)) return undefined;
    if (meeting.pendingIntervention) meeting.set("pendingIntervention", undefined);
    const response = await executeMeetingCommand(meeting, voiceCommand.kind, voiceCommand.prompt, { canRespond });
    if (response === undefined) return undefined;
    const latest = meeting.commandHistory.at(-1);
    return latest
      ? { id: latest.id, kind: latest.kind, response: latest.response }
      : undefined;
  }

  if (turn.reason !== "unnamed") return undefined;

  if (meeting.assistant.correctionPolicy !== "important_only" || text.trim().length < 12 || meeting.pendingIntervention) {
    await recordIntervention("skipped", meeting.assistant.correctionPolicy !== "important_only" ? "policy_disabled"
      : meeting.pendingIntervention ? "already_pending" : "not_a_claim");
    return undefined;
  }
  await enqueueMeetingIntervention(meeting, currentSegment);
  return undefined;
}
