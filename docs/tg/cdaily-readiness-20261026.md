# Daily del 26 ottobre — consegna operativa

Verificato il 25 ottobre 2026. Questa pagina registra predisposizione e collaudi tecnici, non attesta una puntata futura prodotta o pubblicata.

## Giro effettivo del 26 ottobre

Il timer ha avviato il job `6adef3723a80c1de325ac341`. Le consegne precedenti di 855 e 809 parole sono superate dalle revisioni richieste dall’utente. **La versione corrente è di 789 parole e sei notizie, A/B positivi, `editorial_ready` alla revisione 73, senza conferma manuale.** A ha verificato attualità e 45 target; B tutte le 25 clausole e i criteri globali. [Copione e giudizi correnti](editions/2026-10-26-it-editorial-review.md); [rifinitura del contesto e confronto reale](cdaily-context-relevance-20261026.md); [primo giro narrativo](cdaily-narrative-revision-20261026.md).

Writer e B condividono criteri generali su contesto giornalisticamente pertinente, naturalezza, ripetizioni e contributo informativo, senza schemi obbligatori o esempi legati a singole notizie nei prompt di produzione. B ha respinto il vecchio lead per il contesto fattuale mancante; la stesura corretta ha superato A/B. Il writer ha generato 822 parole sopra soglia, ma ha ancora richiesto una rifinitura dell’agente: non è dimostrata una qualità autonoma uniforme al primo tentativo. Espressività appropriata di Alex, score, fonti e conferma manuale restano parte del contratto. Nessun audio, video o pubblicazione; due tentativi worker e sedici correzioni storiche conservati. La revisione non riapre la finestra odierna: questa puntata non va pubblicata tardivamente o trasformata automaticamente in quella di domani.

Alex 2 era stato verificato in sola lettura con quota sufficiente; 17 impronte visive corrispondono allo stile approvato. Il presente giro è solo testo. Le note seguenti registrano il collaudo del 25 ottobre, non una nuova certificazione dei canali o della produzione completa del 26.

## Crediti ripristinati e controllo del servizio

Alle **17:59 UTC del 25 ottobre**, OpenAI aveva risposto **HTTP 429, crediti esauriti** durante il controllo A della prova privata. Dopo la ricarica dichiarata dall’utente, alle **21:00 UTC (22:00 locali)** una richiesta minima al modello editoriale configurato `gpt-5.4` è stata completata correttamente. Ricevuta privata: `.tg-artifacts/provider-health/2026-10-25.json`. Questa verifica conferma il servizio disponibile in quel momento, non il completamento di A/B o dei media né un saldo futuro garantito.

La prova privata precedente è rimasta conservata e non approvata, fuori dalla propria finestra oraria; non è stata rilanciata come puntata corrente. Il controllo operativo conferma database connesso e tutti e tre i servizi Mac caricati; prossimo avvio **26 ottobre alle 07:30 Europe/Rome (06:30 UTC)**. La revisione manuale è ancora attiva: raccolta fresca e A/B, poi attesa dell’OK sul testo prima di voce e video. Nessuna pubblicazione è stata effettuata durante il controllo del credito.

La configurazione persistente ora usa `editorialProfile: italia-morning-v2`: obiettivo 5–7 minuti, minimo sei notizie, normalmente 6–8, massimo nove; master minimo 4:30 e sotto 10:00. [Decisioni e motivazioni degli scarti](cdaily-selection-policy-20261025.md). La verifica in sola lettura conferma: prova assente dal database, archivio pubblicato invariato, job reale del 25 ottobre invariato e nessun job anticipato del 26. Il catalogo Italia è ampliato a 31 feed e 21 origini dichiarate, con diagnostica per feed salvata nel recupero; il collaudo RSS reale ha acquisito 943 articoli nella settimana, 556 datati nelle ultime 24 ore (non eventi distinti già verificati). La copertura insufficiente ora attiva automaticamente ricerca integrativa nel secondo e, se serve, terzo giro dello stesso job, con ripresa persistente; i controlli simulati includono quattro valide più due nuove e un cambio di lease durante il recupero. Il nuovo profilo è una modifica intenzionale delle regole future, non una notizia di prova registrata come trasmessa.

## Domani

1. **07:30 Europe/Rome (06:30 UTC)**: il timer del Mac avvia una nuova edizione Italia datata 26 ottobre. Raccolta e memoria del pubblicato, selezione, copione completo, score semantico, titoli, scaletta e testo social; controlli AI A/B obbligatori.
2. Con `productionMode: full`, `textReviewMode: manual` attualmente salvati, il sistema si ferma a **Testi verificati**. Aprire la [GUI sul Mac](http://localhost:3107/podcast/tg/redazione), leggere testo e regia, inserire il revisore, spuntare la conferma e premere **Conferma testo e avvia produzione**. Un errore editoriale resta un blocco da correggere; non viene approvato per rispettare l’orario.
3. Al controllo successivo del timer, la stessa versione confermata riprende: attualità/A/B, Alex 2, allineamento, avatar e master nativi portrait/landscape, revisione finale AI. L’approvazione del testo non approva automaticamente i media.
4. Il Mac carica soltanto il pacchetto completo approvato sul sito. **08:15** è l’obiettivo Work; **08:45** chiude la finestra. Work deve usare solo il Daily odierno realmente rilasciato, altrimenti attende o segnala il blocco.

Il Mac deve restare alimentato, acceso e con utente connesso. Non occorre lasciare aperta questa chat. La GUI serve per l’OK manuale; la produzione non dipende dal server Next della GUI.

## Verifiche e limiti

- I tre LaunchAgent risultano caricati: tunnel del database esistente, caffeinate e produttore. Configurazione persistente letta dal backend: Italia attiva, 07:30, fuso Europe/Rome, sito prima dei social, revisione manuale attiva. Nessuna prenotazione anticipata con notizie del giorno precedente.
- Prerequisiti Mac presenti, identità Alex 2 già verificata dalla prova salvata; 17 impronte di asset e impostazioni grafiche corrispondono allo stile approvato. La disponibilità futura dei provider e dei crediti non è certificata da questi controlli.
- Ricevitore sito verificato in sola lettura: installato, timer attivo/abilitato, nessuna generazione o distribuzione social sul server.
- L’azione manuale usa revisione e lease, A/B correnti, hash del testo/score, data e archivio. Due conferme concorrenti non accodano due produzioni. Modifiche o controlli non validi impediscono la conferma. Contatori e precedenti errori rimangono conservati.
- Rifinitura del contesto del 26 ottobre: **208 test Daily superati**, zero saltati, typecheck, lint e build separata positivi. Provider simulati nei test; A/B reali descritti nel dossier, nessun media.
- Collaudo precedente del 26 ottobre dopo la revisione narrativa: **205 test Daily e 61 test provider/podcast superati**, con provider simulati; **17 impronte visive confermate**, typecheck, lint e build separata superati. I test non certificano la qualità delle generazioni reali.
- Collaudo precedente del 25 ottobre: **199 test Daily superati, comprese tutte le integrazioni** su `mongodb://127.0.0.1:27018` e database `conclavia_e2e_*` dedicati; **14 test GUI superati nel collaudo precedente**, incluso il nuovo passaggio manuale e le larghezze 320/390/1440 px. Typecheck, lint dei file modificati e build Webpack separata `.next-build-verify` superati. Nessun provider reale usato nei test; le applicazioni esistenti sono state preservate.
- La task **ChatGPT Work delle 08:15 non è verificata da questo strumento**. Prompt completo: [task Work](cdaily-work-publication-task.md). Un link Spotify o una pagina social non certificano una connessione di caricamento; gli esiti dipendono dalle connessioni effettive di Work.
- Il primo Daily completo da notizie fresche fino alle ricevute social resta da osservare. Non garantire un master in 45 minuti finché non è misurato. Nessun nuovo take, video o post reale prodotto per questi test di predisposizione.

## Ripresa rapida

Per il lavoro ordinario leggere [entrata rapida](cdaily-quick-start.md) ed eseguire `npm run daily:context`; per stato reale `npm run daily:mac -- status`. I file privati in `.daily-agent/` e `.tg-artifacts/` conservano diagnostica e cache. Non azzerare gli errori del job storico del 25 ottobre né trasformare il suo laboratorio in un’edizione odierna. Migrazione Mac: [produttore portabile](cdaily-mac-producer.md).
