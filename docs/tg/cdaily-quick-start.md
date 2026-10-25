# Daily — entrata rapida per il testo

Questo è il punto di partenza dei prossimi giri. Non ricostruire il progetto dalla chat. Per un lavoro sul testo bastano questa pagina e il contesto locale; aprire i riferimenti estesi quando cambia una regola o si deve diagnosticare un problema. Aggiornare questo riepilogo insieme alle regole canoniche.

## Prima operazione, senza AI

```sh
npm run daily:context
```

Genera `.tg-artifacts/context/AAAA-MM-GG/agent-context.md` e `.json`: giorno e apertura corretti, claim, chiusura, pausa, configurazione e impronta delle regole. Nessuna rete, database, voce o video. È un’anteprima del file, non una verifica dello stato operativo. Per lo stato reale usare `npm run daily:mac -- status`.

## Contratto da conservare

- **Conclavia Daily**, «Meno rumore, più contesto». Italia al centro; estero per conseguenze italiane documentate o un’eccezione mondiale motivata. World è un prodotto distinto.
- **Meno di dieci minuti**, senza riempire il tempo. Di norma sei–otto notizie, margine cinque–nove quando giustificato. La durata reale si misurerà dopo il testo.
- Saluto a tutti, programma, claim e giorno/mese in pochi secondi; due secondi di pausa pulita prima delle notizie. Il codice genera apertura e chiusura: non riscriverle a ogni giro.
- Linguaggio amichevole, agile e comprensibile. Per ogni notizia: sviluppo, protagonisti e loro ruolo, contesto minimo, conseguenza documentata o incertezza. Fatti e dichiarazioni distinti. Nessuna opinione AI ricorrente o promessa di neutralità infallibile.
- Nuovo sviluppo nelle ultime 24 ore, riscontri entro 36 ore, confronto con l’archivio realmente pubblicato. Due origini sullo stesso evento; le copie di agenzia non sono indipendenti. Un tema può tornare con un fatto nuovo. Il contesto vecchio resta datato.
- Clausole con `text`, `mood`, `intensity`, `intent`, `speaker`, `storyId`, `sourceIds`. Regia coerente con le parole, quiete e varietà; il planner condiviso sceglie le pose. Puntamento sui commenti in chiusura. Nessun timestamp inventato prima della voce.
- Consegna: copione completo, titoli/cartelli, fonti, scaletta, sintesi social, score e controlli A/B. Il riassunto social viene dalla stessa stesura, poi è verificato e compilato localmente.

## Flusso e configurazione

Mac alle **07:30 Europe/Rome** → raccolta locale → selezione/verifica delle fonti → testo → A (attualità e fatti) → B (rilettura completa separata) → eventuale OK → media. Il sito riceve il pacchetto approvato; Work distribuisce, obiettivo 08:15.

In `config/tg/daily-agent.json`: `productionMode: full`, `textReviewMode: manual` attualmente attivo. `ai` o campo omesso salta soltanto l’OK umano. A/B e revisione finale rimangono obbligatori. Dopo una modifica al file: `npm run daily:agent -- configure`. La GUI salva direttamente nel backend; le edizioni già create mantengono lo snapshot.

Per un laboratorio **solo testo**, con chiamate AI esplicite ma media impossibili:

```sh
npm run daily:editorial
```

Riprendere la sessione privata esistente. Correggere rilievi concreti e conservare errori/contatori; nessun reset o ripetizione alla ricerca di un sì. Il ciclo normale ha una correzione automatica; il laboratorio ne richiede esplicitamente al massimo dodici. `productionMode: editorial` è un arresto tecnico distinto dal flag manuale.

## Risparmio già applicato

Regole, date, parsing RSS, fonti, validazioni, compilazione score e pacchetti sono locali. La ricerca viene riusata per singola notizia e query identica entro una finestra massima di 30 minuti. Le verifiche A raggruppano target della stessa notizia; B continua a leggere tutto. Cambiare il testo richiede nuovi giudizi, senza rifare le ricerche delle notizie immutate ancora valide. Il giorno successivo richiede nuove prove.

Regole complete: [standard editoriale](cdaily-editorial-standard-20261025.md). Decisioni sui costi e misura locale: [flusso locale del testo](cdaily-text-local-first.md). Setup, migrazione o guasti: [runbook](cdaily-agent-runbook.md). Solo quando si passa ai media: [standard di produzione](cdaily-production-standard.md) e [identità video](cdaily-video-guide.md). Voce Alex 2 e look approvato restano invariati.
