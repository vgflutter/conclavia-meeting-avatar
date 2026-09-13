import { isMeetingWakePhrase, meetingPermissionDecision, parseMeetingVoiceCommand, statementBeforeMeetingAddress } from "@/lib/meeting-command";
import { classifyTranscriptSource } from "@/lib/meeting-transcript-source";
import type { MeetingDocument } from "@/models/Meeting";

export const FOLLOW_UP_WINDOW_MS = 90_000;
export interface MeetingFollowUpStatement { speakerName: string; text: string }

export function isMeetingTopicBoundary(text: string): boolean {
  return /^(?:(?:ok|okay|bene|allora)[,\s]+)?(?:cambiamo argomento|passiamo (?:al|a un|ad un) (?:prossimo|altro) (?:punto|argomento)|continuiamo con il prossimo argomento|change (?:the )?topic|let['’]s (?:change (?:the )?topic|move on)|moving on to|next topic)\b/iu.test(text.trim());
}

// Only called after an explicit named grant. Never search another meeting or
// resurrect a dismissed/answered topic from the wider long-term memory.
export function recentMeetingFollowUp(meeting: MeetingDocument, index: number): MeetingFollowUpStatement | undefined {
  const current = meeting.transcript[index];
  if (!current) return undefined;
  const wakeWord = meeting.assistant.wakeWord;
  const inlineStatement = statementBeforeMeetingAddress(current.text, wakeWord);
  if (inlineStatement) return isMeetingTopicBoundary(inlineStatement) ? undefined
    : { speakerName: current.speakerName, text: inlineStatement.slice(0, 2_000) };
  for (let previous = index - 1; previous >= Math.max(0, index - 8); previous -= 1) {
    const segment = meeting.transcript[previous];
    const age = current.createdAt.getTime() - segment.createdAt.getTime();
    if (age < 0 || age > FOLLOW_UP_WINDOW_MS || Date.now() - segment.createdAt.getTime() > FOLLOW_UP_WINDOW_MS) return undefined;
    if (classifyTranscriptSource(meeting, segment).source !== "participant") continue;
    if (isMeetingWakePhrase(segment.text, wakeWord)) {
      if (age <= 8_000 && segment.speakerName.toLowerCase() === current.speakerName.toLowerCase()) continue;
      return undefined;
    }
    const permission = meetingPermissionDecision(segment.text, wakeWord);
    if (permission === "defer") continue;
    if (permission || parseMeetingVoiceCommand(segment.text, wakeWord) || isMeetingTopicBoundary(segment.text)) return undefined;
    if (/^(?:ok|okay|bene|si|sì|va bene|grazie|thanks|yes|no)[.!\s]*$/iu.test(segment.text)) continue;
    if (segment.text.trim().length < 8 || !/\s/u.test(segment.text.trim())) return undefined;
    if (meeting.commandHistory.some(command => command.createdAt >= segment.createdAt && command.createdAt <= current.createdAt)) return undefined;
    return { speakerName: segment.speakerName, text: segment.text.slice(0, 2_000) };
  }
  return undefined;
}
