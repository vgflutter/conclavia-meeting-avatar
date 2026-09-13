"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "@/i18n/I18nProvider";
import { CONTEXT_MAX_LENGTH, type ContextScope, type ContextValue } from "@/lib/assistant-context";

export interface InheritedContext { label: string; context: string; href: string }

export function AssistantContextEditor({ scope, resourceId, initial, inherited = [] }: {
  scope: ContextScope; resourceId?: string; initial: ContextValue; inherited?: InheritedContext[];
}) {
  const { locale } = useTranslations();
  const it = locale === "it";
  const router = useRouter();
  const id = useId();
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial.context);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error" | "conflict">("idle");
  const dirty = draft !== saved.context;
  const endpoint = `/api/context?${new URLSearchParams({ scope, ...(resourceId ? { id: resourceId } : {}) })}`;
  const label = scope === "global" ? it ? "Contesto generale" : "General context"
    : scope === "series" ? it ? "Contesto della serie" : "Series context"
      : it ? "Note per questo meeting" : "Notes for this meeting";

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (lock.current || !dirty) return;
    lock.current = true; setBusy(true);
    try {
      const response = await fetch(endpoint, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: draft, version: saved.version }),
        signal: AbortSignal.timeout(10_000),
      });
      if (response.status === 409) { setStatus("conflict"); return; }
      if (!response.ok) throw new Error("Save failed");
      const value = await response.json() as ContextValue;
      setSaved(value); setDraft(value.context); setStatus("saved"); router.refresh();
    } catch { setStatus("error"); }
    finally { lock.current = false; setBusy(false); }
  }

  async function reloadSaved() {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      const response = await fetch(endpoint, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error("Load failed");
      // Preserve the draft for comparison; the next explicit save uses the latest revision.
      setSaved(await response.json() as ContextValue); setStatus("idle"); router.refresh();
    } catch { setStatus("error"); }
    finally { lock.current = false; setBusy(false); }
  }

  return <div data-testid={`context-editor-${scope}`} className="min-w-0 space-y-4">
    {inherited.length > 0 && <details className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <summary className="cursor-pointer text-sm font-medium text-[#295c43]">{it ? "Contesto già incluso" : "Already included context"}</summary>
      <div className="mt-3 space-y-4">{inherited.map(item => <div key={item.href}>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <strong>{item.label}</strong><Link className="text-[#295c43] underline" href={item.href} target="_blank" rel="noopener noreferrer">{it ? "Modifica alla fonte ↗" : "Edit at source ↗"}</Link>
        </div>
        <p className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-sm text-slate-600">{item.context || (it ? "Non impostato." : "Not set.")}</p>
      </div>)}</div>
    </details>}
    <form onSubmit={save} className="space-y-3">
      <label htmlFor={id} className="label">{label}</label>
      <p id={`${id}-help`} className="text-sm leading-6 text-slate-500">{scope === "global"
        ? it ? "Azienda, prodotti, terminologia e preferenze. Disponibile in tutti i meeting." : "Company, products, terminology and preferences. Available in every meeting."
        : scope === "series" ? it ? "Progetto, vincoli e informazioni comuni a tutti gli appuntamenti di questa serie." : "Project, constraints and background shared by every appointment in this series."
          : it ? "Aggiungi solo ciò che serve a questo appuntamento. Il contesto generale e quello della serie sono già inclusi." : "Add only what this appointment needs. General and series context are already included."}</p>
      <textarea id={id} aria-describedby={`${id}-help ${id}-count`} rows={scope === "global" ? 9 : 5}
        className="input resize-y" maxLength={CONTEXT_MAX_LENGTH} value={draft} disabled={busy}
        onChange={event => { setDraft(event.target.value); if (status !== "conflict") setStatus("idle"); }}
        placeholder={it ? "Es. Il progetto Aurora serve il mercato italiano. Per MVP intendiamo la prima versione utilizzabile dal cliente." : "E.g. Project Aurora serves the Italian market. MVP means the first version the customer can use."} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>{it ? "Non inserire password o chiavi API." : "Do not enter passwords or API keys."}</span>
        <span id={`${id}-count`}>{draft.length} / {CONTEXT_MAX_LENGTH}</span>
      </div>
      {status === "conflict" && <div role="alert" className="space-y-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
        <p>{it ? "Il contesto è cambiato in un’altra finestra. La tua bozza è conservata: carica la versione aggiornata per confrontarla prima di salvare." : "Context changed in another window. Your draft is preserved: load the latest version to compare before saving."}</p>
        <button type="button" className="underline" disabled={busy} onClick={() => void reloadSaved()}>{it ? "Carica versione aggiornata" : "Load latest version"}</button>
      </div>}
      {status === "error" && <p role="alert" className="text-sm text-red-700">{it ? "Operazione non riuscita. La bozza è ancora qui: riprova." : "Operation failed. Your draft is still here: please retry."}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button className="button-primary disabled:opacity-50" disabled={busy || !dirty || status === "conflict"}>{busy ? it ? "Attendi…" : "Please wait…" : it ? "Salva contesto" : "Save context"}</button>
        {dirty && <button type="button" className="button-secondary" disabled={busy} onClick={() => { setDraft(saved.context); setStatus("idle"); }}>{it ? "Annulla modifiche" : "Discard changes"}</button>}
        <span role="status" className="text-xs text-slate-500">{dirty ? it ? "Modifiche non salvate" : "Unsaved changes" : status === "saved" ? it ? "Salvato. Vale dalla prossima elaborazione." : "Saved. Applies from the next generation." : it ? "Nessuna modifica da salvare" : "No unsaved changes"}</span>
      </div>
      {dirty && <details className="text-sm text-slate-500"><summary className="cursor-pointer">{it ? "Versione salvata" : "Saved version"}</summary><p className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words">{saved.context || (it ? "Vuota" : "Empty")}</p></details>}
    </form>
  </div>;
}
