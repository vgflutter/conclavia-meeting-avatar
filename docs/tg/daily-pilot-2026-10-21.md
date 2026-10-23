# CDaily — prima edizione italiana pilota

21 ottobre 2026, Europe/Zurich. **96,40 secondi**, un conduttore, quattro storie; aggiornamenti verificati del **20 ottobre sera**. È una base del programma giornaliero, non una dimostrazione di pubblicazione autonoma già operativa.

## Visione

Pagina locale: <http://127.0.0.1:3107/daily-launch/editions/2026-10-21-it-pilot/index.html>. Contiene entrambi i master, capitoli, copione e sette collegamenti alle fonti. Il renderer locale sulla porta 3107 è lasciato attivo per la visione. Le app già aperte sulle altre porte sono preservate.

Master e contenuti: `public/daily-launch/editions/2026-10-21-it-pilot/`. Revisione media **`1a104c5be6a3`**. Il video di presentazione precedente rimane selezionato e invariato (`36a55a3d4eae`, 38,84 s); questa prova non viene attivata sul sito pubblico o sui social.

## Contenuti e recitazione

- Liguria: allerta nella notte, scadenze territoriali e importanza dell’ultimo bollettino.
- Autotrasporto: annunci di sostegno e prosecuzione di blocchi in alcune aree del Sud.
- Ucraina: colloqui a Oslo, distinti da un accordo di pace.
- Scienza: ricerca presentata dalla NASA sulle tendenze delle riserve d’acqua, distinta da una previsione della prossima siccità.

Il copione e le fonti sono dati del formato in `scripts/tg/editions/2026-10-21-it-pilot.json`. La [revisione editoriale separata](daily-pilot-2026-10-21-editorial-review.md) ha verificato le fonti e richiesto due precisazioni prima della registrazione. Il testo finale coincide con quello revisionato.

Alex 2 - daily / Eleven v4, stabilità 50%, somiglianza 75%: una sola richiesta di generazione, 1.528 caratteri / crediti, con due alternative offerte dal prodotto. Usata Generation 1, **93,806 s** di parlato, senza accelerazione. La registrazione precedente è stata salvata prima di sostituire il testo nella nuova scheda; la scheda originale dell’utente è stata preservata.

Quattordici cue con mood e intenzione: attenzione, empatia contenuta, cautela, curiosità e invito finale. Movimento, dita, espressioni, transizioni e labiale provengono dal kit canonico. Il nuovo manifesto conserva la propria regia; non eredita le intenzioni semantiche della presentazione. Studio, personaggio, font, colori e impostazione riusano `dailyVideoIdentity` e il lock approvato.

Una trascrizione OpenAI, autorizzata dal consenso ricorrente del workflow Alex, è conservata in cache. La revisione grafica di sei token (cifre e nome Witkoff) è esplicita e legata all’hash della registrazione: conserva l’ASR originale e tutti gli intervalli, senza inventare parole mancanti o tempi individuali. Le ancore temporali ASR restano approssimate, non sono un allineamento fonetico di laboratorio.

## Verifiche effettuate

- Entrambi i master H.264 / AAC stereo 48 kHz, 25 fps: 1080×1920 e 1920×1080, 96,40 s; decodifica completa riuscita.
- Correlazione del suono codificato con il mix: **0,999930** in entrambi i formati; picco campionato circa −4,01 dBFS, senza clipping.
- Tutti i **4.820 fotogrammi** controllati nei due formati: nessun overflow dei titoli, testo sul volto, mano tagliata o valore di posa non finito.
- Fotogrammi reali dei passaggi espressivi e della chiusura esaminati visivamente. L’ultimo cue ha mood di invito ma usa la firma grafica, senza avatar visibile. Queste verifiche non certificano naturalezza indistinguibile da una persona reale.
- Pagina a 360, 390 e 1440 px: riproduzione reale di entrambi gli MP4, capitoli, fonti, nessun download video prima del play, sottotitoli facoltativi e un solo player udibile alla volta.
- Test della regia, ESLint sui file coinvolti, typecheck, build Meeting e lock dei 13 asset/impostazioni superati. Nessuna modifica al codice del kit; nessuna chiamata a provider nelle regressioni.

Prove: `docs/images/daily-launch/editions/2026-10-21-it-pilot/` contiene audit di ogni frame, metadati/decodifica/audio dei file finali, screenshot e controlli dei player. Nessun worker, pubblicazione social, spesa pubblicitaria o scheduler attivato.

## Riproduzione della prova

1. Per un nuovo episodio creare un nuovo score datato, verificare gli aggiornamenti e far revisionare separatamente fatti, fonti e tono prima di registrare. Non riutilizzare l’allerta di questo episodio come informazione corrente.
2. Importare un take con `prepare-daily-pilot.ts --id=… --file=/percorso/assoluto.mp3 --confirm`, ambiente `TG_PUBLISH_ENABLED=false`. Solo `--align` abilita una trascrizione mancante; la cache evita chiamate ripetute. `--word-review` applica esclusivamente il file di revisione esplicito legato all’hash, se necessario. Non abilitarlo come correzione automatica del contenuto parlato.
3. Comporre il mix con `compose-launch-audio.py`, impostando `TG_LAUNCH_VOICE_DIR` nella cache privata dell’edizione e `TG_LAUNCH_DIR` nella cartella pubblica dell’edizione.
4. Esportare con `render-launch-promo.ts --edition-pilot`, `TG_RENDER_ORIGIN` locale, `TG_LAUNCH_DIR` e `TG_LAUNCH_QA_DIR` dedicati. `--preview` controlla prima le scene; il flag del pilota non allarga i limiti dell’esportazione della presentazione.
5. Eseguire `audit-creative-pilots.ts --edition=…`, generare la pagina con `build-daily-pilot-page.mjs --id=…` e controllare i veri player con `verify-daily-pilot.mjs --id=…`. Servire la pagina da un server che rilevi i nuovi asset, senza riavviare applicativi altrui.

Il prossimo passaggio software è collegare selezione/deduplicazione delle notizie, pacchetto delle fonti, revisore AI separato e score al sistema giornaliero esistente. Produzione video e controlli devono terminare prima di entrare nella coda di pubblicazione; non presentare l’attuale prova manualmente avviata come un’edizione generata autonomamente a orario.
