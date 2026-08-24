import { App } from "@microsoft/teams.apps";

import type { OutboundChatMessage } from "../domain/protocol.js";
import { teamsActivityToChatMessage } from "./teams-chat.js";

interface CompanionChatResult {
  outboundMessages?: OutboundChatMessage[];
}

function companionUrl(): string {
  const configured = process.env.CONCLAVIA_COMPANION_URL?.trim();
  return (configured || "http://127.0.0.1:4310").replace(/\/+$/, "");
}

async function forwardToCompanion(payload: ReturnType<typeof teamsActivityToChatMessage>) {
  if (!payload) return null;
  const response = await fetch(`${companionUrl()}/api/chat/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.json().catch(() => ({})) as CompanionChatResult & { error?: string };
  if (!response.ok) {
    throw new Error(body.error || `Companion returned HTTP ${response.status}.`);
  }
  return body;
}

const app = new App();

app.on("message", async (context) => {
  const payload = teamsActivityToChatMessage(context.activity);
  if (!payload || payload.senderIsAvatar) return;

  try {
    const result = await forwardToCompanion(payload);
    for (const outbound of result?.outboundMessages ?? []) {
      const text = outbound.text?.trim();
      if (text) await context.send(text);
    }
  } catch (error) {
    context.log.error("Failed to relay a Teams message to the Conclavia companion", {
      meetingId: payload.meetingId,
      messageId: payload.messageId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

const port = process.env.CONCLAVIA_TEAMS_AGENT_PORT?.trim() || process.env.PORT?.trim() || "3978";
await app.start(port);
