# Conclavia TG: studio editoriale iniziale

**Revisione successiva:** questo documento conserva le ipotesi e i risultati dei piloti da 90 s. La specifica corrente del 21 ottobre sceglie **240 s**, quattro storie e doppio controllo AI, senza approvazione umana delle singole edizioni: vedere [editorial-workflow.md](editorial-workflow.md) per il flusso e i requisiti ancora da implementare, e [operations.md](operations.md) per il runtime esistente. Le precedenti scelte di 90/180 s e revisione umana qui sotto sono storiche; nessuna durata ottimale è stata dimostrata da dati di pubblico.

La verifica aggiornata su fattibilità AI, policy social, advertising e misurazione è nella sezione [Fattibilità AI e acquisizione del pubblico](operations.md#fattibilità-ai-e-acquisizione-del-pubblico).

Data: 18 ottobre 2026. Finestra esaminata: 11–17 ottobre 2026. Metodo: campione qualitativo di archivi e pubblicazioni datate, senza presentarlo come un censimento di tutte le notizie né come una misurazione delle preferenze del pubblico Conclavia. Le pagine di sezione sono aggiornabili: per la redazione giornaliera vengono conservati URL e date delle singole fonti e il copione di ogni edizione.

## Che cosa emerge dal campione

| Data | Materiale esaminato | Implicazione per il prodotto |
| --- | --- | --- |
| 11 ottobre | [Bollettino Euronews](https://www.euronews.com/video/2026/10/11/latest-news-bulletin-october-11th-2026-morning), [rassegna europea](https://www.euronews.com/my-europe) | Economia quotidiana, eventi internazionali e società convivono. Un TG breve non deve diventare solo politica nazionale. |
| 12 ottobre | [Energia e imprese, ANSA](https://www.ansa.it/sito/notizie/economia/pmi/2026/10/12/ansaorsini-confindustria-gas-russo-niente-ideologie-sullenergia_b45cea89-1378-4a59-96d7-9c887c90c5e2.html), [archivio Euronews](https://fr.euronews.com/2026/10/12) | Le dichiarazioni sull’energia richiedono attribuzione. Un annuncio politico e un accordo confermato devono restare distinti. |
| 13 ottobre | [Archivio economia Teleborsa/ANSA](https://teleborsa.ansa.it/categoria/notiziario/economia/), [archivio politica ANSA](https://www.ansa.it/sito/notizie/politica/index_10.shtml) | Bilancio, investimenti e costo della vita richiedono una breve spiegazione delle conseguenze, non una sequenza di cifre. |
| 14 ottobre | [Bollettino serale Euronews](https://fr.euronews.com/video/2026/10/14/linfo-du-jour-14-octobre-2026-soir), [sezione scienza ANSA](https://www.ansa.it/canale_scienza/notizie/fisica_matematica/index.shtml) | Una voce scientifica o di innovazione può allargare la selezione, se sufficientemente rilevante e corroborata. |
| 15 ottobre | [Archivio economia ANSA](https://www.ansa.it/ansa2030/notizie/finanza_impresa/index.shtml), [archivio infrastrutture Teleborsa](https://teleborsa.ansa.it/author/redazione/) | I temi proseguono per più giorni. Il prodotto deve spiegare lo sviluppo nuovo, non ripetere il titolo precedente. |
| 16 ottobre | [Economia ANSA](https://www.ansa.it/sito/notizie/economia/index.shtml), [AI e lavoro](https://videoembed.ansa.it/sito/photogallery/primopiano/2026/10/16/georgieva-il-mondo-non-puo-permettersi-di-sbagliare-con-lia_345ef555-451e-4e58-b3dc-e3e786a0f9fa.html) | Trasporti, energia e lavoro offrono un impatto concreto sul pubblico italiano. Le affermazioni quantitative devono essere contestualizzate e controllate. |
| 17 ottobre | [ANSA, settimana in immagini](https://videoembed.ansa.it/sito/videogallery/short_video/2026/10/17/il-racconto-della-settimana-in-immagini-10-17-ottobre_e285c494-4328-4e34-9a5c-f99cea98aaf1.html), [Euronews](https://www.euronews.com/), [politica ANSA](https://www.ansa.it/sito/notizie/politica/index.shtml) | Nelle giornate dense serve selezione. Produrre più titoli con meno contesto non aumenta necessariamente il valore del TG. |

La prevalenza di fonti europee e ANSA in questo campione è un limite dello studio, non una scelta per la World edition. La redazione World deve cercare storie da più aree geografiche usando anche Reuters, AP, BBC, NPR, fonti regionali e istituzioni. L’assenza di due riscontri indipendenti ferma una notizia; non viene colmata inventando un secondo riscontro.

## Formati scelti per il lancio

- **Italia: 90 secondi**, lingua italiana, tre notizie corroborate. Budget indicativo: apertura 6 s, prima notizia 29 s, altre due 24 s, chiusura e transizioni 7 s.
- **World: 90 secondi**, lingua inglese, tre notizie con selezione internazionale propria. Stesso tempo finale e budget distinto di parole secondo la voce. L'inglese non traduce la scaletta Italia.
- **Un presentatore iniziale** per entrambe: meno passaggi di voce, stile più chiaro da notiziario. Il secondo è configurabile; aggiunge chiarimenti e domande, non un contrasto politico artificiale.
- Video master sia **1920×1080** sia **1080×1920**, H.264/AAC, 25 fps. Il verticale ha una composizione propria. Le piattaforme devono consentire l’intera durata per l’account collegato; un rifiuto non viene aggirato tagliando a metà una frase.
- La durata nasce dalla misura del PCM, non da una stima delle parole. Piccola correzione del tempo entro ±12%; altrimenti un’unica riscrittura e nuova verifica. Il pacchetto non viene approvato se FFprobe misura uno scostamento superiore a 0,1 s.

La prima ipotesi era 180 s Italia e 240 s World. I piloti hanno misurato 328 parole italiane in 225,0 s e 271 inglesi in 103,9 s con le voci esistenti. Inoltre, allungare testi basati su pochi riscontri ha introdotto spiegazioni non documentate che il verificatore ha bloccato. Una successiva prova ha misurato 213 parole italiane in 94,3 s, mostrando anche quanto la struttura del testo possa cambiare il ritmo: una sola stima non basta. Il formato di lancio viene quindi fissato a 90 s per entrambe, circa 180–220 parole secondo lingua e voce, con tre notizie. La correzione continua a dipendere dal PCM effettivo, non da una formula universale. Sono stati provati anche 120 s durante la calibrazione; non rappresentano un risultato di audience. Questa revisione deriva da fattibilità editoriale e vocale, non da una misura di gradimento.

Questi budget sono scelte editoriali motivate dal campione e dalle prove del parlato, non risultati di un test di audience già svolto. L’inglese di una World edition non è la traduzione automatica dell’edizione Italia.

## Orario: ipotesi iniziali, non un “miglior orario” dimostrato

**Italia 19:15 Europe/Rome**: un riepilogo della giornata prima della fascia serale; orario locale con cambio ora gestito dal fuso. **World 18:00 UTC**: appuntamento stabile internazionale, tarda giornata europea e pomeriggio americano; meno adatto all’Asia, limite da misurare. La preparazione parte 45 minuti prima. Senza una base di pubblico e analytics dei canali TG non esiste evidenza per affermare un orario ottimale universale.

Primi 14 giorni: confrontare completamento del video, abbandono nei primi 10–30 secondi, tempo medio, ritorno il giorno successivo, clic alle fonti e commenti che segnalano errori. Variare un solo fattore alla volta, mantenendo il minutaggio esatto. Una variazione di orario si valuta dopo aver distinto lingua, piattaforma, giorno della settimana e dimensione del campione; non da un singolo video.

## Il valore riconoscibile

Il segno grafico esclusivo è **c / TG**, con coordinate e archi da meridiano, carta avorio, inchiostro blu scuro, verde acqua e accento arancio. Presentatori originali costruiti per il TG, non varianti riusate della galleria Podcast. Le schede mostrano “perché conta”, il cambiamento rispetto ai giorni precedenti e le fonti.

La memoria di sette giorni serve alla continuità editoriale. Il controllo delle affermazioni esegue una nuova ricerca, distinta dalla scrittura, e ogni frase conserva fonti, presentatore, mood e intensità. Non è una garanzia di assenza di errori: le prime edizioni richiedono revisione umana, scelta confermata dall’utente. La modalità autonoma è abilitabile dopo cinque edizioni approvate e solo con i collegamenti di distribuzione pronti.

## Canali e documentazione primaria verificata

- [OpenAI Web search](https://developers.openai.com/api/docs/guides/tools-web-search): ricerca live, fonti consultate e citazioni; modello configurabile, niente nuova sottoscrizione Tavily richiesta come base.
- [YouTube videos.insert](https://developers.google.com/youtube/data/reference/rest/v3/videos/insert?hl=en): caricamento e dichiarazione del contenuto sintetico. La conferma del caricamento non equivale alla verifica della pubblicazione pubblica.
- [Linee guida TikTok](https://developers.tiktok.com/docs/en/content-sharing-guidelines): il TG interno autonomo necessita di un servizio di programmazione approvato, non del Direct Post privato implementato come utility interna. La distribuzione TikTok rimane disabilitata finché questo percorso non è integrato.
- [TikTok Direct Post](https://developers.tiktok.com/docs/en/content-posting-api-reference-direct-post): consenso del creator, account e durata ammessa, dominio verificato per PULL_FROM_URL, dichiarazione AIGC. Account/API non abilitati alla pubblicazione pubblica restano bloccati.
- [Spotify video tramite host](https://support.spotify.com/mx-en/creators/article/video-episodes-for-shows-not-hosted-with-spotify/): host compatibili e procedura alternativa. Il connettore partner deve essere configurato sul servizio effettivamente scelto; il TG non presume di poter caricare video tramite la Web API musicale o un semplice RSS audio.

Nessun account Conclavia TG è stato identificato nelle connessioni esistenti consultate. Non vengono utilizzati gli account di altri progetti. La pubblicazione reale richiede i canali delle due edizioni e le relative autorizzazioni, oltre a una prova completa per ciascuna piattaforma.

## Riscontro tecnico del catalogo del pilota

Nel catalogo bilanciato effettivamente raccolto il 18 ottobre prima dell'alba UTC: Italia 65 articoli (17 del 18 ottobre, 48 del 17) da quattro testate; World 54 (8 del 18, 40 del 17, 6 del 16) da tre testate. Sono **articoli**, non conteggi di eventi distinti o di notizie importanti. I feed non restituivano l'intera settimana: sarebbe scorretto trasformare questa raccolta in una stima statistica dei sette giorni. L'esame retrospettivo della tabella resta qualitativo.

Le prime selezioni corroborate hanno prodotto tre temi per Italia e cinque per World. La prima selezione Italia era troppo concentrata sugli esteri con ricadute italiane: è un limite editoriale del pilota da rivedere, non un risultato di copertura nazionale già accettato. Il valore di un prodotto Italia richiede attenzione effettiva a notizie domestiche di impatto, senza introdurre una notizia debole solo per riempire una quota. L'automatismo non va abilitato sulle sole prove tecniche.

Per ampliare la selezione World oltre al catalogo del primo pilota sono stati aggiunti i feed Al Jazeera e France 24, verificati HTTP 200 il 18 ottobre. La varietà delle testate amplia le occasioni di copertura di Medio Oriente e Africa, ma non prova da sola un equilibrio geografico o l’indipendenza di ogni singolo articolo.
