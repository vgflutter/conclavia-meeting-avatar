import assert from "node:assert/strict";
import test from "node:test";

import type { TranscriptSegment } from "../domain/protocol.js";
import { isLikelyAvatarSpeechEcho } from "./transcript-echo.js";

const marySpeech: TranscriptSegment = {
  id: "mary-1",
  speakerName: "Mary",
  text: "Sto bene, grazie. Pronta a seguire la riunione.",
  isFinal: true,
  capturedAt: "2026-08-26T12:00:00.000Z",
  source: "speech",
};

await test("filters a fuzzy transcription of Mary's recent virtual-bus playback", () => {
  const echoed: TranscriptSegment = {
    id: "participant-1",
    speakerName: "Partecipante meeting",
    text: "Tutto bene, grazie. Pronta a seguire la limone.",
    isFinal: true,
    capturedAt: "2026-08-26T12:00:06.000Z",
    source: "speech",
  };
  assert.equal(isLikelyAvatarSpeechEcho(echoed, [marySpeech], "Mary"), true);
});

await test("filters legacy local-listener echoes whose speech source was omitted", () => {
  const echoed: TranscriptSegment = {
    id: "participant-legacy",
    speakerName: "Partecipante meeting",
    text: "Sto bene grazie, pronta a seguire la riunione.",
    isFinal: true,
    capturedAt: "2026-08-26T12:00:06.000Z",
  };
  assert.equal(isLikelyAvatarSpeechEcho(echoed, [marySpeech], "Mary"), true);
});

await test("does not suppress short acknowledgements or old and chat messages", () => {
  const shortReply = {
    ...marySpeech,
    id: "participant-2",
    speakerName: "Partecipante meeting",
    text: "Sì, va bene.",
    capturedAt: "2026-08-26T12:00:06.000Z",
  };
  assert.equal(isLikelyAvatarSpeechEcho(shortReply, [marySpeech], "Mary"), false);
  assert.equal(
    isLikelyAvatarSpeechEcho(
      { ...shortReply, text: marySpeech.text, capturedAt: "2026-08-26T12:01:00.000Z" },
      [marySpeech],
      "Mary",
    ),
    false,
  );
  assert.equal(
    isLikelyAvatarSpeechEcho(
      { ...shortReply, text: marySpeech.text, source: "chat" },
      [marySpeech],
      "Mary",
    ),
    false,
  );
});

await test("filters an exact short replay of Mary's recent greeting", () => {
  const greeting: TranscriptSegment = {
    ...marySpeech,
    id: "mary-greeting",
    text: "Ciao a tutti!",
  };
  const echo: TranscriptSegment = {
    ...greeting,
    id: "participant-greeting-echo",
    speakerName: "Partecipante meeting",
    capturedAt: "2026-08-26T12:00:02.000Z",
  };

  assert.equal(isLikelyAvatarSpeechEcho(echo, [greeting], "Mary"), true);
  assert.equal(
    isLikelyAvatarSpeechEcho(
      { ...echo, capturedAt: "2026-08-26T12:00:12.000Z" },
      [greeting],
      "Mary",
    ),
    false,
  );
});

await test("does not suppress a different participant contribution", () => {
  const contribution: TranscriptSegment = {
    id: "participant-3",
    speakerName: "Partecipante meeting",
    text: "Secondo me tre più tre fa nove.",
    isFinal: true,
    capturedAt: "2026-08-26T12:00:06.000Z",
    source: "speech",
  };
  assert.equal(isLikelyAvatarSpeechEcho(contribution, [marySpeech], "Mary"), false);
});
