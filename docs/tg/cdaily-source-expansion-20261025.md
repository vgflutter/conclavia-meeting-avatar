# Ampliamento fonti e diagnostica — 25 ottobre 2026

Il minimo di sei notizie è un requisito operativo. Se il sistema non lo raggiunge, diagnosticare raccolta, disponibilità, date, indipendenza, ampiezza del bacino e selezione. Non descrivere l'esito come una giornata priva di notizie e non abbassare i controlli per nascondere un difetto.

## Catalogo applicato

Da 18 a **31 feed Italia**, da 11 a **21 gruppi/origini dichiarati**. Totale con World: 38 feed. Il codice comune è `src/lib/tg/sources.ts`; Mac e laboratorio usano lo stesso catalogo.

Nuove origini: Il Fatto Quotidiano, Today (gruppo Citynews), il manifesto, Domani, Libero, Quotidiano Nazionale, Il Messaggero, Punto Informatico, Quotidiano Sanità e HDblog. Nuove sezioni di origini esistenti: ANSA sport e cultura; economia del Sole 24 Ore. Più feed ANSA o più sezioni del Sole restano una sola origine. Riprese di agenzia riconoscibili non diventano riscontri indipendenti.

Il catalogo amplia cronaca nazionale, politica, economia/lavoro, sanità, società, tecnologia, cultura e sport. Una testata o un'istituzione non sono automaticamente una prova: il fatto centrale richiede due origini sullo stesso evento e i controlli del testo effettivo. Notizie, dichiarazioni, commenti, pubblicità e contenuti sponsorizzati devono restare distinti.

## Verifica reale, senza AI

Alle **20:48 UTC del 25 ottobre** il parser del progetto ha raccolto **943 URL distinti nella finestra di sette giorni**, di cui **556 articoli datati nelle ultime 24 ore**, da 21 gruppi rilevati. Tutti i 31 feed hanno restituito almeno un articolo valido nella finestra di sette giorni; alcuni feed istituzionali e sanitari non avevano articoli nelle ultime 24 ore.

Questi sono articoli candidati, non 556 eventi distinti o notizie già verificate. La verifica non ha usato API AI, database, voce, video o pubblicazione. Diagnostica privata: `.tg-artifacts/source-health/2026-10-25.json`.

Sono stati esclusi gli endpoint controllati ma non utilizzabili: Fanpage 403, La Stampa errore TLS, alcuni indirizzi RSS 404 e DDay 500. I feed provati di Gazzetta e ANSA ambiente erano fermi al 2023, Wired Italia a luglio: non sono stati aggiunti come fonti quotidiane attive. Internazionale era disponibile ma con un bacino troppo ridotto/non recente per questo ampliamento. Per il manifesto viene usato direttamente il suo endpoint CMS verificato, senza abilitare redirect arbitrari nel collettore.

Il Messaggero pubblica date localizzate, ad esempio `dom, 25 ott 2026 ... +0100`: il parser ora le riconosce conservando il fuso originale. Date mancanti, non leggibili o future restano escluse; non vengono sostituite con l'ora della raccolta.

## Diagnostica durante ogni ciclo

`collectFeeds` restituisce per ogni feed: identificativo, editore, gruppo, esito (`ok`, `empty-or-stale`, `unavailable`), numero di articoli acquisiti e quantità nelle finestre 24/36 ore. Il recupero salva questa fotografia in `coverageRecovery.collection`, insieme ai propri giri e ai giudizi. `ok` certifica l'acquisizione di articoli datati, non la loro verità.

Il recupero automatico rimane attivo: conserva le candidate valide, amplia il bacino e cerca quelle mancanti. Dopo tre giri insufficienti l'esito viene esplicitamente classificato **anomalia di raccolta/selezione** nella redazione privata. Gli errori di servizio, compresa una quota API esaurita, restano problemi tecnici separati; l'ampliamento RSS non li risolve.
