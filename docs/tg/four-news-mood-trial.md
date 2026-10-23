# Daily italiano · quattro notizie e mood per proposizione

Prova del 19 ottobre 2026, id `be6e4f64aa8ad210795069e4`, disponibile nella redazione locale: `http://127.0.0.1:3105/podcast/tg/redazione?job=be6e4f64aa8ad210795069e4`.

96 secondi, 207 parole, un presentatore con voce Gianni, modello completo Inworld TTS 2 e velocità di sintesi 0,98. Sei letture continue, non diciassette richieste vocali separate. Il master conserva la durata naturale: nessun filtro di tempo a velocità unitaria, soltanto normalizzazione del livello e coda. I due video sono Full HD nei formati 16:9 e 9:16.

## Copione e temporizzazione

Il contratto JSON continua a richiedere testo, mood, intensità, parlante, notizia e fonti per ogni elemento. Il prompt ora chiarisce che gli elementi possono essere proposizioni della stessa frase completa: si cambia mood dove cambia l'intenzione, senza troncare parole o forzare tutto il catalogo emotivo in ogni notizia. La verifica editoriale valuta le proposizioni con il loro contesto adiacente.

Il primo e il secondo output del writer sono conservati. Per questa prova il passaggio editoriale di Codex ha rifinito il testo e la partitura; non si tratta di un'approvazione umana. Il copione finale riproducibile è in `scripts/tg/fixtures/mood-trial-reviewed-score.json`, con la ricerca in `mood-trial-research.json`.

I segmenti contigui dello stesso parlante e della stessa notizia vengono letti come un unico passaggio. I timestamp nativi delle parole assegnano poi i 17 segmenti al PCM: tutte le 15 proposizioni delle notizie sono allineate alle parole, mentre introduzione e chiusura usano il proprio PCM completo. Non ci sono silenzi aggiunti fra le proposizioni di una notizia. Il parser e l'allineamento riutilizzabili appartengono alla feature `speech` del kit, non al consumer; se il provider non offre un riscontro completo del testo, il ripiego è esplicitamente `estimated`.

| Intervallo | Notizia | Mood |
| --- | --- | --- |
| 8,4–28,2 s | Primo bilancio dei cortei, pubblicato da Rai News il 18 ottobre | Attenzione → empatia → dubbio |
| 28,4–50,9 s | Studio sul risparmio energetico del volo, CNR, 16 ottobre | Curiosità → sorpresa → divertimento misurato → dubbio → attenzione |
| 51,1–69,4 s | Coperture medievali di Santa Croce, CNR, 15 ottobre | Curiosità → sorpresa → accordo |
| 69,6–89,8 s | Apertura del concorso di fotografia naturalistica, museo londinese, 19 ottobre | Attenzione → curiosità → accordo |

La GUI evidenzia la proposizione in riproduzione, mostra il mood corrispondente e consente di saltare al suo tempo audio. Le fonti sono consultate e collegate nella redazione; questa selezione recente serve alla prova audiovisiva, non rappresenta una scaletta giornaliera esaustiva. Non è stata eseguita la verifica editoriale indipendente richiesta per pubblicare.

## Verifiche

100 test del kit, regressioni del backend TG senza chiamate a pagamento e 46 regressioni browser avatar/player superati. Verificati stream con timestamp senza audio, cache di PCM e parole, più mood nella stessa lettura e conservazione della forma d'onda a ritardo zero nella modalità naturale. Onboarding: 82 test, lint, typecheck e build; Meeting: lint, typecheck e build `.next-daily-mood-score-final`. Entrambi i consumer usano il kit canonico SHA-256 `7cf68e7402eb119655f9c143204f1eb3cb3e672634b769f913cb8fc8a285686a`.

L'operazione creativa ha usato due chiamate al writer e sei passaggi TTS; la successiva rimasterizzazione riusa i PCM in cache. La voce non è una registrazione umana: naturalezza e resa editoriale restano da valutare nell'ascolto. Nessun clone o identità di persona reale.

La nuova edizione rimane `needs_review`, con approvazione e distribuzione disabilitate. I due piloti precedenti rimangono alle revisioni Italia 51 e World 28. Report di verifica tecnica, fotogrammi dei mood e prova della GUI in `docs/images/daily-four-news/`.
