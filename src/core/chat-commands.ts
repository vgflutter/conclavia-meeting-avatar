import type {
  ChatCommandAliases,
  ChatCommandKind,
  MatchedChatCommand,
} from "../domain/protocol.js";
import { isFloorGrant } from "./activation.js";

const commandKeys: ReadonlyArray<readonly [keyof ChatCommandAliases, ChatCommandKind]> = [
  ["raiseHand", "raise-hand"],
  ["lowerHand", "lower-hand"],
  ["summarizeInChat", "summarize-in-chat"],
  ["replyInChat", "reply-in-chat"],
  ["speak", "speak"],
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
