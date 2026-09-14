"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "@/i18n/I18nProvider";
import type { MeetingParticipantStatus as ParticipantStatus } from "@/lib/meeting-participants";

export function MeetingParticipantStatus({ meetingId, initial }: { meetingId: string; initial?: ParticipantStatus }) {
  const { locale } = useTranslations();
  const italian = locale === "it";
  const [status, setStatus] = useState<ParticipantStatus>(initial || { state: "unverified", names: [], collisions: [], voiceBlocked: false });
  const [unreachable, setUnreachable] = useState(false);
  useEffect(() => {
    let disposed = false;
    let pending = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const response = await fetch(`/api/meetings/${meetingId}/participants`, {
          cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8_000)]),
        });
        if (!response.ok) throw new Error();
        const payload = await response.json() as { participantStatus: ParticipantStatus };
        if (!disposed) { setStatus(payload.participantStatus); setUnreachable(false); }
      } catch { if (!disposed) setUnreachable(true); }
      finally { pending = false; }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 5_000);
    return () => { disposed = true; controller.abort(); clearInterval(timer); };
  }, [meetingId]);
  if (status.state === "inactive") return null;
  const verified = status.state === "synced" && !unreachable;
  return (
    <div data-testid="participant-status" data-state={unreachable ? "stale" : status.state}
      className={`rounded-xl p-3 text-xs leading-5 ${status.voiceBlocked ? "bg-amber-50 text-amber-900" : "bg-slate-50 text-slate-600"}`}>
      <p role="status">
        {status.voiceBlocked
          ? italian ? "Nome di richiamo ambiguo: comandi vocali sospesi." : "Ambiguous invocation name: voice commands paused."
          : verified
            ? italian ? "Nessun omonimo rilevato nell’elenco sincronizzato." : "No matching name detected in the synchronized list."
            : italian ? "Elenco partecipanti non verificato: non possiamo escludere omonimi." : "Participant list unverified: matching names cannot be ruled out."}
      </p>
      {status.voiceBlocked && <p className="mt-1">
        {italian ? "Nome rilevato: " : "Detected name: "}{status.collisions.join(", ")}.{" "}
        {italian ? "Usa i comandi Assistente di questa pagina per rivolgerti all’avatar." : "Use this page’s Assistant controls to address the avatar."}
      </p>}
      {status.voiceBlocked && !verified && <p className="mt-1">
        {italian ? "Elenco da riverificare: il blocco resta finché l’uscita dell’omonimo non è confermata." : "The list needs rechecking: the block stays until the matching participant’s departure is confirmed."}
      </p>}
      {status.names.length > 0 && <details className="mt-2">
        <summary className="cursor-pointer font-medium">{italian ? "Partecipanti rilevati" : "Detected participants"} ({status.names.length})</summary>
        <ul className="mt-1 max-h-32 list-inside list-disc overflow-auto break-words">
          {status.names.map((name, index) => <li key={index}>{name}</li>)}
        </ul>
      </details>}
    </div>
  );
}
