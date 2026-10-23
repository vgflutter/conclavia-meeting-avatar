# CDaily — Italia, World e durata editoriale

Riesame del 23 ottobre 2026, successivo alla review del pilota `2026-10-23-it-pilot-r2`. L’utente contesta il peso delle notizie coreane nell’edizione Italia e chiarisce che cinque minuti non sono obbligatori. Questo documento supera la precedente prescrizione «cinque notizie in cinque minuti» come scelta editoriale. Non cambia lo stile approvato e non attiva pubblicazioni.

## La correzione della selezione

Nel pilota la varietà geografica ha prevalso sulla rilevanza per il pubblico italiano. Due notizie su cinque riguardano direttamente l’Italia; Corea, Taiwan e consumi britannici sono fatti documentati, ma la scaletta non dimostra perché meritino quello spazio in Italia. I controlli fattuali non bastano a promuovere una selezione editoriale.

- **Italia:** notizie che riguardano l’Italia e la vita del suo pubblico: lavoro, economia, salute, società, servizi, diritti, scienza, tecnologia e decisioni politiche con conseguenze concrete. Nessuna categoria è obbligatoria e nessuna quota impone politica o cronaca nera.
- **Europa ed estero in Italia:** ammissibili quando il dossier documenta una conseguenza concreta per l’Italia o quando un evento eccezionale di portata mondiale giustifica esplicitamente un’eccezione. Non inventare ricadute su prezzi, sicurezza o lavoro per far rientrare una candidata. La provenienza estera non è un divieto, la semplice importanza internazionale non è una motivazione sufficiente.
- **World:** prodotto in inglese con selezione globale autonoma; non una traduzione, né il contenitore degli scarti italiani. Un fatto italiano vi entra se ha interesse internazionale. La notizia coreana va rivalutata insieme alle altre candidate World, non trasferita automaticamente.

Per ogni candidata indicare nel dossier: pubblico interessato, ragione della rilevanza per l’edizione, prova delle eventuali conseguenze e priorità. Il revisore editoriale B valuta anche il baricentro dell’intera scaletta. Una lista di fatti corretti può comunque essere respinta.

## Durata e ampiezza

**Nessun obbligo di 5:00 esatti e nessun numero fisso di notizie.** Prima selezionare e ordinare i fatti, poi assegnare il tempo necessario a comprenderli. Non aggiungere notizie deboli per allungare e non accelerare la voce o togliere contesto per chiudere un clock convenzionale.

Ipotesi di partenza per la prossima prova, da collaudare e non trasformare in una nuova gabbia: circa **4–6 minuti**, con margine verso **6–7** se una giornata densa lo giustifica. Orientativamente **5–7 notizie**, senza quota minima da riempire: una o due più sviluppate, le altre più compatte. L’ampiezza viene dai temi utili al pubblico, non dal numero di paesi nominati. La durata può anche risultare inferiore se le notizie meritevoli sono poche.

La gerarchia deve variare la profondità, senza rendere tutte le notizie identiche per lunghezza. Anche una breve deve dire che cosa è successo e perché interessa; evitare il semplice elenco di titoli. Apertura accogliente e breve, pausa reale di 1–2 s prima della prima notizia, voce agile e colloquiale, niente musica sotto il corpo. Chiusura fissa con indice verso i commenti. Avatar, studio, font, marchio e voce Alex 2 restano quelli della presentazione approvata.

Non inserire nel saluto «cinque minuti» se il clock non è stato scelto e misurato per quella specifica edizione.

## Attenzione e distribuzione

La durata migliore per CDaily non è ancora dimostrata dai dati del suo pubblico. Il Digital News Report 2026 distingue il consumo dei video informativi per piattaforma: TikTok è più orientato a durate inferiori a due minuti, mentre YouTube sostiene un ventaglio più ampio di durate. Non dimostra che 5:00 sia il punto ottimale, né che un video più breve sia sempre migliore.

Fonte primaria: [Reuters Institute, sintesi del Digital News Report 2026](https://reutersinstitute.politics.ox.ac.uk/digital-news-report/2026/dnr-executive-summary), sezione sul video online. [YouTube, report sul coinvolgimento](https://support.google.com/youtube/answer/9313698?hl=en) descrive ritenzione nei diversi momenti e confronto fra video di durata simile.

Proposta: puntata completa per YouTube, Spotify e sito, con entrambe le composizioni; clip verticali autonome di un singolo tema, indicativamente 45–90 s, per acquisizione sui social. È un esperimento editoriale, non una promessa di diffusione o una regola tecnica della piattaforma. Ogni clip deve conservare contesto, attribuzioni e limiti; niente titoli che cambino il senso del contenuto integrale.

Confrontare avvio, abbandoni per argomento, minuti visti e quota completata; per i social anche salvataggi e follow per visualizzazioni. Non scegliere una durata guardando soltanto la percentuale completata: un video corto ha un denominatore diverso. Nessuna soglia di successo è già dimostrata per questo progetto.

## Stato operativo e materiali precedenti

Questa revisione aggiorna la **linea editoriale**, non il contratto tecnico del worker. Il backend conserva ancora `product.seconds`, cinque notizie richieste a 300 s e montaggio a clock esatto; rendere elastici selezione, limiti, GUI, voce, revisione e rendering richiede un intervento coerente, non solo un nuovo testo nel prompt. Nessuna configurazione in produzione o in Mongo è stata modificata in questo riesame. Il sito pubblico conserva al momento il testo di formato del rilascio `web-20261023170041446-c5a093`; va riallineato quando si applica la revisione al prodotto.

Il pilota del 23 ottobre resta una prova tecnica di cinque minuti, con audio, geometria e player verificati. La sua selezione non è il template editoriale approvato per i prossimi Italia; Corea, Taiwan e consumi britannici vanno rimossi o motivati nuovamente con prove e peso editoriale. Non cambiare solo il titolo del file o la data, e non usare le vecchie verifiche per un copione nuovo. Nuove notizie, riepilogo e clock richiedono nuove verifiche prima di voce e video. Nessuna nuova sintesi a pagamento parte da questo documento.
