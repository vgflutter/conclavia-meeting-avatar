import type { PipelineStage } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { MeetingModel } from "@/models/Meeting";
import { MeetingSeriesModel } from "@/models/MeetingSeries";
import type { MeetingStatus } from "@/types/meeting";

export type DashboardView = "overview" | "active" | "attention" | "upcoming" | "history" | "series";
export type HistoryState = "all" | "completed" | "missed" | "processing" | "cancelled" | "archived";
export interface DashboardFilters { view: DashboardView; q: string; from: string; to: string; state: HistoryState; page: number }
export interface MeetingListItem {
  id: string; title: string; status: MeetingStatus; scheduledStart: string; scheduledEnd: string;
  timezone: string; seriesId?: string; seriesLabel?: string; archived: boolean;
  overview: string; decisionCount: number; actionCount: number; issue?: "lobby" | "output" | "entry";
}
export interface SeriesListItem { id: string; title: string; objective: string; total: number; completed: number; nextAt?: string; timezone: string }

const views: DashboardView[] = ["overview", "active", "attention", "upcoming", "history", "series"];
const historyStates: HistoryState[] = ["all", "completed", "missed", "processing", "cancelled", "archived"];
export const DASHBOARD_PAGE_SIZE = 20;
const limits = { active: 4, attention: 3, upcoming: 5, history: 5 };
type Query = Record<string, unknown>;

function day(value?: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return "";
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : "";
}
export function dashboardFilters(query: Record<string, string | string[] | undefined>): DashboardFilters {
  const first = (key: string) => Array.isArray(query[key]) ? query[key][0] : query[key];
  const from = day(first("from"));
  const to = day(first("to"));
  const page = Number(first("page"));
  return {
    view: views.includes(first("view") as DashboardView) ? first("view") as DashboardView : "overview",
    q: (first("q") || "").trim().slice(0, 120),
    from: from && to && from > to ? to : from, to: from && to && from > to ? from : to,
    state: historyStates.includes(first("state") as HistoryState) ? first("state") as HistoryState : "all",
    page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 100_000) : 1,
  };
}
export function dashboardHref(filters: DashboardFilters, changes: Partial<DashboardFilters> = {}): string {
  const next = { ...filters, ...changes };
  const params = new URLSearchParams();
  if (next.view !== "overview") params.set("view", next.view);
  if (next.q) params.set("q", next.q);
  if (next.from && next.view !== "series") params.set("from", next.from);
  if (next.to && next.view !== "series") params.set("to", next.to);
  if (next.view === "history" && next.state !== "all") params.set("state", next.state);
  if (next.page > 1) params.set("page", String(next.page));
  return `/meetings${params.size ? `?${params}` : ""}`;
}

export function dashboardQueries(filters: DashboardFilters, now: Date) {
  const escaped = filters.q.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const search: Query = escaped ? { $or: ["title", "objective", "seriesLabel", "summary.overview"].map((field) => ({ [field]: { $regex: escaped, $options: "i" } })) } : {};
  const dateTerms: Query[] = [];
  const localDate = { $dateToString: { date: "$scheduledStart", format: "%Y-%m-%d", timezone: { $ifNull: ["$timezone", "UTC"] } } };
  if (filters.from) dateTerms.push({ $expr: { $gte: [localDate, filters.from] } });
  if (filters.to) dateTerms.push({ $expr: { $lte: [localDate, filters.to] } });
  const common = [search, ...dateTerms];
  const cutoff = new Date(now.getTime() - 20_000);
  const output: Query = { status: "live", "bot.provider": "attendee", $or: [
    { "bot.outputLastSeenAt": { $lt: cutoff } },
    { "bot.outputLastSeenAt": null, "bot.joinedAt": { $lt: cutoff } },
  ] };
  const uncertain: Query = { status: "failed", $or: [
    { "bot.activeRoomKey": { $type: "string" } }, { "bot.failureCode": "create_uncertain" },
    { "bot.externalBotId": { $type: "string", $ne: "" }, "bot.leftAt": null },
  ] };
  const attention: Query = { archivedAt: null, $or: [
    { status: "waiting_room" }, output, uncertain,
    { status: "failed", scheduledEnd: { $gte: now }, "bot.failureCode": { $ne: "entry_cancelled" } },
  ] };
  const active: Query = { archivedAt: null, $or: [
    { status: { $in: ["joining", "waiting_room", "live"] } },
    { "bot.status": "leaving" }, uncertain,
  ] };
  const past: Query = { $or: [
    { status: { $in: ["completed", "cancelled", "processing"] } },
    { status: "scheduled", scheduledStart: { $lt: now } },
    { status: "failed", scheduledEnd: { $lt: now } },
    { status: "failed", "bot.failureCode": "entry_cancelled" },
    { archivedAt: { $type: "date" } },
  ] };
  const state: Query = filters.state === "all" ? {} : filters.state === "archived" ? { archivedAt: { $type: "date" } }
    : filters.state === "missed" ? { status: { $in: ["scheduled", "failed"] } } : { status: filters.state };
  return {
    attention: { $and: [...common, attention] }, active: { $and: [...common, active] },
    upcoming: { $and: [...common, { archivedAt: null, status: "scheduled", scheduledStart: { $gte: now } }] },
    history: { $and: [...common, past, { $nor: [active, attention] }, ...(filters.view === "history" ? [state] : [])] },
    series: escaped ? { $or: ["title", "objective"].map((field) => ({ [field]: { $regex: escaped, $options: "i" } })) } : {},
  };
}

// Positive projection: no transcripts, command history, bot capabilities or large memory arrays cross the list boundary.
export const MEETING_LIST_PROJECTION = {
  _id: 0, id: { $toString: "$_id" }, title: 1, status: 1, scheduledStart: 1, scheduledEnd: 1, timezone: 1,
  seriesId: { $toString: "$seriesId" }, seriesLabel: 1, archived: { $ne: [{ $ifNull: ["$archivedAt", null] }, null] },
  overview: { $substrCP: [{ $ifNull: ["$summary.overview", ""] }, 0, 240] },
  decisionCount: { $size: { $ifNull: ["$summary.decisions", []] } },
  actionCount: { $size: { $ifNull: ["$summary.actionItems", []] } },
  issue: { $switch: { branches: [
    { case: { $eq: ["$status", "waiting_room"] }, then: "lobby" },
    { case: { $eq: ["$status", "live"] }, then: "output" },
  ], default: "entry" } },
};

export async function loadMeetingDashboard(filters: DashboardFilters, now = new Date()) {
  await connectToDatabase();
  const queries = dashboardQueries(filters, now);
  const [active, attention, upcoming, history, series] = await Promise.all([
    ...(["active", "attention", "upcoming", "history"] as const).map((key) => MeetingModel.countDocuments(queries[key])),
    MeetingSeriesModel.countDocuments(queries.series),
  ]);
  const counts = { active, attention, upcoming, history, series };
  const page = filters.view === "overview" ? 1 : Math.min(filters.page, Math.max(1, Math.ceil(counts[filters.view] / DASHBOARD_PAGE_SIZE)));
  const result: Record<keyof typeof limits, MeetingListItem[]> = { active: [], attention: [], upcoming: [], history: [] };
  await Promise.all((Object.keys(limits) as Array<keyof typeof limits>).map(async (key) => {
    if (filters.view !== "overview" && filters.view !== key) return;
    const pipeline: PipelineStage[] = [{ $match: queries[key] }];
    if (key === "attention") pipeline.push({ $addFields: { _priority: { $switch: { branches: [
      { case: { $eq: ["$status", "waiting_room"] }, then: 0 },
      { case: { $eq: ["$status", "live"] }, then: 1 },
    ], default: 2 } } } }, { $sort: { _priority: 1, scheduledStart: 1, _id: 1 } });
    else pipeline.push({ $sort: { scheduledStart: key === "history" ? -1 : 1, _id: key === "history" ? -1 : 1 } });
    pipeline.push({ $skip: filters.view === "overview" ? 0 : (page - 1) * DASHBOARD_PAGE_SIZE },
      { $limit: filters.view === "overview" ? limits[key] : DASHBOARD_PAGE_SIZE }, { $project: MEETING_LIST_PROJECTION });
    result[key] = (await MeetingModel.aggregate(pipeline)).map((item) => ({ ...item,
      scheduledStart: item.scheduledStart.toISOString(), scheduledEnd: item.scheduledEnd.toISOString(),
    }));
  }));
  let seriesItems: SeriesListItem[] = [];
  if (filters.view === "series") {
    seriesItems = await MeetingSeriesModel.aggregate([
      { $match: queries.series }, { $sort: { updatedAt: -1, _id: -1 } }, { $skip: (page - 1) * DASHBOARD_PAGE_SIZE }, { $limit: DASHBOARD_PAGE_SIZE },
      { $lookup: { from: MeetingModel.collection.name, localField: "_id", foreignField: "seriesId", as: "stats", pipeline: [
        { $group: { _id: null, total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          nextAt: { $min: { $cond: [{ $and: [{ $eq: ["$status", "scheduled"] }, { $gte: ["$scheduledStart", now] }, { $eq: [{ $ifNull: ["$archivedAt", null] }, null] }] }, "$scheduledStart", null] } } } },
      ] } },
      { $project: { _id: 0, id: { $toString: "$_id" }, title: 1, objective: { $substrCP: [{ $ifNull: ["$objective", ""] }, 0, 240] }, timezone: 1,
        total: { $ifNull: [{ $first: "$stats.total" }, 0] }, completed: { $ifNull: [{ $first: "$stats.completed" }, 0] }, nextAt: { $first: "$stats.nextAt" } } },
    ]).then((items) => items.map((item) => ({...item, nextAt: item.nextAt?.toISOString()})));
  }
  return { ...result, series: seriesItems, counts, page };
}
