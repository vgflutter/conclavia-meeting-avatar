// Recovered from vgflutter/conclavia @ 5d4746f900a106defe1377131bce7ebbc5b69ca3.
// Namespaced podcast feature; existing Meeting records and runtime stay separate.
import { Types } from "mongoose";
import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/mongodb";
import { serializeTalkRun } from "@/lib/podcast/serialize-talk-run";
import { TalkRunModel } from "@/models/PodcastRun";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Talk run not found" }, { status: 404 });
  }

  try {
    await connectToDatabase();
    const run = await TalkRunModel.findById(id).exec();
    if (!run) {
      return NextResponse.json({ error: "Talk run not found" }, { status: 404 });
    }

    const generationIsStale =
      run.status === "generating" &&
      (!run.generationStartedAt ||
        run.generationStartedAt.getTime() < Date.now() - 130_000);
    const serialized = serializeTalkRun(run);
    // Reading a run never writes it. The next operator action may atomically reclaim
    // the stale lease; a concurrent newer generation cannot be released by GET.
    if (generationIsStale) {
      serialized.status = "failed";
      serialized.error = "The previous generation was interrupted and can be retried";
    }
    return NextResponse.json({ run: serialized });
  } catch (error) {
    console.error("Unable to load talk run", error);
    return NextResponse.json(
      { error: "Unable to load the talk run" },
      { status: 500 },
    );
  }
}
