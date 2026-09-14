"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useTranslations } from "@/i18n/I18nProvider";
import { attendeeAttemptFinished, meetingEntryError } from "@/lib/meeting-entry-policy";
import { meetingOutputReadiness } from "@/lib/meeting-output-health";
import { captionLanguageSetupStatus } from "@/lib/meeting-caption-language";
import type { MeetingResponse, MeetingStatus } from "@/types/meeting";
import type { MeetingAutomationPublicConfig } from "@/types/meeting-automation";
import { MeetingParticipantStatus } from "@/components/MeetingParticipantStatus";

export function MeetingSessionControls({
  meetingId,
  status,
  autoJoin,
  bot,
  automation,
  participantStatus,
}: {
  meetingId: string;
  status: MeetingStatus;
  autoJoin: boolean;
  bot: MeetingResponse["bot"];
  automation: MeetingAutomationPublicConfig;
  participantStatus?: MeetingResponse["participantStatus"];
}) {
  const router = useRouter();
  const { locale } = useTranslations();
  const isItalian = locale === "it";
  const [pendingAction, setPendingAction] = useState<"join" | "schedule" | "leave" | "refresh_output">();
  const pending = Boolean(pendingAction);
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
    setPendingAction(action);
    setError(undefined);
    try {
      const response = await fetch(`/api/meetings/${meetingId}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json()) as { meeting?: unknown; code?: string };
      const outputError = payload.code?.startsWith("output_") && meetingEntryError(payload.code, isItalian);
      if (outputError) {
        setError(outputError);
        router.refresh();
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
      setPendingAction(undefined);
    }
  }

  const liveIntegration = automation.state === "ready";
  const active = ["scheduling", "joining", "waiting_room", "joined"].includes(bot.status);
  const scheduled = bot.status === "scheduled";
  const stopping = bot.status === "leaving" || Boolean((bot.stopRequestedAt || bot.leftAt) && !attendeeAttemptFinished(bot));
  const exitConfirmed = Boolean(bot.leftAt && ["ended", "fatal_error", "cancelled"].includes(bot.providerStatusCode?.split(":")[0] || ""));
  const failed = bot.status === "failed" || status === "failed";
  const outputReadiness = meetingOutputReadiness(bot);
  const captionStatus = captionLanguageSetupStatus(bot);
  const captionLanguageLabel = bot.captionLanguage === "it-it" ? isItalian ? "italiano" : "Italian"
    : bot.captionLanguage === "en-us" ? isItalian ? "inglese" : "English" : undefined;

  if (!liveIntegration && !active && !stopping && !failed && !scheduled) return null;

  return (
    <div className="space-y-3">
      {status === "live" && !stopping && captionStatus && (
        <div data-testid="caption-language-status" data-state={captionStatus} className="rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-900">
          <p role="status">
            <span className="font-semibold">{isItalian ? "Lingua dell’ascolto Teams non verificata." : "Teams listening language is unverified."}</span>{" "}
            {captionStatus === "request_failed"
              ? isItalian ? "La richiesta di lingua dei sottotitoli non è stata confermata da Attendee." : "Attendee has not acknowledged the caption language request."
              : captionStatus === "requested_unverified"
                ? isItalian ? `Attendee ha ricevuto la richiesta per ${captionLanguageLabel}, ma non conferma quale lingua Teams stia usando.` : `Attendee received the request for ${captionLanguageLabel}, but does not confirm which language Teams is using.`
                : captionStatus === "request_pending"
                  ? isItalian ? `Richiesta per ${captionLanguageLabel} in corso.` : `Request for ${captionLanguageLabel} in progress.`
                  : isItalian ? "Questa sessione non ha una richiesta di lingua tracciata. Non viene riconfigurata automaticamente." : "This session has no tracked language request. It is not automatically reconfigured."}
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer font-semibold">{isItalian ? "Come verificare in Teams" : "How to check in Teams"}</summary>
            <p className="mt-2">{isItalian
              ? "Controlla la lingua parlata nelle impostazioni dei sottotitoli, non la lingua dell’app o della traduzione. Con la trascrizione attiva potrebbe servire l’organizzatore. I menu di Teams Free possono differire. Il controllo decisivo riguarda la sessione Teams del bot: una trascrizione corretta nel tuo client, da sola, non la verifica."
              : "Check the spoken language in caption settings, not the app or translation language. The organizer may be needed when transcription is active. Teams Free menus may differ. The decisive check concerns the bot’s Teams session: correct captions in your own client alone do not verify it."}</p>
            <a className="mt-2 inline-block underline" href="https://support.microsoft.com/en-us/teams/meetings/use-live-captions-in-microsoft-teams-meetings" target="_blank" rel="noreferrer">{isItalian ? "Guida Microsoft alla lingua parlata" : "Microsoft spoken-language guide"}</a>
          </details>
        </div>
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
                ? pendingAction === "leave"
                  ? isItalian ? "Uscita in corso…" : "Leaving…"
                  : isItalian ? "Verifica in corso…" : "Checking…"
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
                  ? "Verifica e programmazione…"
                  : "Checking and scheduling…"
                : isItalian
                  ? "Riprova ingresso"
                  : "Retry entry"}
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
                  ? "Verifica e ingresso…"
                  : "Checking and joining…"
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
              {bot.status === "scheduling" && !bot.externalBotId
                ? isItalian
                  ? "Verifica del collegamento avatar e richiesta d’ingresso in corso. Il controllo dell’avatar dura al massimo 45 secondi; l’ammissione su Teams non è ancora confermata."
                  : "Checking the avatar connection and requesting entry. The avatar check takes at most 45 seconds; Teams admission is not yet confirmed."
                : bot.joinedAt
                ? isItalian
                  ? "Ammissione confermata. Stiamo avviando l’ascolto: il collega non è ancora operativo."
                  : "Admission confirmed. We are starting meeting listening: the colleague is not operational yet."
                : isItalian
                  ? "Stiamo completando l’ingresso. Tieni aperto il meeting e ammetti il collega se compare in sala d’attesa. Dopo circa due minuti senza conferma dal servizio, interrompiamo il tentativo."
                  : "We are completing entry. Keep the meeting open and admit the colleague if it appears in the lobby. After about two minutes without service confirmation, we stop the attempt."}
            </p>
          )}
      </>

      {bot.provider === "attendee" && bot.status === "joined" && !stopping && (
        <MeetingParticipantStatus key={`${meetingId}:${bot.entryAttemptId}`} meetingId={meetingId} initial={participantStatus} />
      )}

      {(error || (bot.lastError && !((stopping || exitConfirmed) && bot.failureCode === "entry_cancelled"))) && (
        <p className="rounded-xl bg-red-50 p-3 text-xs leading-5 text-red-800">
          {error || meetingEntryError(bot.failureCode, isItalian) || bot.lastError}
          {!bot.externalBotId && bot.status === "failed" && bot.failureCode?.startsWith("output_") && (
            <span className="mt-2 block" data-testid="entry-not-sent">
              {isItalian ? "Nessun bot è stato inviato. Puoi riprovare da questo meeting, senza ricrearlo." : "No bot was sent. You can retry this meeting without recreating it."}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
