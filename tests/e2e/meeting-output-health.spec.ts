import { expect, test } from "@playwright/test";
import { MeetingOutputUnavailableError, meetingOutputReadiness, verifyMeetingOutput } from "../../src/lib/meeting-output-health";
import { AttendeeMeetingBotAdapter } from "../../src/lib/meeting-bot-adapter";
import type { MeetingBotRuntimeConfig } from "../../src/lib/meeting-bot-config";
import type { MeetingResponse } from "../../src/types/meeting";

const url = "https://avatar.example/meeting-room/00000000-0000-4000-8000-000000000000?mode=meeting";
const validPage = () => new Response('<main data-output-runtime="conclavia-v1"></main><script src="/_next/runtime.js"></script>', { headers: { "Content-Type": "text/html" } });
const validScript = () => new Response("/* runtime */", {headers: {"Content-Type": "application/javascript"}});
const config: MeetingBotRuntimeConfig = { provider: "attendee", liveRequested: true, ready: true,
  apiBaseUrl: "https://app.attendee.dev/api/v1", apiKey: "not-a-real-key", publicBaseUrl: "https://avatar.example",
  accessMode: "anonymous_guest", displayName: "Riccardo", signedInConfirmed: false };
const meeting = { id: "test-only", platform: "microsoft_teams", meetingUrl: "https://teams.live.com/meet/test",
  scheduledStart: "2030-01-01T10:00:00Z", scheduledEnd: "2030-01-01T10:30:00Z", language: "it",
  assistant: {wakeWord: "Riccardo"}, bot: { outputToken: "00000000-0000-4000-8000-000000000000",
    entryAttemptId: "11111111-1111-4111-8111-111111111111", externalBotId: "bot_test" },
} as MeetingResponse;

test("Attendee reale: preflight fallito non chiama la creazione del partecipante", async () => {
  let providerCalls = 0;
  const adapter = new AttendeeMeetingBotAdapter(config, async (input) => {
    if (String(input).includes("app.attendee.dev")) providerCalls++;
    throw new TypeError("DNS unavailable");
  });
  await expect(adapter.join(meeting)).rejects.toBeInstanceOf(MeetingOutputUnavailableError);
  await expect(adapter.schedule(meeting)).rejects.toBeInstanceOf(MeetingOutputUnavailableError);
  expect(providerCalls).toBe(0);
});

for (const restart of [false, true]) {
test(`Attendee reale: ${restart ? "riavvia" : "ripristina"} il video sullo stesso bot e include il tentativo`, async () => {
  const providerCalls: Array<{path: string; method?: string; body: string}> = [];
  const adapter = new AttendeeMeetingBotAdapter(config, async (input, init) => {
    const endpoint = new URL(String(input));
    if (endpoint.pathname.startsWith("/_next/")) return validScript();
    if (endpoint.hostname === "app.attendee.dev") {
      providerCalls.push({path: endpoint.pathname, method: init?.method, body: String(init?.body)});
      return Response.json({});
    }
    return endpoint.pathname.endsWith("/state") ? Response.json({status: "live"}) : validPage();
  });
  const output = await adapter.refreshOutput(meeting, {restart});
  expect(new URL(output).searchParams.get("attempt")).toBe(meeting.bot.entryAttemptId);
  expect(providerCalls).toHaveLength(restart ? 2 : 1);
  for (const call of providerCalls) {
    expect(call.path).toBe("/api/v1/bots/bot_test/voice_agent_settings");
    expect(call.method).toBe("PATCH");
  }
  if (restart) expect(JSON.parse(providerCalls[0].body)).toEqual({url: ""});
  expect(JSON.parse(providerCalls.at(-1)!.body)).toEqual({url: output});
});
}

for (const [language, captionLanguage] of [["it", "it-it"], ["en", "en-us"]] as const) {
  test(`Attendee: imposta esplicitamente la lingua dei sottotitoli ${language}`, async () => {
    let body: Record<string, unknown> | undefined;
    const adapter = new AttendeeMeetingBotAdapter(config, async (input, init) => {
      const endpoint = new URL(String(input));
      if (endpoint.hostname === "app.attendee.dev") {
        expect(init?.redirect).toBe("error");
        body = JSON.parse(String(init?.body));
        return Response.json({id: "bot_test"}, {status: 201});
      }
      if (endpoint.pathname.startsWith("/_next/")) return validScript();
      return endpoint.pathname.endsWith("/state") ? Response.json({status: "joining"}) : validPage();
    });
    await adapter.join({...meeting, language});
    expect(body?.transcription_settings).toEqual({meeting_closed_captions: {teams_language: captionLanguage}});
  });
}

for (const failure of ["dns", "timeout", "gateway", "error-page", "state", "redirect", "script"]) {
  test(`avatar preflight: blocca ${failure}`, async () => {
    const fetcher: typeof fetch = async (input, init) => {
      expect(init?.redirect).toBe("error");
      expect(init?.signal).toBeDefined();
      const state = String(input).includes("/state");
      if (String(input).includes("/_next/")) return failure === "script" ? new Response("Forbidden", {status: 403}) : validScript();
      if (failure === "dns") throw new TypeError("DNS unavailable");
      if (failure === "timeout") throw new DOMException("Timeout", "TimeoutError");
      if (failure === "redirect") return new Response(null, {status: 302, headers: {Location: "https://other.example"}});
      if (state) return failure === "state" ? new Response("{}", {status: 404}) : Response.json({status: "joining"});
      if (failure === "gateway") return new Response("Bad gateway", {status: 502});
      if (failure === "error-page") return new Response("This site cannot be reached", {headers: {"Content-Type": "text/html"}});
      return validPage();
    };
    await expect(verifyMeetingOutput(url, fetcher)).rejects.toBeInstanceOf(MeetingOutputUnavailableError);
  });
}

for (const language of ["it-it", "en-us"] as const) {
  test(`Attendee: ingresso tracciato rimanda ${language} a una PATCH sullo stesso bot`, async () => {
    const calls: Array<{path: string; method?: string; body: Record<string, unknown>}> = [];
    const adapter = new AttendeeMeetingBotAdapter(config, async (input, init) => {
      const endpoint = new URL(String(input));
      if (endpoint.hostname === "app.attendee.dev") {
        calls.push({path: endpoint.pathname, method: init?.method, body: JSON.parse(String(init?.body))});
        return Response.json({id: "bot_test"}, {status: init?.method === "POST" ? 201 : 200});
      }
      if (endpoint.pathname.startsWith("/_next/")) return validScript();
      return endpoint.pathname.endsWith("/state") ? Response.json({status: "joining"}) : validPage();
    });
    await adapter.join({...meeting, bot: {...meeting.bot, captionLanguage: language}});
    expect(calls[0].body.transcription_settings).toEqual({meeting_closed_captions: {}});
    await adapter.setCaptionLanguage("bot_test", language);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual({path: "/api/v1/bots/bot_test/transcription_settings", method: "PATCH",
      body: {transcription_settings: {meeting_closed_captions: {teams_language: language}}}});
  });
}

test("avatar preflight: pagina corretta e stato raggiungibile", async () => {
  const calls: string[] = [];
  await verifyMeetingOutput(url, async (input) => {
    calls.push(String(input));
    if (String(input).includes("/_next/")) return validScript();
    return String(input).includes("/state") ? Response.json({status: "joining"}) : validPage();
  });
  expect(calls).toHaveLength(3);
});

test("avatar readiness: presenza nel meeting non basta e una conferma vecchia scade", () => {
  const now = Date.now();
  expect(meetingOutputReadiness({}, now)).toBe("missing");
  expect(meetingOutputReadiness({outputLastSeenAt: new Date(now), outputVoiceReady: false}, now)).toBe("preparing");
  expect(meetingOutputReadiness({outputLastSeenAt: new Date(now), outputVoiceReady: true}, now)).toBe("ready");
  expect(meetingOutputReadiness({outputLastSeenAt: new Date(now - 21_000), outputVoiceReady: true}, now)).toBe("missing");
});
