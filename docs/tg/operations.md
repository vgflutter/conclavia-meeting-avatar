# Conclavia Daily (nome di lavoro): avvio e operazioni

Stato del 20 ottobre 2026: implementazione locale e collaudi; **non è una distribuzione di produzione già attiva**. Lo studio grafico è `/podcast/tg`; la GUI operativa dedicata è `/podcast/tg/redazione`. Il primo studio di formato, con fonti, ipotesi e limiti, è [editorial-study-2026-10-18.md](editorial-study-2026-10-18.md).

**Aggiornamento del 21 ottobre:** il riferimento per raccolta, selezione, distinzione fatti/analisi AI, doppio controllo e scaletta è [editorial-workflow.md](editorial-workflow.md). Il formato standard è ora **5:00**, con quattro storie e revisione delle singole edizioni affidata all'AI. Il nuovo secondo controllo editoriale prima della voce è un requisito da implementare e non coincide con il revisore finale dei media già presente. Le ipotesi storiche da 90/180 s più avanti non sostituiscono questa specifica. Identità e claim correnti sono nella [guida video](cdaily-video-guide.md).

Il backend ora richiede quattro storie distinte per il Daily da 300 s e per i job storici da 240 s, anche in un job ripreso e dopo una riscrittura. Copertura insufficiente produce `blocked`, invalida i risultati riusabili e non viene ritentata dal worker come errore tecnico. I piloti con altri minutaggi conservano il loro contratto precedente.

Nome in revisione: il 18 ottobre l’utente ha giudicato NESSO poco interessante e ha preferito **Conclavia Daily**, precisando di non esserne ancora sicuro. Conclavia Daily viene usato come nome di lavoro della presentazione pubblica, identico in italiano e inglese, senza un’ulteriore firma “made by Conclavia”. Le occorrenze NESSO nei documenti precedenti e nelle analisi sotto identificano lo stesso progetto TG. Non sono un marchio definitivo approvato. La presentazione pubblica non rinomina automaticamente GUI privata, identificativi, job o canali.

Claim pubblico: **“Il mondo, spiegato chiaro.” / “The world, clearly explained.”**. Posizionamento: **“Apartitico. Chiaro. Informale.” / “Nonpartisan. Clear. Conversational.”**. “Apartitico” esprime l’impegno a non sostenere partiti/candidati e a selezionare per rilevanza, impatto e prove, includendo la politica quando pertinente. Evitare “apolitico” per descrivere un prodotto che tratta anche decisioni pubbliche; nessuna promessa di neutralità assoluta derivante dall’AI. Distinguere fatti, dichiarazioni e analisi; rendere esplicite incertezze e correzioni. Il tono è accessibile e rispettoso, adattato alla gravità delle notizie.

## Decisione editoriale aggiornata — 19 ottobre 2026

La nuova istruzione dell’utente sostituisce il precedente modello “prima revisione umana, poi automatico”: **ricerca, selezione, scrittura, revisione e pubblicazione delle edizioni devono essere gestite dall’AI, senza selezione, riscrittura o approvazione umana dei singoli contenuti**. Conclavia progetta/configura il sistema e ne mantiene la responsabilità operativa. Le prove creative, la scelta iniziale della voce e i piloti restano attività di sviluppo e non sono edizioni autonome già pubblicate. Il budget pubblicitario non diventa per questo una spesa automatica autorizzata.

Stato effettivo aggiornato: ricercatore, scrittore, recupero web separato e verificatore sono implementati in `agents.ts`; `produceTg` consente una correzione e un nuovo giudizio e blocca un secondo esito negativo. È ora implementato anche un **revisore finale AI distinto**, attivabile per edizione con `automatic=true` solo quando il server abilita `TG_AUTOMATIC_REVIEW_ENABLED=true`. Il collaudo non abilita questa variabile né modifica le edizioni esistenti o gli invii reali.

Il percorso autonomo decodifica interamente entrambi gli MP4, misura audio, durata, dimensioni, silenzi e clipping, verifica la corrispondenza di timeline/mood/copione e invia all’agente finale fino a sei fotogrammi per formato, il copione verificato e i testi social. Un esito negativo o incompleto blocca l’edizione. La decisione ha provenienza `mode=ai`, distinta dalla checklist umana: non si fabbrica il nome di un revisore o un’attestazione di ascolto. Checksum di media, manifest, copione, audit e rapporto finale sono legati al piano di distribuzione e alle destinazioni. I controlli di attualità restano obbligatori prima di un nuovo invio. Lease, ricevute e pausa tecnica restano indipendenti dalla revisione editoriale.

**Limiti del collaudo:** i test del provider usano risposte simulate, non una chiamata AI a pagamento. Il controllo visivo è a campione: non certifica ogni fotogramma o la continuità del movimento. L’audio viene decodificato e misurato, non ascoltato dall’agente; naturalezza, pronunce e corrispondenza semantica del parlato richiedono ancora un ulteriore controllo prima di considerare completa l’accettazione autonoma. I rapporti e la GUI dichiarano questo limite. Il controllo non dimostra assenza assoluta di errori o pregiudizi, né verifica diritti esterni al pacchetto.

La modalità assistita (`automatic=false`) conserva il gate umano di collaudo. Un’edizione autonoma non può sostituire una revisione AI mancante con un’approvazione umana dall’API. La landing `/tg/` e `/en/tg/` continua correttamente a dichiarare che il ciclo autonomo non è attivo in produzione. L’integrazione API della voce Alex, un pilota reale del revisore finale, il runtime persistente e i canali social restano da configurare/verificare prima del lancio.

## Prodotti e responsabilità

Nuove edizioni: Italia in italiano e World in inglese, **300 s ciascuna**; 19:15 Europe/Rome e 18:00 UTC. I piloti storici mantengono il proprio snapshot; la prova italiana r2 del 21 ottobre dura 240 s. Una voce iniziale, due configurabili. Questi orari sono ipotesi da valutare dopo 14 giorni di pubblico reale. World ha una selezione propria, non traduce Italia.

L’identità visiva del TG appartiene solo a questo prodotto. `TgStage` e il renderer risiedono nel kit canonico; raccolta fonti, regia editoriale, persistenza, worker e distribuzione risiedono nell'app Meeting. Nessun dato Meeting viene usato per scrivere le notizie. Le collezioni nuove sono `tg_editions`, `tg_runs`, `tg_deliveries`, `tg_workers`, `tg_publication_control`, `tg_channel_checks`.

## Percorso di una giornata

1. Il calendario della GUI e il worker condividono lo stesso calcolo: avvio 45 minuti prima dell’uscita, chiusura della finestra automatica 30 minuti dopo. Una riaccensione successiva non recupera notizie vecchie. La data è quella dell’uscita, anche quando la preparazione parte il giorno prima. Nel cambio d’ora autunnale si usa la prima occorrenza; nel salto primaverile il primo minuto valido successivo, segnalato nella GUI. Chiave univoca prodotto/data, anche con due worker. Una richiesta anticipata di un’edizione autonoma prenota il lavoro senza consumare tentativi o API prima della finestra. Aprire la pagina non crea job o post.
2. I feed RSS pubblici consentiti formano un catalogo immutabile di URL, data, editore, testo disponibile e gruppo originario. Copie della stessa agenzia non valgono come due editori indipendenti quando la provenienza è identificabile. La finestra di sette giorni è contesto; ogni notizia necessita di due riscontri attuali, entro 36 ore. L'identificazione delle ripubblicazioni non è infallibile e va controllata anche nella revisione.
3. Il ricercatore seleziona soltanto ID realmente presenti nel catalogo, ordina per impatto e novità, confronta le edizioni precedenti. Non può inventare un URL per completare la scaletta. Il catalogo RSS non è un archivio completo della settimana.
4. L'editor scrive frasi originali con fonti, presentatore, mood e intensità e titoli brevi per il video. Il testo non riproduce foto, filmati o musica degli editori.
5. Un recupero web indipendente cerca separatamente ogni notizia effettivamente in onda per parole chiave. Un verificatore distinto valuta tutti i titoli, le schede di contesto/aggiornamento a video e tutte le frasi contro quel materiale e gli estratti RSS effettivamente raccolti, distinguendo gli estratti dal testo integrale non consultato. Ogni notizia deve avere anche un riscontro web sul fatto centrale. Il giudizio è diviso in blocchi di otto elementi per contenere la risposta; nessuna frase può essere saltata. Il server richiede una verifica per ciascuna chiave; una citazione inventata o non effettivamente recuperata non vale come prova. Le pagine possono negare l'accesso ai motori: una ricerca senza riscontri blocca la produzione.
6. È consentita una sola correzione editoriale, seguita da un nuovo controllo. Le prove web possono essere riusate per massimo 30 minuti nella stessa lavorazione: il giudizio sul copione rivisto viene sempre ripetuto, senza rifare inutilmente la medesima ricerca. Un secondo esito negativo ferma la puntata. Una seconda verifica AI e il controllo del pacchetto non sono una garanzia di infallibilità; l’esito e le prove restano consultabili.
7. Le nuove edizioni usano Inworld TTS-2, Gianni/Orietta in italiano e Dennis/Olivia in inglese, con frasi dello stesso passaggio sintetizzate insieme e mood allineati. Il PCM determina durata, visemi ed energia. Oltre il 5% di differenza dal tempo previsto è consentita una sola riscrittura calibrata, seguita da nuova verifica. Un secondo errore ferma la produzione. La voce Alex ElevenLabs del promo è un asset originale importato; non è ancora la voce API del TG automatico.
8. Audio uniformato a target -16 LUFS e picco -1,5 dBTP. Rendering deterministico a 25 fps, 1920×1080 e 1080×1920. FFprobe verifica codec, dimensioni, audio e durata entro 0,1 s. Il pacchetto contiene due MP4, MP3, VTT e manifest con checksum SHA-256. Il verticale ha una propria composizione.
9. In modalità assistita l’edizione si ferma in `needs_review`, con video/copione/fonti/testi social, cinque controlli e revisore nominativo. In modalità autonoma passa a `reviewing`: controllo locale dei media e agente finale separato; solo un rapporto positivo e coerente consente `ready`, entro la finestra e con destinazioni presenti. Mancanza di prove, esito negativo o indisponibilità non diventano un’approvazione. La GUI mostra il rapporto, le misure e i punti campionati selezionabili nel video. Una modifica dei file, del copione, del rapporto, del piano o degli account invalida l’approvazione.
10. La distribuzione controlla orario, approvazione, verifica recente e integrità. Ogni canale ha una ricevuta separata: caricamento accettato e pubblicazione confermata sono stati diversi. Un esito ambiguo non viene riprovato automaticamente, per evitare doppioni.

## Runtime

Usare Node >=22.21.1, FFmpeg/FFprobe e la versione Chromium corrispondente a Playwright. Il worker legge le stesse versioni di sorgenti/kit e lo stesso database dell'app, con un archivio media persistente accessibile a entrambi. Non lanciare rendering pesanti o build sul VPS pubblico esistente da 1 vCPU/2 GB senza una verifica di capacità. Il Dockerfile è preparato, ma l'immagine e il posizionamento del worker richiedono collaudo sul runtime scelto.

```sh
npm ci
npm run tg:worker
# Un solo giro per una prova esplicita:
npm run tg:worker -- --once
```

Il comando carica `.env.local` a runtime; non stampare né copiare quel file nei log, nei ticket o nelle immagini. La condizione Node `react-server` è necessaria per i moduli server-only. Il worker usa lease di due minuti rinnovate ogni 30 s; un secondo processo non può lavorare sullo stesso job. Gli errori tecnici tornano in coda dopo due e quattro minuti; dopo tre tentativi il lavoro si ferma. Un esito editoriale negativo si ferma subito. Il retry conserva i checkpoint coerenti, ma non riusa audit scaduti. La cronologia e la GUI mostrano il prossimo tentativo. Il battito del worker è visibile nel pannello; un processo spento non viene mostrato come pronto solo perché esiste una variabile d'ambiente.

La distribuzione ha una cadenza separata di 15 s anche durante ricerca/rendering. Lo spegnimento SIGTERM interrompe le chiamate e rilascia il battito. Un riavvio recupera una lease scaduta, riusando i checkpoint coerenti. Non rimuovere o alterare a mano le ricevute di invio.

### Variabili di runtime (solo nomi, nessun valore segreto)

- `MONGODB_URI`, `MONGODB_DB_NAME`: database applicativo autorizzato. Per test **entrambi** devono puntare alla Mongo temporanea `mongodb://127.0.0.1:27018` e a un database `conclavia_e2e_*`; cambiare soltanto il nome non isola il database reale.
- `TG_AI_ENABLED=true`, `PODCAST_AI_ENABLED=true`, `OPENAI_API_KEY`: ricerca e redazione. `TG_RESEARCH_MODEL` opzionale per la ricerca web, altrimenti modello OpenAI già configurato nel podcast.
- `PODCAST_SPEECH_ENABLED=true`, `KOKORO_URL`, `INWORLD_API_KEY`: voci. Il servizio Kokoro esistente accetta indirizzi di loopback: un worker separato deve avere il servizio locale o una topologia di rete supportata, non un hostname Docker arbitrario.
- `TG_WORKER_ENABLED=true`, `TG_ARTIFACT_DIR`: worker e percorso persistente assoluto.
- `TG_RENDER_ORIGIN`: origine privata dell'app che espone `/podcast/tg/render`; è il browser del worker a caricare il renderer, non la rete pubblica.
- `TG_CHROME_CHANNEL`: opzionale, per Chrome installato in locale. Nell'immagine Playwright lasciare vuoto per il Chromium incluso.
- `TG_PUBLISH_ENABLED=false`: lasciare disabilitato nel collaudo. Abilitare solo dopo aver configurato e verificato i canali.
- `TG_MEDIA_PUBLIC_ORIGIN`: origine HTTPS per il solo prelievo dei video approvati da Meta/partner. Il connettore TikTok carica direttamente nel deposito Metricool. Il gateway e l'app devono vedere lo stesso archivio media.
- `TG_AUTOMATIC_REVIEW_ENABLED=true`: abilita la scelta della revisione finale AI nella GUI; `TG_FINAL_REVIEW_MODEL` opzionale, altrimenti il modello OpenAI del podcast. Non abilita preparazione o pubblicazione.
- `TG_RESEARCH_TRACE_DIR`: diagnostica editoriale opzionale e privata; contiene testi e fonti, mai header di autorizzazione. Applicare una conservazione limitata anche a questi file.

Non vengono creati nuovi account a pagamento né nuove infrastrutture da questo runbook. La configurazione deve arrivare dal sistema di gestione dei segreti del deployment, non da stringhe copiate nel repository.

### Worker container

```sh
docker build --build-context avatar-kit=../conclavia-avatar-kit \
  -f Dockerfile.tg-worker -t conclavia-tg-worker:RELEASE .
```

L'immagine usa un utente UID/GID 1001, come il processo dell'app che serve i file. Montare lo stesso volume a `TG_ARTIFACT_DIR` per app/worker; i file di bozza sono privati (directory 0700, file di script/manifest 0600). Non pubblicare la directory come file server statico. Prevedere disco, monitoraggio, backup del database e retention dei media: il numero di minuti di video non è una misura del tempo di rendering.

## Collegamenti dei canali

Usare prefissi **distinti** `TG_IT_` e `TG_WORLD_`; non esiste un ripiego sugli account di altri progetti.

| Canale | Configurazione per edizione | Verifica richiesta prima del lancio |
| --- | --- | --- |
| YouTube | `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`, `YOUTUBE_CHANNEL_ID` dopo il prefisso | OAuth del canale corretto, upload reale, elaborazione completata e visibilità pubblica verificata. Master orizzontale. Dichiarazione di contenuto sintetico. |
| Instagram | `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_ACCOUNT_ID`; globale `TG_META_GRAPH_VERSION` | Account professionale e permessi di pubblicazione idonei, lettura HTTPS del verticale, creazione/elaborazione/pubblicazione Reel reale. Durata ammessa e visibilità vanno verificate sull'account. |
| TikTok | `METRICOOL_BLOG_ID`, `TIKTOK_USERNAME` per edizione; globali `TG_METRICOOL_TOKEN`, `TG_METRICOOL_USER_ID` | Connettore Metricool implementato secondo OpenAPI: verifica brand e creator, limiti/privacy, upload semplice o multipart con SHA-256, deposito media permanente, programmazione e polling del vero stato. Richiede accesso API Metricool e collaudo sull’account TG; nessun account di altri progetti viene riutilizzato. Direct Post interno resta disabilitato. |
| Spotify | `SPOTIFY_SHOW_ID`; globali `TG_SPOTIFY_PARTNER_URL`, `TG_SPOTIFY_PARTNER_TOKEN` | Scegliere un host video compatibile e implementare/verificare il suo adattatore reale. L'attuale connettore è **un contratto gateway**, non un'integrazione già configurata con un host. |

Le [linee guida TikTok](https://developers.tiktok.com/docs/en/content-sharing-guidelines), aggiornate il 4 agosto 2026, escludono utility interne/private dal caso d’uso Direct Post e richiedono controllo del creator sul post. Questo vincolo cambia la strategia: non basta aggiungere un token per abilitare il TG autonomo su TikTok. Il connettore implementato usa Metricool; accesso API, disponibilità del servizio e percorso autorizzato vanno verificati sul brand TG prima del lancio. Riferimenti: [guida API](https://help.metricool.com/basic-guide-for-api-integration-r97af), [schema OpenAPI](https://app.metricool.com/api/swagger.json). La documentazione dichiara l’accesso API nei piani Advanced/Custom; non viene attivato né acquistato alcun piano da questa GUI.

Le variabili nella tabella vanno precedute dal prefisso di edizione dove indicato: per esempio `TG_IT_YOUTUBE_CHANNEL_ID`. Le API musicali Spotify e un RSS audio non costituiscono una pipeline di pubblicazione video. Nel pannello è possibile iniziare con un sottoinsieme di canali e aggiungerne altri una volta collaudati.

Il contratto gateway Spotify previsto è `POST deliveries` con chiave di idempotenza `jobId:spotify` e corpo destinazione/videoUrl/titolo/descrizione/lingua/durata; risponde `{id,state}` con stato `submitted|published`. `GET deliveries/:id` restituisce lo stato della distribuzione effettiva. Il gateway deve tradurre questo contratto all'API documentata dell'host scelto e non dichiarare `published` al solo caricamento. Nessun host viene presunto compatibile con questo contratto senza implementazione.

## Sicurezza del media pubblico

L'app/gateway ammettono soltanto GET/HEAD per `/api/tg-media/<capability-casuale-64-hex>/(landscape|portrait).mp4`. È una capability sensibile: chi ha il link può leggere il video approvato. Non dà accesso a bozza, manifest, database, configurazione o gestione. Il link funziona solo dopo approvazione con verifica positiva e per una finestra limitata; non esporre le route `/api/tg/*` di gestione. Le route del renderer non restituiscono contesto Meeting.

## Incidenti e revisione

- **Fonte non disponibile / nessuna ricerca verificabile:** attendere il ripristino o migliorare i feed consentiti con una modifica revisionata. Non disabilitare la verifica per far diventare verde il pannello.
- **Copione bloccato:** leggere le verifiche per frase, rivedere selezione e attribuzioni. La revisione umana non scavalca un fact-check negativo. Il retry editoriale riusa le fonti e riscrive; il retry tecnico riusa checkpoint validi.
- **Durata non conforme:** controllare lingua/voce/velocità e testo; il secondo errore non viene corretto con padding di lunghi silenzi.
- **Invio `unknown` o `blocked`:** confrontare la ricevuta con il canale prima di riprovare. Non eliminare la riga per far ripartire automaticamente l'upload. Nella GUI, “Riconcilia una ricevuta” registra il controllo dell’operatore e l’ID già presente sul canale. Il worker ricontrolla quell’ID senza creare un upload. Una sessione YouTube persistita può essere ripresa senza inserire un nuovo ID, con approvazione e verifica valide. Le sessioni non vengono esposte al browser.
- **Verifica oltre sei ore:** non avviare un nuovo upload. Serve una verifica aggiornata; una puntata del giorno prima non deve diventare la notizia di oggi.
- **Correzione del codice dopo tentativi esauriti:** il comando operatore `scripts/tg/retry.ts --id=... --reason='motivo concreto' --confirm` registra il motivo e rifiuta edizioni già approvate o con ricevute di distribuzione. `--from=media` riusa un audit positivo solo se attuale e corrispondente al copione; `--from=verification` conserva fonti e copione e invalida audit/media; `--seconds=90` permette una modifica esplicita del minutaggio su un’edizione non approvata e registra valore precedente e nuovo; non serve a scavalcare un controllo negativo. Eseguire con le stesse condizioni Node e ambiente del worker.
- **Pausa:** usare “Metti in pausa” nella GUI. La pausa è persistente e viene ricontrollata prima delle richieste esterne, anche prima di `media_publish` Instagram. Le richieste già trasmesse non possono essere richiamate dalla pausa. Disabilitare anche la preparazione giornaliera se necessario. `TG_PUBLISH_ENABLED=false` resta il blocco di deployment; la GUI non può scavalcarlo. Conservare ricevute e artefatti.

La rifinitura operatore `scripts/tg/remaster-audio.ts --id=... --confirm` permette di uniformare il volume di un pilota verificato in attesa di revisione, con `TG_PUBLISH_ENABLED=false`. Usa lease e rinnovo del proprietario, rifiuta edizioni approvate o già inviate, rigenera entrambi i master e i checksum. Non rinnova né scavalca il fact-check.

## Cancelli di lancio

Prima di chiamare il progetto pronto per la produzione servono: piloti completi con revisione dei contenuti, ascolto e validazione del controllo finale AI sui due formati, compresi errori indotti e costi misurati; controllo autonomo delle pronunce/parlato ancora da completare; collegamenti ai canali di proprietà corretti; test di upload e conferma pubblica per ciascun canale selezionato; adattatore Spotify reale se selezionato; connettore Metricool TikTok collaudato se selezionato; worker e volume persistenti collaudati; monitoraggio di errori/ritardi, costi API e spazio disco; prova di riavvio senza doppioni. I test automatici dei publisher usano mock e non soddisfano l'accettazione sui canali reali.

## Verifica senza crediti API

```sh
npm run test:tg
npm run test:podcast
npm run typecheck
npm run lint
npm run check:avatar-kit
```

I casi browser TG richiedono Mongo temporanea sulla porta 27018; verificano anche il vero encoding FFmpeg con media tecnici, non notizie pubblicate. Non effettuare chiamate a provider a pagamento nei test di regressione. Le prove manuali con notizie/voci reali sono separate, esplicite e con pubblicazione disabilitata. Dopo modifiche al kit servono anche i test avatar/player e le build di entrambi i consumer.


## Uso della GUI della redazione

La navigazione TG separa “Identità e formato” da “Redazione e pubblicazione”. La seconda pagina contiene le code Da revisionare, Uscite, Attenzione, Archivio e In preparazione. La preparazione giornaliera, l’orario, il fuso e i canali proposti si salvano esplicitamente per ciascuna lingua; le edizioni già avviate conservano il proprio snapshot.

La distribuzione parte inizialmente **in pausa**. Dopo collegamenti e collaudo, abilitare il runtime `TG_PUBLISH_ENABLED=true` e poi “Attiva distribuzione”. La preparazione è autonoma, la decisione editoriale è umana, gli invii e i controlli delle ricevute sono autonomi. Il nome del revisore è un’attribuzione inserita nell’attuale workspace condiviso, non un’identità autenticata né un sistema di ruoli. L’accesso alla gestione deve restare privato o protetto dal gateway autenticato del deployment.

Un’approvazione seleziona soltanto i canali autorizzati per quella uscita. Un canale non configurato non ferma gli altri; l’edizione diventa Pubblicata soltanto quando tutti i canali selezionati confermano. La GUI mostra il testo effettivamente inviato da ciascun adattatore, preservando la dichiarazione del reale uso dell’AI e citando solo le fonti associate alle frasi in onda. Nessuna frase viene troncata per farla entrare nel limite della caption.

“Richiedi correzioni” conserva note e cronologia. “Rigenera con queste note” riscrive un copione respinto e invalida audit e media. Il retry di una lavorazione tecnica fallita conserva i checkpoint del copione; “Richiedi nuova verifica” aggiorna il controllo senza trattare un vecchio audit come attuale. Questi comandi accodano lavoro AI effettivo quando il worker autorizzato è attivo: i test usano worker disabilitato. “Annulla edizione” chiude un lavoro non inviato; una pubblicazione già trasmessa richiede controllo sul canale e non viene cancellata implicitamente.

Le decisioni hanno controllo della revisione e lease condivisa con il publisher. La coda di produzione rispetta la stessa esclusione. YouTube salva la sessione di upload sul server e ne interroga lo stato prima di riprendere i byte. Instagram distingue il polling dalla richiesta finale di pubblicazione: un crash durante quest’ultima produce uno stato incerto, non un secondo invio. Gli errori di polling hanno attesa crescente e si fermano dopo cinque errori; i timeout di invio richiedono riconciliazione.

Gli upload già ricevuti possono essere controllati dopo mezzanotte o dopo la scadenza dell’audit. Nuovi upload e finalizzazioni che rendono pubblico un contenuto richiedono ancora un’approvazione corrispondente e un audit attuale. L’esito di una richiesta già in corso può restare incerto e richiedere intervento; la GUI non dichiara di poter annullare una richiesta remota già trasmessa.

### Collaudo completo isolato

```sh
MONGODB_URI=mongodb://127.0.0.1:27018 \
MONGODB_DB_NAME=conclavia_e2e_tg_outbox_acceptance \
TG_INTEGRATION_TESTS=true npm run test:tg
```

Questo database temporaneo viene eliminato dal test. Non sostituire URI o prefisso con dati reali. I connettori sono simulati: nessun post né chiamata AI. I browser test `tests/e2e/tg-newsroom.spec.ts` verificano revisione completa, concorrenza, programmazione, ritiro, correzioni, riconciliazione, annullamento e protezione dei video. Lo stato di un account va collaudato separatamente con una pubblicazione reale revisionata.

## Fattibilità AI e acquisizione del pubblico

Verifica del 18 ottobre 2026 per NESSO, made by Conclavia. Direzione: procedere con un prodotto editoriale a produzione AI e revisione umana, e validare l’acquisizione prima di aumentare molto la spesa. Pubblicabilità, approvazione delle inserzioni e idoneità alla monetizzazione sono tre decisioni diverse delle piattaforme. Le policy citate non costituiscono approvazione di un account o di una creatività specifica.

### Direzione visiva riaperta dopo il riscontro dell’utente

Aggiornamento della prova: l'utente ha messo in dubbio l'utilità del 3D e proposto un robot stilizzato. Sono state preparate tre tavole 2D; la direzione 02 con volto digitale è stata raccomandata per il primo test e l'utente ha autorizzato di proseguire. La GUI `/podcast/tg/performance` contiene ora una [ricostruzione 2D animabile](robot-performance.md), con la stessa voce e sequenza dimostrativa di 36 secondi, più export orizzontale e verticale. È una prova di recitazione e disegno da valutare: il renderer delle edizioni giornaliere e la landing pubblica non sono stati sostituiti, e non è un'approvazione estetica per la produzione.

Il 18 ottobre l’utente ha respinto esplicitamente il risultato grafico del renderer TG: personaggio piatto, composizione da slide e scarsa attrattiva. I test tecnici e la nuova landing non costituiscono approvazione del video. La candidata attuale non supera l’accettazione visiva e non va promossa al lancio; ritoccare soltanto palette, naso o labiale non risolve la direzione artistica. L’utente considera di nuovo un servizio a pagamento per questo solo prodotto breve, ma esprime riserve sul fotorealismo totale. Questa disponibilità a valutare non attiva un abbonamento.

Ricerca online del 18 ottobre, separando dati di pubblico, dichiarazioni dei fornitori e giudizio progettuale:

- Il [Reuters Institute, Digital News Report 2026](https://reutersinstitute.politics.ox.ac.uk/digital-news-report/2026/how-news-creators-are-impacting-politics-and-media-around-world) rileva che i news creator sono percepiti come accessibili e coinvolgenti, con riserve sulla fiducia rispetto ai media tradizionali. È evidenza sul linguaggio e sui creator, non sul vantaggio di un conduttore AI fotorealistico.
- [YouTube, rapporto sui virtual creator del 2025](https://blog.youtube/culture-and-trends/youtube-culture-trends-report-virtual-creators/): un campione di 300 creator virtuali ha raccolto oltre 15 miliardi di visualizzazioni nel 2024. Include intrattenimento, live e Shorts, spesso con performance umana dietro il personaggio. Non misura domanda per TG autonomi, probabilità di successo o superiorità di uno stile.
- Le prove sul realismo non danno una regola unica: uno [studio JCOM del 2025](https://jcom.sissa.it/article/pubid/JCOM_2402_2025_A03/), su 491 partecipanti in Germania e comunicazione scientifica, rileva maggiore fiducia per avatar più realistici. Una [tesi City del 2024](https://openaccess.city.ac.uk/id/eprint/32443/), con 100 consumatori e quattro tipi di presentatore, riporta una preferenza prevalente per persone reali. Contesti, stimoli e misure diversi; non equivalgono a una prova sul nostro TG IT/EN.
- Il [rapporto Reuters sulle tendenze 2026](https://reutersinstitute.politics.ox.ac.uk/journalism-media-and-technology-trends-and-predictions-2026) descrive adozione di conduttori sintetici, compreso CITE/Alice, e reazioni miste del pubblico. L’adozione è reale, ma non prova che un falso studio televisivo sia il formato preferito.

Riferimenti da guardare, senza copiarne identità o prometterne tempi/costi di produzione: [TLDR News](https://tldrnews.co.uk/) per la spiegazione accessibile dell’attualità; [Kurzgesagt](https://kurzgesagt.org/what-we-do?visit=videos) per coerenza dell’illustrazione e animazione al servizio della spiegazione; [CITE/Alice](https://cite.org.zw/) per un impiego editoriale effettivo del presentatore sintetico. Sono esempi di categorie diverse, non concorrenti equivalenti né una classifica comparativa di audience.

La proposta progettuale preferita è **un presentatore originale stilizzato, con resa di alto livello, dentro un racconto visivo**. Proporzioni adulte, volto coerente, profondità e luci curate; l’avatar introduce e collega le storie mentre mappe, dati e immagini appropriate svolgono gran parte della spiegazione. Le scene cambiano quando serve a capire, non secondo un timer arbitrario. Ridurre i pannelli di prosa e dare a ogni notizia un soggetto visivo. Mantenere leggibilità verticale e correttezza anche con audio disattivato. Questa è una raccomandazione da provare, non un trend quantitativo dimostrato.

Una possibilità tecnica distinta dal renderer attuale è animare un buon disegno o ritratto 3D con un generatore audio-video. [HeyGen Avatar IV](https://help.heygen.com/en/articles/11269603-heygen-avatar-iv-complete-guide) documenta personaggi cartoon, non umani e modelli 3D; la [API Audio to Video](https://developers.heygen.com/audio-to-video) accetta un audio esistente e un’immagine, con generazione asincrona. Questo permette di provare le voci correnti e un aspetto non fotorealistico. Qualità, coerenza tra clip, mani, labiale, emozioni e pronunce rimangono da valutare: le funzionalità dichiarate non sono un collaudo nostro. Un mood del copione non garantisce il controllo puntuale di ogni movimento generativo.

**LiveAvatar va distinto da HeyGen video:** il primo è destinato alla conversazione in tempo reale; il secondo genera video preparati. La [documentazione LiveAvatar](https://docs.liveavatar.com/) indica 1 credito/minuto in Avatar Only/LITE e 2 in FULL. La [pagina commerciale](https://www.liveavatar.com/) riporta Essential a 99 USD/mese con 1.100 crediti e un avatar personalizzato 720p, Business a 475 USD/mese con 6.000 crediti e un avatar personalizzato 1080p. Sono prezzi pubblici verificati oggi, non un’offerta per il nostro account. La [FAQ](https://help.heygen.com/en/articles/12758866-liveavatar-faq) distingue i piani e precisa che i gesti live dipendono dalla registrazione, senza controllo dinamico puntuale.

Volume di riferimento calcolato: 3 minuti × 2 edizioni × 30 giorni = **180 minuti/mese** per una prima produzione completa, prima di attese, correzioni, prove, duplicazioni o formati che richiedano una nuova generazione. Una proposta con 30–45 secondi complessivi di avatar per edizione produrrebbe 30–45 minuti/mese di segmento generato; non è una quota già scelta. I crediti LiveAvatar misurano tempo di streaming, non soltanto volto visibile. I crediti dei piani web HeyGen non sono il saldo API e il prezzo di generazione asincrona va verificato sul prodotto effettivo: le pagine pubbliche consultate non consentono un preventivo API univoco. I 500 euro/mese già indicati restano il budget pubblicitario, separato dalla produzione.

Per il TG revisionato prima dell’uscita non serve rendere il video in diretta: produzione automatica giornaliera e generazione asincrona sono compatibili. Il tempo reale resta un requisito distinto per conversazioni con ospiti. La prossima accettazione visiva deve confrontare la stessa sequenza di 30–45 secondi in: (a) personaggio stilizzato con racconto visivo, (b) presentatore realistico come confronto di qualità, (c) voce e animazione senza volto come controllo. Stesso testo/audio e due rapporti d’aspetto; almeno un passaggio neutro e uno sensibile. Valutare interesse, chiarezza, identità, naturalezza, emozione pertinente e costo effettivo per clip utilizzabile. Una nuova immagine statica non valida l’animazione.

Nessun provider nuovo è stato attivato, nessuna chiamata di generazione a pagamento è stata effettuata e nessuna sostituzione grafica è stata distribuita durante questa ricerca. L’eventuale adattatore esterno rimane separato dalla logica editoriale e dal publisher; non si copiano renderer, voci o playback fuori dalle feature canoniche del kit.

### Domanda e posizionamento

Il [Digital News Report 2026 del Reuters Institute](https://reutersinstitute.politics.ox.ac.uk/digital-news-report/2026/dnr-executive-summary) rileva, nella media dei 48 mercati studiati, un uso di social/video per le notizie del 54% e fiducia nelle risposte dei chatbot sulle notizie del 20%. Sono fenomeni diversi: il primo non dimostra domanda per un avatar AI; il secondo non misura direttamente NESSO. La scelta di prodotto è offrire chiarezza, continuità e un appuntamento riconoscibile, dichiarando il processo AI. La curiosità tecnologica serve come primo contatto; l’abitudine richiede valore editoriale e performance audiovisiva.

La promessa storica di questa analisi era “Capire cosa cambia, in tre minuti”; il minutaggio corrente è cinque minuti e il claim approvato è nella guida video. Le due edizioni restano distinte. Il primo test di acquisizione si concentra sull’Italia; World mantiene il proprio pilota e avrà una campagna separata, su un singolo mercato linguistico da valutare con i primi risultati. Non si distribuisce un piccolo budget su molti Paesi contemporaneamente.

### Attrattiva del primo prodotto

Direzione aggiornata con l’utente: partire da NESSO e verificare se il pubblico lo segue prima di aprire altre linee editoriali. Italia e World restano le due edizioni del progetto; nessun nuovo canale settoriale viene avviato da questa decisione. Pubblico iniziale ipotizzato: persone con poco tempo che vogliono capire le conseguenze delle notizie senza seguire il flusso continuo degli aggiornamenti. È un posizionamento da verificare con il pubblico reale.

La promessa deve essere dimostrata dentro ogni puntata:

- **Apertura immediata:** nei primi cinque secondi, un fatto verificato e la sua conseguenza concreta. Marchio discreto già a video; evitare una sigla parlata e un riepilogo che ritardino o ripetano la prima storia. Il titolo deve restare fedele al contenuto, senza allarme artificiale.
- **Quattro storie comprensibili nel formato corrente:** gerarchia per rilevanza, novità e impatto. Ogni storia spiega fatto, contesto e cosa cambia; numeri e termini tecnici entrano solo se aiutano a capire. La scaletta Italia deve avere attenzione reale agli avvenimenti domestici. Nessuna quota tecnologica, positiva o di curiosità riempie una giornata debole.
- **Continuità riconoscibile:** per una storia già trattata, mostrare brevemente cosa si sapeva e quale sviluppo è stato verificato oggi. Se non c’è una novità sostanziale, non riciclare la notizia. Separare l’evento atteso da una previsione e dichiarare ciò che non è ancora noto.
- **Presenza audiovisiva:** un presentatore originale, voce calda e precisa, pause pertinenti, espressioni misurate e schede utili. Il topic breve resta leggibile anche entrando a metà di una clip. Mappe, confronti e dati accompagnano una spiegazione; il movimento continuo non sostituisce il contenuto.
- **Clip autonome:** ciascun estratto contiene una storia comprensibile, il contesto minimo, la data e la possibilità di risalire alle fonti e alla puntata. Un ritaglio non deve togliere un’incertezza o trasformare un’affermazione attribuita in un fatto certo.

Budget narrativo storico da 180 s: 0–5 s apertura sul fatto; 5–70 s prima storia; 70–120 s seconda; 120–165 s terza; 165–180 s prossimo sviluppo documentato e chiusura. È conservato come analisi precedente, non come scaletta corrente: per il formato da 300 s usare [editorial-workflow.md](editorial-workflow.md). Audio e comprensibilità guidano la riscrittura; non si corre per riempire gli ultimi secondi.

La ricerca sui [news creator del Reuters Institute, 2026](https://reutersinstitute.politics.ox.ac.uk/digital-news-report/2026/how-news-creators-are-impacting-politics-and-media-around-world) descrive il valore di formati accessibili e di spiegazione, con differenze importanti tra mercati e pubblici. Non dimostra che lo stesso approccio funzioni con un avatar AI: questa è l’ipotesi specifica da collaudare con NESSO.

Primo riscontro: le 7–10 edizioni già previste permettono di correggere difetti evidenti, non di dichiarare acquisita un’abitudine. Nei primi 30 giorni effettivi di distribuzione osservare abbandoni iniziali e a 30 s dove disponibili, tempo medio, completamento, visioni successive e ritorno del pubblico. Distinguere sempre organico/pubblicità, lingua, piattaforma, durata e numerosità; una clip virale o pochi commenti non approvano un formato. Confrontare aperture concrete e ritmo su più puntate, cambiando una scelta alla volta senza sacrificare la copertura delle notizie importanti. Nessuna soglia universale di successo viene inventata prima di avere una base di confronto.

### Possibile sviluppo: settimanali tematici

Un settimanale settoriale è una possibilità credibile da sperimentare dopo il primo prodotto, non una nuova consegna di lancio. Il primo candidato è **tecnologia e AI**, con un taglio pratico: che cosa è cambiato nella settimana, per chi conta, che cosa è già utilizzabile e quali limiti o costi sono documentati. Evitare la rassegna di annunci, le classifiche di strumenti senza prove e le promesse dei fornitori ripetute come risultati indipendenti. L’interesse personale del team per l’AI non prova la domanda del pubblico.

Ipotesi di prova futura: un episodio a settimana per tre settimane, da 4–6 minuti, con due o tre sviluppi selezionati e un approfondimento principale. Durata e cadenza sono scelte da testare, non impostazioni attive. Partire da una rubrica o playlist chiaramente distinta nel canale NESSO pertinente, senza moltiplicare subito account, presentatori e lingue. Se il pubblico risulta diverso, valutare successivamente la separazione. La [guida YouTube sui pubblici nuovi, occasionali e abituali](https://support.google.com/youtube/answer/10246996?hl=en) suggerisce coerenza di temi o formato per costruire continuità; non garantisce che uno spin-off trovi pubblico.

Decidere se provare il settimanale quando sono presenti insieme: qualità e puntualità del quotidiano sostenibili; segnali ripetuti di interesse per quelle spiegazioni rispetto a contenuti comparabili; richieste pertinenti del pubblico; capacità editoriale e budget per un controllo aggiuntivo. Una domanda finale facoltativa o un sondaggio nativo possono integrare i dati di visione, senza esserne l’unica prova. Se il campione resta piccolo, proseguire l’osservazione anziché aumentare i prodotti.

L’eventuale settimanale deve avere una policy di ricerca propria: la finestra attuale di 36 ore del quotidiano non copre da sola sette giorni. La selezione settimanale richiederà archivi e date degli eventi, distinzione tra annuncio e disponibilità effettiva, verifica attuale prima dell’uscita e revisione di ogni affermazione. Non basta cambiare il nome dell’edizione o riusare i copioni della settimana. Questo lavoro rimane nel dominio editoriale dell’app; avatar, performance e playback usano le API condivise del kit. Nessuna nuova automazione, integrazione o pubblicazione settimanale è stata attivata.

### Compatibilità con le piattaforme

| Canale | Ruolo proposto | Vincolo verificato |
| --- | --- | --- |
| YouTube | Edizione completa e destinazione principale dell’acquisizione | Originalità, disclosure pertinente e regole pubblicitarie Google |
| Instagram | Clip di una storia e riconoscibilità dei presentatori | Nell’UE le inserzioni su politica, elezioni e temi sociali non sono disponibili |
| TikTok | Scoperta tramite clip originali e test del formato | Pubblicità politica vietata; contenuti AI e inserzioni hanno regole di trasparenza |
| Spotify | Ascolto ricorrente e follow dello show | Host/distribuzione da collaudare; vietata l’imitazione non autorizzata di altri creator |

[YouTube](https://support.google.com/youtube/answer/1311392?hl=en) esclude dalla monetizzazione letture di materiali altrui senza valore originale, contenuti generici prodotti in serie e determinate forme di personaggi AI che si presentano come esperti umani su temi sensibili. Per NESSO l’idoneità YPP resta da verificare: presentatori dichiaratamente virtuali, spiegazioni originali e nessuna consulenza medica, finanziaria o legale attribuita a falsi esperti. La presenza di una sigla coerente non rende automaticamente ripetitivo il contenuto; deve variare sostanzialmente il valore di ciascuna edizione.

La [disclosure YouTube](https://support.google.com/youtube/answer/14328491?hl=en) distingue contenuti realistici alterati e contenuti non realistici/assistenza alla produzione. Il servizio dichiara che la sola disclosure non limita pubblico o idoneità alla monetizzazione. NESSO deve comunque descrivere apertamente presentatori e voci sintetiche, senza dedurre da questo una garanzia di distribuzione.

[Meta](https://about.fb.com/news/2025/07/ending-political-electoral-and-social-issue-advertising-in-the-eu/) ha interrotto nell’UE le inserzioni politiche, elettorali e su temi sociali dal 6 ottobre 2025. [TikTok Ads](https://ads.tiktok.com/help/article/tiktok-ads-policy-politics-religion-and-culture) vieta la pubblicità politica e valuta anche le destinazioni; la neutralità editoriale non è un’esenzione automatica. Anche [Google Ads nell’UE](https://support.google.com/adspolicy/answer/6014595?hl=en) applica restrizioni politiche, comprese determinate figure politiche e referendum.

Scelta operativa: edizioni organiche e creatività pubblicitarie hanno approvazioni separate. Nessun boost automatico di una notizia per il solo fatto che ha ricevuto approvazione editoriale. Gli spot del marchio presentano il servizio e il formato con materiali propri, senza essere usati per aggirare le restrizioni sui contenuti politici. Creatività, Paese, destinazione e regole dell’account vanno valutati insieme; un rifiuto si corregge o si contesta tramite il normale processo.

[TikTok organico](https://support.tiktok.com/en/using-tiktok/creating-videos/ai-generated-content) richiede etichette per contenuti AI realistici e vieta alcune rappresentazioni ingannevoli anche se etichettate; dichiara inoltre che il solo flag AI non modifica la distribuzione dei contenuti conformi. Gli [annunci TikTok](https://ads.tiktok.com/resources/help/article/tiktok-ads-policy-misleading-and-false-content) ammettono AIGC con trasparenza adeguata. Nessuna immagine di cronaca inventata viene presentata come prova di un fatto reale.

[Spotify](https://support.spotify.com/us/creators/article/impersonation-policy/) vieta la replica non autorizzata della somiglianza o voce di altri creator. Le identità NESSO devono essere originali o autorizzate. Il ruolo proposto di Spotify è una scelta editoriale, non la prova di un canale già collegato.

### Responsabilità e diritti

La [Commissione europea sull’articolo 50 dell’AI Act](https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act) distingue trasparenza sui contenuti e controllo editoriale umano, con applicazione dal 2 agosto 2026. La revisione richiesta dal progetto deve essere sostanziale: possibilità effettiva di correggere o rifiutare e un responsabile editoriale identificabile. Non è sufficiente far approvare un modello da un secondo modello. Gli obblighi applicabili al servizio e alle rappresentazioni utilizzate vanno inquadrati prima del lancio commerciale.

L’accessibilità di un RSS o di un risultato web non prova una licenza per ripubblicare testi, immagini, video o musica. Per i materiali Reuters esistono [licenze editoriali](https://reutersagency.com/who-we-serve/media/) e [commerciali per campagne](https://reutersagency.com/connect-commercial-licensing): i diritti per una puntata non si presumono estesi a un annuncio. Il progetto mantiene scrittura originale, riferimenti consultabili e grafica propria; ogni fonte e asset richiede una base d’uso appropriata, comprese le licenze commerciali delle voci e dei modelli. La stessa verifica vale per identità editoriale e informazioni pubbliche del servizio.

### Piano di acquisizione proposto

Budget indicato dall’utente: **500 euro al mese**. Viene assunto come plafond pubblicitario; produzione, API, fonti, revisione e infrastruttura restano costi separati da quantificare. Sostituisce il precedente scenario esplorativo da 1.500–3.000 euro. La comunicazione del budget aggiorna la pianificazione e non attiva campagne o pagamenti.

1. Completare il primo presentatore, una puntata IT e una World revisionate, canali di proprietà, collegamenti e prove di pubblicazione reali. La landing viene aggiornata al nome di lavoro Conclavia Daily, con claim e posizionamento nelle due lingue; resta una presentazione del progetto, senza episodi pubblici, collegamenti a canali verificati o player del TG.
2. Pubblicare un primo ciclo di 7–10 edizioni revisionate e clip originali di una sola storia. La durata di tre minuti è una scelta da validare, non un risultato di audience. Rivedere i punti di abbandono, l’esposizione, le pronunce e i commenti pertinenti prima di preparare gli spot.
3. Preparare due creatività da 15–25 secondi con aperture diverse e la stessa promessa, identità e trasparenza. Mostrare il valore reale della spiegazione e una porzione del prodotto, evitando promesse di infallibilità o indipendenza assoluta non dimostrata. Gli annunci del TG e quelli per vendere l’engine Conclavia hanno obiettivi distinti.
4. Concentrare il primo test a pagamento su **YouTube, Italia, lingua italiana**. La scelta mantiene scoperta e puntata completa sulla stessa piattaforma; è una decisione di progetto, non la prova che YouTube abbia il costo più basso. Instagram e TikTok ricevono le clip organiche; World mantiene il proprio percorso editoriale senza budget Ads in questo primo test. Non suddividere i 500 euro tra quattro piattaforme e due lingue.
5. Distribuire il plafond per fasi secondo la tabella. Proseguire solo quando fruizione successiva e azioni utili giustificano il test; i risultati piccoli o contraddittori restano inconcludenti. Fermare una creatività che porta visualizzazioni ma non seguito. Non è obbligatorio spendere tutto il plafond e non si aumenta il tetto mensile automaticamente.

| Fase del primo mese di promozione | Massimo pianificato | Impiego |
| --- | --- | --- |
| Esplorazione | 150 euro | Due aperture, con condizioni comparabili e lettura distinta dei risultati |
| Prosecuzione condizionata | 300 euro | Creatività più promettente o variante corretta, dopo revisione dei primi segnali |
| Riserva | 50 euro | Un aggiustamento motivato; resta non spesa se non serve |
| Totale | **500 euro** | Un solo prodotto/mercato pubblicizzato; nessun rinnovo operativo implicito |

Il mese di promozione parte quando prodotto e account sono pronti; non coincide obbligatoriamente con il mese di sviluppo. Il plafond di 500 euro resta riferito al mese civile e la pianificazione deve riconciliare eventuali campagne a cavallo del mese. I 150 euro iniziali non garantiscono una comparazione statisticamente conclusiva: osservare anche qualità delle visite e visioni successive, senza proclamare una creatività vincente su pochi eventi. Se il primo test non dà segnali utili, rivedere messaggio o prodotto e conservare il resto del budget.

Prima dell’attivazione scegliere e verificare un budget totale con data di fine dove supportato, contabilità delle spese già sostenute nel mese e limiti effettivi dell’account. Un budget giornaliero medio non è un tetto giornaliero rigido: [Google Ads](https://support.google.com/google-ads/answer/6385083?hl=en) descrive oscillazioni e limiti mensili per la maggior parte delle campagne; [YouTube Promote](https://support.google.com/youtube/answer/16869935?hl=en) permette di indicare budget e data di fine. Non presumere che dividere 500 per 30 impedisca da solo superamenti tra campagne o periodi diversi. Nessuna configurazione Ads è stata creata da questa pianificazione.

Non ci sono dati reali NESSO con cui stimare CPM, costo per iscritto, profitto o audience acquisibile. Questi valori devono provenire dal test, separati per lingua, mercato, piattaforma e formato. Lo scenario economico iniziale non presume ricavi YPP: valutare separatamente sponsorizzazioni editoriali trasparenti, eventuali ricavi del prodotto media e richieste commerciali per il motore Conclavia.

### Misurazione e autonomia

[Google Ads offre le YouTube follow-on views](https://support.google.com/google-ads/answer/16041562?hl=en), visioni organiche dopo l’esposizione a un annuncio, previa associazione tra canale e account Ads. È una possibile conversione del test; misura visioni, non persone uniche, e non prova da sola il ritorno quotidiano. Affiancare [retention separata paid/organica](https://support.google.com/youtube/answer/9314415?hl=en), spettatori di ritorno quando disponibili, follow e segnalazioni editoriali. I [“regular viewers” di YouTube](https://support.google.com/youtube/answer/10246996?hl=en) richiedono uno storico prolungato e non sono un obiettivo misurabile nelle prime due settimane.

[YouTube Promote](https://support.google.com/youtube/answer/16869935?hl=en) precisa che iscritti e tempo di visione ottenuti con Promote non concorrono all’idoneità YPP. Non usare i contatori acquistati come prova di crescita organica o monetizzazione raggiungibile.

Si parte dalle metriche native. Il sito pubblico non riceve pixel, analytics o moduli nuovi da questa verifica; eventuali cambi di raccolta dati richiedono una scelta esplicita e un progetto di consenso e informativa appropriato. Le metriche di piattaforme diverse non si sommano come se rappresentassero persone uniche.

Il futuro modulo di acquisizione dovrà possedere creatività, revisioni, classificazione delle restrizioni, budget autorizzato, pianificazione, connettori Ads, ricevute e metriche; sarà separato dal publisher editoriale e dall’avatar kit. L’agente potrà proporre varianti e ottimizzazioni entro limiti approvati, senza aumentare autonomamente il tetto di spesa o trasformare una notizia in un annuncio. L’automazione della produzione e pubblicazione esistente non implica un’integrazione Ads già implementata.

Esito della verifica: fattibilità tecnica e promozionale condizionata confermata; fattibilità commerciale ancora da misurare. L’investimento elevato diventa una scelta supportata dai dati dopo il pilota e i test di acquisizione, non una conseguenza automatica del fatto che la produzione è AI. Nessun account Ads, campagna, spesa o pubblicazione social è stato attivato durante questa verifica.

## Collaudo scheduler e video — 20 ottobre 2026

- 59 test TG superati con integrazione Mongo esplicita su `127.0.0.1:27018`, database temporaneo `conclavia_e2e_daily_scheduler_test`; nessuna chiamata provider reale. Comprendono concorrenza, prenotazione prima della finestra, backoff, riavvii, scadenza, rapporto finale AI, hash e ricevute senza doppioni.
- 20 casi browser distinti superati tra newsroom (10), studio (6) e presentazione (4), compresi layout a 320/390/1440 px, API con revisione obsoleta, impossibilità di sostituire l’AI con approvazione umana e accesso al solo media approvato. Il test dello studio codifica veramente i due MP4; non usa un provider vocale.
- Un ciclo reale `worker.ts --once` completato con database temporaneo vuoto e AI, voce e pubblicazioni disabilitate; nessun job o invio creato. Non è una prova della produzione quotidiana con i provider reali.
- Typecheck, ESLint e build Next separata `.next-daily-scheduler` superati. Kit condiviso e applicazione Onboarding non modificati da questo intervento.
- Promo reale: 36,96 s; 1920×1080 e 1080×1920; decodifica completa, audio presente, zero clipping. Rapporto [technical-quality-20261020.json](../images/daily-launch/technical-quality-20261020.json), 12 fotogrammi locali; non è un giudizio editoriale AI o un ascolto soggettivo.
- GUI locale aggiornata su `http://127.0.0.1:3105/podcast/tg/redazione`; player su `/podcast/tg/presentazione`. Preparazione giornaliera e modalità autonoma delle edizioni esistenti non attivate; `TG_PUBLISH_ENABLED=false`. Nessuna pubblicazione social, spesa vocale o campagna effettuata.

Per ricontrollare soltanto i file, senza database, AI, voci o social:

```sh
node --conditions=react-server --import tsx scripts/tg/check-media.ts --launch
# Oppure un pacchetto TG nell’archivio configurato:
node --conditions=react-server --import tsx scripts/tg/check-media.ts --id=ID_EDIZIONE
```

Il comando `--launch` usa una cartella temporanea eliminata a fine prova e non modifica gli MP4 originali. Un esito positivo significa integrità tecnica, non approvazione editoriale. Il player aggiunge capitoli e mood, conserva il punto passando tra formati e apre l’anteprima di una scena dopo la sua dissolvenza; la registrazione Alex e i video restano gli stessi master approvati.
