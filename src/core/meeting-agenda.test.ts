import assert from "node:assert/strict";
import test from "node:test";

import { MeetingAgendaManager, parseMeetingAgenda } from "./meeting-agenda.js";

const startedAt = new Date("2026-08-24T10:00:00.000Z");

await test("parses a readable timestamped meeting agenda", () => {
  assert.deepEqual(parseMeetingAgenda([
    "00:00 Apertura e obiettivi",
    "05:00 - Decisioni",
    "[10:00] Fine",
  ].join("\n")), [
    { offsetMs: 0, label: "Apertura e obiettivi" },
    { offsetMs: 300_000, label: "Decisioni" },
    { offsetMs: 600_000, label: "Fine" },
  ]);
});

await test("rejects ambiguous or unordered agendas", () => {
  assert.throws(
    () => parseMeetingAgenda("01:00 Apertura\n00:00 Fine"),
    /primo punto/u,
  );
  assert.throws(
    () => parseMeetingAgenda("00:00 Apertura\n00:00 Fine"),
    /crescenti/u,
  );
});

await test("emits one-minute, transition and completion reminders once", () => {
  const manager = new MeetingAgendaManager();
  const snapshot = manager.activate({
    platform: "teams",
    meetingId: "meeting-1",
    sourceMessageId: "message-1",
    createdBy: "Vincenzo",
    capturedAt: startedAt.toISOString(),
    agendaText: "00:00 Apertura\n02:00 Decisioni\n05:00 Fine",
    now: startedAt,
  });
  assert.equal(snapshot.currentItem.label, "Apertura");
  assert.equal(snapshot.totalDurationMs, 300_000);

  const upcoming = manager.tick(new Date(startedAt.getTime() + 60_000));
  assert.equal(upcoming[0]?.kind, "upcoming");
  assert.match(upcoming[0]?.text ?? "", /^\[01:00\]/u);
  assert.deepEqual(manager.tick(new Date(startedAt.getTime() + 61_000)), []);

  const transition = manager.tick(new Date(startedAt.getTime() + 120_000));
  assert.equal(transition[0]?.kind, "transition");
  assert.match(transition[0]?.text ?? "", /Decisioni/u);

  const finalWarning = manager.tick(new Date(startedAt.getTime() + 240_000));
  assert.equal(finalWarning[0]?.kind, "upcoming");
  const completion = manager.tick(new Date(startedAt.getTime() + 300_000));
  assert.equal(completion[0]?.kind, "complete");
  assert.equal(manager.snapshots(new Date(startedAt.getTime() + 300_000))[0]?.completed, true);
  assert.deepEqual(manager.tick(new Date(startedAt.getTime() + 360_000)), []);
});

await test("replaces and cancels the agenda independently for each meeting", () => {
  const manager = new MeetingAgendaManager();
  const base = {
    platform: "google-meet" as const,
    meetingId: "abc-defg-hij",
    sourceMessageId: "message-1",
    createdBy: "Vincenzo",
    capturedAt: startedAt.toISOString(),
    now: startedAt,
  };
  manager.activate({ ...base, agendaText: "00:00 A\n05:00 Fine" });
  manager.activate({ ...base, sourceMessageId: "message-2", agendaText: "00:00 B\n08:00 Fine" });
  assert.equal(manager.snapshots(startedAt).length, 1);
  assert.equal(manager.snapshots(startedAt)[0]?.currentItem.label, "B");
  assert.equal(manager.cancel("google-meet", "abc-defg-hij"), true);
  assert.equal(manager.cancel("google-meet", "abc-defg-hij"), false);
});
