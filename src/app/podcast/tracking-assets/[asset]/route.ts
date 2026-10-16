import { podcastFaceAssetResponse } from "@conclavia/avatar-kit/server/assets";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ asset: string }> }) {
  return podcastFaceAssetResponse(request, (await context.params).asset);
}
export const HEAD = GET;
