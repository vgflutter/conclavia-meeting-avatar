import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { decideActivation, isDialogueDismissal } from "./core/activation.js";
import { ConclaviaRenderer } from "./conclavia/renderer.js";
import type { ActivationDecision, TranscriptSegment } from "./domain/protocol.js";
import { MeetingIntelligence } from "./openai/meeting-intelligence.js";
import { runMacosPreflight } from "./preflight/macos.js";
import { MeetingListener } from "./teams/meeting-listener.js";

const publicDirectory = join(dirname(fileURLToPath(import.meta.url)), "../public");
const staticFiles: ReadonlyMap<string, readonly [string, string]> = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/output", ["output.html", "text/html; charset=utf-8"]],
  ["/output.html", ["output.html", "text/html; charset=utf-8"]],
  ["/output.js", ["output.js", "text/javascript; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
] as const);
const maxRetainedSegments = 200;
const maxAudioBytes = 20 * 1024 * 1024;

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  let size = 0;

  for await (const chunk of request as AsyncIterable<Uint8Array>) {
    size += chunk.byteLength;
    if (size > 65_536) {
      throw new Error("Request body too large");
    }
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function readBinaryBody(request: IncomingMessage): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let size = 0;

  for await (const chunk of request as AsyncIterable<Uint8Array>) {
    size += chunk.byteLength;
    if (size > maxAudioBytes) {
      throw new Error("Audio too large (maximum 20 MB)");
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

function parseSpeakerName(value: string | null): string | null {
  const speakerName = value?.trim() ?? "";
  return speakerName && speakerName.length <= 80 ? speakerName : null;
}

function parseSimulationInput(value: unknown): { speakerName: string; text: string } | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.speakerName !== "string" || typeof record.text !== "string") {
    return null;
  }
  const speakerName = record.speakerName.trim();
  const text = record.text.trim();
  if (!speakerName || !text || speakerName.length > 80 || text.length > 2_000) {
    return null;
  }
  return { speakerName, text };
}

function audioFileDetails(contentTypeHeader: string | undefined): {
  mimeType: string;
  extension: string;
} | null {
  const mimeType = contentTypeHeader?.split(";", 1)[0]?.trim().toLowerCase();
  const extensions: Readonly<Record<string, string>> = {
    "audio/webm": "webm",
    "video/webm": "webm",
    "audio/mp4": "m4a",
    "video/mp4": "mp4",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/ogg": "ogg",
    "audio/flac": "flac",
  };
  const extension = mimeType ? extensions[mimeType] : undefined;
  return mimeType && extension ? { mimeType, extension } : null;
}

async function serveStatic(pathname: string, response: ServerResponse): Promise<boolean> {
  const file = staticFiles.get(pathname);
  if (!file) {
    return false;
  }
  const [name, contentType] = file;
  const path = join(publicDirectory, name);
  const metadata = await stat(path);
  response.writeHead(200, {
    "content-type": contentType,
    "content-length": metadata.size,
    "cache-control": "no-cache",
  });
  createReadStream(path).pipe(response);
  return true;
}

export interface ServerOptions {
  host: string;
  port: number;
  wakeWord: string;
  dialogueTimeoutMs: number;
  openaiApiKey: string | undefined;
  responseModel: string;
  transcriptionModel: string;
  realtimeTranscriptionModel: string;
  teamsAudioDevice: string;
  teamsSpeakerName: string;
  rendererUrl: string | undefined;
}

export function startServer(options: ServerOptions): Promise<void> {
  const transcriptHistory: TranscriptSegment[] = [];
  const openaiApiKey = options.openaiApiKey?.trim();
  const intelligence = openaiApiKey
    ? new MeetingIntelligence({
        apiKey: openaiApiKey,
        responseModel: options.responseModel,
        transcriptionModel: options.transcriptionModel,
      })
    : null;
  const renderer = new ConclaviaRenderer(options.rendererUrl);
  let rendererArmed = false;
  let rendererPlayerUrl: string | undefined;
  let dialogueActiveUntil = 0;

  const isDialogueActive = () => Date.now() < dialogueActiveUntil;

  const contextSnapshot = () => ({
    retainedSegmentCount: transcriptHistory.length,
    recentSegments: transcriptHistory.slice(-8),
    dialogue: {
      active: isDialogueActive(),
      activeUntil: isDialogueActive() ? new Date(dialogueActiveUntil).toISOString() : null,
    },
  });

  const processSegment = async (segment: TranscriptSegment) => {
    const startedAt = performance.now();
    let llmMs: number | null = null;
    let rendererMs: number | null = null;
    let decision: ActivationDecision = decideActivation(
      segment,
      options.wakeWord,
      isDialogueActive(),
    );
    if (decision.ingested) {
      transcriptHistory.push(segment);
      if (transcriptHistory.length > maxRetainedSegments) {
        transcriptHistory.splice(0, transcriptHistory.length - maxRetainedSegments);
      }
    }
    let warning: string | null = null;
    let delivery: Awaited<ReturnType<ConclaviaRenderer["deliver"]>> | null = null;
    if (decision.activated && intelligence) {
      try {
        const llmStartedAt = performance.now();
        const cue = await intelligence.createCue(transcriptHistory, segment);
        llmMs = Math.round(performance.now() - llmStartedAt);
        if (cue) {
          decision = { ...decision, cue };
          dialogueActiveUntil = Date.now() + options.dialogueTimeoutMs;
          transcriptHistory.push({
            id: cue.id,
            speakerName: options.wakeWord,
            text: cue.sentences.map((sentence) => sentence.text).join(" "),
            isFinal: true,
            capturedAt: cue.createdAt,
          });
          if (transcriptHistory.length > maxRetainedSegments) {
            transcriptHistory.splice(0, transcriptHistory.length - maxRetainedSegments);
          }
        } else {
          decision = {
            ingested: decision.ingested,
            activated: false,
            reason: "conversation-observed",
          };
        }
      } catch (error: unknown) {
        console.error("OpenAI response failed:", error);
        warning = "Mary ha ascoltato la frase, ma la risposta OpenAI non è riuscita. È mostrata la risposta diagnostica.";
      }
    }

    if (
      rendererArmed &&
      decision.cue?.provider === "openai"
    ) {
      try {
        const rendererStartedAt = performance.now();
        delivery = await renderer.deliver(decision.cue);
        rendererMs = Math.round(performance.now() - rendererStartedAt);
      } catch (error: unknown) {
        console.error("Conclavia MetaHuman delivery failed:", error);
        const rendererWarning =
          "Mary ha generato la risposta, ma il MetaHuman non è riuscito a riprodurla.";
        warning = warning ? `${warning} ${rendererWarning}` : rendererWarning;
      }
    }

    if (isDialogueDismissal(segment.text, options.wakeWord)) {
      dialogueActiveUntil = 0;
    }

    return {
      segment,
      llmContext: contextSnapshot(),
      decision,
      renderer: {
        armed: rendererArmed,
        playerUrl: rendererPlayerUrl ?? null,
        delivery,
      },
      latency: {
        llmMs,
        rendererMs,
        totalMs: Math.round(performance.now() - startedAt),
      },
      warning,
    };
  };

  const listener = openaiApiKey
    ? new MeetingListener({
        apiKey: openaiApiKey,
        audioDevice: options.teamsAudioDevice,
        speakerName: options.teamsSpeakerName,
        transcriptionModel: options.realtimeTranscriptionModel,
        wakeWord: options.wakeWord,
        onSegment: processSegment,
      })
    : null;

  const handleRequest = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

      if (request.method === "GET" && url.pathname === "/api/health") {
        sendJson(response, 200, {
          status: "ok",
          service: "conclavia-meeting-avatar",
          openaiConfigured: intelligence !== null,
          responseModel: options.responseModel,
          transcriptionModel: options.transcriptionModel,
          realtimeTranscriptionModel: options.realtimeTranscriptionModel,
          wakeWord: options.wakeWord,
          dialogue: contextSnapshot().dialogue,
          listener: listener?.status ?? null,
          rendererConfigured: renderer.configured,
          rendererArmed,
          time: new Date().toISOString(),
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/listener/status") {
        sendJson(response, 200, listener?.status ?? {
          phase: "unavailable",
          running: false,
          lastError: "OpenAI non configurato.",
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/listener/start") {
        if (!listener) {
          sendJson(response, 503, {
            error: "OpenAI non configurato. Aggiungi OPENAI_API_KEY e riavvia il server.",
          });
          return;
        }
        try {
          sendJson(response, 200, await listener.start());
        } catch (error: unknown) {
          console.error("Teams listener start failed:", error);
          sendJson(response, 502, {
            error: error instanceof Error ? error.message : "Avvio ascolto Teams non riuscito.",
            status: listener.status,
          });
        }
        return;
      }

      if (request.method === "DELETE" && url.pathname === "/api/listener/session") {
        if (!listener) {
          sendJson(response, 200, { phase: "stopped", running: false });
          return;
        }
        sendJson(response, 200, await listener.stop());
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/preflight") {
        sendJson(response, 200, await runMacosPreflight());
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/context") {
        sendJson(response, 200, contextSnapshot());
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/renderer/status") {
        const status = await renderer.status();
        if (status.playerUrl) rendererPlayerUrl = status.playerUrl;
        if (status.serverStatus === "stopping" || status.serverStatus === "stopped") {
          rendererArmed = false;
        }
        sendJson(response, 200, {
          ...status,
          armed: rendererArmed,
          playerUrl: rendererPlayerUrl ?? status.playerUrl ?? null,
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/renderer/start") {
        try {
          const session = await renderer.start();
          rendererArmed = true;
          rendererPlayerUrl = session.playerUrl;
          sendJson(response, 200, {
            ok: true,
            armed: rendererArmed,
            playerUrl: rendererPlayerUrl,
            serverStatus: session.serverStatus,
          });
        } catch (error: unknown) {
          console.error("Conclavia MetaHuman start failed:", error);
          sendJson(response, 502, {
            error:
              error instanceof Error
                ? error.message
                : "Avvio MetaHuman non riuscito",
          });
        }
        return;
      }

      if (request.method === "DELETE" && url.pathname === "/api/renderer/session") {
        try {
          await renderer.stop();
          rendererArmed = false;
          rendererPlayerUrl = undefined;
          sendJson(response, 200, { ok: true, armed: false });
        } catch (error: unknown) {
          console.error("Conclavia MetaHuman stop failed:", error);
          sendJson(response, 502, {
            error:
              error instanceof Error
                ? error.message
                : "Arresto MetaHuman non riuscito",
          });
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/simulate") {
        const input = parseSimulationInput(await readJsonBody(request));
        if (!input) {
          sendJson(response, 400, { error: "Invalid speakerName or text" });
          return;
        }

        const segment: TranscriptSegment = {
          id: randomUUID(),
          speakerName: input.speakerName,
          text: input.text,
          isFinal: true,
          capturedAt: new Date().toISOString(),
        };
        sendJson(response, 200, await processSegment(segment));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/transcribe") {
        if (!intelligence) {
          sendJson(response, 503, {
            error: "OpenAI non configurato. Aggiungi OPENAI_API_KEY al file .env e riavvia il server.",
          });
          return;
        }

        const speakerName = parseSpeakerName(url.searchParams.get("speakerName"));
        const fileDetails = audioFileDetails(request.headers["content-type"]);
        if (!speakerName || !fileDetails) {
          sendJson(response, 400, {
            error: "Partecipante o formato audio non valido. Sono supportati WebM, MP4/M4A, MP3, WAV, OGG e FLAC.",
          });
          return;
        }

        const audio = await readBinaryBody(request);
        if (audio.byteLength === 0) {
          sendJson(response, 400, { error: "La registrazione audio è vuota." });
          return;
        }

        let text: string;
        try {
          text = await intelligence.transcribe({
            bytes: audio,
            fileName: `meeting-${Date.now()}.${fileDetails.extension}`,
            mimeType: fileDetails.mimeType,
          });
        } catch (error: unknown) {
          console.error("OpenAI transcription failed:", error);
          sendJson(response, 502, {
            error: "Trascrizione OpenAI non riuscita. Controlla la chiave e il log del server.",
          });
          return;
        }

        if (!text) {
          sendJson(response, 422, { error: "Non è stato rilevato parlato nella registrazione." });
          return;
        }

        const segment: TranscriptSegment = {
          id: randomUUID(),
          speakerName,
          text,
          isFinal: true,
          capturedAt: new Date().toISOString(),
        };
        sendJson(response, 200, {
          ...(await processSegment(segment)),
          transcription: {
            provider: "openai",
            model: intelligence.transcriptionModel,
          },
        });
        return;
      }

      if (request.method === "GET" && (await serveStatic(url.pathname, response))) {
        return;
      }

      sendJson(response, 404, { error: "Not found" });
    } catch (error: unknown) {
      console.error(error);
      sendJson(response, 500, { error: "Internal server error" });
    }
  };

  const server = createServer((request, response) => {
    void handleRequest(request, response);
  });
  const shutdown = () => {
    const forceExit = setTimeout(() => process.exit(0), 2_500);
    void (async () => {
      intelligence?.abortPending();
      renderer.abortPending();
      await listener?.stop();
      server.closeAllConnections();
      server.close(() => clearTimeout(forceExit));
    })();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  server.once("close", () => {
    process.off("SIGINT", shutdown);
    process.off("SIGTERM", shutdown);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, options.host, () => {
      console.log(`Conclavia Meeting Avatar: http://${options.host}:${options.port}`);
      console.log(`Wake word: ${options.wakeWord}`);
      console.log(
        intelligence
          ? `OpenAI: ready (${options.transcriptionModel} + ${options.responseModel})`
          : "OpenAI: not configured (text diagnostic mode only)",
      );
      console.log(
        renderer.configured
          ? `Conclavia renderer bridge: ${options.rendererUrl}`
          : "Conclavia renderer bridge: not configured",
      );
      console.log(
        listener
          ? `Teams listener: ready (${options.teamsAudioDevice} -> ${options.realtimeTranscriptionModel})`
          : "Teams listener: not configured",
      );
      resolve();
    });
  });
}
