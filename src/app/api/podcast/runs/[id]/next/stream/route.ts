import { podcastMutationIsSameOrigin } from "@/lib/podcast/request-guard";
// Recovered from vgflutter/conclavia @ 5d4746f900a106defe1377131bce7ebbc5b69ca3.
// Namespaced podcast feature; existing Meeting records and runtime stay separate.
import { Types } from "mongoose";

import { advanceTalkRun, AdvanceTalkRunError } from "@/lib/podcast/advance-talk-run";

export const runtime = "nodejs";
export const maxDuration = 120;

interface RouteContext {
  params: Promise<{ id: string }>;
}

function eventData(type: string, value: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify({ type, ...value })}\n\n`);
}

export async function POST(request: Request, context: RouteContext) {
  if (!podcastMutationIsSameOrigin(request)) return Response.json({ error: "Cross-origin podcast mutations are blocked" }, { status: 403 });
  const { id } = await context.params;
  if (!Types.ObjectId.isValid(id)) {
    return Response.json({ error: "Talk run not found" }, { status: 404 });
  }

  // One operator action produces one turn. Speculative paid preparation stays off.
  const prepareNext = false;
  const disconnected = new AbortController();
  const signal = AbortSignal.any([request.signal, disconnected.signal]);
  let connected = true;
  request.signal.addEventListener("abort", () => {
    connected = false;
  });

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (type: string, value: Record<string, unknown>) => {
        if (!connected) return;
        try {
          controller.enqueue(eventData(type, value));
        } catch {
          connected = false;
        }
      };

      void (async () => {
        try {
          const run = await advanceTalkRun(
            id,
            {
              onSpeechStored: (run) => send("speech_stored", { run }),
              onPlan: (plan) => send("plan", { plan }),
              onDelta: (delta) => send("delta", { delta }),
              onPreparing: (plan) => send("preparing", { plan }),
              onPrepared: (plan) => send("prepared", { plan }),
              onEditorialReviewStarted: () =>
                send("editorial_review_started", {}),
              onEditorialReviewCompleted: (discussionState) =>
                send("editorial_review_completed", { discussionState }),
              onSpeechReady: (message) =>
                send("speech_ready", { message }),
              onTurnSaved: (savedRun) =>
                send("turn_complete", { run: savedRun }),
            },
            { prepareNext, lowLatency: true, signal },
          );
          send("complete", { run });
        } catch (error) {
          if (error instanceof AdvanceTalkRunError) {
            send("error", {
              error: error.message,
              run: error.run,
              code: error.code,
              status: error.status,
            });
          } else {
            send("error", {
              error: "Unable to generate the next intervention",
              status: 500,
            });
          }
        } finally {
          if (connected) controller.close();
        }
      })();
    },
    cancel() { connected = false; disconnected.abort(); },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
