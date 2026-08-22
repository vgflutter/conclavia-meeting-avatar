#!/usr/bin/env node

import { randomUUID } from "node:crypto";

import { decideActivation } from "./core/activation.js";
import type { TranscriptSegment } from "./domain/protocol.js";
import { runMacosPreflight } from "./preflight/macos.js";
import { startServer } from "./server.js";

const command = process.argv[2] ?? "serve";
const wakeWord = process.env.CONCLAVIA_WAKE_WORD?.trim() || "Mary";

async function main(): Promise<void> {
  if (command === "preflight") {
    console.log(JSON.stringify(await runMacosPreflight(), null, 2));
    return;
  }

  if (command === "simulate") {
    const text = process.argv.slice(3).join(" ").trim() || `${wakeWord}, cosa ne pensi?`;
    const segment: TranscriptSegment = {
      id: randomUUID(),
      speakerName: "Partecipante demo",
      text,
      isFinal: true,
      capturedAt: new Date().toISOString(),
    };
    console.log(JSON.stringify(decideActivation(segment, wakeWord), null, 2));
    return;
  }

  if (command !== "serve") {
    throw new Error(`Unknown command: ${command}`);
  }

  const port = Number.parseInt(process.env.PORT ?? "4310", 10);
  const dialogueTimeoutMs = Number.parseInt(
    process.env.CONCLAVIA_DIALOGUE_TIMEOUT_MS ?? "45000",
    10,
  );
  const dialogueMaxFollowUps = Number.parseInt(
    process.env.CONCLAVIA_DIALOGUE_MAX_FOLLOW_UPS ?? "2",
    10,
  );
  const host = process.env.HOST?.trim() || "127.0.0.1";
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  if (!Number.isInteger(dialogueTimeoutMs) || dialogueTimeoutMs < 10_000) {
    throw new Error("CONCLAVIA_DIALOGUE_TIMEOUT_MS must be an integer of at least 10000");
  }
  if (
    !Number.isInteger(dialogueMaxFollowUps) ||
    dialogueMaxFollowUps < 1 ||
    dialogueMaxFollowUps > 5
  ) {
    throw new Error("CONCLAVIA_DIALOGUE_MAX_FOLLOW_UPS must be between 1 and 5");
  }

  await startServer({
    host,
    port,
    wakeWord,
    dialogueTimeoutMs,
    dialogueMaxFollowUps,
    configPath:
      process.env.CONCLAVIA_CONFIG_PATH?.trim() || ".conclavia/avatar-config.json",
    openaiApiKey: process.env.OPENAI_API_KEY,
    responseModel: process.env.OPENAI_RESPONSE_MODEL?.trim() || "gpt-5.4-mini",
    transcriptionModel:
      process.env.OPENAI_TRANSCRIPTION_MODEL?.trim() || "gpt-4o-mini-transcribe",
    realtimeTranscriptionModel:
      process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL?.trim() || "gpt-live-transcribe",
    meetingAudioDevice:
      process.env.CONCLAVIA_MEETING_AUDIO_DEVICE?.trim()
      || process.env.CONCLAVIA_TEAMS_AUDIO_DEVICE?.trim()
      || "BlackHole 16ch",
    meetingSpeakerName:
      process.env.CONCLAVIA_MEETING_SPEAKER_NAME?.trim()
      || process.env.CONCLAVIA_TEAMS_SPEAKER_NAME?.trim()
      || "Partecipante meeting",
    rendererUrl:
      process.env.CONCLAVIA_RENDERER_URL?.trim() || "http://127.0.0.1:3000",
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
