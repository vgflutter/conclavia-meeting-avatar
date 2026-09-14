"use client";

import { type FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CONTEXT_MAX_LENGTH } from "@/lib/assistant-context";

import { useTranslations } from "@/i18n/I18nProvider";
import type { CorrectionPolicy, MeetingLanguage, MeetingCreateInput } from "@/types/meeting";
import type { MeetingAutomationPublicConfig } from "@/types/meeting-automation";

type MeetingMode = "single" | "series";
type MeetingTiming = "now" | "scheduled";

type AppointmentDraft = {
  key: string;
  label: string;
  meetingUrl: string;
  scheduledStart: string;
  durationMinutes: number;
};

type AgendaDraft = {
  key: string;
  title: string;
  mandatory: boolean;
};

function initialAppointment(key: string): AppointmentDraft {
  return {
    key,
    label: "",
    meetingUrl: "",
    scheduledStart: "",
    durationMinutes: 60,
  };
}

export function MeetingCreateForm({
  automation,
  assistantName,
  initialMeeting,
}: {
  automation: MeetingAutomationPublicConfig;
  assistantName: string;
  initialMeeting?: Pick<MeetingCreateInput, "title" | "objective" | "meetingUrl" | "durationMinutes" | "timezone" | "language" | "agenda" | "correctionPolicy" | "seriesLabel" | "context">;
}) {
  const router = useRouter();
  const { locale } = useTranslations();
  const isItalian = locale === "it";
  const nextAppointmentKey = useRef(2);
  const nextAgendaKey = useRef((initialMeeting?.agenda.length || 1) + 1);
  const automaticEntryReady = automation.state === "ready";
  const [mode, setMode] = useState<MeetingMode>("single");
  const [timing, setTiming] = useState<MeetingTiming>(
    automaticEntryReady && !initialMeeting ? "now" : "scheduled",
  );
  const [title, setTitle] = useState(initialMeeting?.title || "");
  const [objective, setObjective] = useState(initialMeeting?.objective || "");
  const [context, setContext] = useState(initialMeeting?.context || "");
  const [appointments, setAppointments] = useState<AppointmentDraft[]>([
    { ...initialAppointment("appointment-1"), meetingUrl: initialMeeting?.meetingUrl || "", durationMinutes: initialMeeting?.durationMinutes || 60 },
  ]);
  const usesTeamsCaptions = automation.provider === "attendee";
  const [language, setLanguage] = useState<MeetingLanguage>(initialMeeting?.language && initialMeeting.language !== "auto" ? initialMeeting.language : usesTeamsCaptions ? locale : "auto");
  const [autoJoin, setAutoJoin] = useState(automaticEntryReady && !initialMeeting);
  const [agenda, setAgenda] = useState<AgendaDraft[]>(initialMeeting?.agenda.length ? initialMeeting.agenda.map((item, index) => ({...item, key: `agenda-${index + 1}`})) : [
    { key: "agenda-1", title: "", mandatory: true },
  ]);
  const [correctionPolicy, setCorrectionPolicy] =
    useState<CorrectionPolicy>(initialMeeting?.correctionPolicy || "important_only");
  const [submitting, setSubmitting] = useState(false);
  const submitInFlight = useRef(false);
  const [error, setError] = useState<string>();
  const timezone = initialMeeting?.timezone || "Europe/Rome";

  function selectMode(nextMode: MeetingMode) {
    setMode(nextMode);
    setTiming(
      nextMode === "series" || !automaticEntryReady ? "scheduled" : "now",
    );
    if (nextMode === "single" && appointments.length > 1) {
      setAppointments([appointments[0]]);
    }
  }

  function updateAppointment(
    key: string,
    field: keyof Omit<AppointmentDraft, "key">,
    value: string | number,
  ) {
    setAppointments((current) =>
      current.map((appointment) =>
        appointment.key === key ? { ...appointment, [field]: value } : appointment,
      ),
    );
  }

  function addAppointment() {
    const key = `appointment-${nextAppointmentKey.current}`;
    nextAppointmentKey.current += 1;
    setAppointments((current) => [...current, initialAppointment(key)]);
  }

  function removeAppointment(key: string) {
    setAppointments((current) => current.filter((appointment) => appointment.key !== key));
  }

  function addAgendaItem() {
    const key = `agenda-${nextAgendaKey.current}`;
    nextAgendaKey.current += 1;
    setAgenda((current) => [...current, { key, title: "", mandatory: false }]);
  }

  function updateAgendaItem(key: string, value: Partial<Omit<AgendaDraft, "key">>) {
    setAgenda((current) =>
      current.map((item) => (item.key === key ? { ...item, ...value } : item)),
    );
  }

  function removeAgendaItem(key: string) {
    setAgenda((current) => current.filter((item) => item.key !== key));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitInFlight.current) return;
    submitInFlight.current = true;
    setSubmitting(true);
    setError(undefined);

    try {
      const joiningNow = mode === "single" && timing === "now";
      const automaticEntry = joiningNow ? true : autoJoin;
      const immediateStart = new Date(Date.now() + 30_000).toISOString();
      const normalizedAppointments = appointments.map((appointment, index) => ({
        label: appointment.label,
        meetingUrl: appointment.meetingUrl,
        scheduledStart:
          joiningNow && index === 0
            ? immediateStart
            : new Date(appointment.scheduledStart).toISOString(),
        durationMinutes: joiningNow && index === 0 ? 60 : appointment.durationMinutes,
      }));
      const normalizedAgenda = agenda
        .filter((item) => item.title.trim())
        .map((item) => ({ title: item.title, mandatory: item.mandatory }));

      const response = await fetch(
        mode === "series" ? "/api/meeting-series" : "/api/meetings",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            mode === "series"
              ? {
                  title,
                  objective,
                  context,
                  timezone,
                  language,
                  autoJoin: automaticEntry,
                  agenda: normalizedAgenda,
                  correctionPolicy,
                  appointments: normalizedAppointments,
                }
              : {
                  title,
                  objective,
                  context,
                  timezone,
                  language,
                  autoJoin: automaticEntry,
                  agenda: normalizedAgenda,
                  correctionPolicy,
                  ...normalizedAppointments[0],
                  seriesLabel: initialMeeting?.seriesLabel,
                },
          ),
        },
      );
      const payload = (await response.json()) as {
        meeting?: { id: string };
        series?: { id: string };
      };

      if (!response.ok || (mode === "series" ? !payload.series : !payload.meeting)) {
        throw new Error();
      }

      router.push(
        mode === "series"
          ? `/meetings/series/${payload.series?.id}`
          : `/meetings/${payload.meeting?.id}`,
      );
      router.refresh();
    } catch {
      submitInFlight.current = false;
      setError(
        isItalian
          ? "Non siamo riusciti a salvare il meeting. Controlla i dati e riprova."
          : "We couldn’t save the meeting. Check the details and try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <fieldset disabled={submitting} className="min-w-0 space-y-6">
      <fieldset className="card p-2">
        <legend className="sr-only">
          {isItalian ? "Tipo di programmazione" : "Schedule type"}
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => selectMode("single")}
            aria-pressed={mode === "single"}
            className={`rounded-xl px-4 py-4 text-left transition ${
              mode === "single"
                ? "bg-[#1f5139] text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span className="block text-sm font-bold">
              {isItalian ? "Meeting singolo" : "Single meeting"}
            </span>
            <span className={`mt-1 block text-xs leading-5 ${mode === "single" ? "text-white/65" : "text-slate-400"}`}>
              {isItalian ? "Un appuntamento e un link." : "One appointment and one link."}
            </span>
          </button>
          <button
            type="button"
            onClick={() => selectMode("series")}
            aria-pressed={mode === "series"}
            className={`rounded-xl px-4 py-4 text-left transition ${
              mode === "series"
                ? "bg-[#1f5139] text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span className="block text-sm font-bold">
              {isItalian ? "Serie di meeting" : "Meeting series"}
            </span>
            <span className={`mt-1 block text-xs leading-5 ${mode === "series" ? "text-white/65" : "text-slate-400"}`}>
              {isItalian ? "Più appuntamenti, una memoria." : "Several appointments, one memory."}
            </span>
          </button>
        </div>
      </fieldset>

      <section className="card p-5 sm:p-7">
        <h2 className="text-xl font-semibold">
          {mode === "series" ? isItalian ? "Dati della serie" : "Series details" : isItalian ? "Dati del meeting" : "Meeting details"}
        </h2>

        <div className="mt-6 grid gap-5">
          {mode === "single" && <div>
            <label className="label" htmlFor="single-meeting-url">{isItalian ? "Link Microsoft Teams" : "Microsoft Teams link"}</label>
            <input id="single-meeting-url" type="url" className="input" required value={appointments[0].meetingUrl}
              onChange={event => updateAppointment(appointments[0].key, "meetingUrl", event.target.value)}
              placeholder="https://teams.live.com/meet/..." />
          </div>}
          <div>
            <label className="label" htmlFor="meeting-title">
              {mode === "series"
                ? isItalian
                  ? "Nome della serie"
                  : "Series name"
                : isItalian
                  ? "Titolo del meeting"
                  : "Meeting title"}
            </label>
            <input
              id="meeting-title"
              className="input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={
                mode === "series"
                  ? isItalian
                    ? "Progetto Conclavia · Weekly"
                    : "Conclavia project · Weekly"
                  : isItalian
                    ? "Kickoff prodotto"
                    : "Product kickoff"
              }
              maxLength={160}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="meeting-objective">
              {isItalian ? "Obiettivo del meeting" : "Meeting objective"}
            </label>
            <textarea
              id="meeting-objective"
              className="input min-h-24 resize-y"
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
              placeholder={
                isItalian
                  ? "Quale risultato vuoi ottenere da questo incontro?"
                  : "What result do you want from this meeting?"
              }
              maxLength={2_000}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="meeting-language">
              {isItalian ? "Lingua" : "Language"}
            </label>
            <select
              id="meeting-language"
              className="input"
              value={language}
              onChange={(event) => setLanguage(event.target.value as MeetingLanguage)}
            >
              {!usesTeamsCaptions && <option value="auto">{isItalian ? "Automatica · IT/EN" : "Automatic · IT/EN"}</option>}
              <option value="it">Italiano</option>
              <option value="en">English</option>
            </select>
            {usesTeamsCaptions && <p className="mt-2 text-sm text-slate-500">
              {isItalian ? "Scegli la lingua parlata: la richiediamo anche a Teams. L’applicazione effettiva nei sottotitoli deve essere verificata." : "Choose the spoken language: we also request it from Teams. Its actual application to captions must be verified."}
            </p>}
          </div>
          <details className="rounded-xl border border-slate-200 p-4" data-testid="create-context" open={initialMeeting?.context ? true : undefined}>
            <summary className="cursor-pointer text-sm font-semibold text-[#295c43]">
              {mode === "series" ? isItalian ? "Contesto della serie" : "Series context" : isItalian ? "Note per questo meeting" : "Notes for this meeting"}
              <span className="ml-2 text-xs font-normal text-slate-500">{context.trim() ? isItalian ? "Aggiunto" : "Added" : isItalian ? "Facoltativo" : "Optional"}</span>
            </summary>
            <p className="mt-3 text-sm leading-6 text-slate-500">{isItalian
              ? "Il contesto generale è già incluso. Aggiungi qui solo informazioni specifiche, terminologia o vincoli. Potrai modificarle anche dopo."
              : "General context is already included. Add only specific background, terminology or constraints here. You can edit these later."}</p>
            <label className="label mt-3" htmlFor="meeting-context">{mode === "series" ? isItalian ? "Informazioni condivise dalla serie" : "Shared series background" : isItalian ? "Informazioni per questo appuntamento" : "Background for this appointment"}</label>
            <textarea id="meeting-context" className="input min-h-28 resize-y" maxLength={CONTEXT_MAX_LENGTH} value={context} onChange={event => setContext(event.target.value)} />
            <p className="mt-2 text-xs text-slate-500">{context.length} / {CONTEXT_MAX_LENGTH} · {isItalian ? "Niente password o chiavi API." : "No passwords or API keys."}</p>
          </details>
        </div>
      </section>

      <section className="card p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">
              {mode === "series"
                ? isItalian
                  ? `${appointments.length} ${appointments.length === 1 ? "appuntamento" : "appuntamenti"}`
                  : `${appointments.length} ${appointments.length === 1 ? "appointment" : "appointments"}`
                : isItalian
                  ? "Quando deve entrare"
                  : "When to join"}
            </h2>
          </div>
          {mode === "series" && appointments.length < 24 && (
            <button type="button" onClick={addAppointment} className="button-secondary">
              <span aria-hidden="true">＋</span>{" "}
              {isItalian ? "Aggiungi appuntamento" : "Add appointment"}
            </button>
          )}
        </div>

        {mode === "single" && automaticEntryReady && (
          <fieldset className="mt-6">
            <legend className="label">
              {isItalian ? "Quando deve entrare" : "When should it join"}
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setTiming("now");
                  setAutoJoin(true);
                }}
                aria-pressed={timing === "now"}
                className={`rounded-xl border p-4 text-left transition ${
                  timing === "now"
                    ? "border-[#6e9a7d] bg-[#e9f2ec] text-[#204d36]"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                <strong className="block text-sm">
                  {isItalian ? "Entra ora" : "Join now"}
                </strong>
                <span className="mt-1 block text-xs leading-5">
                  {isItalian
                    ? "Entra appena salvi il meeting."
                    : "Join as soon as you save the meeting."}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setTiming("scheduled")}
                aria-pressed={timing === "scheduled"}
                className={`rounded-xl border p-4 text-left transition ${
                  timing === "scheduled"
                    ? "border-[#6e9a7d] bg-[#e9f2ec] text-[#204d36]"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                <strong className="block text-sm">
                  {isItalian ? "Pianifica" : "Schedule"}
                </strong>
                <span className="mt-1 block text-xs leading-5">
                  {isItalian
                    ? "Scegli data, ora e durata."
                    : "Choose the date, time and duration."}
                </span>
              </button>
            </div>
          </fieldset>
        )}

        {(mode === "series" || timing === "scheduled") && <div className="mt-6 space-y-4">
          {appointments.map((appointment, index) => (
            <fieldset key={appointment.key} className="rounded-2xl border border-slate-200 bg-[#fafbf9] p-4 sm:p-5">
              <legend className="sr-only">
                {isItalian ? `Appuntamento ${index + 1}` : `Appointment ${index + 1}`}
              </legend>
              {mode === "series" && <div className="mb-4 flex items-center justify-between gap-3">
                <span className="flex size-8 items-center justify-center rounded-full bg-[#e4eee7] text-sm font-bold text-[#295c43]">
                  {index + 1}
                </span>
                {mode === "series" && appointments.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeAppointment(appointment.key)}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                  >
                    {isItalian ? "Rimuovi" : "Remove"}
                  </button>
                )}
              </div>}
              <div className="grid gap-4 sm:grid-cols-2">
                {mode === "series" && (
                  <div className="sm:col-span-2">
                    <label className="label" htmlFor={`${appointment.key}-label`}>
                      {isItalian ? "Nome appuntamento" : "Appointment name"}
                      <span className="ml-1 font-normal text-slate-400">
                        {isItalian ? "facoltativo" : "optional"}
                      </span>
                    </label>
                    <input
                      id={`${appointment.key}-label`}
                      className="input"
                      value={appointment.label}
                      onChange={(event) => updateAppointment(appointment.key, "label", event.target.value)}
                      placeholder={isItalian ? "Kickoff, revisione, follow-up…" : "Kickoff, review, follow-up…"}
                      maxLength={120}
                    />
                  </div>
                )}
                {mode === "series" && <div className="sm:col-span-2">
                  <label className="label" htmlFor={`${appointment.key}-url`}>
                    {isItalian ? "Link Microsoft Teams" : "Microsoft Teams link"}
                  </label>
                  <input
                    id={`${appointment.key}-url`}
                    type="url"
                    className="input"
                    value={appointment.meetingUrl}
                    onChange={(event) => updateAppointment(appointment.key, "meetingUrl", event.target.value)}
                    placeholder="https://teams.microsoft.com/l/meetup-join/..."
                    required
                  />
                </div>}
                {(mode === "series" || timing === "scheduled") && (
                  <>
                    <div>
                      <label className="label" htmlFor={`${appointment.key}-start`}>
                        {isItalian ? "Data e ora" : "Date and time"}
                      </label>
                      <input
                        id={`${appointment.key}-start`}
                        type="datetime-local"
                        className="input"
                        value={appointment.scheduledStart}
                        onChange={(event) => updateAppointment(appointment.key, "scheduledStart", event.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor={`${appointment.key}-duration`}>
                        {isItalian ? "Durata" : "Duration"}
                      </label>
                      <select
                        id={`${appointment.key}-duration`}
                        className="input"
                        value={appointment.durationMinutes}
                        onChange={(event) => updateAppointment(appointment.key, "durationMinutes", Number(event.target.value))}
                      >
                        <option value={30}>30 min</option>
                        <option value={45}>45 min</option>
                        <option value={60}>60 min</option>
                        <option value={90}>90 min</option>
                        <option value={120}>120 min</option>
                      </select>
                    </div>
                  </>
                )}
              </div>
            </fieldset>
          ))}
        </div>}
      </section>

      <details className="card group p-5 sm:p-7" data-testid="create-agenda" open={Boolean(initialMeeting?.agenda.length)}>
        <summary className="cursor-pointer text-lg font-semibold">
          {isItalian ? "Scaletta" : "Agenda"} <span className="text-sm font-normal text-slate-500">· {agenda.some(item => item.title.trim())
            ? `${agenda.filter(item => item.title.trim()).length} ${isItalian ? "punti" : "items"}`
            : isItalian ? "facoltativa" : "optional"}</span>
        </summary>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">{isItalian ? "Indica i punti da affrontare e quelli obbligatori." : "Add topics and mark any mandatory items."}</p>
          {agenda.length < 20 && (
            <button type="button" onClick={addAgendaItem} className="button-secondary">
              <span aria-hidden="true">＋</span> {isItalian ? "Aggiungi punto" : "Add item"}
            </button>
          )}
        </div>
        <div className="mt-6 space-y-3">
          {agenda.map((item, index) => (
            <div key={item.key} className="grid gap-3 rounded-xl border border-slate-200 bg-[#fafbf9] p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-center">
              <span className="flex size-8 items-center justify-center rounded-full bg-[#e4eee7] text-xs font-bold text-[#295c43]">{index + 1}</span>
              <label className="min-w-0">
                <span className="sr-only">{isItalian ? `Punto ${index + 1}` : `Item ${index + 1}`}</span>
                <input className="input" value={item.title} onChange={(event) => updateAgendaItem(item.key, { title: event.target.value })} placeholder={isItalian ? "Es. Approvare la roadmap" : "E.g. Approve the roadmap"} maxLength={500} />
              </label>
              <label className="flex items-center gap-2 whitespace-nowrap text-sm font-medium text-slate-600">
                <input type="checkbox" checked={item.mandatory} onChange={(event) => updateAgendaItem(item.key, { mandatory: event.target.checked })} className="size-4 accent-[#295c43]" />
                {isItalian ? "Obbligatorio" : "Mandatory"}
              </label>
              <button type="button" onClick={() => removeAgendaItem(item.key)} className="rounded-lg px-2.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50" aria-label={isItalian ? `Rimuovi punto ${index + 1}` : `Remove item ${index + 1}`}>×</button>
            </div>
          ))}
          {!agenda.length && <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">{isItalian ? "Nessun punto: puoi aggiungerne uno." : "No items: add one when ready."}</p>}
        </div>
      </details>

      {mode === "series" && (
        <div className="rounded-2xl border border-[#bfd5c5] bg-[#eef5f0] p-5">
          <p className="text-sm font-semibold text-[#204d36]">
            {isItalian ? "Memoria unica della serie" : "One memory for the series"}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {isItalian
              ? "Decisioni, attività aperte e domande passeranno automaticamente da un appuntamento al successivo, anche usando link Teams diversi."
              : "Decisions, open actions and questions move automatically from one appointment to the next, even across different Teams links."}
          </p>
        </div>
      )}

      <details className="card group overflow-hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 hover:bg-[#fafcf9] sm:p-6">
          <div>
            <h2 className="text-lg font-semibold">
              {isItalian ? "Ingresso e interventi" : "Entry and contributions"}
            </h2>
          </div>
          <span aria-hidden="true" className="text-lg text-slate-400 transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <div className="grid gap-5 border-t border-slate-100 p-5 sm:grid-cols-2 sm:p-6">
          <div>
            <label className="label" htmlFor="meeting-correction-policy">
              {isItalian ? "Correzione delle inesattezze" : "Inaccuracy correction"}
            </label>
            <select
              id="meeting-correction-policy"
              className="input"
              value={correctionPolicy}
              onChange={(event) => setCorrectionPolicy(event.target.value as CorrectionPolicy)}
            >
              <option value="important_only">{isItalian ? "Alza la mano solo se è importante" : "Raise its hand only when important"}</option>
              <option value="on_request">{isItalian ? "Correggi solo su richiesta" : "Correct only when asked"}</option>
              <option value="off">{isItalian ? "Non intervenire" : "Do not intervene"}</option>
            </select>
          </div>
          {automaticEntryReady && mode === "single" && timing === "now" ? (
            <div className="rounded-xl bg-[#f3f7f4] p-4 sm:col-span-2">
              <p className="text-sm font-semibold text-[#204d36]">
                {isItalian ? "Ingresso immediato" : "Immediate entry"}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {isItalian
                  ? "Il collega digitale entrerà appena salvi. Se trova una sala d’attesa, dovrai ammetterlo."
                  : "The digital colleague will join as soon as you save. If it reaches a lobby, you will need to admit it."}
              </p>
            </div>
          ) : automaticEntryReady ? (
            <label className="flex items-start gap-3 rounded-xl bg-[#f3f7f4] p-4 sm:col-span-2">
              <input
                type="checkbox"
                checked={autoJoin}
                onChange={(event) => setAutoJoin(event.target.checked)}
                className="mt-0.5 size-4 accent-[#295c43]"
              />
              <span>
                <span className="block text-sm font-semibold">
                  {isItalian
                    ? "Programma l’ingresso automatico"
                    : "Schedule automatic join"}
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  {isItalian
                    ? "Il collega digitale entrerà all’orario indicato. Se trova una sala d’attesa, dovrai ammetterlo."
                    : "The digital colleague will join at the selected time. If it reaches a lobby, you will need to admit it."}
                </span>
              </span>
            </label>
          ) : null}
          {correctionPolicy === "important_only" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 sm:col-span-2">
              <p className="text-sm font-semibold text-amber-950">
                {isItalian ? "Non interrompe la conversazione" : "It does not interrupt the conversation"}
              </p>
              <p className="mt-1 text-xs leading-5 text-amber-900/75">
                {isItalian
                  ? `Se ${assistantName} rileva un errore importante o possiede un’informazione davvero utile, alza la mano. Parla soltanto dopo che qualcuno gli dice “${assistantName}, vai pure”.`
                  : `If ${assistantName} notices an important error or has genuinely useful information, it raises its hand. It speaks only after someone says “${assistantName}, go ahead”.`}
              </p>
            </div>
          )}
        </div>
      </details>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-[#d9e4da] bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-slate-500 sm:max-w-xl">
          {timing === "now"
            ? isItalian ? `Dopo il salvataggio ${assistantName} proverà a entrare. Se necessario, ammettilo in Teams.` : `After saving, ${assistantName} will try to join. Admit it in Teams if needed.`
            : autoJoin
              ? isItalian ? `${assistantName} proverà a entrare all’orario indicato. Potrebbe servire la tua ammissione in Teams.` : `${assistantName} will try to join at the scheduled time. Teams may require you to admit it.`
              : isItalian ? "Salva l’appuntamento senza avviare l’ingresso dell’avatar." : "Save the appointment without starting avatar entry."}
        </p>
        <button type="submit" className="button-primary min-w-44" disabled={submitting}>
          {submitting
            ? isItalian
              ? "Salvataggio…"
              : "Saving…"
            : mode === "series"
              ? isItalian
                ? "Crea serie"
                : "Create series"
              : isItalian
                ? timing === "now"
                  ? "Salva e fai entrare"
                  : "Memorizza meeting"
                : timing === "now"
                  ? "Save and join"
                  : "Save meeting"}
        </button>
      </div>
      </fieldset>
    </form>
  );
}
