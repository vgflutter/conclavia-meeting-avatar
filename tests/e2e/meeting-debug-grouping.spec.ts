import { expect, test } from "@playwright/test";
import { groupMeetingDebugEvents } from "../../src/lib/meeting-debug-grouping";
import type { MeetingDebugEvent } from "../../src/types/meeting-debug";

const response: MeetingDebugEvent = {
  id: "response-a", kind: "response", speakerName: "Riccardo",
  text: "Solo una correzione: 9 per 9 fa 81, non 13.", createdAt: "2026-09-13T21:13:08.000Z",
};
const caption: MeetingDebugEvent = {
  id: "transcript-a", kind: "transcript", source: "avatar", speakerName: "Riccardo",
  text: "Solo una correzione 9 per 9 fa 81, non 13.", createdAt: "2026-09-13T21:13:16.000Z",
};

test("debug grouping: screenshot response and avatar transcript become one card without changing raw events", () => {
  const human: MeetingDebugEvent = { ...caption, id: "human", source: "participant", speakerName: "Vincenzo", text: "Tornassi indietro a fare le stesse cose." };
  const events = [response, human, caption];
  const before = JSON.stringify(events);
  expect(groupMeetingDebugEvents(events)).toEqual([
    { event: response, transcripts: [caption] }, { event: human, transcripts: [] },
  ]);
  expect(JSON.stringify(events)).toBe(before);
});

test("debug grouping: multiple substantial fragments attach to the same response", () => {
  const first = { ...caption, text: "Solo una correzione 9 per 9" };
  const second = { ...caption, id: "transcript-b", text: "9 per 9 fa 81, non 13." };
  expect(groupMeetingDebugEvents([response, first, second])).toEqual([{ event: response, transcripts: [first, second] }]);
});

for (const [name, changes] of [
  ["human namesake", { source: "participant" }],
  ["uncertain attribution", { source: "suspected_echo", echoCommandId: "a" }],
  ["different answer", { text: "9 per 9 fa 82, non 13." }],
  ["short ambiguous fragment", { text: "Solo una correzione" }],
  ["stale answer", { createdAt: "2026-09-13T21:15:16.000Z" }],
  ["caption before answer", { createdAt: "2026-09-13T21:13:07.000Z" }],
  ["invalid timestamp", { createdAt: "invalid" }],
  ["different command ID", { echoCommandId: "other" }],
  ["empty caption", { text: "..." }],
] as Array<[string, Partial<MeetingDebugEvent>]>) {
  test(`debug grouping: preserves a separate card for ${name}`, () => {
    const event = { ...caption, ...changes };
    expect(groupMeetingDebugEvents([response, event])).toEqual([
      { event: response, transcripts: [] }, { event, transcripts: [] },
    ]);
  });
}

test("debug grouping: no parent in the bounded window means no hidden transcript", () => {
  expect(groupMeetingDebugEvents([caption])).toEqual([{ event: caption, transcripts: [] }]);
});

test("debug grouping: two identical answers stay separate unless the command ID disambiguates", () => {
  const second = { ...response, id: "response-b" };
  expect(groupMeetingDebugEvents([response, second, caption])).toHaveLength(3);
  const linked = { ...caption, echoCommandId: "b" };
  expect(groupMeetingDebugEvents([response, second, linked])).toEqual([
    { event: response, transcripts: [] }, { event: second, transcripts: [linked] },
  ]);
});

test("debug grouping: avatar name and language are not hard-coded", () => {
  const answer = { ...response, speakerName: "Nora", text: "Just a correction: nine times nine is eighty-one." };
  const event = { ...caption, speakerName: "Nora (Guest)", text: "Just a correction nine times nine is eighty-one." };
  expect(groupMeetingDebugEvents([answer, event])).toEqual([{ event: answer, transcripts: [event] }]);
});
