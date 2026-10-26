# CDaily — pertinenza del contesto, 26 ottobre 2026

**Rapporto storico della revisione 73.** La successiva verifica richiesta dall’utente ha rilevato dati serbi superati e introdotto sottoesiti B espliciti: [ultimo intervento e risultati](cdaily-currentness-quality-20261026.md). I sì descritti qui non approvano una revisione successiva; lo stato corrente è nel dossier dell’edizione.

Ulteriore rifinitura richiesta dall’utente dopo la revisione narrativa. Documento interno: non è un’approvazione o un annuncio di pubblicazione.

## Regole generali implementate

- `DAILY_CONTEXT_POLICY`, in `src/lib/tg/narrative-policy.ts`, è condivisa da writer e B: il pubblico è generalista adulto, il contesto deve cambiare la comprensione di questa notizia. Ruoli indispensabili, rapporti fra i protagonisti, origine documentata, decisione in gioco e confronti significativi sono scelte possibili, non una lista di sezioni obbligatorie.
- La prova di rimozione distingue spiegazione utile e riempitivo: quale equivoco materiale rimane senza il passaggio? Nessun aumento automatico di lunghezza, definizioni o tecnicismi. Il gergo si chiarisce solo se necessario al fatto concreto; nessuna informazione o relazione causale viene inventata per renderlo interessante.
- B valuta esplicitamente naturalezza, ripetitività, pertinenza del contesto e contributo informativo/funzione narrativa. Usa `form`, `coherence` e `coverage` già esistenti. Fatti, attribuzioni, date, tracciabilità e `delivery` restano obbligatori. Transizioni brevi, qualificazioni necessarie e formulazioni espressive non vengono eliminate meccanicamente.
- `agents.ts` e la linea espositiva comune applicano lo stesso criterio; anche la ricerca del contesto nel recupero delle prove esistente privilegia relazioni e informazioni pertinenti. Rimosso un vecchio suggerimento riferito a un singolo Paese. Le istruzioni di produzione non contengono esempi tratti dalle notizie dell’edizione.
- Alex conserva calore, curiosità, energia e coinvolgimento appropriati. Nessuna normalizzazione automatica di mood/intensità, nessun nuovo gesto imposto. Lo score resta quello che governa parlato e successivo allineamento misurato.
- Nessun nuovo stadio, campo di rapporto o contratto pubblico. La politica narrativa è già parte dell’impronta B e delle cache del laboratorio: un vecchio giudizio non approva la nuova versione delle regole. Conferma manuale configurabile e filtri di profondità/copertura invariati.

## Rivalutazione reale

Archiviata privatamente la versione di 809 parole, revisione 71, insieme a ricerca, score, A/B e dossier. Due tentativi worker e quindici correzioni storiche conservati; nessun reset o ricevuta umana creata.

Aggiornate le ricerche indipendenti sulle sei notizie. B, senza conoscere il precedente verdetto o la valutazione dell’agente, ha respinto la vecchia stesura: nel lead su Siher manca il contesto fattuale del tipo di inchiesta/accuse, mentre la definizione della convalida occupa il suo posto. `coverage: false`, due clausole segnalate, apertura/chiusura e `delivery` positive. Il cambiamento ha quindi rilevato un difetto reale nel copione, oltre a trasmettere nuove istruzioni.

Sono stati acquisiti direttamente anche corpi e metadati dei documenti necessari per le informazioni aggiuntive. Questi riscontri appartengono al materiale della singola edizione, non agli esempi dei prompt di produzione. Il registro precedente resta conservato; le prove nuove sono nel contesto recuperato e nei relativi file privati.

La correzione usa il writer esistente, con la bozza e i rilievi reali di B come materiale editoriale. Gli esiti conclusivi e il confronto del copione sono riportati sotto. La revisione non riapre la finestra mattutina o autorizza una pubblicazione tardiva/ridatazione.

## Regressioni

208 test Daily superati, senza test saltati: integrazioni MongoDB sul server temporaneo esplicito `127.0.0.1:27018`, database `conclavia_e2e_*` e provider simulati. Tre regressioni aggiunte mostrano che contesto essenziale mancante, spiegazione irrilevante e prosa vuota bloccano nei campi B esistenti anche con i fatti positivi, prima dei media e della conferma manuale. Il test dell’adapter writer conserva esattamente score vivaci e fonti; writer e B ricevono la politica comune. Questi test provano trasporto e blocchi, non sostituiscono la valutazione editoriale reale.

## Confronto concreto

| Passaggio | Versione precedente | Rifinitura |
| --- | --- | --- |
| Lead | Definizione della convalida, senza chiarire abbastanza il nucleo dell’inchiesta. | Ruolo attribuito a Siher, collegamento alle manifestazioni e contestazioni della Procura, mantenute come accuse. |
| Serbia | Il protagonista non era qualificato; la maggioranza veniva spiegata e poi nuovamente parafrasata. | Identificati ruolo e schieramento del protagonista, conservando cifre e provvisorietà del risultato. |
| Sport | Distinzione generale fra vittoria di una gara e titolo, con più richiami allo stesso stato del campionato. | Informazioni specifiche sulla prestazione e sulla portata del risultato, mantenendo condizioni e carattere ancora futuro del titolo. |
| Editoria | Ripetuta la fase preliminare dell’operazione. | Precisato il peso dei soci contrari nella proprietà, senza dichiarare impossibile un esito futuro. |

809 parole iniziali → 822 nella generazione del writer → 789 nella rifinitura finale. Sei notizie in tutte le versioni; clausole dello score 27 → 26 → 25. Sintesi finale 120 parole e 797 caratteri, su tutte le notizie. Apertura con il giorno, pausa prevista, formula finale e singolo puntamento ai commenti sono conservati. Nessun take generato: il minutaggio resta una stima di circa cinque minuti.

Il writer aggiornato ha raggiunto da solo la soglia di profondità in questo tentativo e ha migliorato il lead. Conservava però spiegazioni e recap dispensabili: la bozza finale comprende una rifinitura dell’agente, non viene presentata come uscita grezza del writer. Questa prova mostra un miglioramento concreto e un limite ancora osservato, senza garantire qualità autonoma uniforme nelle edizioni future.

## Esito conclusivo

**A e B positivi sulla stesura finale di 789 parole e sei notizie, revisione 73, stato `editorial_ready`.** A ha verificato attualità/novità e 45 target complessivi, incluse 20 clausole fattuali: parlato, titoli, cartelli e sintesi. B ha verificato tutte le 25 clausole con score e prove, senza ricevere il giudizio di A: coerenza, imparzialità, apertura, chiusura e copertura positive. Il nuovo esito di B supera il rilievo sul contesto del lead; l’esito negativo della vecchia stesura resta conservato.

[Copione completo, fonti, regia e identità della versione](editions/2026-10-26-it-editorial-review.md). Apertura e chiusura restano quelle dell’applicazione. I nuovi accenti dello score seguono le informazioni e le formulazioni riviste; l’energia del passaggio sportivo è mantenuta, senza imporre lo stesso mood a tutto il corpo o ruotare emozioni per esibire varietà. Il renderer, le gesture, l’allineamento e la voce non sono stati modificati o eseguiti. Nessuna recitazione fisica o qualità audio non prodotta è certificata da questa revisione testuale.

208 test Daily, typecheck, ESLint dei file modificati, build Webpack separata e `git diff --check` superati. Nessun provider reale nei test di regressione; le chiamate editoriali reali descritte sopra sono distinte dai test simulati.

Due tentativi worker e sedici correzioni complessive conservati. Nessuna conferma manuale, manifest, asset multimediale o pubblicazione. L’archivio pubblicato è stato confrontato prima/dopo ed è rimasto invariato. La pipeline continua a richiedere l’OK sul testo esatto dove configurato; la presente revisione non autorizza una produzione tardiva o la ridatazione dell’edizione.
