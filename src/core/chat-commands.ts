import type {
  ChatCommandAliases,
  ChatCommandKind,
  MatchedChatCommand,
} from "../domain/protocol.js";
import { isFloorGrant } from "./activation.js";

const commandKeys: ReadonlyArray<readonly [keyof ChatCommandAliases, ChatCommandKind]> = [
  ["raiseHand", "raise-hand"],
  ["lowerHand", "lower-hand"],
  ["applaud", "applaud"],
  ["previewMoods", "preview-moods"],
  ["summarizeInChat", "summarize-in-chat"],
  ["replyInChat", "reply-in-chat"],
  ["speak", "speak"],
  ["setAgenda", "set-agenda"],
  ["cancelAgenda", "cancel-agenda"],
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function phrasePattern(value: string): string {
  return value
    .trim()
    .split(/\s+/gu)
    .map(escapeRegExp)
    .join("\\s+");
}

function addressedRemainder(text: string, avatarName: string): string | null {
  const name = phrasePattern(avatarName);
  const match = new RegExp(
    `^\\s*(?:@\\s*)?${name}(?=$|[\\s,.:;!?-])(?:[\\s,.:;!?-]+)?`,
    "iu",
  ).exec(text);
  return match ? text.slice(match[0].length).trim() : null;
}

export function matchChatCommand(
  text: string,
  avatarName: string,
  aliases: ChatCommandAliases,
): MatchedChatCommand | null {
  const remainder = addressedRemainder(text, avatarName);
  if (remainder === null) return null;

  const candidates = commandKeys
    .flatMap(([key, kind]) => aliases[key].map((alias) => ({ alias, kind })))
    .sort((left, right) => right.alias.length - left.alias.length);

  for (const candidate of candidates) {
    const match = new RegExp(
      `^${phrasePattern(candidate.alias)}(?=$|[\\s,.:;!?-])(?:[\\s,.:;!?-]+)?`,
      "iu",
    ).exec(remainder);
    if (!match) continue;
    return {
      kind: candidate.kind,
      alias: candidate.alias,
      argument: remainder.slice(match[0].length).trim(),
    };
  }
  return null;
}

/**
 * Voice transcription shares the configurable command vocabulary, but only
 * physical gestures and the explicit mood diagnostic are safe to execute
 * immediately. Content-producing chat commands keep their existing
 * channel-specific behavior.
 */
export function matchSpokenGestureCommand(
  text: string,
  avatarName: string,
  aliases: ChatCommandAliases,
): (MatchedChatCommand & {
  kind: "raise-hand" | "lower-hand" | "applaud" | "preview-moods";
}) | null {
  const command = matchChatCommand(text, avatarName, aliases);
  if (
    command?.kind !== "raise-hand" && command?.kind !== "lower-hand" &&
    command?.kind !== "applaud" && command?.kind !== "preview-moods"
  ) return null;
  return command as MatchedChatCommand & {
    kind: "raise-hand" | "lower-hand" | "applaud" | "preview-moods";
  };
}

export function chatResponseChannel(
  text: string,
  avatarName: string,
  command: MatchedChatCommand | null,
  hasPendingFloorRequest: boolean,
): "voice" | "chat" {
  if (command?.kind === "speak") return "voice";
  if (hasPendingFloorRequest && isFloorGrant(text, avatarName)) return "voice";
  return "chat";
}
