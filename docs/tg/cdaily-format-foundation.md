# CDaily — basi del formato giornaliero

Decisioni consolidate il **23 ottobre 2026**, dopo il riscontro dell’utente sul pilota Italia: «mi sembra che ci siamo» e «per il resto mi piace molto». Questa è la base delle prossime puntate. Alla successiva approvazione «ok adesso ci siamo» sono confermati anche i [palmi raccolti e inclinati verso il petto](cdaily-palms-chest-20261023.md); il tocco laterale al mento resta quello già apprezzato. L’inserimento nella nuova puntata deve essere verificato sul suo parlato reale.

Seguito autorizzato: [prova della regia e del labiale](cdaily-acting-semantic-20261023.md). Le capacità di selezione per sottosegmenti e memoria delle famiglie sono implementate; la prova breve conserva voce, testo, data e grafica del pilota approvato. La nuova regia completa non è ancora un nuovo master lungo approvato.

Leggere questo documento insieme allo [standard di produzione](cdaily-production-standard.md). Per la prossima evoluzione della recitazione usare la [direzione di mood e gesti](cdaily-acting-direction.md); il [catalogo del motore condiviso](../../../conclavia-avatar-kit/docs/performance-repertoire.md) distingue capacità presenti e proposte.

## 1. Riferimenti approvati

| Elemento | Base da conservare |
| --- | --- |
| Daily completo | `2026-10-23-it-pilot-r3`, media `1876a600e330`, durata **326,64 s**, circa 5:27. [Dossier con prove e limiti](cdaily-italia-pilot-r3-20261023.md). |
| Stile della presentazione | `avatar-refined-presence-20261023`, media `12c91abdf743`. |
| Personaggio | Alex adulto, ibrido umano/robot, volto chiaro e modellato, mani anatomiche, giacca petrolio snella. Postura in piedi come base attuale. |
| Ambiente | Studio luminoso con pietra chiara, legno e piante; stessa identità di presentazione e Daily. |
| Marchio e caratteri | CDaily, by Conclavia; asset e Bricolage Grotesque già approvati. |
| Voce | **Alex 2 - daily**: amica, informale, comprensibile e agile. |
| Composizioni | Portrait 1080×1920 e landscape 1920×1080 nativi, 50 fps. Un solo player adattivo sul sito, con scelta di formato. |
| Chiusura | Frase ricorrente e indice verso il basso sulla parola «commenti». |
| Contatti espressivi | Palmi più vicini e inclinati verso il petto, con avambracci coordinati; tocco laterale al mento approvato. Scelta occasionale dal significato, mai dal tema della notizia. |

Conservare i master approvati. Le nuove regole di apertura e recitazione si applicano alle prossime edizioni: questo documento non modifica il vecchio audio, le animazioni o la data dei video già esportati.

## 2. Apertura: pronunciare la data dell’edizione

Formula di base:

> Ciao, questo è Conclavia Daily. Oggi è il **[giorno] [mese]**. [Due o tre anticipazioni brevi dei temi reali.] [Pausa pulita di due secondi.] [Prima notizia.]

Per un’edizione datata `2026-10-23`, l’esempio è:

> Ciao, questo è Conclavia Daily. Oggi è il ventitré ottobre.

Il «22 ottobre» del messaggio dell’utente è un esempio di formulazione, non una data da fissare nel template. Giorno e mese vengono dai metadati della puntata; l’eventuale giorno della settimana si calcola dalla stessa data, senza affidarlo alla memoria del modello. Anno completo sempre nei metadati e nella pagina; pronunciarlo quando serve a evitare ambiguità.

Regole operative:

- Usare la **data dell’edizione approvata**, non il momento in cui un browser riproduce il video o un worker termina il render. Per Italia il prodotto è configurato su `Europe/Rome`; World usa il proprio fuso configurato, attualmente `UTC`.
- Verificare che copione, data pronunciata, manifesto, titolo, copertina e testo social concordino. Se un export arriva oltre la mezzanotte, non cambiarne automaticamente la data.
- Se si prepara un’edizione per il giorno successivo, aggiornare la ricerca e rivalutare la scaletta prima della registrazione. Una nuova data non rende fresche notizie vecchie.
- Le date dei fatti restano distinte dalla data del Daily. Il voto del 22 può essere raccontato il 23 dichiarandone correttamente il giorno e motivandone l’attualità.
- Apertura accogliente ma breve: saluto, data e orientamento. Le anticipazioni non devono diventare l’elenco completo ripetuto subito dopo.
- Conservare lo **stacco reale di 2 s** prima della prima notizia, misurato sull’audio finale. Durante la pausa l’avatar respira e recupera, con labbra ferme e senza effetto sonoro.

Nessuna nuova registrazione viene generata per inserire la data nel master già approvato in questa revisione documentale.

Per la prossima edizione prevista, **24 ottobre 2026**, l’apertura dovrà quindi dire: «Ciao, questo è Conclavia Daily. Oggi è il ventiquattro ottobre.» Questa è un’applicazione della regola, non una data fissa da conservare nei video successivi. Il saluto automatico è ora allineato: il worker passa al writer la data congelata dell’edizione; il saluto datato viene inserito prima di entrambi i controlli AI e riservato nel budget di parole. [Implementazione e pipeline](cdaily-text-production-pipeline-20261023.md). Le chiamate storiche senza data conservano il saluto precedente.

## 3. Scelta delle notizie e durata

**Italia:** fatti italiani e conseguenze concrete per il pubblico italiano. L’estero entra con un legame documentato o per un evento mondiale eccezionale motivato. **World:** selezione globale autonoma in inglese, non traduzione automatica né raccolta degli scarti di Italia.

La durata segue la sostanza. Il pilota da circa 5:27 è una base di confronto riuscita, non un nuovo obbligo al secondo. Ipotesi di lavoro: circa **4–6 minuti**, con margine motivato verso 6–7; **5–7 notizie indicative**, senza quote da riempire. Una o due principali possono avere più spazio delle brevi.

Ogni notizia deve dare, in modo naturale:

1. lo sviluppo nuovo e verificato;
2. il contesto minimo per chi non segue già il tema;
3. chi riguarda e perché conta;
4. il limite dell’informazione o il prossimo passaggio, quando sono utili a comprenderla.

Evitare bollettini meteo ordinari, curiosità deboli, cataloghi di numeri e passaggi procedurali inseriti per allungare. Gli eventi locali importanti possono entrare per le loro conseguenze, senza esagerarne la gravità. Politica e diritti si raccontano con gli stessi criteri di prova degli altri temi; l’autore AI non garantisce assenza di bias.

Transizioni sul tema, senza «seconda storia». Niente introduzione con «gli aggiornamenti di ieri sera». Niente richiamo a elementi «qui accanto al video»: per approfondire si indica il sito.

## 4. Voce, grafica e ritmo da preservare

- Frasi collegate, ritmo agile e piccoli cambi di intenzione; evitare cadenza da comunicato o lettura solenne.
- Il +5% del take r3 è una scelta verificata su quella registrazione, non un aumento da applicare a ogni futuro audio. Valutare il take effettivo senza deformare il timbro o comprimere il contenuto per arrivare a una durata prefissata.
- Per la base corrente scegliere **voce sola**, senza musica sulle notizie e senza colpi sonori nel passaggio iniziale.
- Un titolo breve per notizia e una sola idea visiva per volta. Il testo non deve contendersi lo spazio con volto e mani.
- Sottotitoli separati e attivabili. Non aggiungere un paragrafo fisso sotto l’avatar o una nuova etichetta permanente sul petto.
- Il robot rimane riconoscibile come tale, con gesti credibili e intenzionali. Lo sviluppo della recitazione conserva grafica, materiali, proporzioni, font e ambiente.

## 5. Regia: più varietà di atteggiamento e significato

Il prossimo miglioramento riguarda **viso, sguardo, collo, spalle, busto, braccia, polsi e dita coordinati**. Una posa non va aggiunta perché è disponibile nel catalogo: deve servire la frase.

Il repertorio comprende spiegazione, offerta, confronto, precisione, rassicurazione, riflessione, mani raccolte, accenti e recuperi. La prossima regia deve distribuire meglio queste famiglie e utilizzare anche la quiete. Il cambio di mood dentro un pensiero modifica progressivamente l’atteggiamento del corpo, conservando la traiettoria già iniziata.

Le mani a punte delle dita unite e la sovrapposizione morbida sono basi esistenti da usare intenzionalmente. **Palmi contrapposti** e **tocco laterale al mento** sono ora capacità opzionali del rig anatomico, selezionate da intenzione semantica e mood e verificate con prove mute. Guancia, tempia e altri contatti richiedono ancora sviluppo. Il writer non prescrive pose fisiche o associazioni a categorie di notizie. L’intreccio delle dita resta riservato allo scenario da seduto.

La [specifica di recitazione](cdaily-acting-direction.md) conserva analisi del pilota, abbinamenti mood/gesti, priorità e protocollo di prova **muto**, senza usare crediti voce o ricreare il Daily intero.

## 6. Chiusura ricorrente

> Segui Conclavia Daily. Fonti e approfondimenti su daily.conclavia.me.
>
> Scrivici nei commenti cosa vuoi approfondire: partiamo dalle tue domande.
>
> Meno rumore, più contesto.

L’indice punta in basso su **«commenti»**, con preparazione e recupero. La forma del gesto è quella approvata in `avatar-comments-gesture-20261023`, media `1f326b7fe9b3`; il tempo assoluto si adatta alla parola realmente registrata. Non copiare il secondo 319,16 del pilota in una nuova puntata.

## 7. Produzione e controllo editoriale

Raccolta → raggruppamento degli eventi → confronto con il pubblicato → scaletta motivata → copione con fonti, mood, intensità e intenzione comunicativa → controllo AI A su fatti, date e prove → controllo AI B su selezione, chiarezza, omissioni e tono → correzione documentata se necessaria → voce → tempi reali e regia → due video → verifica finale e nuovo controllo di attualità → distribuzione con ricevute.

Conservare fonti primarie e origini editoriali distinte; le copie della stessa agenzia non sono riscontri indipendenti. Reddit e tendenze aiutano a individuare temi, senza costituire prove dei fatti. Non dichiarare un numero di fonti consultate che l’edizione non ha realmente usato.

Il controllo delle uscite usa **pubblicazioni confermate**, con testo e sviluppo già raccontato. Un database non raggiungibile non è un archivio vuoto; un argomento ripreso richiede un fatto nuovo oppure una motivazione esplicita di approfondimento. Il revisore deve distinguere data dell’evento, pubblicazione dell’articolo e aggiornamento reale.

Il progetto punta a una filiera operativa AI con revisione AI separata. Stato, errori e passaggi mancanti restano visibili; non attribuire al pilota la prova che l’intero sistema autonomo sia già operativo.

## 8. Pacchetto di ogni puntata

- Dossier Markdown datato: scelta delle notizie, escluse, contesto, fonti, cutoff, confronto col pubblicato, controlli AI, scaletta e direzione della recitazione.
- Copione e manifesto congelati; take originale, trasformazioni documentate e tempi reali delle parole.
- Video nei due formati, copertine, sottotitoli e prove tecniche/visive.
- **Riassunto social autonomo di 80–130 parole, massimo 1100 caratteri**, con tutte le notizie nell’ordine del video e senza nuovi fatti. Salvato in `description` e `social-summary.txt`; attribuzioni e link si aggiungono senza riscrivere i fatti dopo la verifica.
- Registro di pubblicazione, ricevute dei singoli canali e rettifiche collegate all’edizione.

## 9. Che cosa è approvato e che cosa resta da realizzare

| Stato | Elemento |
| --- | --- |
| Approvato come base | Taglio Italia, impostazione del pilota r3, identità grafica, Alex 2, due formati, invito finale. |
| Regola per le prossime puntate | Data pronunciata nell’apertura. Il vecchio MP4 conserva il proprio take. |
| Implementato, in prova breve | Scelta dei gesti per sottosegmento emotivo, memoria delle famiglie e labiale più morbido. Il confronto completo delle traiettorie rimane da sviluppare. [Stato e prove](cdaily-acting-semantic-20261023.md). |
| Implementato e approvato nelle prove brevi | Palmi uniti raccolti e inclinati verso il petto e contatto laterale al mento dal significato editoriale. [Ultima posa approvata](cdaily-palms-chest-20261023.md), [score e integrazione](cdaily-editorial-acting-20261023.md). Verificare l’uso nel nuovo parlato completo. |
| Proposto, non implementato | Altri contatti con il volto, subordinati a nuove prove anatomiche mute. |
| Limite tecnico presente | Il pilota isolato segue la durata naturale; il worker generale mantiene ancora il clock configurato. |
| Implementato e testato | Saluto datato nel writer e nel worker; doppio controllo A/B del testo esatto e dello score prima di voce/render, con invalidazione sulle modifiche e limiti persistenti delle riscritture. [Pipeline](cdaily-text-production-pipeline-20261023.md). |
| Prima della pubblicazione | Completare il confronto col registro reale delle uscite e tutti i controlli di attualità. L’approvazione visiva non li sostituisce. |

Le prove operative collegate documentano gli export muti brevi. Nessuna nuova voce o puntata completa è stata generata; i master approvati e le pubblicazioni restano indipendenti.

## 10. Promemoria operativo per il prossimo Daily

- Data pronunciata all’inizio, concordante con edizione, copertina, pagina e testo social; brevi anticipazioni, poi **due secondi reali di pausa pulita** prima della prima notizia.
- Ricerca rinnovata per il giorno dell’uscita: focus Italia, fatti sostanziali spiegati per tutti, sviluppo recente verificato e confronto col registro delle pubblicazioni confermate. Niente ripetizioni senza novità, meteo ordinario, «ieri sera» o «seconda storia».
- Durata naturale, indicativamente 4–6 minuti e 5–7 notizie, senza obbligo di riempire il numero o il tempo. World resta un prodotto separato in inglese.
- Mood, intensità e intento assegnati per clausola dal significato; revisore AI su fatti e recitazione appropriata. Viso, sguardo, collo, spalle, busto, braccia, polsi e dita coordinati; continuità fra clausole, varietà e quiete, niente rotazione forzata di tutti i mood. Palmi e mento usati con misura; intreccio soltanto da seduto.
- Voce **Alex 2 - daily**, agile e collegata, con disponibilità verificata prima di produrre; nessun cambio silenzioso di voce. Labiale sui tempi reali, senza frenesia, bocca ferma nei silenzi. Nessuna musica sulle notizie e controllo della giunzione all’avvio.
- Stile, font, studio e personaggio approvati; portrait e landscape nativi. Chiusura con invito a seguire, sito per gli approfondimenti, richieste nei commenti e indice in basso sulla parola misurata «commenti».
- Dossier datato, fonti, rapporti AI separati, scaletta, copione/score, riassunto social, sottotitoli e due export. Controllo finale di voce, gesti, leggibilità mobile, attualità e ricevute dei canali prima di dichiarare l’uscita riuscita.

Stato al 23 ottobre: riferimenti e regole pronti; il Daily del 24 non è ancora ricercato, registrato o renderizzato e questa nota non ne programma l’esecuzione. L’autonomia completa di produzione/pubblicazione resta da collaudare; una prova approvata dell’avatar non ne dimostra l’operatività.
