import { meetingAddressParts, meetingInvocationNameOccurs, meetingPermissionDecision, parseMeetingVoiceCommand } from "@/lib/meeting-command";
import type { MeetingCommandKind } from "@/types/meeting";

export interface SpeakingTurnInput {
  text: string;
  wakeWord: string;
  pending?: { id: string; statement: string; response: string };
  recent: Array<{ speakerName: string; text: string }>;
  blocked?: boolean;
}

export type TurnReason = "unnamed" | "ambiguous_recipient" | "quoted_or_reported" |
  "awaiting_invitation" | "named_grant" | "named_request" | "declined" | "deferred" |
  "no_pending_turn" | "not_addressed" | "semantic_unavailable" | "stale_turn";
export interface SpeakingTurnDecision {
  action: "ignore" | "grant" | "decline" | "defer" | "request" | "unresolved";
  method: "rules" | "semantic";
  reason: TurnReason;
  command?: { kind: MeetingCommandKind; prompt: string };
}

// Pure local fast path. Unresolved utterances are kept distinct from an
// invitation: unknown wording never falls through to an invented question.
export function resolveLocalMeetingSpeakingTurn(input: SpeakingTurnInput): SpeakingTurnDecision {
  const result = (action: SpeakingTurnDecision["action"], reason: TurnReason): SpeakingTurnDecision => ({ action, reason, method: "rules" });
  if (!meetingInvocationNameOccurs(input.text, input.wakeWord)) return result("ignore", "unnamed");
  if (input.blocked) return result("ignore", "ambiguous_recipient");
  const address = meetingAddressParts(input.text, input.wakeWord)!;
  if (/["“”«»]/u.test(address.before) ||
      /\b(?:ha detto|aveva detto|diceva|ho detto|ho chiesto|ne parlavo|said|told|was saying)\b/iu.test(address.before)) {
    return result("ignore", "quoted_or_reported");
  }
  const permission = meetingPermissionDecision(input.text, input.wakeWord, { awaitingPermission: Boolean(input.pending) });
  if (permission) return result(permission, permission === "grant" ? "named_grant" : permission === "decline" ? "declined" : "deferred");
  // No replay of expired/dismissed/already delivered contributions on bare yes.
  if (!input.pending && meetingPermissionDecision(input.text, input.wakeWord, { awaitingPermission: true }) === "grant") {
    return result("ignore", "no_pending_turn");
  }
  const command = parseMeetingVoiceCommand(input.text, input.wakeWord);
  const contextualQuestion = command?.kind === "ask" &&
    /\b(?:volevi|vuoi dire|da dire|mano|punto|pens[iia]|wanted|want to say|hand|point|thoughts)\b/iu.test(command.prompt);
  const conditional = /^[\s,.:;!?]*\b(?:se|if|quando ti|when i|quando te lo)\b/iu.test(address.after);
  if (command && !contextualQuestion && !conditional) return { ...result("request", "named_request"), command };
  return result("unresolved", "semantic_unavailable");
}
