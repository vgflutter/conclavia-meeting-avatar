import { podcastMutationIsSameOrigin } from "@/lib/podcast/request-guard";
// Recovered from vgflutter/conclavia @ 5d4746f900a106defe1377131bce7ebbc5b69ca3.
// Namespaced podcast feature; existing Meeting records and runtime stay separate.
import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { chooseNextTurn } from "@/lib/podcast/talk-director";

import { connectToDatabase } from "@/lib/mongodb";
import { createInitialDiscussionState } from "@/lib/podcast/talk-director";
import { serializeTalk } from "@/lib/podcast/serialize-talk";
import { serializeTalkRun } from "@/lib/podcast/serialize-talk-run";
import {
  getTalkRunBlockCode,
  MAX_RUN_TURNS,
} from "@/lib/podcast/talk-run-compatibility";
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
    const documents = await TalkRunModel.find({ talkId: id }).sort({ createdAt: -1 }).limit(30).exec();
    const runs = documents.map(serializeTalkRun);
    return NextResponse.json({ runs, run: runs[0] ?? null });
  } catch (error) {
    console.error("Unable to load latest talk run", error);
    return NextResponse.json(
      { error: "Unable to load the talk run" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  if (!podcastMutationIsSameOrigin(request)) return Response.json({ error: "Cross-origin podcast mutations are blocked" }, { status: 403 });
  const { id } = await context.params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Talk not found" }, { status: 404 });
  }

  try {
    await connectToDatabase();
    const document = await TalkModel.findById(id).exec();
    if (!document) {
      return NextResponse.json({ error: "Talk not found" }, { status: 404 });
    }

    const talk = serializeTalk(document);
    const blockCode = getTalkRunBlockCode(talk);
    if (blockCode) {
      return NextResponse.json(
        { error: "This talk cannot be run yet", code: blockCode },
        { status: 409 },
      );
    }

    await TalkRunModel.init();
    const activeRun = await TalkRunModel.findOne({
      talkId: document._id,
      status: { $in: ["idle", "generating", "waiting_for_human"] },
    })
      .sort({ createdAt: -1 })
      .exec();
    if (activeRun) {
      return NextResponse.json({ run: serializeTalkRun(activeRun) });
    }

    const run = await TalkRunModel.create({
      talkId: document._id,
      status: "idle",
      phase: talk.moderator.kind === "none" ? "discussion" : "opening",
      participantTurnCount: 0,
      maxTurns: Math.min(talk.settings.maxTurns, MAX_RUN_TURNS),
      targetDurationMinutes: talk.settings.targetDurationMinutes,
      estimatedAirtimeSeconds: 0,
      nextParticipantIndex: 0,
      discussionState: createInitialDiscussionState(talk),
      talkSnapshot: talk,
      messages: [],
      startedAt: new Date(),
    });

    const initial = serializeTalkRun(run);
    const plan = chooseNextTurn(talk, initial);
    const isHuman = plan && (plan.speakerType === "moderator"
      ? talk.moderator.kind === "human"
      : talk.participants[plan.participantIndex ?? 0]?.kind === "human");
    if (isHuman && plan) {
      run.status = "waiting_for_human";
      run.activeTurn = plan;
      await run.save();
    }
    return NextResponse.json({ run: serializeTalkRun(run) }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      const existing = await TalkRunModel.findOne({ talkId: id, status: { $in: ["idle", "generating", "waiting_for_human"] } }).sort({ createdAt: -1 }).exec();
      if (existing) return NextResponse.json({ run: serializeTalkRun(existing) });
    }
    console.error("Unable to create talk run", error);
    return NextResponse.json(
      { error: "Unable to create the talk run" },
      { status: 500 },
    );
  }
}
