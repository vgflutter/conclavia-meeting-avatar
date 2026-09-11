import { getAssistantProfile } from "@/lib/assistant-profile";
import { inworldSpeechResponse, SpeechServiceError } from "@/lib/inworld-tts";
import { limitedSpeechResponse } from "@/lib/speech-request-limit";
import type { InworldModel } from "@/lib/meeting-tts-config";
import { selectedMeetingVoices } from "@/lib/meeting-tts-config";
import { isAvatarVoice } from "@/lib/avatar-voice-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Management-only endpoint, excluded from the public tunnel by src/proxy.ts.
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const publicUrl = new URL(request.url);
  // Next can normalize request.url to the server's bind host (localhost), even
  // when the browser used 127.0.0.1 or a LAN name. Host is the actual request
  // destination; do not let a client-controlled forwarded host override it.
  const host = request.headers.get("host");
  if (host) publicUrl.host = host;
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== publicUrl.origin)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  let input: { text: string; language: "it" | "en"; model: InworldModel; voiceId?: string; speakingRate?: number };
  try {
    if (!request.headers.get("content-type")?.includes("application/json")) throw new Error();
    const text = await request.text();
    if (text.length > 5_000) throw new Error();
    input = JSON.parse(text);
    if (!input || typeof input.text !== "string" || !input.text.trim() || input.text.length > 1_000 ||
      !["it", "en"].includes(input.language) || !["inworld-tts-2-flash", "inworld-tts-2"].includes(input.model) ||
      (input.voiceId !== undefined && !isAvatarVoice(input.voiceId, input.language)) ||
      (input.speakingRate !== undefined && (typeof input.speakingRate !== "number" || !Number.isFinite(input.speakingRate) || input.speakingRate < 0.8 || input.speakingRate > 1.1))) throw new Error();
  } catch { return Response.json({ error: "Invalid voice test" }, { status: 400 }); }
  try {
    const profile = await getAssistantProfile();
    return await limitedSpeechResponse("preview", () => inworldSpeechResponse({
      ...input, voiceId: input.voiceId || selectedMeetingVoices(profile.voice)[input.language],
      speakingRate: input.speakingRate ?? profile.voice.speakingRate, signal: request.signal,
    }));
  } catch (error) {
    return Response.json({ error: "Voice service unavailable" }, { status: error instanceof SpeechServiceError ? error.status : 503 });
  }
}
