import { randomUUID } from "node:crypto";
import { MeetingModel, type MeetingDocument } from "@/models/Meeting";
import { detectElementaryArithmetic, meetingInvocationNameOccurs } from "@/lib/meeting-command";
import { classifyTranscriptSource } from "@/lib/meeting-transcript-source";
import { isMeetingTopicBoundary } from "@/lib/meeting-follow-up";
import { meetingParticipantStatus } from "@/lib/meeting-participants";
import { detectImportantIntervention } from "@/lib/execute-meeting-command";
import { INTERVENTION_BATCH_CHARS, INTERVENTION_CHECK_INTERVAL_MS } from "@/lib/meeting-intervention-context";
import { sanitizeDiagnosticText } from "@/lib/diagnostic-redaction.mjs";
import type { MeetingTranscriptSegment } from "@/types/meeting";

const MAX_AGE_MS = 90_000;
const WAITING = ["queued", "checking"];
type Decision = NonNullable<MeetingTranscriptSegment["interventionDecision"]>;

export async function recordInterventionDecision(
  meeting: MeetingDocument, ids: string[], state: Decision["state"], reason: string, detail?: string,
  lease?: Date,
) {
  if (!ids.length) return;
  await MeetingModel.updateOne({ _id: meeting._id, "bot.entryAttemptId": meeting.bot.entryAttemptId,
    ...(lease ? { "bot.interventionLeaseUntil": lease } : {}) }, {
    $set: { "transcript.$[segment].interventionDecision": {
      state, reason, ...(detail ? { detail: sanitizeDiagnosticText(detail).slice(0, 500) } : {}), decidedAt: new Date(),
    } },
  }, { arrayFilters: [{ "segment.segmentId": { $in: ids } }] });
}

export async function enqueueMeetingIntervention(meeting: MeetingDocument, segment: MeetingTranscriptSegment) {
  if (!segment.segmentId) return;
  await recordInterventionDecision(meeting, [segment.segmentId], "queued", "awaiting_check");
  const due = Date.now() + INTERVENTION_CHECK_INTERVAL_MS;
  // Never debounce by replacing a previous caption. The original caption is
  // the durable job, and $min never postpones an already scheduled check.
  await MeetingModel.updateOne({ _id: meeting._id, "bot.entryAttemptId": meeting.bot.entryAttemptId }, {
    $min: { "bot.interventionNextCheckAt": new Date(due) },
  });
  // Ingress only persists work. The existing renderer poll runs the worker in
  // after(), never in the transcript/answer response path (including arithmetic).
}

// Consented contextual analysis, same configured OpenAI provider. The worker
// only prepares a hand request; it cannot append a command or release audio.
export async function processMeetingInterventionQueue(id: string) {
  const now = new Date();
  const lease = new Date(now.getTime() + 45_000);
  const meeting = await MeetingModel.findOneAndUpdate({
    _id: id, status: "live", "bot.stopRequestedAt": null, "bot.leftAt": null,
    "bot.interventionNextCheckAt": { $lte: now },
    $or: [{ "bot.interventionLeaseUntil": null }, { "bot.interventionLeaseUntil": { $lte: now } }],
  }, { $set: { "bot.interventionLeaseUntil": lease } }, { new: true }).exec();
  if (!meeting) return;
  const guard = { _id: meeting._id, "bot.entryAttemptId": meeting.bot.entryAttemptId,
    "bot.interventionLeaseUntil": lease };
  const record = (ids: string[], state: Decision["state"], reason: string, detail?: string) =>
    recordInterventionDecision(meeting, ids, state, reason, detail, lease);
  let batch: MeetingTranscriptSegment[] = [];
  let nextCheck = Math.max(now.getTime(), (meeting.bot.lastCorrectionCheckAt?.getTime() || 0) + INTERVENTION_CHECK_INTERVAL_MS);
  try {
    const queued = meeting.transcript.filter(segment => WAITING.includes(segment.interventionDecision?.state || ""));
    const human = meeting.transcript.filter(segment =>
      segment.createdAt.getTime() >= now.getTime() - MAX_AGE_MS &&
      segment.entryAttemptId === meeting.bot.entryAttemptId && classifyTranscriptSource(meeting, segment).source === "participant");
    const boundarySequence = human.reduce((latest, segment) =>
      isMeetingTopicBoundary(segment.text) || meetingInvocationNameOccurs(segment.text, meeting.assistant.wakeWord)
        ? Math.max(latest, segment.sequence) : latest, -1);
    const latestAnswerAt = meeting.commandHistory.reduce((latest, command) => Math.max(latest, command.createdAt.getTime()), 0);
    const blocked = meetingParticipantStatus(meeting).voiceBlocked;
    const eligible: MeetingTranscriptSegment[] = [];
    for (const segment of queued) {
      const superseded = boundarySequence > segment.sequence;
      const answered = latestAnswerAt >= segment.createdAt.getTime();
      const reason = meeting.assistant.correctionPolicy !== "important_only" ? "policy_disabled"
        : blocked ? "ambiguous_recipient"
        : meeting.pendingIntervention && meeting.pendingIntervention.expiresAt > now ? "already_pending"
        : segment.entryAttemptId !== meeting.bot.entryAttemptId ? "old_attempt"
        : now.getTime() - segment.createdAt.getTime() > MAX_AGE_MS ? "expired"
        : classifyTranscriptSource(meeting, segment).source !== "participant" ? "not_participant"
        : superseded || answered ? "superseded" : undefined;
      if (reason) await record([segment.segmentId!], "skipped", reason);
      else eligible.push(segment);
    }
    if (!eligible.length) return;
    const latest = eligible.at(-1)!;
    const arithmetic = latest.segmentId === human.at(-1)?.segmentId ? detectElementaryArithmetic(latest.text) : undefined;
    // Simple complete arithmetic claims retain their local zero-cost fast path.
    // Embedded assertions go through contextual analysis, never a loose regex.
    if (!arithmetic && nextCheck > now.getTime()) return;
    const candidate = (segment: MeetingTranscriptSegment) => ({ segmentId: segment.segmentId!, speakerName: segment.speakerName, text: segment.text });
    for (const segment of eligible) {
      if (JSON.stringify([candidate(segment)]).length > INTERVENTION_BATCH_CHARS) {
        await record([segment.segmentId!], "skipped", "context_limit");
      } else if (batch.length < 8 && JSON.stringify([...batch, segment].map(candidate)).length <= INTERVENTION_BATCH_CHARS) batch.push(segment);
    }
    if (arithmetic) batch = [latest];
    if (!batch.length) return;
    const ids = batch.map(segment => segment.segmentId!);
    await record(ids, "checking", arithmetic ? "arithmetic_check" : "context_check");
    let outcome: { reason: string; detail?: string } = { reason: "no_material_issue" };
    if (!arithmetic) {
      nextCheck = now.getTime() + INTERVENTION_CHECK_INTERVAL_MS;
      await MeetingModel.updateOne(guard, { $set: { "bot.lastCorrectionCheckAt": now } });
    }
    const proposal = arithmetic ? { type: "correction" as const, ...arithmetic, sourceSegmentId: latest.segmentId }
      : await detectImportantIntervention(meeting, batch.at(-1)!.text,
        (reason, detail) => { outcome = { reason, detail }; }, batch.map(candidate));
    const fresh = await MeetingModel.findOne(guard).exec();
    if (!fresh) return; // Lost lease/attempt: a newer worker owns these jobs.
    if (fresh.status !== "live" || fresh.bot.stopRequestedAt || fresh.bot.leftAt ||
        fresh.assistant.correctionPolicy !== "important_only" || fresh.assistant.wakeWord !== meeting.assistant.wakeWord ||
        meetingParticipantStatus(fresh).voiceBlocked ||
        (fresh.pendingIntervention && fresh.pendingIntervention.expiresAt > new Date())) {
      await record(ids, "skipped", "state_changed");
      return;
    }
    // Do not act on an assessment that missed a new refusal/self-correction.
    // Keep the jobs for another bounded contextual pass, rather than losing them.
    // Playback acknowledgements can reveal an echo without adding any new IDs.
    const freshSegments = new Map(fresh.transcript.map(segment => [segment.segmentId, segment]));
    const changedSource = batch.some(segment => {
      const current = freshSegments.get(segment.segmentId);
      return !current || current.text !== segment.text || current.entryAttemptId !== segment.entryAttemptId ||
        classifyTranscriptSource(fresh, current).source !== "participant";
    });
    if (fresh.transcript.at(-1)?.segmentId !== meeting.transcript.at(-1)?.segmentId ||
        fresh.commandHistory.at(-1)?.id !== meeting.commandHistory.at(-1)?.id || changedSource) {
      await record(ids, "queued", "context_changed");
      return;
    }
    const source = batch.find(segment => segment.segmentId === proposal?.sourceSegmentId);
    if (proposal && !source) outcome = { reason: "analysis_error" };
    if (!proposal || !source) {
      await record(ids, outcome.reason === "analysis_error" || outcome.reason === "ai_unavailable" ? "error" : "none", outcome.reason, outcome.detail);
      return;
    }
    if (Date.now() - source.createdAt.getTime() > MAX_AGE_MS) {
      await record(ids, "skipped", "expired");
      return;
    }
    // updatedAt fences any intervening lifecycle, profile, roster or caption
    // update. A failed compare-and-set keeps the job; it cannot overwrite state.
    const raised = await MeetingModel.updateOne({ ...guard,
      status: "live", "bot.stopRequestedAt": null, "bot.leftAt": null,
      "assistant.correctionPolicy": "important_only", updatedAt: fresh.updatedAt,
    }, { $set: { pendingIntervention: {
      id: randomUUID(), type: proposal.type, sourceSpeaker: source.speakerName,
      sourceStatement: source.text.slice(0, 2_000), reason: proposal.reason.slice(0, 1_000),
      response: proposal.response.slice(0, 2_000), createdAt: new Date(), expiresAt: new Date(Date.now() + MAX_AGE_MS),
    } } });
    if (!raised.modifiedCount) {
      await record(ids, "queued", "context_changed");
      return;
    }
    await record(ids.filter(id => id !== source.segmentId), "none", "batch_reviewed");
    await record([source.segmentId!], "raised", arithmetic ? "arithmetic_error" : "contextual_contribution", proposal.reason);
    await MeetingModel.updateOne({ ...guard, "transcript.segmentId": source.segmentId }, {
      $set: { "transcript.$.turnDecision": { action: "ignore", reason: "awaiting_invitation", method: arithmetic ? "rules" : "semantic", decidedAt: new Date() } },
    });
  } catch {
    await record(batch.map(segment => segment.segmentId!), "error", "analysis_error");
  } finally {
    // Give captions arriving during IO one short collection window as well.
    // Never run a tight catch-up loop against the provider when a meeting is busy.
    if (batch.length) nextCheck = Math.max(nextCheck, Date.now() + INTERVENTION_CHECK_INTERVAL_MS);
    // Conditional atomic updates preserve captions queued during network IO.
    await MeetingModel.updateOne({ ...guard, transcript: { $elemMatch: { "interventionDecision.state": { $in: WAITING } } } }, {
      $set: { "bot.interventionNextCheckAt": new Date(nextCheck) },
    });
    await MeetingModel.updateOne({ ...guard, transcript: { $not: { $elemMatch: { "interventionDecision.state": { $in: WAITING } } } } }, {
      $unset: { "bot.interventionNextCheckAt": 1 },
    });
    await MeetingModel.updateOne(guard, { $unset: { "bot.interventionLeaseUntil": 1 } });
  }
}
