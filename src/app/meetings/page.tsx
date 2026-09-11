import type { Metadata } from "next";
import Link from "next/link";
import { getRequestLocale } from "@/i18n/server";
import type { Locale } from "@/i18n/locale";
import { formatMeetingDate, meetingStatusLabel } from "@/lib/meeting-presentation";
import { dashboardFilters, dashboardHref, loadMeetingDashboard, DASHBOARD_PAGE_SIZE, type DashboardFilters, type DashboardView, type MeetingListItem } from "@/lib/meeting-dashboard";
import { MeetingArchiveButton } from "@/components/MeetingArchiveButton";
import { MeetingDashboardRefresh } from "@/components/MeetingDashboardRefresh";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getRequestLocale()) === "it" ? "Meeting" : "Meetings" };
}
const headings: Record<DashboardView, [string, string]> = {
  overview: ["Panoramica", "Overview"], active: ["In corso", "In progress"],
  attention: ["Richiedono un intervento", "Action required"], upcoming: ["Prossimi meeting", "Upcoming meetings"],
  history: ["Storico", "History"], series: ["Serie di meeting", "Meeting series"],
};
function text(pair: [string, string], locale: Locale) { return pair[locale === "it" ? 0 : 1]; }
function rowStatus(item: MeetingListItem, locale: Locale, history: boolean) {
  if (item.archived) return text(["Archiviato", "Archived"], locale);
  if (history && ["scheduled", "failed"].includes(item.status)) return text(["Non svolto", "Not held"], locale);
  if (item.status === "processing") return text(["Riepilogo in preparazione", "Preparing summary"], locale);
  return meetingStatusLabel(locale, item.status);
}
function MeetingRows({ items, view, locale }: { items: MeetingListItem[]; view: DashboardView; locale: Locale }) {
  const it = locale === "it";
  const history = view === "history";
  return <div className="card divide-y divide-slate-100 overflow-hidden" data-testid={`meeting-list-${view}`}>
    {items.map((item) => {
      const missed = history && ["scheduled", "failed"].includes(item.status);
      const action = item.issue === "lobby" ? text(["Apri per ammettere", "Open to admit"], locale)
        : item.issue === "output" ? text(["Ripristina avatar", "Restore avatar"], locale)
        : text(["Verifica ingresso", "Review entry"], locale);
      return <article key={item.id} data-testid="meeting-row" className="grid min-w-0 gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-5 sm:px-5">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <Link href={`/meetings/${item.id}${history ? "#summary" : view === "attention" ? "#session" : ""}`} className="min-w-0 break-words text-sm font-semibold text-[#1a2921] hover:text-[#295c43] hover:underline sm:text-base">{item.title}</Link>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${view === "attention" || (view === "active" && ["waiting_room", "failed"].includes(item.status)) ? "bg-amber-50 text-amber-800" : view === "active" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{rowStatus(item, locale, history)}</span>
          </div>
          <p className="mt-1 flex flex-wrap gap-x-3 text-xs leading-5 text-slate-500">
            <time dateTime={item.scheduledStart}>{formatMeetingDate(item.scheduledStart, locale, item.timezone)}</time>
            {item.seriesLabel && <span className="break-words">{item.seriesLabel}</span>}
          </p>
          {history && item.overview && <p className="mt-1 line-clamp-2 max-w-4xl text-sm leading-5 text-slate-600">{item.overview}</p>}
          {history && (item.decisionCount > 0 || item.actionCount > 0) && <p className="mt-1 text-xs text-slate-500">{item.decisionCount} {it ? item.decisionCount === 1 ? "decisione" : "decisioni" : item.decisionCount === 1 ? "decision" : "decisions"} · {item.actionCount} {it ? "attività" : item.actionCount === 1 ? "action" : "actions"}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold sm:justify-end">
          {view === "attention" ? <Link href={`/meetings/${item.id}#session`} className="rounded-lg border border-amber-200 px-3 py-2 text-amber-900 hover:bg-amber-50">{action} →</Link>
            : missed ? <>
              <Link href={item.seriesId ? `/meetings/series/${item.seriesId}` : `/meetings/new?from=${item.id}`} className="rounded-lg px-2 py-2 text-[#295c43] hover:underline">{it ? "Riprogramma" : "Reschedule"}</Link>
              <MeetingArchiveButton meetingId={item.id} archived={item.archived} />
            </> : <Link href={`/meetings/${item.id}${history ? "#summary" : ""}`} className="rounded-lg px-2 py-2 text-[#295c43] hover:underline">{history && item.status !== "processing" ? it ? "Leggi riepilogo" : "Read summary" : it ? "Apri meeting" : "Open meeting"} →</Link>}
        </div>
      </article>;
    })}
  </div>;
}
function Section({ view, items, total, locale, filters }: { view: Exclude<DashboardView, "overview" | "series">; items: MeetingListItem[]; total: number; locale: Locale; filters: DashboardFilters }) {
  const it = locale === "it";
  return <section aria-label={text(headings[view], locale)}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-semibold tracking-tight">{text(headings[view], locale)} <span className="ml-2 text-sm font-normal text-slate-500">{total}</span></h2>
      {filters.view === "overview" && total > items.length && <Link className="text-sm font-semibold text-[#295c43] hover:underline" href={dashboardHref(filters, {view, page: 1})}>{it ? "Vedi tutti" : "View all"} →</Link>}
    </div>
    {view === "history" && <p className="mb-3 text-sm text-slate-500">{it ? "Riepiloghi, decisioni e attività. La trascrizione resta nei dettagli." : "Summaries, decisions and actions. Full transcripts remain in the details."}</p>}
    {items.length ? <MeetingRows items={items} view={view} locale={locale} /> : <p className="rounded-xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">
      {filters.q || filters.from || filters.to || filters.state !== "all" ? it ? "Nessun meeting corrisponde ai filtri." : "No meetings match these filters."
        : view === "active" ? it ? "Nessun meeting in corso." : "No meetings in progress."
        : view === "attention" ? it ? "Nessun intervento necessario." : "No action required."
        : view === "upcoming" ? it ? "Nessun appuntamento in programma." : "No upcoming appointments."
        : it ? "I riepiloghi compariranno qui al termine dei meeting." : "Summaries will appear here after your meetings."}
    </p>}
  </section>;
}
export default async function MeetingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [locale, query] = await Promise.all([getRequestLocale(), searchParams]);
  const it = locale === "it";
  const filters = dashboardFilters(query);
  const data = await loadMeetingDashboard(filters);
  const current = { ...filters, page: data.page };
  const expanded = filters.view !== "overview";
  const hasFilters = Boolean(filters.q || filters.from || filters.to || (filters.view === "history" && filters.state !== "all"));
  const total = expanded ? data.counts[filters.view as Exclude<DashboardView, "overview">] : 0;
  const pages = Math.max(1, Math.ceil(total / DASHBOARD_PAGE_SIZE));
  return <div className="container-page py-8 sm:py-10">
    <MeetingDashboardRefresh enabled={data.counts.active > 0 || data.history.some((item) => item.status === "processing")} />
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-3xl font-bold tracking-tight">{it ? "Meeting" : "Meetings"}</h1><p className="mt-2 text-sm text-slate-500">{it ? "Segui gli incontri di oggi e ritrova ciò che avete deciso." : "Follow today's meetings and find what you decided."}</p></div>
      <Link href="/meetings/new" className="button-primary">＋ {it ? "Nuovo meeting" : "New meeting"}</Link>
    </header>
    <nav aria-label={it ? "Filtra meeting" : "Filter meetings"} className="mb-5 grid grid-cols-4 gap-1 border-b border-slate-200 pb-2 sm:flex sm:flex-wrap">
      {(["overview", "upcoming", "history", "series"] as const).map((view) => <Link key={view} aria-current={filters.view === view ? "page" : undefined} href={dashboardHref(filters, { view, page: 1, state: "all" })} className={`rounded-lg px-1 py-2 text-center text-xs font-semibold sm:px-4 sm:text-sm ${filters.view === view ? "bg-[#e7f0e9] text-[#24563d]" : "text-slate-500 hover:bg-slate-100"}`}>
        {view === "upcoming" ? it ? "Prossimi" : "Upcoming" : view === "series" ? it ? "Serie" : "Series" : text(headings[view], locale)}
      </Link>)}
    </nav>
    <form key={`${filters.view}:${filters.q}:${filters.from}:${filters.to}:${filters.state}`} action="/meetings" className="mb-6 flex flex-wrap items-end gap-3">
      {expanded && <input type="hidden" name="view" value={filters.view} />}
      <label className="min-w-0 flex-[2_1_16rem] text-xs font-medium text-slate-600">{it ? "Cerca meeting" : "Search meetings"}<input name="q" type="search" defaultValue={filters.q} placeholder={it ? "Titolo, progetto o riepilogo" : "Title, project or summary"} className="input mt-1 w-full" /></label>
      {(expanded || filters.from || filters.to) && filters.view !== "series" && <>
        <label className="min-w-0 flex-[1_1_8rem] text-xs font-medium text-slate-600">{it ? "Dal" : "From"}<input name="from" type="date" defaultValue={filters.from} className="input mt-1 w-full" /></label>
        <label className="min-w-0 flex-[1_1_8rem] text-xs font-medium text-slate-600">{it ? "Al" : "To"}<input name="to" type="date" defaultValue={filters.to} className="input mt-1 w-full" /></label>
      </>}
      {filters.view === "history" && <label className="min-w-0 flex-[1_1_10rem] text-xs font-medium text-slate-600">{it ? "Stato" : "Status"}<select aria-label={it ? "Stato" : "Status"} name="state" defaultValue={filters.state} className="input mt-1 w-full">
        {([ ["all", "Tutti", "All"], ["completed", "Conclusi", "Completed"], ["missed", "Non svolti", "Not held"], ["processing", "Riepilogo in preparazione", "Preparing summary"], ["cancelled", "Annullati", "Cancelled"], ["archived", "Archiviati", "Archived"] ] as const).map(([value, italian, english]) => <option key={value} value={value}>{it ? italian : english}</option>)}
      </select></label>}
      <button type="submit" className="button-secondary">{it ? "Cerca" : "Search"}</button>
      {hasFilters && <Link href={dashboardHref(filters, { q: "", from: "", to: "", state: "all", page: 1 })} className="py-3 text-sm font-semibold text-[#295c43] hover:underline">{it ? "Azzera ricerca" : "Clear search"}</Link>}
    </form>
    {expanded && <Link href={dashboardHref(filters, { view: "overview", page: 1, state: "all", from: "", to: "" })} className="mb-5 inline-block text-sm text-[#295c43] hover:underline">← {it ? "Torna alla panoramica" : "Back to overview"}</Link>}
    <div className="space-y-7">
      {!expanded && data.counts.attention > 0 && <details className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3" data-testid="attention-inbox">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-amber-950"><span>{data.counts.attention} {it ? data.counts.attention === 1 ? "richiede un intervento" : "richiedono un intervento" : data.counts.attention === 1 ? "needs action" : "need action"}</span><span aria-hidden="true">⌄</span></summary>
        <p className="mt-2 text-xs text-amber-900">{it ? "Ammissioni e problemi operativi. I meeting conclusi restano nello storico." : "Admissions and operational issues. Finished meetings stay in history."}</p>
        <div className="mt-4"><Section view="attention" items={data.attention} total={data.counts.attention} locale={locale} filters={filters} /></div>
      </details>}
      {(!expanded || filters.view === "active") && <Section view="active" items={data.active} total={data.counts.active} locale={locale} filters={filters} />}
      {filters.view === "attention" && <Section view="attention" items={data.attention} total={data.counts.attention} locale={locale} filters={filters} />}
      {(!expanded || filters.view === "upcoming") && <Section view="upcoming" items={data.upcoming} total={data.counts.upcoming} locale={locale} filters={filters} />}
      {(!expanded || filters.view === "history") && <Section view="history" items={data.history} total={data.counts.history} locale={locale} filters={filters} />}
      {filters.view === "series" && <section>
        <h2 className="mb-3 text-lg font-semibold">{text(headings.series, locale)} <span className="text-sm font-normal text-slate-500">{data.counts.series}</span></h2>
        <p className="mb-4 text-sm text-slate-500">{it ? "Appuntamenti collegati, con una memoria condivisa." : "Connected appointments with shared memory."}</p>
        <div className="card divide-y divide-slate-100">{data.series.map((series) => <Link key={series.id} href={`/meetings/series/${series.id}`} className="block px-5 py-4 hover:bg-slate-50">
          <h3 className="break-words font-semibold">{series.title}</h3><p className="mt-1 line-clamp-2 text-sm text-slate-500">{series.objective}</p>
          <p className="mt-2 text-xs text-slate-500">{series.total} {it ? "appuntamenti" : "appointments"} · {series.completed} {it ? "conclusi" : "completed"}{series.nextAt ? ` · ${it ? "Prossimo:" : "Next:"} ${formatMeetingDate(series.nextAt, locale, series.timezone)}` : ""}</p>
        </Link>)}</div>
        {!data.series.length && <p className="text-sm text-slate-500">{it ? "Nessuna serie corrisponde alla ricerca." : "No series match your search."}</p>}
      </section>}
    </div>
    {expanded && total > 0 && <nav aria-label={it ? "Paginazione meeting" : "Meeting pagination"} className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
      <span className="text-slate-500">{(data.page - 1) * DASHBOARD_PAGE_SIZE + 1}–{Math.min(data.page * DASHBOARD_PAGE_SIZE, total)} {it ? "di" : "of"} {total}</span>
      <div className="flex items-center gap-4">{data.page > 1 && <Link className="button-secondary" href={dashboardHref(current, {page: data.page - 1})}>{it ? "Precedente" : "Previous"}</Link>}<span>{data.page} / {pages}</span>{data.page < pages && <Link className="button-secondary" href={dashboardHref(current, {page: data.page + 1})}>{it ? "Successiva" : "Next"}</Link>}</div>
    </nav>}
  </div>;
}
