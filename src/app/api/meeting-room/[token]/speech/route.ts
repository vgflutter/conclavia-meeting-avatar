import { getAssistantProfile } from "@/lib/assistant-profile";
import { inworldSpeechResponse, SpeechServiceError } from "@/lib/inworld-tts";
import { meetingSpeechLanguage, splitMeetingSpeech } from "@/lib/meeting-speech";
import { meetingTtsConfig, selectedMeetingVoices } from "@/lib/meeting-tts-config";
import { connectToDatabase } from "@/lib/mongodb";
import { limitedSpeechResponse } from "@/lib/speech-request-limit";
import { MeetingModel } from "@/models/Meeting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!uuid.test(token)) return Response.json({ error: "Not found" }, { status: 404 });
  let input: { attemptId: string; commandId: string; chunk: number };
  try {
    const body = await request.text();
    if (body.length > 512) throw new Error();
    input = JSON.parse(body);
    if (!input || typeof input.attemptId !== "string" || !uuid.test(input.attemptId) ||
      typeof input.commandId !== "string" || !uuid.test(input.commandId) ||
      !Number.isInteger(input.chunk) || input.chunk < 0 || input.chunk > 31 ||
      Object.keys(input).some((key) => !["attemptId", "commandId", "chunk"].includes(key))) throw new Error();
  } catch { return Response.json({ error: "Invalid speech request" }, { status: 400 }); }
  try {
    await connectToDatabase();
    const meeting = await MeetingModel.findOne({
      "bot.outputToken": token, "bot.entryAttemptId": input.attemptId,
      "bot.status": "joined", status: "live", "bot.stopRequestedAt": null, "bot.leftAt": null,
      "commandHistory.id": input.commandId,
    }).select("commandHistory language bot.outputSpeechCommandId bot.outputSpeechState").exec();
    const command = meeting?.commandHistory.find((entry) => entry.id === input.commandId);
    if (!meeting || !command || (meeting.bot.outputSpeechCommandId === command.id && meeting.bot.outputSpeechState === "completed")) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    const text = splitMeetingSpeech(command.response, 3_800)[input.chunk];
    if (!text || text.length > 4_000) return Response.json({ error: "Invalid speech chunk" }, { status: 400 });
    const config = meetingTtsConfig();
    if (config.provider !== "inworld" || !config.ready) throw new SpeechServiceError();
    const profile = await getAssistantProfile();
    const language = meetingSpeechLanguage(command.response, meeting.language === "en" ? "en" : "it");
    return await limitedSpeechResponse(token, () => inworldSpeechResponse({
      text, language, voiceId: selectedMeetingVoices(profile.voice, config)[language],
      speakingRate: profile.voice.speakingRate, signal: request.signal,
    }));
  } catch (error) {
    return Response.json({ error: "Voice service unavailable" }, { status: error instanceof SpeechServiceError ? error.status : 503 });
  }
}
