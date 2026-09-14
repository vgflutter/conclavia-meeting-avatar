import { expect, test } from "@playwright/test";
import { MeetingOutputUnavailableError, meetingOutputReadiness, verifyMeetingOutput } from "../../src/lib/meeting-output-health";
import { AttendeeMeetingBotAdapter } from "../../src/lib/meeting-bot-adapter";
import type { MeetingBotRuntimeConfig } from "../../src/lib/meeting-bot-config";
import type { MeetingResponse } from "../../src/types/meeting";
import { meetingEntryError } from "../../src/lib/meeting-entry-policy";

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
    const session = await adapter.join({...meeting, bot: {...meeting.bot, captionLanguage: language}});
    expect(session.diagnosticLogsRequested).toBe(true);
    expect(calls[0].body.webhooks).toEqual([expect.objectContaining({triggers: [
      "bot_logs.update", "bot.state_change", "transcript.update", "participant_events.join_leave",
    ]})]);
    expect(calls[0].body.debug_settings).toBeUndefined(); // No opt-in video recording.
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

test("avatar preflight: pagina lenta non consuma il tempo dei successivi JavaScript", async () => {
  const signals = new Set<AbortSignal>();
  let scriptCalls = 0;
  let concurrent = 0;
  let maxConcurrent = 0;
  const started = Date.now();
  await verifyMeetingOutput(url, async (input, init) => {
    signals.add(init!.signal!);
    const path = new URL(String(input)).pathname;
    if (path.endsWith("/state")) return Response.json({status: "joining", voice: {ready: true}});
    if (path.startsWith("/_next/")) {
      scriptCalls++;
      maxConcurrent = Math.max(maxConcurrent, ++concurrent);
      await new Promise(resolve => setTimeout(resolve, 180));
      concurrent--;
      return validScript();
    }
    await new Promise(resolve => setTimeout(resolve, 200));
    const scripts = Array.from({length: 9}, (_, i) => `<script src="/_next/${i}.js"></script>`).join("");
    return new Response(`<main data-output-runtime="conclavia-v1"></main>${scripts}<script src="/_next/0.js"></script>`, {headers: {"Content-Type": "text/html"}});
  }, {requestMs: 500, totalMs: 3_000, retryDelayMs: 0});
  expect(Date.now() - started).toBeGreaterThan(500);
  expect(scriptCalls).toBe(9); // Duplicate HTML references do not refetch the asset.
  expect(maxConcurrent).toBe(4);
  expect(signals.size).toBe(11); // Page, state, nine assets: no shared per-request clock.
  expect([...signals].every(signal => signal.aborted)).toBeTruthy();
});

for (const status of [408, 429, 502]) {
  test(`avatar preflight: recupera HTTP ${status}, poi crea un solo bot`, async () => {
    let pages = 0;
    let creations = 0;
    const adapter = new AttendeeMeetingBotAdapter(config, async (input, init) => {
      const endpoint = new URL(String(input));
      if (endpoint.hostname === "app.attendee.dev") {
        expect(init?.method).toBe("POST");
        creations++;
        return Response.json({id: "bot_test"}, {status: 201});
      }
      expect(init?.method).toBe("GET");
      if (endpoint.pathname.startsWith("/_next/")) return validScript();
      if (endpoint.pathname.endsWith("/state")) return Response.json({status: "joining"});
      return ++pages === 1 ? new Response("temporary", {status}) : validPage();
    });
    await adapter.join(meeting);
    expect(pages).toBe(2);
    expect(creations).toBe(1);
  });
}

test("avatar preflight: timeout temporaneo recuperato con un nuovo segnale", async () => {
  const pageSignals: AbortSignal[] = [];
  await verifyMeetingOutput(url, async (input, init) => {
    if (String(input).includes("/state")) return Response.json({status: "joining"});
    if (String(input).includes("/_next/")) return validScript();
    pageSignals.push(init!.signal!);
    if (pageSignals.length === 1) return new Promise<Response>(() => {});
    return validPage();
  }, {requestMs: 50, totalMs: 2_000, retryDelayMs: 0});
  expect(pageSignals).toHaveLength(2);
  expect(pageSignals[0]).not.toBe(pageSignals[1]);
  expect(pageSignals.every(signal => signal.aborted)).toBeTruthy();
});

for (const [scenario, expectedCode] of [
  ["403", "output_page_http_403"], ["redirect", "output_page_http_302"],
  ["html", "output_page_invalid"], ["state", "output_state_invalid"],
  ["voice", "output_state_voice"], ["script", "output_scripts_http_404"],
  ["tls", "output_page_tls"],
] as const) {
  test(`avatar preflight: diagnostica sicura ${scenario}, nessun retry permanente`, async () => {
    const calls = new Map<string, number>();
    const error = await verifyMeetingOutput(url, async (input) => {
      const path = new URL(String(input)).pathname;
      calls.set(path, (calls.get(path) || 0) + 1);
      if (path.startsWith("/_next/")) return scenario === "script" ? new Response("private provider details", {status: 404}) : validScript();
      if (path.endsWith("/state")) {
        if (scenario === "state") return new Response("private invalid JSON");
        return Response.json({status: "joining", voice: {ready: scenario !== "voice"}});
      }
      if (scenario === "403") return new Response("private provider details", {status: 403});
      if (scenario === "redirect") return new Response(null, {status: 302});
      if (scenario === "html") return new Response("private provider details", {headers: {"Content-Type": "text/html"}});
      if (scenario === "tls") throw new TypeError(`private ${url}`, {cause: {code: "UNABLE_TO_GET_ISSUER_CERT_LOCALLY"}});
      return validPage();
    }).catch(error => error);
    expect(error).toBeInstanceOf(MeetingOutputUnavailableError);
    expect(error.code).toBe(expectedCode);
    expect(error.retryable).toBeFalsy();
    expect([...calls.values()].every(count => count === 1)).toBeTruthy();
    for (const italian of [true, false]) {
      const message = meetingEntryError(error.code, italian);
      expect(message).toBeTruthy();
      expect(`${error.message} ${error.code} ${message}`).not.toMatch(/private|avatar\.example|00000000/u);
    }
  });
}

test("avatar preflight: blocco totale include i body e interrompe anche i controlli fratelli", async () => {
  const signals: AbortSignal[] = [];
  let calls = 0;
  const started = Date.now();
  await expect(verifyMeetingOutput(url, async (_input, init) => {
    calls++;
    signals.push(init!.signal!);
    // Headers arrive, but neither JSON nor HTML ever finishes loading.
    return new Response(new ReadableStream({start() {}}), {headers: {"Content-Type": "text/html"}});
  }, {requestMs: 2_000, totalMs: 80, retryDelayMs: 0})).rejects.toMatchObject({code: expect.stringMatching(/^output_(page|state)_timeout$/u)});
  expect(calls).toBe(2);
  expect(signals.every(signal => signal.aborted)).toBeTruthy();
  expect(Date.now() - started).toBeLessThan(1_500);
});

test("avatar preflight: il limite totale interrompe anche l’attesa fra retry", async () => {
  let calls = 0;
  const started = Date.now();
  await expect(verifyMeetingOutput(url, async input => {
    if (String(input).includes("/state")) return Response.json({status: "joining"});
    calls++;
    throw new TypeError("temporary DNS failure");
  }, {requestMs: 1_000, totalMs: 80, retryDelayMs: 3_000})).rejects.toMatchObject({code: "output_page_timeout"});
  expect(calls).toBe(1);
  expect(Date.now() - started).toBeLessThan(1_500);
});

test("avatar preflight: DNS persistente termina dopo due GET, senza dettagli sensibili", async () => {
  let calls = 0;
  await expect(verifyMeetingOutput(url, async input => {
    if (String(input).includes("/state")) return Response.json({status: "joining"});
    calls++;
    throw new TypeError(`private URL ${url}`);
  }, {retryDelayMs: 0})).rejects.toMatchObject({code: "output_page_network", message: "The public avatar check failed."});
  expect(calls).toBe(2);
});

test("avatar preflight: indirizzi e script esterni restano bloccati", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async input => {
    calls++;
    expect(new URL(String(input)).hostname).toBe("avatar.example");
    if (String(input).includes("/state")) return Response.json({status: "joining"});
    return new Response('<main data-output-runtime="conclavia-v1"></main><script src="https://other.example/code.js"></script>', {headers: {"Content-Type": "text/html"}});
  };
  await expect(verifyMeetingOutput(url.replace("https:", "http:"), fetcher)).rejects.toMatchObject({code: "output_url_invalid"});
  expect(calls).toBe(0);
  await expect(verifyMeetingOutput(url, fetcher)).rejects.toMatchObject({code: "output_scripts_invalid"});
  expect(calls).toBe(2);
  expect(meetingEntryError("output_page_private=https://private.example")).toBeUndefined();
});

test("avatar readiness: presenza nel meeting non basta e una conferma vecchia scade", () => {
  const now = Date.now();
  expect(meetingOutputReadiness({}, now)).toBe("missing");
  expect(meetingOutputReadiness({outputLastSeenAt: new Date(now), outputVoiceReady: false}, now)).toBe("preparing");
  expect(meetingOutputReadiness({outputLastSeenAt: new Date(now), outputVoiceReady: true}, now)).toBe("ready");
  expect(meetingOutputReadiness({outputLastSeenAt: new Date(now - 21_000), outputVoiceReady: true}, now)).toBe("missing");
});
