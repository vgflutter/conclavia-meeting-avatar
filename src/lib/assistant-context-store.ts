import { connectToDatabase } from "@/lib/mongodb";
import { AssistantContextModel } from "@/models/AssistantContext";
import { MeetingSeriesModel } from "@/models/MeetingSeries";
import type { MeetingDocument } from "@/models/Meeting";
import type { AssistantContextLayers, ContextValue } from "@/lib/assistant-context";

export async function getGlobalAssistantContext(): Promise<ContextValue> {
  await connectToDatabase();
  const value = await AssistantContextModel.findOne({ key: "default" }).lean().exec();
  return { context: value?.context || "", version: value?.contextVersion || 0 };
}

export async function getMeetingContextLayers(
  meeting: Pick<MeetingDocument, "seriesId" | "context">,
): Promise<AssistantContextLayers> {
  // Resolve on every generation: edits also apply to existing meetings without rejoining.
  const [global, series] = await Promise.all([
    getGlobalAssistantContext(),
    meeting.seriesId
      ? MeetingSeriesModel.findById(meeting.seriesId).select("context").lean().exec()
      : Promise.resolve(null),
  ]);
  return { global: global.context, series: series?.context || "", meeting: meeting.context || "" };
}
