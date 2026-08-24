import type { ChatMessageInput } from "../domain/protocol.js";

export interface TeamsMessageActivityLike {
  id?: string;
  timestamp?: Date | string;
  text?: string;
  conversation?: {
    id?: string;
  };
  from?: {
    id?: string;
    name?: string;
  };
  recipient?: {
    id?: string;
  };
}

const namedEntities: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z]+);/gi, (entity, name: string) => {
    if (name.startsWith("#")) {
      const hexadecimal = name[1]?.toLowerCase() === "x";
      const codePoint = Number.parseInt(name.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      if (Number.isFinite(codePoint)) {
        try {
          return String.fromCodePoint(codePoint);
        } catch {
          return entity;
        }
      }
      return entity;
    }
    return namedEntities[name.toLowerCase()] ?? entity;
  });
}

export function visibleTeamsMessageText(value: unknown): string {
  if (typeof value !== "string") return "";
  return decodeHtmlEntities(
    value
      .replace(/<at\b[^>]*>(.*?)<\/at>/gis, "$1")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p\s*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  ).replace(/\s+/g, " ").trim();
}

export function teamsActivityToChatMessage(
  activity: TeamsMessageActivityLike,
): ChatMessageInput | null {
  const meetingId = activity.conversation?.id?.trim() ?? "";
  const messageId = activity.id?.trim() ?? "";
  const speakerId = activity.from?.id?.trim() ?? "";
  const speakerName = activity.from?.name?.trim() || "Partecipante Teams";
  const text = visibleTeamsMessageText(activity.text);
  if (!meetingId || !messageId || !text || meetingId.length > 240 || messageId.length > 240) {
    return null;
  }

  const timestamp = activity.timestamp instanceof Date
    ? activity.timestamp.getTime()
    : typeof activity.timestamp === "string"
      ? Date.parse(activity.timestamp)
      : Number.NaN;
  const senderIsAvatar = Boolean(
    speakerId && activity.recipient?.id && speakerId === activity.recipient.id,
  );
  return {
    platform: "teams",
    meetingId,
    messageId,
    ...(speakerId ? { speakerId: speakerId.slice(0, 240) } : {}),
    speakerName: speakerName.slice(0, 80),
    text: text.slice(0, 4_000),
    ...(Number.isFinite(timestamp) ? { capturedAt: new Date(timestamp).toISOString() } : {}),
    senderIsAvatar,
  };
}
