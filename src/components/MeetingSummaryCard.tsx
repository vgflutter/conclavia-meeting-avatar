import type { Locale } from "@/i18n/locale";
import type { MeetingResponse } from "@/types/meeting";
import { MeetingOutcomeForm } from "@/components/MeetingOutcomeForm";

export function MeetingSummaryCard({ meeting, locale }: { meeting: MeetingResponse; locale: Locale }) {
  const it = locale === "it";
  const saved = Boolean(meeting.summary.generatedAt || meeting.summary.overview);
  return <section id="summary" className="card scroll-mt-6 p-5 sm:p-7">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold">{it ? "Riepilogo del meeting" : "Meeting summary"}</h2>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">{saved ? it ? "Memoria salvata" : "Memory saved" : it ? "In attesa" : "Pending"}</span>
    </div>
    <p className="mt-3 text-sm text-slate-500">{it ? "Resta nello storico e nella memoria degli appuntamenti collegati. La revisione è facoltativa." : "Kept in history and in the memory of connected appointments. Review is optional."}</p>
    {saved && <p className="mt-5 whitespace-pre-wrap rounded-xl bg-[#f4f7f4] p-4 text-sm leading-6 text-slate-700">{meeting.summary.overview}</p>}
    {(meeting.summary.decisions.length > 0 || meeting.summary.actionItems.length > 0) && <div className="mt-5 grid gap-5 sm:grid-cols-2">
      {meeting.summary.decisions.length > 0 && <div><h3 className="text-sm font-semibold">{it ? "Decisioni" : "Decisions"}</h3><ul className="mt-2 list-disc space-y-2 pl-4 text-sm text-slate-600">{meeting.summary.decisions.map((decision, index) => <li key={index}>{decision}</li>)}</ul></div>}
      {meeting.summary.actionItems.length > 0 && <div><h3 className="text-sm font-semibold">{it ? "Attività" : "Actions"}</h3><ul className="mt-2 list-disc space-y-2 pl-4 text-sm text-slate-600">{meeting.summary.actionItems.map((action, index) => <li key={index}>{action.description}{action.owner ? ` · ${action.owner}` : ""}{action.completed ? " ✓" : ""}</li>)}</ul></div>}
    </div>}
    {meeting.summary.openQuestions.length > 0 && <div className="mt-5"><h3 className="text-sm font-semibold">{it ? "Questioni aperte" : "Open questions"}</h3><ul className="mt-2 list-disc space-y-2 pl-4 text-sm text-slate-600">{meeting.summary.openQuestions.map((question, index) => <li key={index}>{question}</li>)}</ul></div>}
    <details className="group mt-5 border-t border-slate-100 pt-4">
      <summary className="cursor-pointer rounded-lg py-2 text-sm font-semibold text-[#295c43]">{saved ? it ? "Modifica il riepilogo" : "Edit summary" : it ? "Completa il riepilogo" : "Complete summary"}</summary>
      <div className="mt-4"><MeetingOutcomeForm meeting={meeting} /></div>
    </details>
  </section>;
}
