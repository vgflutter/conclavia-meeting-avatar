import { DEFAULT_ASSISTANT_PROFILE, getAssistantProfile } from "@/lib/assistant-profile";
import { AVATAR_VOICES, isAvatarVoice } from "@/lib/avatar-voice-catalog";
import { meetingTtsConfig, selectedMeetingVoices } from "@/lib/meeting-tts-config";
import { AssistantProfileModel } from "@/models/AssistantProfile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

// Management-only. The public tunnel must never expose profile changes.
export async function GET() {
  try {
    const profile = await getAssistantProfile();
    const config = meetingTtsConfig();
    return Response.json({ voices: AVATAR_VOICES, selected: selectedMeetingVoices(profile.voice, config),
      speakingRate: profile.voice.speakingRate, enabled: config.provider === "inworld" && config.ready }, { headers });
  } catch { return Response.json({ error: "Voice settings unavailable" }, { status: 503, headers }); }
}

export async function PATCH(request: Request) {
  const origin = request.headers.get("origin");
  const destination = new URL(request.url);
  if (request.headers.get("host")) destination.host = request.headers.get("host")!;
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== destination.origin)) {
    return Response.json({ error: "Forbidden" }, { status: 403, headers });
  }
  let input: { language: "it" | "en"; voiceId?: string; speakingRate?: number };
  try {
    if (!request.headers.get("content-type")?.includes("application/json")) throw new Error();
    const body = await request.text();
    if (body.length > 512) throw new Error();
    input = JSON.parse(body);
    if (!input || Object.keys(input).some((key) => !["language", "voiceId", "speakingRate"].includes(key)) ||
      !["it", "en"].includes(input.language) ||
      (input.voiceId === undefined && input.speakingRate === undefined) ||
      (input.voiceId !== undefined && !isAvatarVoice(input.voiceId, input.language)) ||
      (input.speakingRate !== undefined && (typeof input.speakingRate !== "number" || !Number.isFinite(input.speakingRate) || input.speakingRate < 0.8 || input.speakingRate > 1.1))) throw new Error();
  } catch { return Response.json({ error: "Invalid voice selection" }, { status: 400, headers }); }
  try {
    await getAssistantProfile(); // Connect without resetting any existing settings.
    await AssistantProfileModel.updateOne({ key: "default" }, { $setOnInsert: DEFAULT_ASSISTANT_PROFILE }, { upsert: true });
    const field = input.language === "it" ? "voice.inworldVoiceIdIt" : "voice.inworldVoiceIdEn";
    await AssistantProfileModel.updateOne({ key: "default" }, { $set: { ...(input.voiceId !== undefined ? { [field]: input.voiceId } : {}),
      ...(input.speakingRate !== undefined ? { "voice.speakingRate": input.speakingRate } : {}) } }, { runValidators: true, strict: "throw" });
    const profile = await getAssistantProfile();
    return Response.json({ selected: selectedMeetingVoices(profile.voice), speakingRate: profile.voice.speakingRate }, { headers });
  } catch { return Response.json({ error: "Unable to save voice" }, { status: 503, headers }); }
}
