import { expect, test } from "@playwright/test";
import { inworldSpeechResponse, SpeechServiceError } from "../../src/lib/inworld-tts";
import { meetingTtsConfig } from "../../src/lib/meeting-tts-config";
import { createSpeechRequestLimiter } from "../../src/lib/speech-request-limit";
import { decodeSpeechPcm, inworldFrame, inworldViseme, readSpeechLines, SPEECH_SAMPLE_RATE, speechFrameAt } from "../../src/lib/streaming-speech";

const fakeConfig = meetingTtsConfig({ MEETING_TTS_PROVIDER: "inworld", INWORLD_API_KEY: "test-not-a-real-key" });
const input = () => ({ text: "Ciao Riccardo, mi senti?", language: "it" as const, speakingRate: 0.96, signal: new AbortController().signal });
const encode = (value: unknown) => new TextEncoder().encode(`${JSON.stringify(value)}\n`);
const pcm = (seconds = 0.3) => {
  const data = Buffer.alloc(Math.floor(SPEECH_SAMPLE_RATE * seconds) * 2);
  for (let i = 0; i < data.length / 2; i++) data.writeInt16LE(Math.round(7000 * Math.sin(i / SPEECH_SAMPLE_RATE * 2 * Math.PI * 220)), i * 2);
  return data.toString("base64");
};
const upstreamFrame = () => ({ result: { audioContent: pcm(), timestampInfo: { wordAlignment: {
  phoneticDetails: [{ phones: [{ phoneSymbol: "a", startTimeSeconds: 0, durationSeconds: 0.3, visemeSymbol: "aei" }] }],
} } } });

test("streaming config: opt-in automatico con chiave, Flash predefinito e nessun fallback silenzioso", () => {
  expect(meetingTtsConfig({})).toMatchObject({ provider: "inworld", ready: false });
  expect(fakeConfig).toMatchObject({ provider: "inworld", model: "inworld-tts-2-flash", ready: true });
  expect(meetingTtsConfig({ INWORLD_API_KEY: "test" }).provider).toBe("inworld");
  expect(meetingTtsConfig({ MEETING_TTS_PROVIDER: "inworld" }).ready).toBe(false);
  expect(meetingTtsConfig({ MEETING_TTS_PROVIDER: "typo" }).ready).toBe(false);
  expect(meetingTtsConfig({ MEETING_TTS_PROVIDER: "inworld", INWORLD_API_KEY: "test", INWORLD_TTS_MODEL: "typo" }).ready).toBe(false);
  expect(meetingTtsConfig({ MEETING_TTS_PROVIDER: "local", INWORLD_API_KEY: "test" })).toMatchObject({ provider: "inworld", ready: false });
  expect(fakeConfig.italianVoiceId).toBe("Gianni");
  expect(meetingTtsConfig({ INWORLD_VOICE_ID_IT: " ItalianCustom " }).italianVoiceId).toBe("ItalianCustom");
});

test("streaming HTTP: prima riproduzione disponibile prima della fine della sintesi", async () => {
  let provider!: ReadableStreamDefaultController<Uint8Array>;
  const response = await inworldSpeechResponse(input(), { config: fakeConfig, fetcher: async (_url, init) => {
    const request = JSON.parse(String(init?.body));
    expect(init?.redirect).toBe("error");
    expect(request).toMatchObject({ voiceId: "Gianni", modelId: "inworld-tts-2-flash", language: "it-IT", timestampType: "WORD",
      timestampTransportStrategy: "SYNC", audioConfig: { audioEncoding: "PCM", sampleRateHertz: 24000, speakingRate: 0.96 } });
    return new Response(new ReadableStream({ start(controller) { provider = controller; controller.enqueue(encode(upstreamFrame())); } }));
  } });
  const reader = response.body!.getReader();
  const first = await reader.read(); // Provider has not closed, yet the first chunk is already consumable.
  expect(JSON.parse(new TextDecoder().decode(first.value)).audio).toBeTruthy();
  provider.enqueue(encode(upstreamFrame()));
  provider.close();
  expect((await reader.read()).done).toBe(false);
  expect(JSON.parse(new TextDecoder().decode((await reader.read()).value))).toEqual({ done: true });
  expect((await reader.read()).done).toBe(true);
  expect(response.headers.get("cache-control")).toContain("no-transform");
});

test("streaming: cancella anche la richiesta upstream", async () => {
  let signal: AbortSignal | undefined;
  const response = await inworldSpeechResponse(input(), { config: fakeConfig, fetcher: async (_url, init) => {
    signal = init?.signal || undefined;
    return new Response(new ReadableStream({ start(controller) {
      controller.enqueue(encode(upstreamFrame()));
      signal?.addEventListener("abort", () => { try { controller.close(); } catch { /* cancelled */ } }, { once: true });
    } }));
  } });
  const reader = response.body!.getReader();
  await reader.read();
  const cancelled = reader.cancel();
  await expect.poll(() => signal?.aborted).toBe(true);
  // Abort-aware HTTP fetch releases its pending read. This fixture closes on abort as well.
  await cancelled;
});

for (const language of ["it", "en"] as const) test(`streaming: selezione voce ${language} indipendente`, async () => {
  const config = meetingTtsConfig({ MEETING_TTS_PROVIDER: "inworld", INWORLD_API_KEY: "test",
    INWORLD_VOICE_ID: "EnglishCustom", INWORLD_VOICE_ID_IT: "ItalianCustom" });
  const response = await inworldSpeechResponse({ ...input(), language }, { config, fetcher: async (_url, init) => {
    expect(JSON.parse(String(init?.body)).voiceId).toBe(language === "it" ? "ItalianCustom" : "EnglishCustom");
    return new Response(encode(upstreamFrame()));
  } });
  expect(await response.text()).toContain('"done":true');
});

for (const status of [401, 429, 500]) {
  test(`streaming: errore ${status}, nessun retry e nessuna credenziale nella risposta`, async () => {
    let calls = 0;
    await expect(inworldSpeechResponse(input(), { config: fakeConfig, fetcher: async () => {
      calls++;
      return new Response("private provider error with test-not-a-real-key", { status });
    } })).rejects.toMatchObject({ status: status === 429 ? 429 : 503, message: "Voice service unavailable" });
    expect(calls).toBe(1);
  });
}

test("streaming: errore dopo primo audio non diventa un falso completamento", async () => {
  const response = await inworldSpeechResponse(input(), { config: fakeConfig, fetcher: async () => new Response(
    `${JSON.stringify(upstreamFrame())}\n${JSON.stringify({ error: { message: "secret test-not-a-real-key" } })}\n`,
  ) });
  const text = await response.text();
  expect(text).toContain("Voice service unavailable");
  expect(text).not.toContain("secret");
  expect(text).not.toContain("test-not-a-real-key");
  expect(text).not.toContain('"done":true');
});

test("streaming: configurazione mancante non effettua richieste esterne", async () => {
  let calls = 0;
  await expect(inworldSpeechResponse(input(), { config: meetingTtsConfig({ MEETING_TTS_PROVIDER: "inworld" }),
    fetcher: async () => { calls++; return new Response(); } })).rejects.toBeInstanceOf(SpeechServiceError);
  expect(calls).toBe(0);
});

test("streaming: rifiuta audio vuoto e risposte provider malformate", async () => {
  for (const body of ["", "not-json\n", '{"result":{}}\n']) {
    const response = await inworldSpeechResponse(input(), { config: fakeConfig, fetcher: async () => new Response(body) });
    expect(await response.text()).toContain("Voice service unavailable");
  }
});

test("streaming: NDJSON segmentato byte per byte e ultima riga senza newline", async () => {
  const bytes = new TextEncoder().encode('{"text":"Sì, perché?"}\n{"done":true}');
  const stream = new ReadableStream<Uint8Array>({ start(controller) {
    for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
    controller.close();
  } });
  const output = [];
  for await (const frame of readSpeechLines(stream)) output.push(frame);
  expect(output).toEqual([{ text: "Sì, perché?" }, { done: true }]);
});

test("streaming: PCM e fonemi rispettano suoni, silenzi e tempo reale di riproduzione", () => {
  expect(inworldFrame(upstreamFrame()).phones).toEqual([{ start: 0, end: 0.3, viseme: "a" }]);
  const samples = decodeSpeechPcm(pcm());
  const phones = [{ start: 4, end: 4.3, viseme: "a" as const }];
  expect(speechFrameAt(samples, 0.1, phones, 4.1).viseme).toBe("a");
  expect(speechFrameAt(samples, 0.1, phones, 3.9).viseme).toBe("rest");
  expect(speechFrameAt(new Float32Array(24000), 0.1, phones, 4.1)).toEqual({ viseme: "rest", level: 0 });
  expect(inworldViseme("bmp", "[silence]")).toBe("rest");
  expect(inworldViseme("bmp", "p")).toBe("mbp");
  expect(inworldViseme("fv", "f")).toBe("fv");
  expect(inworldViseme("aei", "ɛ")).toBe("e");
  expect(() => decodeSpeechPcm(Buffer.from("RIFFfakeWAVE").toString("base64"))).toThrow("Expected raw PCM");
  expect(() => decodeSpeechPcm("AA==")).toThrow("Invalid PCM");
});

test("streaming: limita concorrenza, richieste ripetute e libera gli slot", () => {
  let time = 1000;
  const claim = createSpeechRequestLimiter(() => time);
  const release = claim("meeting");
  expect(release).toBeDefined();
  expect(claim("meeting")).toBeUndefined();
  release!();
  for (let i = 0; i < 11; i++) claim("meeting")!();
  expect(claim("meeting")).toBeUndefined();
  time += 60_001;
  expect(claim("meeting")).toBeDefined();
  for (const key of ["a", "b", "c"]) expect(claim(key)).toBeDefined();
  expect(claim("d")).toBeUndefined();
});

test("streaming preview: audio Web Audio, labiale, stop, replay e cambio modello", async ({ page }) => {
  const requests: Array<{ model: string }> = [];
  await page.context().addCookies([{ name: "conclavia_locale", value: "it", url: "http://127.0.0.1:3101" }]);
  await page.route("**/api/avatar/speech", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ contentType: "application/x-ndjson", body: `${JSON.stringify({ audio: pcm(2), phones: [{ start: 0, end: 2, viseme: "a" }] })}\n{"done":true}\n` });
  });
  await page.goto("/avatar/test?voice=inworld");
  const avatar = page.locator('svg[data-audio-driven="true"]');
  await page.getByRole("button", { name: "Ascolta la voce" }).click();
  await expect(page.locator('[data-streaming-voice-state="speaking"]')).toBeVisible();
  await expect(avatar).toHaveAttribute("data-viseme", "a");
  await expect(page.getByTestId("stream-first-audio")).toContainText("Avvio audio nel browser");
  await page.getByRole("button", { name: "Ferma la voce" }).click();
  await expect(avatar).toHaveAttribute("data-viseme", "rest");
  await page.getByTestId("voice-advanced").locator("summary").click();
  await page.getByLabel("Modello da confrontare").selectOption("inworld-tts-2");
  await page.getByRole("button", { name: "Ascolta la voce" }).click();
  await expect(page.locator('[data-streaming-voice-state="speaking"]')).toBeVisible();
  await expect(page.locator('[data-streaming-voice-state="ready"]')).toBeVisible();
  await expect(avatar).toHaveAttribute("data-viseme", "rest");
  expect(requests.map((request) => request.model)).toEqual(["inworld-tts-2-flash", "inworld-tts-2"]);
});

test("streaming preview: errore leggibile, niente fallback locale e niente retry automatico", async ({ page }) => {
  let calls = 0;
  let models = 0;
  await page.route("**/api/avatar/speech", async (route) => { calls++; await route.fulfill({ status: 503, body: "{}" }); });
  await page.route("**/*.onnx", async (route) => { models++; await route.abort(); });
  await page.goto("/avatar/test?voice=inworld");
  await page.getByRole("button", { name: /Ascolta la voce|Listen to voice/ }).click();
  await expect(page.locator('[data-streaming-voice-state="error"]')).toBeVisible();
  expect(calls).toBe(1);
  expect(models).toBe(0);
});

test("streaming API: richieste non autorizzate e testo arbitrario non raggiungono il provider", async ({ request }) => {
  const token = "11111111-1111-4111-8111-111111111111";
  expect((await request.post(`/api/meeting-room/not-a-token/speech`, { data: {} })).status()).toBe(404);
  expect((await request.post(`/api/meeting-room/${token}/speech`, { data: { text: "Speak this arbitrary text" } })).status()).toBe(400);
  expect((await request.post(`/api/meeting-room/${token}/speech`, { data: { attemptId: token, commandId: token, chunk: 0 } })).status()).toBe(404);
  expect((await request.post("/api/avatar/speech", { headers: { Origin: "https://attacker.invalid" }, data: {} })).status()).toBe(403);
  expect((await request.post("/api/avatar/speech", { headers: { Host: "test.trycloudflare.com" }, data: {} })).status()).toBe(404);
  expect((await request.post("/api/avatar/speech", { data: { text: "Ciao", language: "it", model: "arbitrary" } })).status()).toBe(400);
  expect((await request.post("/api/avatar/speech", { data: { text: "Ciao", language: "it", model: "inworld-tts-2-flash" } })).status()).toBe(503);
});

test("streaming API: origine del browser e Host coincidono anche dopo la normalizzazione di Next", async ({ page, request }) => {
  await page.goto("/avatar/test?voice=inworld");
  // Invalid input checks the real browser origin without making a paid request.
  expect(await page.evaluate(async () => (await fetch("/api/avatar/speech", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  })).status)).toBe(400);
  for (const host of ["127.0.0.1:3101", "localhost:3101", "workstation.local:3101"]) {
    expect((await request.post("/api/avatar/speech", { headers: { Host: host, Origin: `http://${host}` }, data: {} })).status()).toBe(400);
  }
  const rejectedHeaders: Array<Record<string, string>> = [
    { Host: "127.0.0.1:3101", Origin: "http://localhost:3101" },
    { Host: "127.0.0.1:3101", Origin: "https://127.0.0.1:3101" },
    { Host: "127.0.0.1:3101", Origin: "https://attacker.invalid", "x-forwarded-host": "attacker.invalid" },
    { Host: "127.0.0.1:3101", Origin: "http://127.0.0.1:3101", "sec-fetch-site": "cross-site" },
  ];
  for (const headers of rejectedHeaders) {
    expect((await request.post("/api/avatar/speech", { headers, data: {} })).status()).toBe(403);
  }
});
