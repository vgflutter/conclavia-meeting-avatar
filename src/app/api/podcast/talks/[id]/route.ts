import { podcastMutationIsSameOrigin, readPodcastJson, PodcastRequestError } from "@/lib/podcast/request-guard";
// Recovered from vgflutter/conclavia @ 5d4746f900a106defe1377131bce7ebbc5b69ca3.
// Namespaced podcast feature; existing Meeting records and runtime stay separate.
import { Types } from "mongoose";
import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/mongodb";
import { serializeTalk } from "@/lib/podcast/serialize-talk";
import { validateTalkInput } from "@/lib/podcast/talk-validation";
import { AudienceRoomModel } from "@/models/PodcastAudienceRoom";
import { TalkModel } from "@/models/PodcastTalk";
import { TalkRunModel } from "@/models/PodcastRun";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Talk not found" }, { status: 404 });
  }

  try {
    await connectToDatabase();
    const talk = await TalkModel.findById(id).exec();

    if (!talk) {
      return NextResponse.json({ error: "Talk not found" }, { status: 404 });
    }

    return NextResponse.json({ talk: serializeTalk(talk) });
  } catch (error) {
    console.error(`Unable to read talk ${id}`, error);
    return NextResponse.json(
      { error: "Unable to load the talk" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!podcastMutationIsSameOrigin(request)) return Response.json({ error: "Cross-origin podcast mutations are blocked" }, { status: 403 });
  const { id } = await context.params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Talk not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await readPodcastJson(request);
  } catch (error) {
    if (error instanceof PodcastRequestError) return Response.json({ error: error.message }, { status: error.status });
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const result = validateTalkInput(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "The talk configuration is invalid", issues: result.issues },
      { status: 400 },
    );
  }

  try {
    await connectToDatabase();
    const talk = await TalkModel.findByIdAndUpdate(id, result.data, {
      new: true,
      runValidators: true,
    }).exec();
    if (!talk) {
      return NextResponse.json({ error: "Talk not found" }, { status: 404 });
    }
    return NextResponse.json({ talk: serializeTalk(talk) });
  } catch (error) {
    console.error(`Unable to update talk ${id}`, error);
    return NextResponse.json(
      { error: "Unable to update the talk" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!podcastMutationIsSameOrigin(request)) return Response.json({ error: "Cross-origin podcast mutations are blocked" }, { status: 403 });
  const { id } = await context.params;

  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Talk not found" }, { status: 404 });
  }

  try {
    await connectToDatabase();

    const activeRun = await TalkRunModel.exists({
      talkId: id,
      status: "generating",
      generationStartedAt: { $gte: new Date(Date.now() - 130_000) },
    }).exec();
    if (activeRun) {
      return NextResponse.json(
        {
          error: "The talk cannot be deleted while an intervention is being generated",
          code: "active_run",
        },
        { status: 409 },
      );
    }

    const talk = await TalkModel.findByIdAndDelete(id).exec();
    if (!talk) {
      return NextResponse.json({ error: "Talk not found" }, { status: 404 });
    }

    const runIds = await TalkRunModel.distinct("_id", { talkId: talk._id }).exec();
    await AudienceRoomModel.deleteMany({ runId: { $in: runIds } }).exec();
    const deletedRuns = await TalkRunModel.deleteMany({ talkId: talk._id }).exec();

    return NextResponse.json({
      deleted: true,
      deletedRuns: deletedRuns.deletedCount,
    });
  } catch (error) {
    console.error(`Unable to delete talk ${id}`, error);
    return NextResponse.json(
      { error: "Unable to delete the talk" },
      { status: 500 },
    );
  }
}
