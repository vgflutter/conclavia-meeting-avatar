import { randomUUID } from "node:crypto";

import type { ChatPlatform } from "../domain/protocol.js";

export interface MeetingAgendaItem {
  offsetMs: number;
  label: string;
}

export interface MeetingAgenda {
  id: string;
  platform: ChatPlatform;
  meetingId: string;
  sourceMessageId: string;
  createdBy: string;
  startedAt: string;
  items: MeetingAgendaItem[];
  upcomingSent: number[];
  transitionSent: number[];
  completed: boolean;
}

export interface MeetingAgendaNotification {
  agendaId: string;
  platform: ChatPlatform;
  meetingId: string;
  sourceMessageId: string;
  kind: "upcoming" | "transition" | "complete";
  itemIndex: number;
  text: string;
}

export interface MeetingAgendaSnapshot {
  id: string;
  platform: ChatPlatform;
  meetingId: string;
  startedAt: string;
  elapsedMs: number;
  totalDurationMs: number;
  currentItemIndex: number;
  currentItem: MeetingAgendaItem;
  nextItem: MeetingAgendaItem | null;
  items: MeetingAgendaItem[];
  completed: boolean;
}

const maximumAgendaDurationMs = 8 * 60 * 60 * 1_000;
const upcomingLeadMs = 60_000;

function agendaKey(platform: ChatPlatform, meetingId: string): string {
  return `${platform}\u0000${meetingId}`;
}

function parseOffset(value: string): number | null {
  const match = /^(\d{1,3}):([0-5]\d)(?::([0-5]\d))?$/u.exec(value);
  if (!match) return null;
  const first = Number(match[1]);
  const second = Number(match[2]);
  const third = match[3] === undefined ? null : Number(match[3]);
  const totalSeconds = third === null
    ? first * 60 + second
    : first * 3_600 + second * 60 + third;
  return totalSeconds * 1_000;
}

export function formatAgendaOffset(offsetMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(offsetMs / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function parseMeetingAgenda(value: string): MeetingAgendaItem[] {
  const items = value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const match = /^(?:[-*]\s*)?\[?(\d{1,3}:[0-5]\d(?::[0-5]\d)?)\]?\s*(?:[-–—:]\s*)?(.+)$/u.exec(line);
      if (!match) {
        throw new Error(`Riga ${index + 1} non valida: usa MM:SS Titolo`);
      }
      const offsetMs = parseOffset(match[1] ?? "");
      const label = match[2]?.trim() ?? "";
      if (offsetMs === null || !label || label.length > 160) {
        throw new Error(`Riga ${index + 1} non valida: usa MM:SS Titolo`);
      }
      return { offsetMs, label };
    });

  if (items.length < 2 || items.length > 24) {
    throw new Error("La scaletta deve contenere da 2 a 24 punti");
  }
  if (items[0]?.offsetMs !== 0) {
    throw new Error("Il primo punto della scaletta deve iniziare da 00:00");
  }
  for (let index = 1; index < items.length; index += 1) {
    if ((items[index]?.offsetMs ?? 0) <= (items[index - 1]?.offsetMs ?? 0)) {
      throw new Error("I timestamp della scaletta devono essere crescenti e senza duplicati");
    }
  }
  if ((items.at(-1)?.offsetMs ?? 0) > maximumAgendaDurationMs) {
    throw new Error("La scaletta non può superare 8 ore");
  }
  return items;
}

export class MeetingAgendaManager {
  readonly #agendas = new Map<string, MeetingAgenda>();

  activate(input: {
    platform: ChatPlatform;
    meetingId: string;
    sourceMessageId: string;
    createdBy: string;
    capturedAt: string;
    agendaText: string;
    now?: Date;
  }): MeetingAgendaSnapshot {
    const now = input.now ?? new Date();
    const capturedAtMs = Date.parse(input.capturedAt);
    const startedAtMs = Number.isFinite(capturedAtMs) &&
        Math.abs(now.getTime() - capturedAtMs) <= 5 * 60_000
      ? capturedAtMs
      : now.getTime();
    const agenda: MeetingAgenda = {
      id: randomUUID(),
      platform: input.platform,
      meetingId: input.meetingId,
      sourceMessageId: input.sourceMessageId,
      createdBy: input.createdBy,
      startedAt: new Date(startedAtMs).toISOString(),
      items: parseMeetingAgenda(input.agendaText),
      upcomingSent: [],
      transitionSent: [0],
      completed: false,
    };
    this.#agendas.set(agendaKey(input.platform, input.meetingId), agenda);
    return this.#snapshot(agenda, now);
  }

  cancel(platform: ChatPlatform, meetingId: string): boolean {
    return this.#agendas.delete(agendaKey(platform, meetingId));
  }

  reset(): void {
    this.#agendas.clear();
  }

  tick(now = new Date()): MeetingAgendaNotification[] {
    const notifications: MeetingAgendaNotification[] = [];
    for (const agenda of this.#agendas.values()) {
      if (agenda.completed) continue;
      const elapsedMs = Math.max(0, now.getTime() - Date.parse(agenda.startedAt));
      let latestDueIndex = -1;
      for (let index = 1; index < agenda.items.length; index += 1) {
        if (!agenda.transitionSent.includes(index) &&
            elapsedMs >= (agenda.items[index]?.offsetMs ?? Number.POSITIVE_INFINITY)) {
          latestDueIndex = index;
        }
      }
      if (latestDueIndex >= 1) {
        for (let index = 1; index <= latestDueIndex; index += 1) {
          if (!agenda.transitionSent.includes(index)) agenda.transitionSent.push(index);
          if (!agenda.upcomingSent.includes(index)) agenda.upcomingSent.push(index);
        }
        const item = agenda.items[latestDueIndex];
        if (!item) continue;
        const final = latestDueIndex === agenda.items.length - 1;
        agenda.completed = final;
        notifications.push({
          agendaId: agenda.id,
          platform: agenda.platform,
          meetingId: agenda.meetingId,
          sourceMessageId: agenda.sourceMessageId,
          kind: final ? "complete" : "transition",
          itemIndex: latestDueIndex,
          text: final
            ? `[${formatAgendaOffset(item.offsetMs)}] Tempo previsto esaurito. Chiudiamo con “${item.label}”.`
            : `[${formatAgendaOffset(item.offsetMs)}] Tempo: passiamo a “${item.label}”.`,
        });
        continue;
      }

      const nextIndex = agenda.items.findIndex((item, index) =>
        index > 0 &&
        !agenda.upcomingSent.includes(index) &&
        elapsedMs >= item.offsetMs - upcomingLeadMs &&
        elapsedMs < item.offsetMs
      );
      if (nextIndex < 1) continue;
      agenda.upcomingSent.push(nextIndex);
      const current = agenda.items[nextIndex - 1];
      const next = agenda.items[nextIndex];
      if (!current || !next) continue;
      notifications.push({
        agendaId: agenda.id,
        platform: agenda.platform,
        meetingId: agenda.meetingId,
        sourceMessageId: agenda.sourceMessageId,
        kind: "upcoming",
        itemIndex: nextIndex,
        text: `[${formatAgendaOffset(Math.max(0, next.offsetMs - upcomingLeadMs))}] Un minuto per chiudere “${current.label}”; poi “${next.label}”.`,
      });
    }
    return notifications;
  }

  snapshots(now = new Date()): MeetingAgendaSnapshot[] {
    return [...this.#agendas.values()].map((agenda) => this.#snapshot(agenda, now));
  }

  #snapshot(agenda: MeetingAgenda, now: Date): MeetingAgendaSnapshot {
    const elapsedMs = Math.max(0, now.getTime() - Date.parse(agenda.startedAt));
    let currentItemIndex = 0;
    for (let index = 1; index < agenda.items.length; index += 1) {
      if (elapsedMs >= (agenda.items[index]?.offsetMs ?? Number.POSITIVE_INFINITY)) {
        currentItemIndex = index;
      }
    }
    return {
      id: agenda.id,
      platform: agenda.platform,
      meetingId: agenda.meetingId,
      startedAt: agenda.startedAt,
      elapsedMs,
      totalDurationMs: agenda.items.at(-1)?.offsetMs ?? 0,
      currentItemIndex,
      currentItem: { ...(agenda.items[currentItemIndex] ?? agenda.items[0]!) },
      nextItem: agenda.items[currentItemIndex + 1]
        ? { ...agenda.items[currentItemIndex + 1]! }
        : null,
      items: agenda.items.map((item) => ({ ...item })),
      completed: agenda.completed,
    };
  }
}
