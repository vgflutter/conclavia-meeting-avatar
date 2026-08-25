#!/usr/bin/env node

import { randomUUID } from "node:crypto";

import { decideActivation } from "./core/activation.js";
import type { TranscriptSegment } from "./domain/protocol.js";
import { runMacosPreflight } from "./preflight/macos.js";
import { auditWebAvatar, inspectWebAvatarModel } from "./performance/web-avatar-audit.js";
import { installWebAvatar } from "./performance/web-avatar-installer.js";
import { writeWebAvatarScaffold } from "./performance/web-avatar-scaffold.js";
import {
  loadWebAvatarManifest,
  webAvatarModelPath,
} from "./performance/web-avatar-manifest.js";
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

  if (command === "web-avatar:audit") {
    const avatarId = process.argv[3]?.trim() || "showcase";
    const directory = process.env.CONCLAVIA_WEB_AVATAR_DIRECTORY?.trim()
      || ".conclavia/web-avatars";
    const manifest = await loadWebAvatarManifest(directory, avatarId);
    if (!manifest) throw new Error(`Web avatar manifest not found or invalid: ${avatarId}`);
    const audit = await auditWebAvatar(manifest, webAvatarModelPath(directory, manifest));
    console.log(JSON.stringify(audit, null, 2));
    if (!audit.valid) process.exitCode = 1;
    return;
  }

  if (command === "web-avatar:install") {
    const manifestPath = process.argv[3]?.trim();
    if (!manifestPath) throw new Error("Usage: web-avatar:install <manifest.json>");
    const directory = process.env.CONCLAVIA_WEB_AVATAR_DIRECTORY?.trim()
      || ".conclavia/web-avatars";
    const installed = await installWebAvatar(manifestPath, directory);
    console.log(JSON.stringify({
      installed: true,
      id: installed.manifest.id,
      displayName: installed.manifest.displayName,
      assetVersion: installed.manifest.assetVersion,
      directory: installed.directory,
      modelBytes: installed.modelBytes,
      audit: installed.audit,
    }, null, 2));
    return;
  }

  if (command === "web-avatar:probe") {
    const modelPath = process.argv[3]?.trim();
    if (!modelPath) throw new Error("Usage: web-avatar:probe <model.glb>");
    console.log(JSON.stringify(await inspectWebAvatarModel(modelPath), null, 2));
    return;
  }

  if (command === "web-avatar:scaffold") {
    const modelPath = process.argv[3]?.trim();
    const avatarId = process.argv[4]?.trim();
    if (!modelPath || !avatarId) {
      throw new Error("Usage: web-avatar:scaffold <model.glb> <avatar-id>");
    }
    const result = await writeWebAvatarScaffold(modelPath, avatarId);
    console.log(JSON.stringify({
      created: true,
      outputPath: result.outputPath,
      unresolved: result.unresolved,
    }, null, 2));
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
  const rendererMode = process.env.CONCLAVIA_RENDERER_MODE?.trim() === "web"
    ? "web"
    : "unreal";
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
      process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL?.trim() || "gpt-4o-mini-transcribe",
    meetingAudioDevice:
      process.env.CONCLAVIA_MEETING_AUDIO_DEVICE?.trim()
      || process.env.CONCLAVIA_TEAMS_AUDIO_DEVICE?.trim()
      || "BlackHole 16ch",
    meetingSpeakerName:
      process.env.CONCLAVIA_MEETING_SPEAKER_NAME?.trim()
      || process.env.CONCLAVIA_TEAMS_SPEAKER_NAME?.trim()
      || "Partecipante meeting",
    rendererUrl:
      process.env.CONCLAVIA_RENDERER_URL?.trim() || `http://${host}:${port}`,
    rendererMode,
    webAvatarDirectory:
      process.env.CONCLAVIA_WEB_AVATAR_DIRECTORY?.trim()
      || ".conclavia/web-avatars",
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
