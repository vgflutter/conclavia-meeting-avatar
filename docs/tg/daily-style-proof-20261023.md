# CDaily — prova grafica e gesto commenti, 23 ottobre 2026

L'utente approva lo stile `avatar-refined-presence-20261023`, chiede di consolidare tutti i suggerimenti nei Markdown e di preparare un Daily di prova. Riferimento operativo: [standard di produzione](cdaily-production-standard.md), richiamato anche da `AGENTS.md`, linea editoriale, flusso e guida video.

## Ordine corrente della revisione

Il 23 ottobre l'utente precisa: mantenere un'introduzione parlata e una conclusione che invita ai commenti con il dito verso il basso. **Prima del Daily completo vuole vedere il gesto.** La prova viene mostrata e l'utente risponde **«perfetto»**: gesto e chiusura sono approvati e si procede con l'export della puntata d'archivio. Conservare la coreografia della prova, non una nuova variante.

Prova isolata: `avatar-comments-gesture-20261023`, **7,96 s**, 50 fps, 1080×1920 e 1920×1080. [Player locale](http://127.0.0.1:3107/daily-launch/revisions/avatar-comments-gesture-20261023/index.html). Stessa voce Alex 2 dal take già salvato; nessuna sintesi, trascrizione o chiamata a pagamento. Indice sulla parola misurata «commenti», invito verso il pubblico e recupero. Stesso avatar chiaro, finitura, mani anatomiche, studio e font approvati.

Testo della prova:

> Scrivici nei commenti cosa vuoi approfondire: partiamo dalle tue domande.
> Meno rumore, più contesto.

## Daily d'archivio approvato per la prova grafica

ElevenLabs mostra **69 crediti residui**. L'utente sceglie esplicitamente: «Prepara una prova grafica con l’audio già salvato e datala correttamente». Nessun acquisto o cambio di voce autorizzato da questa scelta.

Preparato `2026-10-21-it-pilot-r8` da r6: audio, parole, notizie e mood restano quelli del **21 ottobre 2026**, con durata originale **4:00**. La precedente r7 era una bozza grafica non esportata; r8 incorpora esattamente la coreografia della chiusura appena approvata, traslandola di 230,6 s senza generare una variante. È una prova grafica d'archivio, non un'edizione del 23 ottobre. Applica lo stile approvato, il profilo di movimento `connected`, titoli più puliti e data visibile nell'apertura. La selezione storica, incluso il bollettino ligure e la formula «ieri sera», **non** è il modello dei prossimi Daily.

I nuovi Daily restano fissati a **5:00 con quattro notizie sostanziali**, apertura orientativa di circa 20 s e chiusura commenti di circa 10 s. La durata di questa sola prova archiviata non cambia il format.

## Riassunto di accompagnamento

94 parole, 691 caratteri. Riassume nell'ordine i quattro blocchi del parlato conservato, senza aggiungere notizie. La corrispondenza è controllata contro il copione d'archivio, non attraverso una nuova ricerca o un nuovo rapporto editoriale A/B. Le attribuzioni e i limiti del parlato restano espliciti; il bollettino è datato. La pagina e `caption.txt` mantengono separata l'avvertenza di prova grafica locale.

> Nel Daily del 21 ottobre, il governo annuncia risorse per l’autotrasporto, mentre le proteste proseguono in alcune regioni: gli impegni non equivalgono a pagamenti già eseguiti. A Oslo, i colloqui sull’Ucraina coinvolgono rappresentanti ucraini, americani ed europei; il confronto continua, senza un accordo di pace annunciato. Una ricerca presentata dalla NASA ricostruisce le variazioni delle riserve d’acqua attraverso osservazioni satellitari: aiuta a leggere tendenze di lungo periodo, senza prevedere la prossima siccità. Infine, il bollettino ligure del 20 ottobre indicava scadenze diverse dell’allerta per zona: un riepilogo datato, da distinguere dagli avvisi ufficiali aggiornati.

## Materiale nuovo separato

Esiste anche una **bozza non approvata e non registrata** del 23 ottobre, `scripts/tg/editions/2026-10-23-it-pilot.json`, con 779 parole e riassunto social di 105 parole. Temi candidati: nuovi aiuti carburanti, proposta di colloqui fra le Coree, Champi a Taiwan, consumi britannici. La ricerca distingue estratti indicizzati da pagine effettivamente aperte, e segnala il bollettino ONS di settembre non recuperabile. Non sono completati i rapporti AI A/B, la verifica finale di attualità né la voce. Non usare la bozza come copione approvato o come prova che il Daily nuovo sia già prodotto.

## Riuso tecnico

`daily-avatar-preset.ts` conserva l'approvazione del prodotto. Il preparatore dei nuovi piloti salva finitura, postura, mani e riferimento di stile; il renderer li legge dal manifesto senza richiedere flag del laboratorio. I vecchi manifesti privi di questi campi mantengono il percorso precedente. Le clausole di uno stesso pensiero possono mantenere una sola finestra di movimento, con accenti dai tempi reali delle parole. Il motore canonico del kit resta condiviso e invariato.

## Esito della prova breve

Media `1f326b7fe9b3`: riproduzione integrale in entrambi i formati, audio attivo, 0 fotogrammi persi, nessun errore browser o overflow a 390 px. Audio, parole e tempi conservati dal take precedente; nessuna chiamata provider. Build e TypeScript superati, 7 regressioni del player/preset superate. L'approvazione dell'utente riguarda il gesto; non è un'approvazione editoriale o una pubblicazione.

## Daily grafico completo e consegna locale

Esportata **r8**, media **`23e1146cdc02`**: **240 s esatti**, H.264/AAC, 50 fps, 12.000 fotogrammi per formato. [Verticale](http://127.0.0.1:3107/daily-launch/editions/2026-10-21-it-pilot-r8/index.html?format=portrait) · [Orizzontale](http://127.0.0.1:3107/daily-launch/editions/2026-10-21-it-pilot-r8/index.html?format=landscape). Un solo player, con selettore, capitoli, sottotitoli attivabili, copione, fonti datate e riassunto scaricabile. Copertine ricavate dall'apertura con avatar e data, senza modificare i master; formato richiesto nel link, selezione del pulsante e copertina controllati su mobile e desktop (`format-cover-proof.json`). Il renderer riusa questo criterio per i successivi piloti.

- Audio PCM identico byte per byte alla r6, SHA-256 `8d517dfbb9a98a217ec14594fff7816cf42f257f8bf5bb2d499ed3387aa68ba3`. Saluto e orientamento iniziale conservati (0,18–14,829 s), 640 ancore parola e tutti i segmenti di parlato/mood immutati. Conservata anche la riparazione della vecchia giunzione a 14,829 s. Musica già archiviata solo nei primi quattro secondi, nessun sottofondo nelle notizie o nella chiusura.
- Chiusura parlata 230,78–237,049 s. Coreografia delle tre frasi identica alla prova approvata, offset 230,6 s; apice dell'indice a **231,740 s**, dentro la parola «commenti». La continuità è verificata su dati e fotogrammi effettivamente codificati.
- Anteprime di tutte le scene e dieci fotogrammi estratti dai file finali ispezionati: volto chiaro e finitura, studio, titoli brevi, anatomia e gesto conservati. Nessun ridisegno degli asset; controllo identità **17/17** superato.
- Audit geometrico e temporale a 25 campioni/s per tutti i 240 s: **6.000 campioni per formato**, nessun taglio delle mani, testo sulla testa, overflow o valore di posa non finito. Non equivale a una certificazione percettiva della naturalezza.
- Decodifica integrale FFmpeg di entrambi gli MP4 superata senza errori. Riproduzione browser e salti ai capitoli, chiusura e sottotitoli verificati a **360, 390 e 1440 px**, audio attivo, un solo player, caricamento video solo dopo il play, nessun errore browser o richiesta esterna. Il controllo del player usa riproduzione e seek, non un ascolto browser integrale dei quattro minuti per ciascun formato.
- TypeScript, ESLint sui file coinvolti e 7 regressioni del preset/player superati. Motore canonico invariato in questa integrazione; nessuna nuova chiamata a sintesi, trascrizione o AI.

Prove in [`docs/images/daily-launch/editions/2026-10-21-it-pilot-r8/`](../images/daily-launch/editions/2026-10-21-it-pilot-r8/): `render-report.json`, `continuity-report.json`, `all-frame-audit.json`, `player-proof.json`, anteprime e fotogrammi codificati. I master e i testi sono in `public/daily-launch/editions/2026-10-21-it-pilot-r8/`.

Stato: **prova grafica locale completa**, nessuna pubblicazione social, modifica del sito pubblico o attivazione dello scheduling. Per una nuova uscita resta necessario produrre la puntata fresca di cinque minuti, con selezione aggiornata e controlli editoriali A/B; questo archivio non li sostituisce.
