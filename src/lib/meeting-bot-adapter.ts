import { randomUUID } from "node:crypto";
import { getMeetingBotRuntimeConfig } from "@/lib/meeting-bot-config";
import { verifyMeetingOutput } from "@/lib/meeting-output-health";
import { MEETING_ENTRY_TIMEOUT_SECONDS } from "@/lib/meeting-entry-policy";
import { teamsCaptionLanguage } from "@/lib/meeting-caption-language";
import type { AttendeeState } from "@/lib/attendee-state";
import type { MeetingBotProvider, MeetingResponse } from "@/types/meeting";

export interface MeetingBotSession {
  provider: MeetingBotProvider;
  externalBotId: string;
  outputUrl: string;
  scheduledFor?: Date;
  joinedAt?: Date;
}

export interface MeetingBotAdapter {
  readonly provider: MeetingBotProvider;
  readonly live: boolean;
  schedule(meeting: MeetingResponse): Promise<MeetingBotSession>;
  join(meeting: MeetingResponse, requestOrigin: string): Promise<MeetingBotSession>;
  cancel(externalBotId: string): Promise<void>;
  leave(externalBotId: string): Promise<{ leftAt: Date }>;
  getStatus?(externalBotId: string): Promise<AttendeeState>;
  setCaptionLanguage?(externalBotId: string, language: "it-it" | "en-us"): Promise<void>;
  refreshOutput?(meeting: MeetingResponse, options?: { restart?: boolean }): Promise<string>;
  findAttempt?(meetingId: string, attemptId: string): Promise<{ externalBotId: string; state: AttendeeState } | undefined>;
}

export class MeetingBotConfigurationError extends Error {}

export class MeetingBotProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

class MockMeetingBotAdapter implements MeetingBotAdapter {
  readonly provider = "mock" as const;
  readonly live = false;

  async schedule(): Promise<MeetingBotSession> {
    throw new MeetingBotConfigurationError(
      "Automatic meeting entry has not been connected yet.",
    );
  }

  async join(meeting: MeetingResponse, requestOrigin: string): Promise<MeetingBotSession> {
    void meeting;
    void requestOrigin;
    throw new MeetingBotConfigurationError(
      "Automatic meeting entry has not been connected yet.",
    );
  }

  async cancel(): Promise<void> {}

  async leave(): Promise<{ leftAt: Date }> {
    return { leftAt: new Date() };
  }
}

interface RecallBotResponse {
  id?: unknown;
}

interface AttendeeBotResponse {
  id?: unknown;
}

function providerErrorMessage(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim().slice(0, 500);
  if (Array.isArray(value)) {
    for (const item of value) {
      const message = providerErrorMessage(item);
      if (message) return message;
    }
    return undefined;
  }
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ["detail", "error", "message", ...Object.keys(record)]) {
    const message = providerErrorMessage(record[key]);
    if (message) return message;
  }
  return undefined;
}

class RecallMeetingBotAdapter implements MeetingBotAdapter {
  readonly provider = "recall" as const;
  readonly live = true;

  private readonly config = getMeetingBotRuntimeConfig();

  constructor() {
    if (!this.config.ready || !this.config.apiKey || !this.config.publicBaseUrl) {
      throw new MeetingBotConfigurationError(
        "Automatic meeting entry is not fully configured.",
      );
    }
  }

  private async request(
    path: string,
    init: RequestInit,
    acceptedStatuses: number[],
  ): Promise<Response> {
    const response = await fetch(`${this.config.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Token ${this.config.apiKey}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    if (!acceptedStatuses.includes(response.status)) {
      let code: string | undefined;
      let detail: string | undefined;
      try {
        const payload = (await response.json()) as { code?: unknown; detail?: unknown };
        code = typeof payload.code === "string" ? payload.code : undefined;
        detail = typeof payload.detail === "string" ? payload.detail : undefined;
      } catch {
        // A provider error without a JSON body is still represented by its status code.
      }
      throw new MeetingBotProviderError(
        detail || "The meeting provider rejected the request.",
        response.status,
        code,
      );
    }

    return response;
  }

  private outputUrl(meeting: MeetingResponse): string {
    return `${this.config.publicBaseUrl}/meeting-room/${meeting.bot.outputToken}?mode=meeting`;
  }

  private async createBot(
    meeting: MeetingResponse,
    joinAt?: string,
  ): Promise<MeetingBotSession> {
    if (meeting.platform !== "microsoft_teams") {
      throw new MeetingBotConfigurationError(
        "Automatic entry is currently available only for Microsoft Teams.",
      );
    }

    const outputUrl = this.outputUrl(meeting);
    const plannedDurationSeconds = Math.max(
      15 * 60,
      Math.round(
        (new Date(meeting.scheduledEnd).getTime() -
          new Date(meeting.scheduledStart).getTime()) /
          1_000,
      ),
    );
    const response = await this.request(
      "/bot/",
      {
        method: "POST",
        body: JSON.stringify({
          meeting_url: meeting.meetingUrl,
          bot_name: meeting.assistant.wakeWord || this.config.displayName,
          ...(joinAt ? { join_at: joinAt } : {}),
          metadata: {
            conclavia_meeting_id: meeting.id,
            ...(meeting.seriesId ? { conclavia_series_id: meeting.seriesId } : {}),
          },
          output_media: {
            camera: {
              kind: "webpage",
              config: { url: outputUrl },
            },
          },
          recording_config: {
            transcript: {
              provider: {
                recallai_streaming: {
                  mode: "prioritize_low_latency",
                  language_code: meeting.language === "auto" ? "auto" : meeting.language,
                },
              },
              diarization: {
                use_separate_streams_when_available: true,
              },
            },
          },
          automatic_leave: {
            waiting_room_timeout: 15 * 60,
            noone_joined_timeout: 15 * 60,
            everyone_left_timeout: {
              timeout: 30,
              activate_after: 2 * 60,
            },
            in_call_not_recording_timeout: 5 * 60,
            in_call_recording_timeout: plannedDurationSeconds + 15 * 60,
          },
        }),
      },
      [200, 201],
    );
    const payload = (await response.json()) as RecallBotResponse;
    if (typeof payload.id !== "string" || !payload.id) {
      throw new MeetingBotProviderError(
        "The meeting provider returned an incomplete response.",
        response.status,
      );
    }

    return {
      provider: this.provider,
      externalBotId: payload.id,
      outputUrl,
      scheduledFor: joinAt ? new Date(joinAt) : undefined,
      joinedAt: joinAt ? undefined : new Date(),
    };
  }

  schedule(meeting: MeetingResponse): Promise<MeetingBotSession> {
    return this.createBot(meeting, meeting.scheduledStart);
  }

  join(meeting: MeetingResponse): Promise<MeetingBotSession> {
    return this.createBot(meeting);
  }

  async cancel(externalBotId: string): Promise<void> {
    await this.request(`/bot/${encodeURIComponent(externalBotId)}/`, { method: "DELETE" }, [204]);
  }

  async leave(externalBotId: string): Promise<{ leftAt: Date }> {
    await this.request(
      `/bot/${encodeURIComponent(externalBotId)}/leave_call/`,
      { method: "POST" },
      [200],
    );
    return { leftAt: new Date() };
  }
}

export class AttendeeMeetingBotAdapter implements MeetingBotAdapter {
  readonly provider = "attendee" as const;
  readonly live = true;

  constructor(private readonly config = getMeetingBotRuntimeConfig(), private readonly fetcher: typeof fetch = fetch) {
    if (
      this.config.provider !== "attendee" ||
      !this.config.ready ||
      !this.config.apiKey ||
      !this.config.publicBaseUrl
    ) {
      throw new MeetingBotConfigurationError(
        "Automatic meeting entry is not fully configured.",
      );
    }
  }

  private async request(
    path: string,
    init: RequestInit,
    acceptedStatuses: number[],
  ): Promise<Response> {
    const response = await this.fetcher(`${this.config.apiBaseUrl}${path}`, {
      ...init,
      // Do not follow a POST to another TLS endpoint: transport failures must
      // describe this request, not a redirect after a bot was already created.
      redirect: "error",
      headers: {
        Accept: "application/json",
        Authorization: `Token ${this.config.apiKey}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    if (!acceptedStatuses.includes(response.status)) {
      let detail: string | undefined;
      try {
        detail = providerErrorMessage(await response.json());
      } catch {
        // The HTTP status still identifies provider failures without JSON bodies.
      }
      throw new MeetingBotProviderError(
        detail || "The meeting provider rejected the request.",
        response.status,
      );
    }

    return response;
  }

  private outputUrl(meeting: MeetingResponse): string {
    const url = new URL(`/meeting-room/${meeting.bot.outputToken}`, this.config.publicBaseUrl);
    url.searchParams.set("mode", "meeting");
    if (meeting.bot.entryAttemptId) url.searchParams.set("attempt", meeting.bot.entryAttemptId);
    return url.toString();
  }

  async refreshOutput(meeting: MeetingResponse, options?: { restart?: boolean }): Promise<string> {
    if (!meeting.bot.externalBotId) throw new MeetingBotConfigurationError("No active participant");
    const target = new URL(this.outputUrl(meeting));
    // The provider ignores identical settings: a new URL forces a renderer reload on repeated recovery.
    target.searchParams.set("reload", randomUUID());
    const url = target.toString();
    await verifyMeetingOutput(url, this.fetcher);
    if (options?.restart) {
      // A hung webpage may not react to navigation. Stop only its media output,
      // never the meeting participant, then allow the provider to apply the stop.
      await this.request(`/bots/${encodeURIComponent(meeting.bot.externalBotId)}/voice_agent_settings`, {
        method: "PATCH", body: JSON.stringify({ url: "" }),
      }, [200]);
      await new Promise((resolve) => setTimeout(resolve, 3_000));
    }
    await this.request(`/bots/${encodeURIComponent(meeting.bot.externalBotId)}/voice_agent_settings`, {
      method: "PATCH", body: JSON.stringify({ url }),
    }, [200]);
    return url;
  }

  private webhookUrl(meeting: MeetingResponse): string {
    const url = new URL("/api/webhooks/attendee", this.config.publicBaseUrl);
    url.searchParams.set("meeting_token", meeting.bot.outputToken);
    return url.toString();
  }

  private async createBot(
    meeting: MeetingResponse,
    joinAt?: string,
  ): Promise<MeetingBotSession> {
    if (meeting.platform !== "microsoft_teams") {
      throw new MeetingBotConfigurationError(
        "Automatic entry is currently available only for Microsoft Teams.",
      );
    }

    const outputUrl = this.outputUrl(meeting);
    const plannedDurationSeconds = Math.max(
      15 * 60,
      Math.round(
        (new Date(meeting.scheduledEnd).getTime() -
          new Date(meeting.scheduledStart).getTime()) /
          1_000,
      ),
    );
    await verifyMeetingOutput(outputUrl, this.fetcher);
    // Newly tracked entries apply the language after recording starts. The
    // provider can skip startup language selection on its UI fallback, then
    // ignore a same-value PATCH. Deferring avoids that no-op without briefly
    // switching the whole meeting to an unrelated language.
    const teamsLanguage = meeting.bot.captionLanguage ? undefined : teamsCaptionLanguage(meeting.language);
    const response = await this.request(
      "/bots",
      {
        method: "POST",
        body: JSON.stringify({
          meeting_url: meeting.meetingUrl,
          bot_name: meeting.assistant.wakeWord || this.config.displayName,
          ...(joinAt ? { join_at: joinAt } : {}),
          deduplication_key: `conclavia-${meeting.id}`,
          metadata: {
            conclavia_meeting_id: meeting.id,
            ...(meeting.bot.entryAttemptId ? { conclavia_attempt_id: meeting.bot.entryAttemptId } : {}),
            ...(meeting.seriesId ? { conclavia_series_id: meeting.seriesId } : {}),
          },
          voice_agent_settings: {
            url: outputUrl,
          },
          transcription_settings: {
            meeting_closed_captions: {
              ...(teamsLanguage ? { teams_language: teamsLanguage } : {}),
            },
          },
          recording_settings: {
            format: "none",
          },
          automatic_leave_settings: {
            waiting_room_timeout_seconds: MEETING_ENTRY_TIMEOUT_SECONDS,
            wait_for_host_to_start_meeting_timeout_seconds: MEETING_ENTRY_TIMEOUT_SECONDS,
            only_participant_in_meeting_timeout_seconds: 60,
            max_uptime_seconds: plannedDurationSeconds + 15 * 60,
          },
          webhooks: [
            {
              url: this.webhookUrl(meeting),
              triggers: [
                "bot.state_change",
                "transcript.update",
                "participant_events.join_leave",
              ],
            },
          ],
        }),
      },
      [201],
    );
    const payload = (await response.json()) as AttendeeBotResponse;
    if (typeof payload.id !== "string" || !payload.id) {
      throw new MeetingBotProviderError(
        "The meeting provider returned an incomplete response.",
        response.status,
      );
    }

    return {
      provider: this.provider,
      externalBotId: payload.id,
      outputUrl,
      scheduledFor: joinAt ? new Date(joinAt) : undefined,
      joinedAt: joinAt ? undefined : new Date(),
    };
  }

  schedule(meeting: MeetingResponse): Promise<MeetingBotSession> {
    return this.createBot(meeting, meeting.scheduledStart);
  }

  join(meeting: MeetingResponse): Promise<MeetingBotSession> {
    return this.createBot(meeting);
  }

  async cancel(externalBotId: string): Promise<void> {
    await this.request(
      `/bots/${encodeURIComponent(externalBotId)}`,
      { method: "DELETE" },
      [200, 204],
    );
  }

  async leave(externalBotId: string): Promise<{ leftAt: Date }> {
    await this.request(
      `/bots/${encodeURIComponent(externalBotId)}/leave`,
      { method: "POST" },
      [200],
    );
    return { leftAt: new Date() };
  }

  private parseState(value: unknown): AttendeeState {
    const bot = value as { state?: unknown; events?: Array<{ type?: string; sub_type?: string; created_at?: string }> };
    if (!bot || typeof bot.state !== "string") throw new MeetingBotProviderError("Invalid bot state response");
    const event = Array.isArray(bot.events) ? bot.events.at(-1) : undefined;
    const occurredAt = event?.created_at ? new Date(event.created_at) : new Date();
    if (!Number.isFinite(occurredAt.getTime())) throw new MeetingBotProviderError("Invalid bot event timestamp");
    return { state: bot.state, occurredAt, eventType: event?.type, subType: event?.sub_type };
  }

  async getStatus(externalBotId: string): Promise<AttendeeState> {
    const response = await this.request(`/bots/${encodeURIComponent(externalBotId)}`, { method: "GET" }, [200]);
    return this.parseState(await response.json());
  }

  async setCaptionLanguage(externalBotId: string, language: "it-it" | "en-us"): Promise<void> {
    await this.request(`/bots/${encodeURIComponent(externalBotId)}/transcription_settings`, {
      method: "PATCH",
      body: JSON.stringify({ transcription_settings: { meeting_closed_captions: { teams_language: language } } }),
    }, [200]);
  }

  async findAttempt(meetingId: string, attemptId: string) {
    const response = await this.request(`/bots?deduplication_key=${encodeURIComponent(`conclavia-${meetingId}`)}`, { method: "GET" }, [200]);
    const payload = await response.json() as { results?: Array<{ id?: string; metadata?: Record<string, unknown> }> };
    if (!Array.isArray(payload.results)) throw new MeetingBotProviderError("Invalid bot list response");
    const bot = payload.results.find((item) => item.metadata?.conclavia_attempt_id === attemptId);
    return bot?.id ? { externalBotId: bot.id, state: this.parseState(bot) } : undefined;
  }
}

const mockAdapter = new MockMeetingBotAdapter();

export function getMeetingBotAdapter(provider?: MeetingBotProvider): MeetingBotAdapter {
  if (provider === "mock") return mockAdapter;
  const config = getMeetingBotRuntimeConfig();
  const selectedProvider = provider || config.provider;
  if (!config.ready || selectedProvider !== config.provider) return mockAdapter;
  if (selectedProvider === "attendee") return new AttendeeMeetingBotAdapter();
  if (selectedProvider === "recall") return new RecallMeetingBotAdapter();
  return mockAdapter;
}
