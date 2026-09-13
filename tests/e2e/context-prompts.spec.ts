import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { randomUUID } from "node:crypto";
import ts from "typescript";
import { expect, test } from "@playwright/test";
import * as context from "../../src/lib/assistant-context";
import * as personality from "../../src/lib/meeting-assistant-prompt";

// Execute the actual orchestration code with database/provider boundaries replaced.
// Captures the exact prompt sent by each path, without keys or paid model calls.
function harness(file: string) {
  const layers = { global: "Company Aurora", series: "Project scope", meeting: "Today's constraints" };
  const calls: Array<{ instructions: string; input: string }> = [];
  const document = {
    id: "fixture", seriesId: "series", language: "it", objective: "Review launch",
    context: layers.meeting, agenda: [], commandHistory: [], status: "live",
    assistant: { wakeWord: "Riccardo" },
    transcript: [{ speakerName: "Vincenzo", text: "We agreed to launch on Friday.", source: "participant" }],
    summary: { rememberedFacts: [], decisions: [], actionItems: [], openQuestions: [] },
    save: async () => {},
  };
  const deps: Record<string, unknown> = {
    "node:crypto": { randomUUID },
    "@/lib/assistant-context": context,
    "@/lib/assistant-context-store": { getMeetingContextLayers: async () => ({ ...layers }) },
    "@/lib/meeting-transcript-source": { participantTranscript: () => document.transcript },
    "@/lib/assistant-profile": { getAssistantProfile: async () => ({ displayName: "Riccardo", role: "Colleague", personality: { responseStyle: "balanced", attitude: "collaborative" } }) },
    "@/lib/meeting-assistant-prompt": personality,
    "@/lib/meeting-command": {
      buildLocalMeetingSummary: () => "Local summary", findMemoryMatches: () => [],
      meetingMemoryCandidates: () => [], selectMeetingMemory: () => [],
    },
    "@/lib/meeting-continuity": { buildMeetingContinuity: async () => ({ openQuestions: [] }) },
    "@/lib/meeting-speech": { meetingSpeechLanguage: () => "it" },
    "@/lib/serialize-meeting": { serializeMeeting: () => document },
    "@/lib/mongodb": { connectToDatabase: async () => {} },
    "@/models/Meeting": { MeetingModel: { findById: () => ({ exec: async () => document }) } },
    "@/lib/openai-meeting": {
      isMeetingIntelligenceConfigured: () => true,
      generateMeetingIntelligence: async (request: typeof calls[number]) => { calls.push(request); return "Answer from provider"; },
      generateMeetingStructured: async (request: typeof calls[number] & { schemaName: string }) => {
        calls.push(request);
        return request.schemaName === "meeting_intervention" ? { type: "none", response: "", reason: "" }
          : { overview: "Meeting summary", rememberedFacts: [], decisions: [], actionItems: [], openQuestions: [] };
      },
    },
  };
  const compiled = ts.transpileModule(readFileSync(`src/lib/${file}.ts`, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const testModule = { exports: {} as Record<string, (...args: unknown[]) => Promise<unknown>> };
  runInNewContext(compiled, { module: testModule, exports: testModule.exports, console,
    require: (name: string) => { if (!(name in deps)) throw new Error(`Unmocked boundary: ${name}`); return deps[name]; },
  });
  return { run: testModule.exports, document, calls, layers };
}

function assertContext(call: { instructions: string; input: string }, layers: context.AssistantContextLayers) {
  expect(call.instructions).toContain(context.ASSISTANT_CONTEXT_RULES);
  const block = call.input.match(/<configured_context>([\s\S]*?)<\/configured_context>/)?.[1];
  expect(block).toBeTruthy(); expect(JSON.parse(block!)).toEqual(layers);
  expect(call.input.match(/<configured_context>/g)).toHaveLength(1);
  expect(call.instructions).not.toContain(layers.global);
}

for (const kind of ["ask", "correct", "summary"]) {
  test(`actual ${kind} orchestration includes every context layer and sees next-request edits`, async () => {
    const h = harness("execute-meeting-command");
    await h.run.executeMeetingCommand(h.document, kind, "Qual è il budget di Aurora?");
    expect(h.calls).toHaveLength(1); assertContext(h.calls[0], h.layers);
    h.layers.global = "Updated company"; h.layers.series = "Updated series";
    await h.run.executeMeetingCommand(h.document, kind, "Qual è il budget di Aurora?");
    expect(h.calls).toHaveLength(2); assertContext(h.calls[1], h.layers);
  });
}
test("proactive intervention reads the same configured context", async () => {
  const h = harness("execute-meeting-command");
  await h.run.detectImportantIntervention(h.document, "The budget is different from what was agreed.");
  expect(h.calls).toHaveLength(1); assertContext(h.calls[0], h.layers);
});
test("final meeting extraction gets context but keeps it separate from transcript evidence", async () => {
  const h = harness("finalize-meeting");
  await h.run.finalizeMeeting("fixture");
  expect(h.calls).toHaveLength(1); assertContext(h.calls[0], h.layers);
  expect(h.calls[0].input).toContain("<transcript>Vincenzo: We agreed to launch on Friday.</transcript>");
  expect(h.calls[0].instructions).toContain("Extract new decisions and commitments only from the transcript");
  expect(h.document.status).toBe("completed");
});
