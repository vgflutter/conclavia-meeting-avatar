import { publicPodcastSpeechConfig } from "@/lib/podcast/speech";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Readiness flags only: no credentials, model requests or database access. */
export async function GET() {
  const enabled = process.env.PODCAST_AI_ENABLED === "true";
  const providers = {
    openai: enabled && Boolean(process.env.OPENAI_API_KEY?.trim()),
    gemini: enabled && Boolean(process.env.GEMINI_API_KEY?.trim() && process.env.PODCAST_GEMINI_MODEL?.trim()),
  };
  return Response.json({
    ai: { enabled, ready: providers.openai, providers },
    speech: publicPodcastSpeechConfig(),
  }, { headers: { "Cache-Control": "no-store" } });
}
