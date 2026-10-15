import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { inworldSpeechResponse, SpeechServiceError } from "@/lib/inworld-tts";
import { limitedSpeechResponse } from "@/lib/speech-request-limit";
import { podcastSpeechOptions, publicPodcastSpeechConfig } from "@/lib/podcast/speech";
import { podcastMutationIsSameOrigin, PodcastRequestError, readPodcastJson } from "@/lib/podcast/request-guard";
import { TalkRunModel } from "@/models/PodcastRun";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Explicit operator action only; never called by polling, page rendering or broadcasts. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!podcastMutationIsSameOrigin(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  if (!Types.ObjectId.isValid(id)) return Response.json({ error: "Podcast run not found" }, { status: 404 });
  let sequence: number;
  try {
    const input = await readPodcastJson(request, 200);
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length !== 1 ||
      !("sequence" in input) || !Number.isSafeInteger(input.sequence) || Number(input.sequence) < 1) {
      throw new PodcastRequestError("A stored AI turn sequence is required");
    }
    sequence = Number(input.sequence);
  } catch (error) {
    return Response.json({ error: error instanceof PodcastRequestError ? error.message : "Invalid request" },
      { status: error instanceof PodcastRequestError ? error.status : 400 });
  }
  const config = publicPodcastSpeechConfig();
  if (!config.ready) return Response.json({ error: "Podcast voice is disabled or unavailable" }, { status: 503 });
  try {
    await connectToDatabase();
    const run = await TalkRunModel.findById(id).select("talkSnapshot messages").lean();
    const speech = run && podcastSpeechOptions(run, sequence);
    if (!speech) return Response.json({ error: "Stored AI turn not found or unsupported" }, { status: 404 });
    return await limitedSpeechResponse(`podcast:${id}`, () => inworldSpeechResponse({ ...speech, model: config.model, signal: request.signal }));
  } catch (error) {
    return Response.json({ error: "Podcast voice unavailable" }, { status: error instanceof SpeechServiceError ? error.status : 503 });
  }
}
