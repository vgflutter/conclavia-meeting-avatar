import { createHash } from "node:crypto";
import type { Types } from "mongoose";
import { sanitizeDiagnosticText } from "@/lib/diagnostic-redaction.mjs";
import { MeetingDiagnosticModel, type DiagnosticEntry } from "@/models/MeetingDiagnostic";

export const MAX_DIAGNOSTIC_ENTRIES = 100;
export const DIAGNOSTIC_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export function parseAttendeeDiagnostic(data: Record<string, unknown>, now = new Date()): DiagnosticEntry | undefined {
  if (typeof data.id !== "string" || !data.id || data.id.length > 256 ||
      typeof data.message !== "string" || !data.message.trim() ||
      typeof data.created_at !== "string" || !Number.isFinite(Date.parse(data.created_at)) ||
      !["debug", "info", "warning", "error"].includes(String(data.level))) return undefined;
  return {
    key: createHash("sha256").update(data.id).digest("hex"),
    level: data.level as DiagnosticEntry["level"],
    type: typeof data.entry_type === "string" && /^[a-z][a-z0-9_]{0,79}$/u.test(data.entry_type) && sanitizeDiagnosticText(data.entry_type) === data.entry_type
      ? data.entry_type : "uncategorized",
    message: sanitizeDiagnosticText(data.message) || "[empty diagnostic]",
    occurredAt: new Date(data.created_at), receivedAt: now,
  };
}

export async function storeAttendeeDiagnostic(scope: { meetingId: Types.ObjectId; attemptId: string; botId: string }, entry: DiagnosticEntry) {
  const id = `${scope.meetingId}:${scope.attemptId}:${scope.botId}`;
  // A separate collection means neither a late log nor a concurrent retry can
  // overwrite lifecycle, transcript, memory or speech state.
  try {
    await MeetingDiagnosticModel.updateOne({ _id: id }, { $setOnInsert: {
      ...scope, expiresAt: new Date(entry.receivedAt.getTime() + DIAGNOSTIC_RETENTION_MS), entries: [],
    } }, { upsert: true }).exec();
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
  }
  await MeetingDiagnosticModel.updateOne({ _id: id, "entries.key": { $ne: entry.key } }, {
    $push: { entries: { $each: [entry], $slice: -MAX_DIAGNOSTIC_ENTRIES } },
  }).exec();
}

// Diagnostics are intentionally local-only, even if a future public hostname
// is not a Quick Tunnel. Do not trust a forwarded localhost over a public Host.
export function isLocalDiagnosticRequest(request: Request): boolean {
  const hosts = [new URL(request.url).host, request.headers.get("host") || "",
    request.headers.get("x-forwarded-host") || ""].flatMap(value => value.split(",")).filter(Boolean);
  return hosts.every(value => /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/iu.test(value.trim()));
}
