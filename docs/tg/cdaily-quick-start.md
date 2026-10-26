# Daily — entrata rapida per il testo

Questo è il punto di partenza dei prossimi giri. Non ricostruire il progetto dalla chat. Per un lavoro sul testo bastano questa pagina e il contesto locale; aprire i riferimenti estesi quando cambia una regola o si deve diagnosticare un problema. Aggiornare questo riepilogo insieme alle regole canoniche.

## Prima operazione, senza AI

```sh
npm run daily:context
```

Genera `.tg-artifacts/context/AAAA-MM-GG/agent-context.md` e `.json`: giorno e apertura corretti, claim, chiusura, pausa, configurazione e impronta delle regole. Nessuna rete, database, voce o video. È un’anteprima del file, non una verifica dello stato operativo. Per lo stato reale usare `npm run daily:mac -- status`.

## Contratto da conservare

- **Conclavia Daily**, «Meno rumore, più contesto». Italia al centro; estero per conseguenze italiane documentate o un’eccezione mondiale motivata. World è un prodotto distinto.
- **Obiettivo 5–7 minuti**, minimo sei notizie, normalmente 6–8 e massimo nove. Master reale almeno 4:30 e inferiore a 10:00, senza riempitivi. Profilo `italia-morning-v2`; gli snapshot precedenti mantengono le loro soglie. [Criteri e scarti del collaudo](cdaily-selection-policy-20261025.md).
- Saluto a tutti, programma, claim e giorno/mese in pochi secondi; due secondi di pausa pulita prima delle notizie. Il codice genera apertura e chiusura: non riscriverle a ogni giro.
- Alex giovane, amichevole, sciolto, credibile ed espressivo. Linguaggio da ascoltare, contesto indispensabile e documentato; nessuna sequenza narrativa obbligatoria, riepilogo ripetuto o previsione forzata. Attribuzioni nel parlato quando servono al grado di certezza; fonti complete nei metadati. Fatti e dichiarazioni distinti. Nessuna opinione AI ricorrente o promessa di neutralità infallibile.
- Contesto per generalisti adulti: colmare una lacuna importante su questa notizia, senza spiegare concetti ovvi. Prova di rimozione del passaggio: quale equivoco concreto resterebbe? Non aumentare automaticamente spiegazioni, lunghezza o tecnicismi; non inserire esempi di singole notizie nelle regole di produzione.
- Catalogo Italia: 31 feed, 21 origini dichiarate; diagnostica acquisizione/date per feed salvata in `coverageRecovery.collection`. Sotto sei notizie è un’anomalia della raccolta/selezione da risolvere. [Fonti e collaudo](cdaily-source-expansion-20261025.md).
- Nuovo sviluppo nelle ultime 24 ore, riscontri entro 36 ore, confronto con l’archivio realmente pubblicato. Due origini sullo stesso evento; le copie di agenzia non sono indipendenti. Un tema può tornare con un fatto nuovo. Il contesto vecchio resta datato.
- Precisione delle date proporzionata: cronologia attendibile e parte della giornata possono bastare, senza l’ora esatta di ogni voto. Chiederla solo se cambia l’ammissione al confine della finestra o rispetto al pubblicato. Un annuncio recente è verificato come annuncio, mantenendo futuro il passaggio atteso; non deve essere già avvenuto né essere stato annunciato necessariamente oggi.
- Clausole con `text`, `mood`, `intensity`, `intent`, `speaker`, `storyId`, `sourceIds`. Regia coerente con le parole, quiete e varietà; il planner condiviso sceglie le pose. Puntamento sui commenti in chiusura. Nessun timestamp inventato prima della voce.
- Espressività proporzionata, senza attenuazione automatica: conservare il calore, la curiosità e l’energia appropriati di Alex. Nessun appiattimento dei mood o delle intensità per rendere il parlato più credibile.
- B controlla contenuti come prima e blocca anche ripetitività sostanziale, opacità e contesto essenziale mancante: [revisione narrativa del 26 ottobre](cdaily-narrative-revision-20261026.md). I nuovi criteri invalidano i vecchi esiti B; i contratti pubblici restano invariati. La segmentazione interna è libera entro i limiti tecnici, senza imporre frasi o recap per riempire slot.
- B conserva i cinque esiti globali e registra quattro sottoesiti obbligatori: naturalezza, ripetizioni informative (anche parafrasi), pertinenza del contesto e contributo informativo/funzione narrativa. Ogni esito ha una motivazione; i negativi citano le clausole e bloccano anche con i cinque globali positivi. [Verifica dell’implementazione](cdaily-currentness-quality-20261026.md).
- A aggiorna la ricerca al momento della verifica, confrontando proiezioni, conteggi, ruoli e sviluppi con le prove autorevoli più recenti trovate. Ogni notizia registra `latest: current/superseded/unverifiable`: un evento fresco con dati superati resta bloccato. Non riusare la cache della raccolta come prova di un nuovo controllo A.
- Consegna: copione completo, titoli/cartelli, fonti, scaletta, sintesi social, score e controlli A/B. Il riassunto social viene dalla stessa stesura, poi è verificato e compilato localmente.

## Flusso e configurazione

Mac alle **07:30 Europe/Rome** → raccolta locale → selezione/verifica delle fonti → se meno di sei, recupero immediato conservando le valide (secondo giro, poi terzo se serve) → testo → A (attualità e fatti) → B (rilettura completa separata) → eventuale OK → media. Il sito riceve il pacchetto approvato; Work distribuisce, obiettivo 08:15.

In `config/tg/daily-agent.json`: `productionMode: full`, `textReviewMode: manual` attualmente attivo. `ai` o campo omesso salta soltanto l’OK umano. A/B e revisione finale rimangono obbligatori. Dopo una modifica al file: `npm run daily:agent -- configure`. La GUI salva direttamente nel backend; le edizioni già create mantengono lo snapshot.

Con `manual`, aprire la GUI privata `/podcast/tg/redazione`, scheda **Testi verificati**, leggere copione, score e sintesi; compilare il revisore, spuntare la conferma e premere **Conferma testo e avvia produzione**. L’azione conserva i contatori e accoda quella versione: il Mac riprende entro il controllo successivo (circa un minuto), ricontrolla A/B e attualità, poi avvia i media. Il primo passaggio solo testo e l’attesa non compilano il renderer. Un controllo scaduto richiede **Richiedi nuova verifica**; non autorizza una conferma fittizia o una produzione oltre le 08:45. Questo percorso riguarda le edizioni del database, non importa automaticamente una sessione privata del laboratorio.

Per un laboratorio **solo testo**, con chiamate AI esplicite ma media impossibili:

```sh
npm run daily:editorial
```

Riprendere la sessione privata esistente. Correggere rilievi concreti e conservare errori/contatori; nessun reset o ripetizione alla ricerca di un sì. La copertura ha fino a tre giri di ricerca integrativa, salvati nel medesimo job; è distinta dalle riscritture e dagli errori tecnici. Il ciclo normale di riscrittura ha una correzione automatica; il laboratorio ne richiede esplicitamente al massimo dodici. `productionMode: editorial` è un arresto tecnico distinto dal flag manuale.

Per una prova completa separata, senza influenzare le prossime notizie: `npm run daily:editorial -- --rehearsal=prova-serale`. Il dossier va in `.tg-artifacts/rehearsals/AAAA-MM-GG/prova-serale/review.md`, senza registrazione nel database, archivio pubblico o modifica degli orari. Anche questa prova aspetta il tuo OK sul testo prima dei media. [Procedura e limiti](cdaily-private-rehearsal.md).

## Risparmio già applicato

Regole, date, parsing RSS, fonti, validazioni, compilazione score e pacchetti sono locali. La raccolta può riusare ricerche per singola notizia e query identica per al massimo 30 minuti; ogni nuova verifica A effettua invece un recupero aggiornato, con ricevuta locale legata a testo/ricerca e prove acquisite entro cinque minuti dall’avvio del giudizio. A raggruppa i target della stessa notizia; B legge tutto e può usare lo stesso snapshot fresco senza ricevere il verdetto A. Cambiare il testo richiede nuovi giudizi. Restano le scadenze esistenti dei rapporti: non è un monitoraggio continuo delle fonti. Il giorno successivo richiede nuove prove.

Regole complete: [standard editoriale](cdaily-editorial-standard-20261025.md). Decisioni sui costi e misura locale: [flusso locale del testo](cdaily-text-local-first.md). Setup, migrazione o guasti: [runbook](cdaily-agent-runbook.md). Solo quando si passa ai media: [standard di produzione](cdaily-production-standard.md) e [identità video](cdaily-video-guide.md). Voce Alex 2 e look approvato restano invariati.
