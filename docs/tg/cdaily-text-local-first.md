# Daily — riuso locale e costo della preparazione del testo

Decisione del 25 ottobre 2026. Obiettivo: ridurre contesto e richieste ridondanti, conservando qualità, novità e due controlli editoriali. L’audio e il video sono fuori da questo intervento.

## Decisione

Il testo giornaliero è un’applicazione con regole versionate, dati odierni e checkpoint. Le parti fisse vengono generate da codice locale; l’AI riceve il materiale necessario al proprio compito. I nuovi giri partono dalla [pagina rapida](cdaily-quick-start.md), non dall’intera conversazione o dalla rilettura di tutti i vecchi esperimenti.

Le lunghe iterazioni del primo copione erano anche un collaudo del motore. Non vanno assunte come procedura ordinaria. Prima di scrivere, la scheda di ogni notizia deve già distinguere tempo dell’evento e dell’articolo, sviluppo nuovo, fonti sullo stesso fatto, contesto verificato e incertezze. Le istruzioni di produzione (pausa e chiusura) restano esplicite al revisore, separate dal parlato. Questo evita di spendere nuove richieste per ricostruire contesto mancante o chiedere all’audio una prova che appartiene alla fase successiva.

| Parte | Esecuzione e riuso |
| --- | --- |
| Nome, claim, giorno, saluto, invito finale, pausa | Funzioni locali; cambia la data dell’edizione. |
| Fonti, parsing RSS, URL, date, editori e bilanciamento | Codice locale; le notizie vengono raccolte di nuovo. Il catalogo attuale ha 25 feed, 18 italiani, 11 gruppi italiani dichiarati. |
| Archivio del pubblicato | Lettura persistente; supporta il confronto. Un archivio non disponibile non equivale ad archivio vuoto. |
| Selezione, contesto, scrittura e sintesi social | Ragionamento AI sui dati; una stesura produce copione, score e sintesi insieme. |
| Prove web della singola notizia | Nella raccolta: riutilizzabili per stessa query, fonti, modello e regole, al massimo 30 minuti. La verifica A forza invece nuove ricerche. |
| A: attualità e verifica dei fatti | Recupero aggiornato, confronto esplicito con gli ultimi snapshot autorevoli e target esaustivi; ogni gruppo riceve prove pertinenti e l’intero parlato come contesto. |
| B: contenuto, forma e regia | Chiamata distinta sull’intera edizione; non riceve il verdetto A. |
| Formattazione, score, scaletta, testo condivisibile, hash e dossier | Compilazione locale dai dati verificati; nessun modello aggiuntivo. |
| OK manuale | Configurabile: `manual` attende l’utente; `ai` conserva A/B e prosegue. |

Si riusano struttura, funzioni e contesto verificato; il corpo delle notizie deve descrivere i fatti dell’edizione corretta. Sostituire solo la data di una puntata precedente non crea una nuova puntata.

## Ottimizzazioni implementate

**Contesto locale breve.** `npm run daily:context` genera un handoff datato di circa 2.500 caratteri, senza leggere la chat, caricare `.env.local` o chiamare rete/database/provider. Include un fingerprint delle regole; il file è un’anteprima, non un’approvazione editoriale o una prova dello stato del Mac.

**Cache per notizia.** La chiave include l’ID, le esatte frasi da verificare, candidati e prove disponibili, domanda di ricerca, modello, policy, domini e finestra temporale. Correggere una notizia non invalida automaticamente le altre. Il worker condivide risultati e richieste in corso nello stesso job; il laboratorio li conserva privatamente su disco. I dati mantengono il momento originale del recupero. La scadenza della finestra, un cambiamento rilevante o un modello diverso producono una nuova chiave. Nessun riuso automatico il giorno dopo.

**Eccezione obbligatoria per A dal 26 ottobre.** Il riuso di cui sopra riguarda raccolta e selezione: un nuovo controllo A salta tale cache, cerca aggiornamenti e confronta ogni notizia con il miglior dato autorevole trovato. La ricevuta locale identifica testo, ricerca e recupero entro cinque minuti dall’avvio del giudizio; il cache key dei sottoesiti fattuali include anche questo snapshot. B può riutilizzarlo senza una seconda ricerca e senza vedere il verdetto A. Le scadenze dei rapporti restano quelle già previste. [Verifica e limiti](cdaily-currentness-quality-20261026.md).

**Controllo A per gruppi pertinenti.** I target mantengono gli indici originali e vengono raggruppati per notizia, con massimo sei controlli per richiesta. Ogni gruppo conserva integralmente le proprie prove e le clausole vicine; l’intero copione resta visibile. Titolo, sintesi e bookend conservano il dossier completo. I vecchi brief non strutturati vengono mantenuti interi. Nessun target negativo viene rimosso e il validatore pretende tutti i target. B rimane globale: il risparmio non deve nascondere contraddizioni fra notizie.

**Ripresa dei checkpoint.** Riutilizzare gli artefatti completati, distinguendo prova, bozza e giudizio. Un errore tecnico non è un sì. Non cancellare tentativi falliti; una risposta incerta non va ripetuta alla cieca. Il testo cambiato richiede un nuovo controllo A/B; con modalità manuale richiede anche un nuovo OK sul testo e sullo score esatti.

## Misura locale, senza spendere chiamate

```sh
npm run daily:context -- --measure .tg-artifacts/editorial/2026-10-25/session.json
```

La simulazione sul copione salvato del 25 ottobre, usando il dossier di ricerca salvato, mantiene **39 target**. Confronta il precedente invio dell’intero dossier in gruppi da quattro con il nuovo raggruppamento:

| Misura | Prima | Dopo |
| --- | ---: | ---: |
| Richieste per i target fattuali di A | 10 | 9 |
| Caratteri di JSON variabile e schemi, sommati | 1.921.600 | 744.540 |

Riduzione misurata di quel payload: **61,3%**. È una simulazione offline: esclude il prompt fisso, le altre fasi e l’output; non misura token fatturati, prezzo complessivo, qualità di una nuova risposta o una nuova approvazione. Il conto reale si confronterà sulle prossime produzioni. I due controlli editoriali sono due fasi logiche, non necessariamente due sole richieste API.

Il report completo viene scritto in `.tg-artifacts/context/AAAA-MM-GG/payload-measurement.json`. Gli artefatti restano privati. I test usano provider simulati e includono un’esecuzione del comando con rete e socket vietati.

La riscrittura automatica può ancora rigenerare l’intero copione. Una futura correzione limitata alle clausole interessate, mantenendo intatte le altre e rifacendo la rilettura globale B, è la prossima ottimizzazione da valutare sui dati reali. La cache della raccolta risparmia ricerche identiche; la verifica A aggiorna comunque le prove, senza presumere che un testo immutato sia ancora corretto.

## Modello locale: passo successivo da qualificare

Sul Mac il comando Ollama risulta installato; al controllo non c’erano servizio attivo o manifest di modelli salvati. Non sono stati avviati servizi, scaricati modelli o sostituiti provider.

Un modello locale può essere provato come redattore su un pacchetto già documentato, confrontando italiano naturale, fedeltà ai fatti, sintassi dello score e latenza. La scelta va fatta sul nostro corpus di edizioni, mantenendo i due controlli editoriali. Il numero di parametri o l’esecuzione sul Mac non dimostrano qualità o assenza di bias. L’attuale scrittura ragionata e i giudizi usano ancora l’AI configurata; raccolta, riuso e compilazione sono locali. Il prossimo risparmio va scelto sulla misura reale, evitando una nuova sperimentazione indefinita del formato.
