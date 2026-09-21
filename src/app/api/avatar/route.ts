import { NextResponse } from "next/server";

import { DEFAULT_ASSISTANT_PROFILE, getAssistantProfile } from "@/lib/assistant-profile";
import { isAvatarVoice } from "@/lib/avatar-voice-catalog";
import { isAvatarVisualStyle } from "@/lib/avatar-visual-style";
import { isAvatarAppearance, isAvatarAppearanceSupported } from '@conclavia/avatar-kit/lib/avatar-catalog';
import { connectToDatabase } from "@/lib/mongodb";
import { AssistantProfileModel } from "@/models/AssistantProfile";
import { MeetingModel } from "@/models/Meeting";
import { MeetingSeriesModel } from "@/models/MeetingSeries";
import type {
  AssistantAttitude,
  AssistantResponseStyle,
  AssistantVoiceStyle,
} from "@/types/assistant-profile";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ profile: await getAssistantProfile() });
  } catch (error) {
    console.error("Unable to load avatar profile", error);
    return NextResponse.json({ error: "Unable to load avatar profile" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const origin = request.headers.get("origin");
  const destination = new URL(request.url);
  if (request.headers.get("host")) destination.host = request.headers.get("host")!;
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== destination.origin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid avatar profile" }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const displayName = typeof payload.displayName === "string" ? payload.displayName.trim().slice(0, 80) : "";
  const role = typeof payload.role === "string" ? payload.role.trim().slice(0, 120) : "";
  const style = payload.voiceStyle as AssistantVoiceStyle;
  const responseStyle = payload.responseStyle as AssistantResponseStyle;
  const attitude = payload.attitude as AssistantAttitude;
  const speakingRate = payload.speakingRate;
  const appearance = payload.appearance;
  const visualStyle = payload.visualStyle;
  if (visualStyle !== undefined && !isAvatarVisualStyle(visualStyle)) {
    return NextResponse.json({ error: "Invalid avatar visual style" }, { status: 400 });
  }
  const voiceIt = payload.inworldVoiceIdIt;
  const voiceEn = payload.inworldVoiceIdEn;
  if ((voiceIt !== undefined && !isAvatarVoice(voiceIt, "it")) || (voiceEn !== undefined && !isAvatarVoice(voiceEn, "en"))) {
    return NextResponse.json({ error: "Invalid voice selection" }, { status: 400 });
  }
  if (appearance !== undefined && !isAvatarAppearance(appearance)) {
    return NextResponse.json({ error: "Invalid avatar appearance" }, { status: 400 });
  }

  if (
    !displayName ||
    !role ||
    !["executive_warm", "executive_clear"].includes(style) ||
    !["concise", "balanced", "detailed"].includes(responseStyle) ||
    !["discreet", "collaborative", "proactive"].includes(attitude)
  ) {
    return NextResponse.json({ error: "Name, role, personality and voice style are required" }, { status: 400 });
  }
  if (speakingRate !== undefined && (typeof speakingRate !== "number" || !Number.isFinite(speakingRate) || speakingRate < 0.8 || speakingRate > 1.1)) {
    return NextResponse.json({ error: "Speaking rate must be between 0.8 and 1.1" }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const previous = await AssistantProfileModel.findOne({ key: "default" }).exec();
    const nextAppearance = isAvatarAppearance(appearance) ? appearance : previous?.appearance ?? DEFAULT_ASSISTANT_PROFILE.appearance;
    const nextStyle = isAvatarVisualStyle(visualStyle) ? visualStyle : previous?.visualStyle ?? DEFAULT_ASSISTANT_PROFILE.visualStyle;
    if (!isAvatarAppearanceSupported(nextAppearance, nextStyle)) {
      return NextResponse.json({ error: "This appearance is not available in the selected visual style" }, { status: 400 });
    }
    const updated = await AssistantProfileModel.findOneAndUpdate(
      // Do not combine an appearance with a style changed concurrently after
      // the compatibility check. Omitted fields still preserve stored choices.
      { key: "default", ...(previous ? { appearance: previous.appearance,
        // Mongoose materializes the editorial default for legacy rows whose
        // field is absent on disk. Both represent the same stored selection.
        visualStyle: previous.visualStyle && previous.visualStyle !== "editorial"
          ? previous.visualStyle : { $in: ["editorial", null] } } : {}) },
      {
        $set: { displayName, role, ...(appearance ? { appearance } : {}), ...(visualStyle !== undefined ? { visualStyle } : {}), personality: { responseStyle, attitude },
          "voice.style": style, ...(speakingRate !== undefined ? { "voice.speakingRate": speakingRate } : {}),
          ...(voiceIt !== undefined ? { "voice.inworldVoiceIdIt": voiceIt } : {}),
          ...(voiceEn !== undefined ? { "voice.inworldVoiceIdEn": voiceEn } : {}) },
        $setOnInsert: { key: "default", ...(appearance ? {} : { appearance: DEFAULT_ASSISTANT_PROFILE.appearance }),
          "voice.provider": DEFAULT_ASSISTANT_PROFILE.voice.provider,
          "voice.model": DEFAULT_ASSISTANT_PROFILE.voice.model,
          "voice.pronunciationProfile": DEFAULT_ASSISTANT_PROFILE.voice.pronunciationProfile },
      },
      { upsert: !previous, new: true, runValidators: true, setDefaultsOnInsert: true },
    ).exec();
    if (!updated) return NextResponse.json({ error: "Avatar changed; reload before saving" }, { status: 409 });
    await Promise.all([
      MeetingModel.updateMany(
        { status: { $in: ["scheduled", "joining", "waiting_room", "live"] } },
        { $set: { "assistant.wakeWord": displayName } },
      ).exec(),
      MeetingSeriesModel.updateMany(
        {},
        { $set: { "assistant.wakeWord": displayName } },
      ).exec(),
    ]);
    return NextResponse.json({ profile: await getAssistantProfile() });
  } catch (error) {
    console.error("Unable to save avatar profile", error);
    return NextResponse.json({ error: "Unable to save avatar profile" }, { status: 500 });
  }
}
