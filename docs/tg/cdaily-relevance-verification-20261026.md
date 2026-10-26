# CDaily — pertinenza delle prove e verifica semantica di B

Verifica mirata del 26 ottobre 2026. **Daily salvato invariato:** nessuna riscrittura, raccolta di nuove notizie, generazione di voce/video o pubblicazione. Nessuna scrittura ai job reali. Template del generatore, personalità di Alex, regia, orari e approvazione manuale conservati.

## Correzioni generali, negli stessi A/B

**B.** Il protocollo dei quattro sottoesiti ora esplicita il confronto fra proposizioni informative: sinonimi, sintassi diversa e spostamento di una frase non costituiscono un’informazione nuova. Una qualificazione materiale, una relazione o una funzione narrativa utile possono invece giustificare un richiamo. Il confronto riguarda anche la priorità del contesto: dettagli corretti ma secondari non compensano una relazione essenziale omessa. Nessuna gerarchia obbligatoria di paragrafi, quota di spiegazioni o riduzione dell’espressività. Motivazioni, riferimenti alle clausole e blocchi già esistenti restano gli stessi.

**A.** Individuata una lacuna concreta: `web_search_call.action.sources` comprendeva tutti i collegamenti scoperti dalla ricerca, non solo quelli utilizzati nel riscontro. La presenza in quel catalogo dimostrava il recupero, non la pertinenza alla specifica affermazione.

- Il recupero delle prove mantiene ora soltanto URL effettivamente citate nel testo del riscontro o nelle annotazioni di citazione del provider. Una URL scritta dal modello ma assente dal recupero/annotazioni non viene inventata come fonte. Restano validazione dei domini, normalizzazione e verifiche scientifiche esistenti. Se non restano citazioni utilizzabili, il recupero fallisce esplicitamente.
- La chiave della cache include anche la nuova politica di pertinenza, per evitare il riuso di un vecchio catalogo grezzo. Le ricerche grezze rimangono nelle tracce private; non vengono presentate tutte come prove. Non si eliminano citazioni pertinenti solo perché contraddicono il copione.
- L’insieme ammissibile delle URL è legato alla notizia di ogni affermazione, anche per cartelli e frasi del parlato, indipendentemente dai gruppi di richieste. Lo schema restringe i valori ammissibili; il validatore applica di nuovo il vincolo. Inserire una fonte di un’altra notizia rende il target `unverifiable`, anche insieme a una URL valida. Una fonte condivisa resta utilizzabile quando associata esplicitamente a entrambe le notizie.
- Il catalogo finale di A e `webSourceUrls` includono le fonti effettivamente associate ai controlli, invece dell’intero elenco recuperato. Anche un arresto nell’attualità espone le sole fonti associate a quei confronti. Le fonti dei rilievi negativi restano visibili: sono prove della contestazione, non certificazioni positive della notizia.
- A deve motivare nel campo `evidence` esistente il legame tra documento e affermazione. Stesso argomento, soggetto o dominio non basta; link di navigazione, rimandi laterali e menzioni incidentali non costituiscono corroborazione. Mancanza di supporto e prove contrarie restano bloccanti.

**Nessun nuovo passaggio o campo nei contratti JSON.** Restano gli stessi target, stati, cinque globali e quattro sottoesiti B. Cambiano ammissibilità e uso delle citazioni all’interno delle fasi esistenti; nessun nuovo revisore o chiamata aggiuntiva nella pipeline ordinaria. Il protocollo B entra nell’impronta già esistente: i vecchi esiti restano conservati e non vengono dichiarati automaticamente conformi alle nuove regole. Questo intervento non ha rilanciato la verifica del Daily.

## Verifiche semantiche reali, separate dalla produzione

Il modello editoriale configurato è stato chiamato su dati dichiaratamente inventati e isolati. Nessun writer, worker o collegamento ai job del Daily. I test automatici di regressione continuano a usare provider simulati.

Le prime prove con l’adapter completo B hanno rilevato le parafrasi e i dettagli secondari, ma il controllo positivo era confuso dal rifiuto di ammettere una vicenda inventata come notizia reale. Questo rifiuto è corretto per la produzione: non è stato disattivato. Inoltre la prima fixture A usava domini placeholder non ammessi dal validatore; non è usata come prova di attribuzione corretta. Esiti preliminari conservati privatamente, senza presentarli come successo.

Per isolare la domanda editoriale sono state poi eseguite **tre prove di componente** con gli stessi criteri narrativi, protocollo, schema e validatore di B, valutando esplicitamente l’esempio come ipotetico. Questa prova non certifica l’ammissione di una notizia reale.

| Caso controllato | Risultato osservato |
| --- | --- |
| Trasferimento di un servizio: sede, motivo strutturale, durata e accesso descritti senza doppioni. | Tutti e quattro i sottoesiti B positivi; nessun rilievo. |
| Stesso testo, con due ulteriori formulazioni dello spostamento: «le visite non si svolgeranno più nei vecchi locali» e «gli appuntamenti avranno luogo nel nuovo quartiere». | `nonRedundancy: false`, riferimenti alle tre clausole; `informationValue: false`. Il contesto essenziale resta giudicato pertinente. |
| Stesso evento, ma spazio dedicato a colore dei cartelli, sedie e cerimonia, omettendo motivo, durata e accessibilità. | `contextRelevance: false` e `informationValue: false`; `nonRedundancy: true`. B distingue quindi povertà del contesto e ripetizione. |

Una prova separata di **pertinenza semantica in A**, con la stessa politica delle fonti e lo schema fattuale esistente, ha dato:

| Affermazione della fixture | Prova fornita | Esito |
| --- | --- | --- |
| Apertura della nuova sede. | Documento che descrive direttamente apertura e trasferimento. | `supported`, citazione del documento pertinente. |
| Quaranta sedie nella sala d’attesa. | Numero presente nello stesso documento. | `supported`, citazione pertinente. |
| Attese ridotte del 40%. | Altro documento sanitario parla di bilancio aumentato del 40%, senza misurare le attese. | `unsupported`: il numero e l’argomento simili non dimostrano la stessa affermazione. |
| Navetta a due euro. | Documento che la dichiara gratuita. | `unsupported`, con fonte contraria conservata. |

Gli URL della fixture sono percorsi sintetici per il validatore, non articoli consultati né fonti del Daily. Questa prova riguarda lettura e attribuzione degli estratti forniti; non esegue il controllo A completo di attualità o una nuova raccolta sul web.

Gli esiti permettono di osservare i comportamenti richiesti su casi controllati. Non sono una garanzia su ogni futura parafrasi o scelta editoriale: la pertinenza semantica rimane un giudizio AI. Il codice garantisce provenienza, associazioni ammissibili e applicazione dei blocchi, senza sostituirli con somiglianza lessicale o criteri basati soltanto sul dominio.

## Verifiche locali e conservazione del Daily

- **220 test Daily superati**, zero saltati, provider simulati; integrazioni seriali su `mongodb://127.0.0.1:27018`, database `conclavia_e2e_*` separato. Quattro regressioni nuove coprono citazioni realmente usate, link marginali/scoperti ma non citati, mancata citazione, URL inventate, abbinamenti a un’altra notizia, catalogo finale e conservazione delle prove contrarie. Controllati anche i parametri di tracking e gli articoli con prefissi simili.
- Typecheck, lint dei file modificati, build Webpack separata e bundle editoriale privo di media/publisher superati. App esistente preservata.
- Ricalcolo **solo locale** sui sei cataloghi web archiviati: 135 collegamenti scoperti, 26 citati nel testo dei riscontri. Non è una nuova verifica dell’edizione né una misura di origini indipendenti. Le vecchie annotazioni di citazione non erano salvate in quel file; il recupero nuovo usa anche quelle, quindi il conteggio non anticipa esattamente il prossimo risultato di produzione.
- Hash del dossier Markdown del Daily prima/dopo: `6fa2783e938fcf72bb13b6366c39c416f7db8b13d74a593400b18a0298fc9fff`, identico. Nessuna modifica al dossier, ai testi, allo score o ai job reali durante le prove.

Artefatti privati: `.tg-artifacts/evals/editorial-relevance-20261026/` (preliminare), `editorial-relevance-20261026-v2/` (adapter completo e attribuzione A), `editorial-relevance-20261026-components/` (tre confronti editoriali, hash e ricalcolo locale). Il documento descrive quali prove sono conclusive per il singolo criterio e quali avevano limiti del banco di prova.
