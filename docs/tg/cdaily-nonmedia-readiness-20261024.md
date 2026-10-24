# CDaily: completamento della parte non media

Decisione del 24 ottobre: finire redazione, controllo, testi, GUI, scheduling e predisposizione della distribuzione; **audio e video per ultimi**. Nessuna rigenerazione o pubblicazione di video in questo lavoro.

## Contratto operativo

- `product.productionMode=editorial`: raccolta, novità rispetto alle uscite confermate, copione con data e contesto, A/B sul testo esatto e sullo score. Se uno dei controlli fallisce, blocco; una sola correzione editoriale persistente. Nessuna opinione AI aggiunta automaticamente.
- Prima di consultare una cache o configurazione media, esportazione del dossier datato, registro fonti, copione, narrazione, score, riassunto, scaletta, caption per canale e rapporti A/B. Gli stessi testi sono scaricabili dalla GUI, ricostruiti dallo snapshot DB corrente; una modifica successiva fa apparire il download come bozza.
- Stato dedicato `editorial_ready`: non è `ready`, non è un’approvazione dei media e non entra nell’outbox. Audio, rendering e revisore video non sono invocati. Anche una ricevuta media preesistente non rende pubblicabile un prodotto configurato in questa modalità.
- Controller con heartbeat distinto dal worker video, fase visibile nella GUI e `daily:agent -- preflight` senza generazione. `channels` verifica i collegamenti backend senza creare upload/post. `package` ricontrolla anche l’archivio pubblicato prima dell’esportazione.
- I limiti di durata nei trasporti usano la durata reale del master, quando presente, non l’obiettivo editoriale.

## Fonti e prove

Verifica live dei sette feed Italia: 127 articoli nelle ultime 24 ore da ANSA, Rai News, Euronews Italia, Adnkronos, AGI e Il Sole 24 Ore; nessun errore di trasporto/parsing. Il feed Istat non ha restituito elementi recenti. Questo è un controllo tecnico, non un fact checking dei 127 articoli. Non dichiarare «50 fonti istituzionali verificate»: catalogo, feed funzionanti e riscontri di una singola notizia sono misure diverse. I documenti primari e la ricerca puntuale entrano nei controlli dei singoli fatti.

Regressioni senza provider a pagamento: 137 test backend inclusi DB/lease/outbox e bundle eseguito fuori dal checkout; 13 browser sul desk, download, conflitti e mobile a 320/390 px. Build Meeting positiva; nessuna modifica al kit o all’avatar. Nel deploy: 65 test Node e 51 Python positivi. I log privati stanno in `.daily-agent/nonmedia-verification/`.

## Distribuzione: ciò che è verificato e ciò che manca

La lettura del connettore Metricool mostra il brand **CDaily · Conclavia Daily**, con Instagram `conclavia.me`, YouTube e Facebook. Non dimostra una pubblicazione avvenuta né rende disponibili i token Metricool al backend. Il publisher attuale usa proprie credenziali server; il collegamento MCP di Work e queste credenziali sono due trasporti distinti. Non usare il connettore per aggirare l’outbox o i controlli del pacchetto.

TikTok non compare nei collegamenti osservati: serve collegare l’account al brand e poi verificare destinazione e pubblicazione automatica. [Procedura ufficiale](https://help.metricool.com/how-to-connect-tiktok-to-metricool-0ea7e).

Spotify: il link dello show è noto, ma non è una credenziale né un’API di caricamento. [Spotify documenta](https://support.spotify.com/pw/creators/article/video-episodes-for-shows-not-hosted-with-spotify/) la distribuzione video attraverso host supportati; per show ospitati su Spotify esiste l’upload/scheduling in [Spotify for Creators](https://support.spotify.com/mr-en/creators/article/publishing-videos/). L’adattatore partner attuale è un contratto da integrare, non un host acquistato o già funzionante. Non comprare un piano, migrare lo show o dichiarare pubblicabile Spotify senza un percorso reale collaudato.

Task Work delle 09:00: prompt aggiornato per la sola redazione in `cdaily-work-publication-task.md`, salvataggio e primo esito ancora da verificare nella UI. I tool disponibili non espongono il salvataggio di task desktop; la UI locale restituisce errore di avvio del controllo nativo. Nessun ID inventato. [OpenAI Docs](https://learn.chatgpt.com/docs/automations) richiede web/app per gestire la task; il CLI qui prepara e collauda il flusso.

## Host sempre acceso

Bundle editoriale preparato dal backend, senza implementazioni media/publisher. Rilascio separato attraverso `../conclavia-deploy`: **`editorial-20261024132158764-5819ecf3`**, timer systemd attivo e abilitato all’avvio. Il servizio ha terminato con `Result=success`, `ExecMainStatus=0`; heartbeat condiviso recente e readiness editoriale positiva nella GUI. La verifica è avvenuta fuori finestra: nessuna raccolta AI anticipata. La prima raccolta/A/B del nuovo host resta da osservare il **25 ottobre alle 08:00 Europe/Rome, ossia 07:00 UTC**.

Timer locale `me.conclavia.daily-production` disattivato dopo la prova remota positiva: un solo scheduler. Il server usa il database Daily realmente già in uso (risolto dal backend, anche quando non esiste una variabile separata per il nome), autenticazione e tunnel esistenti. Nessun nuovo DB o modifica delle altre applicazioni. Meeting e Onboarding conservano container e release precedenti. Volume privato, nessuna porta pubblicata e nessun riavvio delle app.

Anteprima GUI aggiornata in locale sulla porta 3107: health, desk e API redazione rispondono 200; Italia in `editorial`, controller online, `editorialReady=true`, `productionReady=false`, invii disabilitati e distribuzione in pausa. Il sito pubblico e i master approvati non sono stati modificati. Le edizioni esistenti conservano la loro configurazione; quella bloccata del 24 non viene riavviata.

Continuità Git: Meeting sul ramo `feat/podcast-studio`. Il deploy editoriale è sul ramo `feat/daily-editorial-host-20261024`, [PR di deploy n. 1](https://github.com/vgflutter/conclavia-deploy/pull/1), senza merge su `main`. Il controllo automatico ha rifiutato il push diretto sul ramo predefinito; il ramo dedicato e la PR sono l’alternativa pubblicata e verificata. Il rilascio server resta attivo; la PR non è prova di una produzione giornaliera già completata.
