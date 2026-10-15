import { podcastMutationIsSameOrigin } from "@/lib/podcast/request-guard";
// Recovered from vgflutter/conclavia @ 5d4746f900a106defe1377131bce7ebbc5b69ca3.
// Namespaced podcast feature; existing Meeting records and runtime stay separate.
import { NextResponse } from "next/server";

import { advanceTalkRun, AdvanceTalkRunError } from "@/lib/podcast/advance-talk-run";

export const runtime = "nodejs";
export const maxDuration = 120;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  if (!podcastMutationIsSameOrigin(request)) return Response.json({ error: "Cross-origin podcast mutations are blocked" }, { status: 403 });
  const { id } = await context.params;
  try {
    return NextResponse.json({
      run: await advanceTalkRun(id, {}, { signal: request.signal }),
    });
  } catch (error) {
    if (error instanceof AdvanceTalkRunError) {
      return NextResponse.json(
        { error: error.message, run: error.run, code: error.code },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: "Unable to generate the next intervention" },
      { status: 500 },
    );
  }
}
