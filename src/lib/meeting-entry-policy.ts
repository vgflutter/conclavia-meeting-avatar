export const MEETING_ENTRY_TIMEOUT_SECONDS = 120;
export const MEETING_MEDIA_START_GRACE_SECONDS = 60;
export const MEETING_ENTRY_CHECK_MS = 10_000;

export function attendeeAttemptFinished(bot: { entryAttemptId?: string; externalBotId?: string; leftAt?: unknown; providerStatusCode?: string }): boolean {
  if (!bot.externalBotId) return false;
  if (!bot.entryAttemptId) return Boolean(bot.leftAt);
  return Boolean(bot.leftAt && ["ended", "fatal_error", "cancelled"].includes(bot.providerStatusCode?.split(":")[0] || ""));
}

export function meetingEntryError(code: string | undefined, italian = true): string | undefined {
  // Closed vocabulary: never display arbitrary provider errors or private URLs.
  const output = code?.match(/^output_(url|page|state|scripts)_(timeout|network|tls|invalid|voice|http(?:_[1-5][0-9]{2})?)$/u);
  if (output) {
    const stages: Record<string, [string, string]> = {
      url: ["Indirizzo dell’avatar", "Avatar address"], page: ["Pagina dell’avatar", "Avatar page"],
      state: ["Stato dell’avatar", "Avatar state"], scripts: ["JavaScript dell’avatar", "Avatar JavaScript"],
    };
    const reasons: Record<string, [string, string]> = {
      timeout: ["tempo massimo di attesa superato. Verifica che app e tunnel siano attivi, poi riprova.", "the time limit was exceeded. Check that the app and tunnel are running, then retry."],
      network: ["collegamento non riuscito. Verifica che app e tunnel siano raggiungibili, poi riprova.", "connection failed. Check that the app and tunnel are reachable, then retry."],
      tls: ["certificato HTTPS non verificabile. Ripristina il collegamento sicuro prima di riprovare.", "the HTTPS certificate could not be verified. Restore the secure connection before retrying."],
      invalid: ["risposta non valida. Controlla l’app e il suo indirizzo pubblico prima di riprovare.", "invalid response. Check the app and its public address before retrying."],
      voice: ["voce non pronta. Controlla la configurazione del servizio vocale prima di riprovare.", "voice is not ready. Check the voice service configuration before retrying."],
    };
    const index = italian ? 0 : 1;
    const reason = output[2].startsWith("http")
      ? (italian ? `errore HTTP${output[2].slice(4).replace("_", " ")}. Controlla app e tunnel prima di riprovare.` : `HTTP error${output[2].slice(4).replace("_", " ")}. Check the app and tunnel before retrying.`)
      : reasons[output[2]][index];
    return `${stages[output[1]][index]}: ${reason}`;
  }
  const messages: Record<string, [string, string]> = {
    provider_tls_error: ["Il collegamento HTTPS al servizio meeting non supera la verifica del certificato. Nessun bot è stato inviato. Ripristina le autorità HTTPS fidate del server e riprova.", "The meeting service HTTPS certificate could not be verified. No bot was sent. Restore the server's trusted HTTPS authorities and retry."],
    output_unavailable: ["L’avatar non è raggiungibile. Ripristina il collegamento del servizio prima di riprovare.", "The avatar is unreachable. Restore the service connection before retrying."],
    request_to_join_denied: ["Il collega digitale non è stato ammesso al meeting.", "The digital colleague was not admitted to the meeting."],
    waiting_room_timeout_exceeded: ["Il collega digitale non è stato ammesso dalla sala d’attesa.", "The digital colleague was not admitted from the lobby."],
    meeting_not_found: ["Il collegamento Teams non è valido o il meeting non è disponibile.", "The Teams link is invalid or the meeting is unavailable."],
    login_required: ["Questo meeting richiede un account Microsoft autorizzato.", "This meeting requires an authorized Microsoft account."],
    out_of_credits: ["Il servizio di ingresso nei meeting non ha credito disponibile.", "No credit is available for meeting entry."],
    blocked_by_captcha: ["Microsoft ha richiesto una verifica che ha impedito l’ingresso automatico.", "Microsoft requested a verification that prevented automatic entry."],
    auto_leave_could_not_enable_closed_captions: ["Non è stato possibile attivare l’ascolto del meeting.", "Meeting listening could not be started."],
    join_timeout: [
      "Il servizio non ha confermato l’ingresso entro due minuti e abbiamo richiesto l’uscita. Se avevi già ammesso il collega, l’avvio non è stato confermato dal servizio.",
      "The service did not confirm entry within two minutes, so we requested departure. If you had already admitted the colleague, the service did not confirm startup.",
    ],
    media_not_ready: [
      "Il collega è entrato, ma l’ascolto del meeting non è stato attivato. L’ingresso è stato interrotto.",
      "The colleague joined, but meeting listening did not start. Entry has been stopped.",
    ],
    entry_cancelled: ["Ingresso annullato.", "Entry cancelled."],
    entry_failed: [
      "L’ingresso non è stato completato. Controlla il collegamento e l’ammissione nella sala d’attesa, poi riprova.",
      "Entry did not complete. Check the link and lobby admission, then try again.",
    ],
    create_uncertain: [
      "Stiamo verificando se il collega è stato inviato. Non avvieremo un altro tentativo finché la verifica non è conclusa.",
      "We are checking whether the colleague was sent. Another attempt will not start until this check is complete.",
    ],
  };
  return code ? messages[code]?.[italian ? 0 : 1] : undefined;
}

export function meetingEntryDeadline(now: Date, scheduledFor?: Date): Date {
  return new Date(Math.max(now.getTime(), scheduledFor?.getTime() || 0) + MEETING_ENTRY_TIMEOUT_SECONDS * 1000);
}
