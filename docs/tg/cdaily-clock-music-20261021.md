# Presentazione CDaily: podcast e nuova sigla

Revisione privata del 21 ottobre 2026. Identità, studio, avatar, animazioni e
font approvati rimangono quelli di [cdaily-video-guide.md](cdaily-video-guide.md).
Non sostituisce automaticamente il video pubblico selezionato.

La frase pronunciata è «Notizie ogni giorno e podcast di approfondimento»;
il cartello della scena a due riporta «Podcast di approfondimento».
La nuova registrazione continua è allineata alle parole e ai mood; non è
accelerata. Il video completo dura 39,08 secondi, in 9:16 e 16:9.

## Sigla originale locale

«Primo piano»: piano elettrico sintetizzato in FM, basso morbido, accordi estesi,
pulsazione discreta e percussioni leggere. Mi maggiore, 100 BPM, 16 battute con
coda. La frase melodica iniziale ritorna modificata nella chiusura; il centro
rimane più vuoto per lasciare spazio al parlato.

Tutte le note e gli strumenti sono prodotti dal codice locale: nessun campione,
loop, soundbank o registrazione esterna. Il riferimento dell'utente alla musica
dell'orologio orienta soltanto l'atmosfera. Non è una trascrizione o un
arrangiamento di quella composizione. Non contiene l'audio di YouTube.

- Composizione/sintesi: [compose-clock-score.swift](../../scripts/tg/compose-clock-score.swift).
- Mix e remux dei fotogrammi esistenti: [mix-clock-score.py](../../scripts/tg/mix-clock-score.py).
- Note e WAV sorgente: cache privata della registrazione candidata.
- Nessun account o abbonamento musicale necessario; nessuna chiamata AI per questa sigla.

```sh
swiftc -O -module-cache-path /tmp/cdaily-swift-module-cache \
  scripts/tg/compose-clock-score.swift -o /tmp/cdaily-clock-score
/tmp/cdaily-clock-score \
  .tg-artifacts/.launch-promo/voices/alex2-podcast-clock-20261021 39.08
TG_LAUNCH_VOICE_DIR=.tg-artifacts/.launch-promo/voices/alex2-podcast-clock-20261021 \
  python3 scripts/tg/mix-clock-score.py \
  public/daily-launch/revisions/podcast-clock-20261021
```

Il mixer accetta solo candidate private sotto `revisions/`. Mantiene tutti i
fotogrammi H.264 e i tempi del parlato. Il sottofondo si abbassa durante la voce
e risale nella chiusura; master e due esportazioni sono stereo a 48 kHz.
La traccia isolata è disponibile nella pagina di revisione locale.

## Stato dei diritti e della consegna

La generazione musicale precedente in ElevenLabs resta una bozza nell'account:
il piano ne bloccava il download. Non è stata esportata o inclusa; nessun
abbonamento è stato attivato.

La voce Alex 2 di questa nuova prova è stata generata con il piano Free.
[La documentazione ElevenLabs](https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform)
esclude l'uso commerciale dei take generati fuori da un abbonamento a pagamento.
La composizione locale risolve il costo della musica, non i diritti della voce.
La candidata resta quindi per revisione privata, senza sponsorizzazione,
pubblicazione social o sostituzione del video online. La qualità musicale va
valutata anche con un ascolto: i controlli di mix non sostituiscono il gusto.

Report audio, decodifica e riproduzione sono in
`docs/images/daily-launch/podcast-clock-20261021/`.

## Ultima variante: apertura breve, poi voce sola

La candidata **`podcast-clean-20261021`**, revisione media **`b44b41fab14d`**,
mantiene la registrazione aggiornata «podcast di approfondimento», durata di
39,08 s, fotogrammi, animazioni, font, studio, cue e sottotitoli della prova
precedente. La sigla termina a 4,00 s; nessuna ripresa musicale in chiusura.
La variante con il sottofondo completo resta conservata per confronto.

Il mixer supporta ora `--intro-only`; i due mix conservano stem separati.
Nessuna nuova sintesi vocale, trascrizione o chiamata a provider è necessaria.
I due MP4 decodificano integralmente e hanno lo stesso flusso video della prova
precedente. Dopo l'apertura il master conserva il segnale vocale con guadagno
unitario; il controllo dello stem conferma zero musica dopo il quarto secondo.
Il rapporto è `docs/images/daily-launch/podcast-clean-20261021/final-media-proof.json`.

Anteprima: `http://127.0.0.1:3107/daily-launch/revisions/podcast-clean-20261021/index.html?v=b44b41fab14d`.
La candidata resta privata per lo stesso limite della registrazione Free già
descritto sopra: non è il master autorizzato per una sponsorizzazione.
Il video pubblico selezionato rimane `36a55a3d4eae`; nessun deploy eseguito.

Il 21 ottobre l'utente ha confermato di mantenere questa registrazione per le
prove, rinviando la scelta del piano commerciale. Non rigenerare il take né
richiedere nuovamente un abbonamento durante la revisione. Lo stato dei diritti
rimane invariato; questa conferma non attiva sponsorizzazioni o pubblicazioni.
