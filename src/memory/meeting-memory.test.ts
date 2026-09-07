import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isSharedMeetingMemoryQuery,
  meetingMemoryRecallPlan,
  normalizeMemoryScopeId,
  recalledMemoryAsSegments,
} from "./meeting-memory.js";
import { parseMeetingMemorySnapshot } from "./meeting-memory-compactor.js";

void test("normalizes workspace and project ids", () => {
  assert.equal(normalizeMemoryScopeId(" Progetto Mary 2026 ", "general"), "progetto-mary-2026");
  assert.equal(normalizeMemoryScopeId("   ", "general"), "general");
});

void test("recognizes cross-meeting recall without treating ordinary questions as history", () => {
  assert.equal(isSharedMeetingMemoryQuery("Mary, cosa avevamo deciso su Kubernetes?"), true);
  assert.equal(isSharedMeetingMemoryQuery("Quali azioni sono rimaste aperte dallo scorso meeting?"), true);
  assert.equal(isSharedMeetingMemoryQuery("Mary, quanto fa due più due?"), false);
});

void test("builds intent-aware recall plans and avoids stop-word-only text searches", () => {
  assert.deepEqual(meetingMemoryRecallPlan("Mary, cosa avevamo deciso?"), {
    kinds: ["decision"],
    openOnly: false,
    searchTerms: "",
  });
  assert.deepEqual(meetingMemoryRecallPlan("Quali azioni sono rimaste aperte su Kubernetes?"), {
    kinds: ["action"],
    openOnly: true,
    searchTerms: "kubernetes",
  });
});

void test("parses and bounds a structured meeting snapshot", () => {
  const snapshot = parseMeetingMemorySnapshot(JSON.stringify({
    summary: "Il gruppo ha scelto il rilascio progressivo.",
    items: [{
      kind: "decision",
      text: "Adottare un rilascio progressivo.",
      owner: null,
      dueAt: null,
      status: "informational",
      confidence: 0.94,
      sourceSegmentIds: ["segment-1"],
    }],
  }), 8, "2026-08-28T10:00:00.000Z");
  assert.equal(snapshot.items[0]?.kind, "decision");
  assert.equal(snapshot.items[0]?.confidence, 0.94);
  assert.equal(snapshot.sourceSegmentCount, 8);
});

void test("converts recalled memories to provenance-labelled model segments", () => {
  const segments = recalledMemoryAsSegments([{
    id: "memory-1",
    sessionId: "session-old",
    meetingTitle: "Architecture review",
    meetingStartedAt: "2026-08-20T09:00:00.000Z",
    generatedAt: "2026-08-20T10:00:00.000Z",
    kind: "decision",
    text: "Usare MongoDB per la memoria condivisa.",
    owner: null,
    dueAt: null,
    status: "informational",
    confidence: 0.9,
    sourceSegmentIds: ["segment-1"],
  }], "2026-08-28T10:00:00.000Z");
  assert.equal(segments[0]?.source, "manual");
  assert.match(segments[0]?.text ?? "", /Architecture review/u);
});
