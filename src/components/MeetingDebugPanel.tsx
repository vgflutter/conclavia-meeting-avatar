"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import { useTranslations } from "@/i18n/I18nProvider";
import { MEETING_DEBUG_EVENT_LIMIT, type MeetingDebugResponse } from "@/types/meeting-debug";
import type { TurnReason } from "@/lib/meeting-speaking-turn";
import { groupMeetingDebugEvents } from "@/lib/meeting-debug-grouping";

const turnLabels: Record<TurnReason, [string, string]> = {
  unnamed: ["Nessun richiamo all’avatar", "Avatar not called"],
  ambiguous_recipient: ["Destinatario ambiguo: omonimo presente", "Ambiguous recipient: namesake present"],
  quoted_or_reported: ["Citazione o discorso riportato: nessun turno concesso", "Quoted or reported speech: no turn granted"],
  awaiting_invitation: ["Intervento pronto, in attesa del turno", "Contribution ready, awaiting a turn"],
  named_grant: ["Consenso riconosciuto", "Floor granted"],
  named_request: ["Nuova richiesta riconosciuta", "New request recognized"],
  declined: ["Intervento annullato su richiesta", "Contribution dismissed on request"],
  deferred: ["Permesso rinviato: resto in attesa", "Permission deferred: still waiting"],
  no_pending_turn: ["Nessun intervento in attesa da riprendere", "No pending contribution to resume"],
  not_addressed: ["Nessun invito inequivocabile all’avatar", "No unambiguous invitation to the avatar"],
  semantic_unavailable: ["Intenzione non risolta: nessuna risposta avviata", "Intent unresolved: no response started"],
  stale_turn: ["Turno già gestito o non più valido", "Turn already handled or no longer valid"],
};

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

function pageIsVisible() { return document.visibilityState === "visible"; }
function serverIsVisible() { return false; }

function LiveConversation({ meetingId }: { meetingId: string }) {
  const { locale } = useTranslations();
  const isItalian = locale === "it";
  const visible = useSyncExternalStore(subscribeVisibility, pageIsVisible, serverIsVisible);
  const [conversation, setConversation] = useState<MeetingDebugResponse>();
  const [checkedAt, setCheckedAt] = useState<Date>();
  const [error, setError] = useState(false);
  const [following, setFollowing] = useState(true);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    let etag: string | undefined;

    async function poll() {
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 8_000);
      let retry = false;
      try {
        const response = await fetch(`/api/meetings/${meetingId}/debug`, {
          cache: "no-store",
          signal: controller.signal,
          headers: etag ? { "If-None-Match": etag } : undefined,
        });
        if (response.status !== 304) {
          if (!response.ok) throw new Error();
          const payload = await response.json() as MeetingDebugResponse;
          if (disposed) return;
          setConversation(payload);
          etag = response.headers.get("etag") || undefined;
        }
        if (!disposed) {
          setCheckedAt(new Date());
          setError(false);
        }
      } catch {
        retry = true;
        if (!disposed) setError(true);
      } finally {
        clearTimeout(timeout);
        if (!disposed) timer = setTimeout(poll, retry ? 3_000 : 1_000);
      }
    }

    void poll();
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [meetingId, visible]);

  useEffect(() => {
    if (following && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [conversation, following]);

  const time = (date: Date | string) => new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-GB", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).format(new Date(date));

  return (
    <div className="border-t border-slate-100 p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <p className="flex items-center gap-2">
          <span aria-hidden="true" className={`size-2 rounded-full ${error || !visible ? "bg-amber-500" : checkedAt ? "bg-emerald-500" : "bg-slate-300"}`} />
          {!visible
            ? isItalian ? "Aggiornamenti in pausa" : "Updates paused"
            : error
              ? isItalian ? "Aggiornamento interrotto" : "Updates interrupted"
              : checkedAt
                ? `${isItalian ? "Aggiornato alle" : "Updated at"} ${time(checkedAt)}`
                : isItalian ? "Caricamento conversazione…" : "Loading conversation…"}
        </p>
        {!following && (
          <button type="button" onClick={() => setFollowing(true)} className="rounded-lg px-2 py-1 font-semibold text-[#295c43] hover:bg-[#edf4ef]">
            {isItalian ? "Vai agli ultimi messaggi ↓" : "Jump to latest messages ↓"}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          {isItalian
            ? "Non riusciamo ad aggiornare la conversazione. Riproviamo automaticamente; i messaggi già ricevuti restano visibili."
            : "We can’t update the conversation. Retrying automatically; messages already received remain visible."}
        </p>
      )}
      <div
        ref={scroller}
        role="log"
        aria-label={isItalian ? "Conversazione in diretta" : "Live conversation"}
        aria-live={following ? "polite" : "off"}
        tabIndex={0}
        onScroll={(event) => {
          const node = event.currentTarget;
          setFollowing(node.scrollHeight - node.scrollTop - node.clientHeight < 48);
        }}
        className="max-h-96 space-y-3 overflow-y-auto overscroll-contain rounded-xl bg-[#f6f8f6] p-3 outline-offset-2 sm:p-4"
      >
        {conversation?.hasEarlierEvents && (
          <p className="text-xs text-slate-500">
            {isItalian ? `Sono mostrati gli ultimi ${MEETING_DEBUG_EVENT_LIMIT} messaggi.` : `Showing the latest ${MEETING_DEBUG_EVENT_LIMIT} messages.`}
          </p>
        )}
        {conversation?.events.length === 0 && (
          <p className="py-6 text-center text-sm leading-6 text-slate-500">
            {isItalian
              ? "Nessun intervento ricevuto. I messaggi appariranno qui appena disponibili."
              : "No contributions received. Messages will appear here as they become available."}
          </p>
        )}
        {conversation && groupMeetingDebugEvents(conversation.events).map(({ event, transcripts }) => (
          <article key={event.id} className={`rounded-xl border p-3 sm:p-4 ${event.kind === "response" ? "border-[#d3e4d8] bg-[#edf4ef]" : "border-slate-100 bg-white"}`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className="break-words font-semibold text-[#295c43]">{event.source === "suspected_echo" ? isItalian ? "Possibile eco dell’avatar" : "Possible avatar echo" : event.speakerName}</span>
              <span className="text-slate-500">{event.kind === "response" ? isItalian ? "Risposta" : "Response" : event.source === "avatar" ? isItalian ? "Trascrizione avatar" : "Avatar transcript" : event.source === "suspected_echo" ? isItalian ? "Attribuzione incerta" : "Uncertain attribution" : isItalian ? "Intervento" : "Contribution"}</span>
              <time dateTime={event.createdAt} className="ml-auto text-slate-500">{time(event.createdAt)}</time>
            </div>
            {event.prompt && <p className="mt-2 break-words text-xs leading-5 text-slate-500">{isItalian ? "Richiesta: " : "Request: "}{event.prompt}</p>}
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{event.text}</p>
            {event.turnDecision && <p className="mt-2 text-xs text-slate-500">
              {turnLabels[event.turnDecision.reason]?.[isItalian ? 0 : 1]}
              {event.turnDecision.method === "semantic" ? isItalian ? " · Interpretazione del contesto" : " · Context interpretation" : ""}
            </p>}
            {event.interventionDecision && <details className="mt-2 text-xs text-slate-500">
              <summary className="cursor-pointer">{isItalian ? "Controllo mano alzata" : "Hand-raise check"}</summary>
              <p className="mt-1">{({
                queued: isItalian ? "In coda per la valutazione" : "Queued for assessment",
                checking: isItalian ? "Valutazione in corso" : "Checking",
                raised: isItalian ? "Intervento preparato, in attesa del permesso" : "Prepared, awaiting permission",
                none: isItalian ? "Nessun intervento ritenuto necessario" : "No contribution needed",
                skipped: isItalian ? "Controllo non eseguito" : "Check skipped",
                error: isItalian ? "Valutazione non disponibile" : "Assessment unavailable",
              })[event.interventionDecision.state]}</p>
              <p>{({
                cooldown: isItalian ? "Intervallo di 30 secondi tra controlli AI: questa frase non è stata valutata." : "30-second AI cooldown: this caption was not assessed.",
                policy_disabled: isItalian ? "Correzioni automatiche disattivate." : "Automatic corrections disabled.",
                already_pending: isItalian ? "C’è già un intervento in attesa." : "A contribution is already pending.",
                not_a_claim: isItalian ? "Frase troppo breve per il controllo automatico." : "Caption too short for automatic checks.",
                awaiting_check: isItalian ? "La frase è conservata: verrà valutata al prossimo controllo, anche senza nuovi interventi." : "Caption retained for the next check, even if nobody speaks again.",
                context_changed: isItalian ? "Nuovi interventi ricevuti: rivalutazione con il contesto aggiornato." : "New dialogue received: reassessing with updated context.",
                context_limit: isItalian ? "Frase oltre il limite di contesto: controllo non eseguito." : "Caption exceeds the context limit: not assessed.",
                expired: isItalian ? "Il punto è troppo vecchio per intervenire adesso." : "The point is too old to intervene now.",
                superseded: isItalian ? "Punto superato da un nuovo turno o cambio argomento." : "Point superseded by a new turn or topic change.",
                old_attempt: isItalian ? "Frase di una sessione precedente." : "Caption belongs to a previous session.",
                not_participant: isItalian ? "Voce dell’avatar o possibile eco esclusi." : "Avatar speech or suspected echo excluded.",
                state_changed: isItalian ? "Stato del meeting cambiato: intervento annullato." : "Meeting state changed: contribution cancelled.",
                batch_reviewed: isItalian ? "Valutata insieme alle altre frasi; nessun ulteriore intervento preparato." : "Assessed with the other captions; no additional contribution prepared.",
                ambiguous_recipient: isItalian ? "Destinatario ambiguo: nome condiviso con un partecipante." : "Ambiguous recipient: another participant shares the name.",
                ai_unavailable: isItalian ? "Servizio AI non configurato o disattivato." : "AI service not configured or disabled.",
                analysis_error: isItalian ? "Errore durante la valutazione." : "Assessment failed.",
                no_material_issue: isItalian ? "La valutazione non ha proposto una correzione importante." : "The assessment proposed no important correction.",
                arithmetic_error: isItalian ? "Errore aritmetico riconosciuto dal controllo locale." : "Arithmetic error recognized locally.",
                contextual_contribution: isItalian ? "Contributo proposto dalla valutazione del contesto." : "Contribution proposed by contextual assessment.",
              } as Record<string, string>)[event.interventionDecision.reason]}</p>
              {event.interventionDecision.detail && <p className="mt-1 whitespace-pre-wrap break-words">{event.interventionDecision.detail}</p>}
            </details>}
            {event.source === "suspected_echo" && <p className="mt-2 text-xs text-amber-800">
              {isItalian ? `Il servizio l’ha attribuito a ${event.speakerName}. Non usato per nuovi comandi, memoria e riepiloghi; il testo originale è conservato.` : `The service attributed this to ${event.speakerName}. Not used for new commands, memory or summaries; the original text is preserved.`}
            </p>}
            {event.id === `response-${conversation.playback?.commandId}` && (
              <p className="mt-2 text-xs text-[#295c43]">
                {conversation.playback?.state === "completed"
                  ? isItalian ? "Audio riprodotto dal browser dell’avatar" : "Audio played by the avatar browser"
                  : conversation.playback?.state === "speaking"
                    ? isItalian ? "Audio in riproduzione" : "Audio playing"
                    : isItalian ? "Riproduzione audio non riuscita" : "Audio playback failed"}
              </p>
            )}
            {event.playbackMetrics && (
              <details className="mt-3 text-xs leading-5 text-slate-600">
                <summary className="cursor-pointer font-semibold text-[#295c43]">
                  {isItalian ? "Tempi audio · browser avatar" : "Audio timing · avatar browser"}
                </summary>
                <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
                  <dt>{isItalian ? "Richiesta voce → primo audio" : "Voice request → first audio"}</dt>
                  <dd>{(event.playbackMetrics.firstAudioMs / 1000).toLocaleString(locale, { maximumFractionDigits: 2 })} s</dd>
                  <dt>{isItalian ? "Interruzioni del buffer" : "Buffer underruns"}</dt>
                  <dd>{event.playbackMetrics.underruns} ({Math.round(event.playbackMetrics.gapMs)} ms)</dd>
                  <dt>{isItalian ? "Pausa massima animazione" : "Longest animation gap"}</dt>
                  <dd>{Math.round(event.playbackMetrics.maxAnimationGapMs)} ms</dd>
                </dl>
                <p className="mt-2">{isItalian
                  ? "Misure del browser, non della ricezione su Teams. L’avvio non include trascrizione, generazione della risposta o attesa in coda. Le pause tra parti molto lunghe non sono conteggiate come interruzioni del buffer."
                  : "Browser measurements, not Teams reception. Startup excludes transcription, answer generation and queue wait. Pauses between very long speech parts are not counted as buffer underruns."}</p>
              </details>
            )}
            {transcripts.length > 0 && (
              <details className="mt-3 text-xs leading-5 text-slate-600">
                <summary className="cursor-pointer font-semibold text-[#295c43]">
                  {isItalian ? "Trascrizioni ricevute" : "Received transcripts"} ({transcripts.length})
                </summary>
                <p className="mt-2">{isItalian
                  ? "Testo originale ricevuto dal servizio di trascrizione, associato a questa risposta. Non indica una seconda riproduzione audio."
                  : "Original text received from the transcription service, associated with this response. This does not indicate a second audio playback."}</p>
                {transcripts.map(transcript => (
                  <div key={transcript.id} className="mt-2 rounded-lg border border-[#d3e4d8] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="break-words font-semibold">{transcript.speakerName}</span>
                      <span>{isItalian ? "Trascrizione avatar" : "Avatar transcript"}</span>
                      <time dateTime={transcript.createdAt} className="ml-auto">{time(transcript.createdAt)}</time>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words">{transcript.text}</p>
                  </div>
                ))}
              </details>
            )}
          </article>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        {isItalian
          ? "Il riscontro audio conferma la riproduzione nel browser dell’avatar, non la ricezione da parte degli altri partecipanti su Teams."
          : "Audio feedback confirms playback in the avatar browser, not reception by other participants in Teams."}
      </p>
    </div>
  );
}

export function MeetingDebugPanel({ meetingId }: { meetingId: string }) {
  const { locale } = useTranslations();
  const isItalian = locale === "it";
  const [enabled, setEnabled] = useState(false);
  const panelId = useId();
  const descriptionId = useId();

  return (
    <section className="card overflow-hidden" aria-label={isItalian ? "Modalità debug" : "Debug mode"}>
      <div className="flex items-center justify-between gap-5 p-5 sm:p-6">
        <div>
          <h2 className="text-base font-semibold">{isItalian ? "Modalità debug" : "Debug mode"}</h2>
          <p id={descriptionId} className="mt-1 text-sm leading-6 text-slate-500">
            {isItalian ? "Mostra la conversazione in diretta durante le prove." : "Show the live conversation during tests."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-label={isItalian ? "Modalità debug" : "Debug mode"}
          aria-checked={enabled}
          aria-controls={panelId}
          aria-describedby={descriptionId}
          onClick={() => setEnabled((value) => !value)}
          className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#295c43] ${enabled ? "bg-[#295c43]" : "bg-slate-300"}`}
        >
          <span aria-hidden="true" className={`size-5 rounded-full bg-white shadow-sm transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} />
        </button>
      </div>
      <div id={panelId} hidden={!enabled}>
        {enabled && <LiveConversation key={meetingId} meetingId={meetingId} />}
      </div>
    </section>
  );
}
