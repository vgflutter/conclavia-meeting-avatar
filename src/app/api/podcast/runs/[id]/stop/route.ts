import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { podcastMutationIsSameOrigin } from "@/lib/podcast/request-guard";
import { serializeTalkRun } from "@/lib/podcast/serialize-talk-run";
import { TalkRunModel } from "@/models/PodcastRun";

export const runtime = "nodejs";

/** Close a rehearsal without deleting its transcript. Never interrupt an in-flight save. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!podcastMutationIsSameOrigin(request)) return Response.json({ error: "Cross-origin podcast mutations are blocked" }, { status: 403 });
  const { id } = await context.params;
  if (!Types.ObjectId.isValid(id)) return Response.json({ error: "Podcast run not found" }, { status: 404 });
  try {
    await connectToDatabase();
    const run = await TalkRunModel.findOneAndUpdate({ _id: id, status: { $ne: "generating" } }, {
      $set: { status: "completed", phase: "completed", completedAt: new Date() },
      $unset: { activeTurn: 1, generationStartedAt: 1, generationToken: 1, preparedTurn: 1, error: 1 },
    }, { new: true }).exec();
    if (run) return Response.json({ run: serializeTalkRun(run) });
    const exists = await TalkRunModel.exists({ _id: id }).exec();
    return Response.json({ error: exists ? "Wait for or cancel the current generation before ending this run" : "Podcast run not found" }, { status: exists ? 409 : 404 });
  } catch {
    return Response.json({ error: "Unable to end this podcast run" }, { status: 500 });
  }
}
