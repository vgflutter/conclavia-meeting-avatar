import { MongoClient, type Collection, type Db } from "mongodb";

import type { TranscriptSegment } from "../domain/protocol.js";
import type {
  MeetingMemoryItem,
  MeetingMemoryScope,
  MeetingMemorySession,
  MeetingMemorySnapshot,
  MeetingMemoryStore,
  RecalledMeetingMemory,
} from "./meeting-memory.js";
import { meetingMemoryRecallPlan } from "./meeting-memory.js";

interface MeetingDocument {
  sessionId: string;
  workspaceId: string;
  projectId: string;
  title: string;
  startedAt: Date;
  endedAt: Date | null;
  segmentCount: number;
  summary: string | null;
  snapshotGeneratedAt: Date | null;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface TranscriptDocument {
  sessionId: string;
  segmentId: string;
  workspaceId: string;
  projectId: string;
  speakerId?: string;
  speakerName: string;
  text: string;
  isFinal: boolean;
  capturedAt: Date;
  source: string;
  platform?: string;
  externalMeetingId?: string;
  externalId?: string;
  expiresAt?: Date;
  createdAt: Date;
}

interface MemoryDocument extends MeetingMemoryItem {
  memoryId: string;
  sessionId: string;
  workspaceId: string;
  projectId: string;
  meetingTitle: string;
  meetingStartedAt: Date;
  generatedAt: Date;
  expiresAt?: Date;
}

export interface MongoMeetingMemoryStoreOptions {
  uri: string;
  database?: string;
  retentionDays: number;
}

export class MongoMeetingMemoryStore implements MeetingMemoryStore {
  readonly backend = "mongodb" as const;
  readonly enabled = true;
  readonly #client: MongoClient;
  readonly #databaseName: string | undefined;
  readonly #retentionDays: number;
  #database: Db | null = null;

  constructor(options: MongoMeetingMemoryStoreOptions) {
    this.#client = new MongoClient(options.uri, {
      appName: "conclavia-meeting-avatar",
      maxPoolSize: 6,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 5_000,
    });
    this.#databaseName = options.database?.trim() || undefined;
    this.#retentionDays = options.retentionDays;
  }

  async initialize(): Promise<void> {
    await this.#client.connect();
    this.#database = this.#client.db(this.#databaseName);
    await Promise.all([
      this.#meetings().createIndexes([
        { key: { sessionId: 1 }, unique: true, name: "session_unique" },
        {
          key: { workspaceId: 1, projectId: 1, startedAt: -1 },
          name: "scope_started_at",
        },
      ]),
      this.#segments().createIndexes([
        {
          key: { sessionId: 1, segmentId: 1 },
          unique: true,
          name: "session_segment_unique",
        },
        {
          key: { workspaceId: 1, projectId: 1, capturedAt: -1 },
          name: "scope_captured_at",
        },
      ]),
      this.#memories().createIndexes([
        { key: { memoryId: 1 }, unique: true, name: "memory_unique" },
        {
          key: { workspaceId: 1, projectId: 1, generatedAt: -1 },
          name: "scope_generated_at",
        },
        {
          key: { text: "text", meetingTitle: "text" },
          name: "meeting_memory_text",
          default_language: "none",
        },
      ]),
    ]);
    if (this.#retentionDays > 0) {
      await Promise.all([
        this.#meetings().createIndex(
          { expiresAt: 1 },
          { expireAfterSeconds: 0, name: "meeting_retention" },
        ),
        this.#segments().createIndex(
          { expiresAt: 1 },
          { expireAfterSeconds: 0, name: "transcript_retention" },
        ),
        this.#memories().createIndex(
          { expiresAt: 1 },
          { expireAfterSeconds: 0, name: "memory_retention" },
        ),
      ]);
    } else {
      await Promise.all([
        this.#meetings().dropIndex("meeting_retention").catch(() => undefined),
        this.#segments().dropIndex("transcript_retention").catch(() => undefined),
        this.#memories().dropIndex("memory_retention").catch(() => undefined),
      ]);
    }
  }

  async unfinishedSessions(
    scope: MeetingMemoryScope,
    excludeSessionId: string,
  ): Promise<MeetingMemorySession[]> {
    const documents = await this.#meetings().find({
      workspaceId: scope.workspaceId,
      projectId: scope.projectId,
      sessionId: { $ne: excludeSessionId },
      endedAt: null,
    }).sort({ startedAt: 1 }).limit(12).toArray();
    return documents.map((document) => ({
      id: document.sessionId,
      workspaceId: document.workspaceId,
      projectId: document.projectId,
      title: document.title,
      startedAt: document.startedAt.toISOString(),
      endedAt: null,
    }));
  }

  async beginSession(session: MeetingMemorySession): Promise<void> {
    const now = new Date();
    const expiresAt = this.#expiresAt(now);
    await this.#meetings().updateOne(
      { sessionId: session.id },
      {
        $setOnInsert: {
          sessionId: session.id,
          workspaceId: session.workspaceId,
          projectId: session.projectId,
          title: session.title,
          startedAt: new Date(session.startedAt),
          endedAt: null,
          segmentCount: 0,
          summary: null,
          snapshotGeneratedAt: null,
          createdAt: now,
          ...(expiresAt ? { expiresAt } : {}),
        },
        $set: { updatedAt: now },
      },
      { upsert: true },
    );
  }

  async appendSegment(
    session: MeetingMemorySession,
    segment: TranscriptSegment,
  ): Promise<void> {
    const now = new Date();
    const expiresAt = this.#expiresAt(now);
    const result = await this.#segments().updateOne(
      { sessionId: session.id, segmentId: segment.id },
      {
        $setOnInsert: {
          sessionId: session.id,
          segmentId: segment.id,
          workspaceId: session.workspaceId,
          projectId: session.projectId,
          ...(segment.speakerId ? { speakerId: segment.speakerId } : {}),
          speakerName: segment.speakerName,
          text: segment.text,
          isFinal: segment.isFinal,
          capturedAt: new Date(segment.capturedAt),
          source: segment.source ?? "speech",
          ...(segment.platform ? { platform: segment.platform } : {}),
          ...(segment.meetingId ? { externalMeetingId: segment.meetingId } : {}),
          ...(segment.externalId ? { externalId: segment.externalId } : {}),
          ...(expiresAt ? { expiresAt } : {}),
          createdAt: now,
        },
      },
      { upsert: true },
    );
    if (result.upsertedCount > 0) {
      await this.#meetings().updateOne(
        { sessionId: session.id },
        { $inc: { segmentCount: 1 }, $set: { updatedAt: now } },
      );
    }
  }

  async sessionSegments(sessionId: string): Promise<TranscriptSegment[]> {
    const documents = await this.#segments()
      .find({ sessionId })
      .sort({ capturedAt: 1, createdAt: 1 })
      .toArray();
    return documents.map((document) => ({
      id: document.segmentId,
      ...(document.speakerId ? { speakerId: document.speakerId } : {}),
      speakerName: document.speakerName,
      text: document.text,
      isFinal: document.isFinal,
      capturedAt: document.capturedAt.toISOString(),
      source: document.source === "chat" || document.source === "manual"
        ? document.source
        : "speech",
      ...(document.platform
        ? {
            platform: document.platform === "teams" || document.platform === "google-meet"
              ? document.platform
              : "generic" as const,
          }
        : {}),
      ...(document.externalMeetingId ? { meetingId: document.externalMeetingId } : {}),
      ...(document.externalId ? { externalId: document.externalId } : {}),
    }));
  }

  async saveSnapshot(
    session: MeetingMemorySession,
    snapshot: MeetingMemorySnapshot,
  ): Promise<void> {
    const generatedAt = new Date(snapshot.generatedAt);
    const expiresAt = this.#expiresAt(generatedAt);
    const summaryItem: MeetingMemoryItem = {
      kind: "summary",
      text: snapshot.summary,
      owner: null,
      dueAt: null,
      status: "informational",
      confidence: 1,
      sourceSegmentIds: [],
    };
    const items = snapshot.summary.trim()
      ? [summaryItem, ...snapshot.items]
      : snapshot.items;

    await this.#memories().deleteMany({ sessionId: session.id });
    if (items.length > 0) {
      await this.#memories().insertMany(items.map((item, index) => ({
        ...item,
        memoryId: `${session.id}:${index}`,
        sessionId: session.id,
        workspaceId: session.workspaceId,
        projectId: session.projectId,
        meetingTitle: session.title,
        meetingStartedAt: new Date(session.startedAt),
        generatedAt,
        ...(expiresAt ? { expiresAt } : {}),
      })), { ordered: true });
    }
    await this.#meetings().updateOne(
      { sessionId: session.id },
      {
        $set: {
          summary: snapshot.summary,
          snapshotGeneratedAt: generatedAt,
          updatedAt: new Date(),
        },
      },
    );
  }

  async finalizeSession(session: MeetingMemorySession, endedAt: string): Promise<void> {
    await this.#meetings().updateOne(
      { sessionId: session.id },
      { $set: { endedAt: new Date(endedAt), updatedAt: new Date() } },
    );
  }

  async recall(
    scope: MeetingMemoryScope,
    query: string,
    excludeSessionId: string,
    limit: number,
  ): Promise<RecalledMeetingMemory[]> {
    const normalizedLimit = Math.max(1, Math.min(12, Math.round(limit)));
    const plan = meetingMemoryRecallPlan(query);
    const filter: Record<string, unknown> = {
      workspaceId: scope.workspaceId,
      projectId: scope.projectId,
      sessionId: { $ne: excludeSessionId },
    };
    if (plan.kinds.length > 0) filter.kind = { $in: plan.kinds };
    if (plan.openOnly) filter.status = "open";
    if (plan.searchTerms) filter.$text = { $search: plan.searchTerms };

    const documents = await this.#memories()
      .find(
        filter,
        plan.searchTerms ? { projection: { score: { $meta: "textScore" } } } : {},
      )
      .sort(plan.searchTerms
        ? { score: { $meta: "textScore" }, generatedAt: -1 }
        : { generatedAt: -1 })
      .limit(normalizedLimit)
      .toArray();

    return documents.map((document) => ({
      id: document.memoryId,
      sessionId: document.sessionId,
      meetingTitle: document.meetingTitle,
      meetingStartedAt: document.meetingStartedAt.toISOString(),
      generatedAt: document.generatedAt.toISOString(),
      kind: document.kind,
      text: document.text,
      owner: document.owner,
      dueAt: document.dueAt,
      status: document.status,
      confidence: document.confidence,
      sourceSegmentIds: document.sourceSegmentIds,
    }));
  }

  async close(): Promise<void> {
    await this.#client.close();
    this.#database = null;
  }

  #meetings(): Collection<MeetingDocument> {
    return this.#db().collection<MeetingDocument>("meeting_memory_sessions");
  }

  #segments(): Collection<TranscriptDocument> {
    return this.#db().collection<TranscriptDocument>("meeting_transcript_segments");
  }

  #memories(): Collection<MemoryDocument> {
    return this.#db().collection<MemoryDocument>("shared_meeting_memories");
  }

  #db(): Db {
    if (!this.#database) throw new Error("Mongo meeting memory is not initialized.");
    return this.#database;
  }

  #expiresAt(from: Date): Date | undefined {
    if (this.#retentionDays <= 0) return undefined;
    return new Date(from.getTime() + this.#retentionDays * 86_400_000);
  }
}
