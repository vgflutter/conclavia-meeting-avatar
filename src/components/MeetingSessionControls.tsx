"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useTranslations } from "@/i18n/I18nProvider";
import { attendeeAttemptFinished, meetingEntryError } from "@/lib/meeting-entry-policy";
import { meetingOutputReadiness } from "@/lib/meeting-output-health";
import { CAPTION_LANGUAGE_MAX_ATTEMPTS } from "@/lib/meeting-caption-language";
import type { MeetingResponse, MeetingStatus } from "@/types/meeting";
import type { MeetingAutomationPublicConfig } from "@/types/meeting-automation";

export function MeetingSessionControls({
  meetingId,
  status,
  autoJoin,
  bot,
  automation,
}: {
  meetingId: string;
  status: MeetingStatus;
  autoJoin: boolean;
  bot: MeetingResponse["bot"];
  automation: MeetingAutomationPublicConfig;
}) {
  const router = useRouter();
  const { locale } = useTranslations();
  const isItalian = locale === "it";
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!["scheduling", "scheduled", "joining", "waiting_room", "joined", "leaving"].includes(bot.status) &&
        !(bot.entryAttemptId && bot.externalBotId && !attendeeAttemptFinished(bot))) {
      return;
    }
    const timer = window.setInterval(() => router.refresh(), 5_000);
    return () => window.clearInterval(timer);
  }, [bot, router]);

  async function runAction(action: "join" | "schedule" | "leave" | "refresh_output") {
    setPending(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/meetings/${meetingId}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json()) as { meeting?: unknown; code?: string };
      if (payload.code === "output_unavailable") {
        setError(isItalian ? "L’avatar non è raggiungibile. Il collegamento del servizio deve essere ripristinato." : "The avatar is unreachable. The service connection must be restored.");
        return;
      }
      if (payload.code === "output_not_active") {
        setError(isItalian ? "Il collega non è più nel meeting. Avvia un nuovo ingresso." : "The colleague is no longer in the meeting. Start a new entry.");
        router.refresh();
        return;
      }
      if (!response.ok || !payload.meeting) throw new Error();
      router.refresh();
    } catch {
      setError(
        isItalian
          ? "Non siamo riusciti ad aggiornare l’ingresso. Riprova."
          : "We couldn’t update the meeting entry. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  const liveIntegration = automation.state === "ready";
  const active = ["scheduling", "joining", "waiting_room", "joined"].includes(bot.status);
  const scheduled = bot.status === "scheduled";
  const stopping = bot.status === "leaving" || Boolean((bot.stopRequestedAt || bot.leftAt) && !attendeeAttemptFinished(bot));
  const exitConfirmed = Boolean(bot.leftAt && ["ended", "fatal_error", "cancelled"].includes(bot.providerStatusCode?.split(":")[0] || ""));
  const failed = bot.status === "failed" || status === "failed";
  const outputReadiness = meetingOutputReadiness(bot);

  if (!liveIntegration && !active && !stopping && !failed && !scheduled) return null;

  return (
    <div className="space-y-3">
      {status === "live" && !stopping && bot.captionLanguage && !bot.captionLanguageRequestedAt && (
        <p role="status" data-testid="caption-language-status" className="rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-900">
          {(bot.captionLanguageAttempts || 0) >= CAPTION_LANGUAGE_MAX_ATTEMPTS
            ? isItalian ? "Non è stato possibile impostare la lingua dei sottotitoli. Controllala in Teams: i richiami vocali potrebbero non essere riconosciuti." : "Could not set the caption language. Check it in Teams: voice commands may not be recognized."
            : isItalian ? "Stiamo impostando la lingua dei sottotitoli per l’ascolto." : "Setting the caption language for listening."}
        </p>
      )}
      <>
          {stopping ? (
            <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-900">
              {isItalian
                ? "Uscita in corso. Attendiamo la conferma prima di consentire un nuovo tentativo."
                : "Leaving the meeting. We are waiting for confirmation before allowing another attempt."}
            </p>
          ) : active ? (
            <button
              type="button"
              onClick={() => runAction("leave")}
              disabled={pending}
              className="button-primary w-full bg-[#9a3d24]! hover:bg-[#7c2f1c]!"
            >
              {pending
                ? isItalian
                  ? "Uscita in corso…"
                  : "Leaving…"
                : isItalian
                  ? "Fai uscire dal meeting"
                  : "Remove from meeting"}
            </button>
          ) : scheduled ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
              {isItalian ? "Ingresso automatico programmato" : "Automatic entry scheduled"}
            </div>
          ) : autoJoin && (failed || bot.status === "not_scheduled") ? (
            <button
              type="button"
              onClick={() => runAction("schedule")}
              disabled={pending || !liveIntegration || bot.failureCode === "create_uncertain"}
              className="button-primary w-full"
            >
              {pending
                ? isItalian
                  ? "Programmazione…"
                  : "Scheduling…"
                : isItalian
                  ? "Riprova programmazione"
                  : "Retry scheduling"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => runAction("join")}
              disabled={pending || !liveIntegration || status === "completed" || status === "cancelled" || bot.failureCode === "create_uncertain"}
              className="button-primary w-full"
            >
              {pending
                ? isItalian
                  ? "Accesso in corso…"
                  : "Joining…"
                : isItalian
                  ? "Fai entrare ora"
                  : "Join now"}
            </button>
          )}

          {exitConfirmed && (
            <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
              {isItalian ? "Il collega è uscito dal meeting." : "The colleague has left the meeting."}
            </p>
          )}

          {bot.accountEmail && (
            <p className="break-all text-xs font-medium leading-5 text-[#295c43]">
              {isItalian ? "Identità: " : "Identity: "}
              {bot.accountEmail}
            </p>
          )}
          {bot.provider === "attendee" && bot.status === "joined" && !stopping && (
            <div className="space-y-2" data-testid="output-readiness" data-readiness={outputReadiness}>
              <p role="status" className={`rounded-xl p-3 text-sm leading-6 ${outputReadiness === "ready" ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>
                {outputReadiness === "ready"
                  ? isItalian ? "Avatar caricato e voce pronta." : "Avatar loaded and voice ready."
                  : outputReadiness === "preparing"
                    ? isItalian ? "Avatar caricato. La voce si sta preparando." : "Avatar loaded. The voice is preparing."
                    : isItalian ? "Il collega è entrato, ma l’avatar non conferma il collegamento. Video e voce non sono ancora verificati." : "The colleague has joined, but the avatar is not confirming its connection. Video and voice are not yet verified."}
              </p>
              {outputReadiness === "missing" && (
                <button type="button" disabled={pending} onClick={() => runAction("refresh_output")} className="button-secondary w-full">
                  {pending ? isItalian ? "Verifica…" : "Checking…" : isItalian ? "Ripristina avatar" : "Restore avatar"}
                </button>
              )}
            </div>
          )}
          {bot.status === "waiting_room" && (
            <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              {isItalian
                ? "Il collega digitale è nella sala d’attesa. Un partecipante deve ammetterlo."
                : "The digital colleague is in the waiting room. A participant must admit it."}
            </p>
          )}
          {["scheduling", "joining", "waiting_room"].includes(bot.status) && !stopping && (
            <p className="text-xs leading-5 text-slate-600">
              {bot.joinedAt
                ? isItalian
                  ? "Ammissione confermata. Stiamo avviando l’ascolto: il collega non è ancora operativo."
                  : "Admission confirmed. We are starting meeting listening: the colleague is not operational yet."
                : isItalian
                  ? "Stiamo completando l’ingresso. Tieni aperto il meeting e ammetti il collega se compare in sala d’attesa. Dopo circa due minuti senza conferma dal servizio, interrompiamo il tentativo."
                  : "We are completing entry. Keep the meeting open and admit the colleague if it appears in the lobby. After about two minutes without service confirmation, we stop the attempt."}
            </p>
          )}
      </>

      {(error || (bot.lastError && !((stopping || exitConfirmed) && bot.failureCode === "entry_cancelled"))) && (
        <p className="rounded-xl bg-red-50 p-3 text-xs leading-5 text-red-800">
          {error || meetingEntryError(bot.failureCode, isItalian) || bot.lastError}
        </p>
      )}
    </div>
  );
}
