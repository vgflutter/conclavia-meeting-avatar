import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { validateContext } from "@/lib/assistant-context";
import { getGlobalAssistantContext } from "@/lib/assistant-context-store";
import { connectToDatabase } from "@/lib/mongodb";
import { AssistantContextModel } from "@/models/AssistantContext";
import { MeetingModel } from "@/models/Meeting";
import { MeetingSeriesModel } from "@/models/MeetingSeries";

export const runtime = "nodejs";

function target(request: Request) {
  const query = new URL(request.url).searchParams;
  const scope = query.get("scope") || "global";
  const id = query.get("id");
  if (scope === "global" && !id) return { scope } as const;
  if ((scope === "meeting" || scope === "series") && id && Types.ObjectId.isValid(id)) {
    return { scope, id } as const;
  }
  return undefined;
}

export async function GET(request: Request) {
  const selected = target(request);
  if (!selected) return NextResponse.json({ error: "Invalid context scope" }, { status: 400 });
  try {
    await connectToDatabase();
    if (selected.scope === "global") return NextResponse.json(await getGlobalAssistantContext());
    const document = selected.scope === "meeting"
      ? await MeetingModel.findById(selected.id).select("context contextVersion").lean().exec()
      : await MeetingSeriesModel.findById(selected.id).select("context contextVersion").lean().exec();
    if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ context: document.context || "", version: document.contextVersion || 0 });
  } catch {
    return NextResponse.json({ error: "Unable to load context" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const origin = request.headers.get("origin");
  const destination = new URL(request.url);
  if (request.headers.get("host")) destination.host = request.headers.get("host")!;
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== destination.origin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const selected = target(request);
  if (!selected) return NextResponse.json({ error: "Invalid context scope" }, { status: 400 });
  const body = await request.json().catch(() => null);
  if (!body || !validateContext(body.context) || !Number.isSafeInteger(body.version) || body.version < 0) {
    return NextResponse.json({ error: "Context must be text of at most 8000 characters with a valid version" }, { status: 400 });
  }
  try {
    await connectToDatabase();
    const versionFilter = body.version === 0
      ? { $or: [{ contextVersion: 0 }, { contextVersion: { $exists: false } }] }
      : { contextVersion: body.version };
    const update = { $set: { context: body.context.trim() }, $inc: { contextVersion: 1 } };
    const options = { new: true, runValidators: true };
    if (selected.scope === "global") {
      // Create just the context record; never reset the avatar or voice profile.
      await AssistantContextModel.updateOne({ key: "default" }, { $setOnInsert: { key: "default", context: "", contextVersion: 0 } }, { upsert: true });
    }
    const saved = selected.scope === "global"
      ? await AssistantContextModel.findOneAndUpdate({ key: "default", ...versionFilter }, update, options).exec()
      : selected.scope === "meeting"
        ? await MeetingModel.findOneAndUpdate({ _id: selected.id, ...versionFilter }, update, options).exec()
        : await MeetingSeriesModel.findOneAndUpdate({ _id: selected.id, ...versionFilter }, update, options).exec();
    if (!saved) {
      const exists = selected.scope === "global" || (selected.scope === "meeting"
        ? await MeetingModel.exists({ _id: selected.id })
        : await MeetingSeriesModel.exists({ _id: selected.id }));
      return NextResponse.json({ error: exists ? "Context changed in another window" : "Not found" }, { status: exists ? 409 : 404 });
    }
    return NextResponse.json({ context: saved.context || "", version: saved.contextVersion });
  } catch {
    return NextResponse.json({ error: "Unable to save context" }, { status: 500 });
  }
}
