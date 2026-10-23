# Alex — sei prove di postura e rifinitura delle mani

Richiesta: correggere in modo sostanziale mani e polsi, anche dopo il ritorno alla base precedente, confrontando almeno sei tentativi e scegliendo autonomamente il risultato più credibile. L'identità approvata rimane il riferimento: viso, voce Alex 2, studio, palette, font, scene e copione conservati.

## Metodo del confronto

Sei assetti sono stati renderizzati con lo stesso renderer, clock e inquadratura verticale. Ogni assetto comprende riposo, offerta, confronto bimanuale e mani raccolte. Le immagini intere, i dettagli e i campioni del motore sono in `docs/images/daily-avatar-hands-20261022/`. La tavola delle sei prove è `initial-six-hands-contact.png`; `initial-study-report.json` registra i sei profili e le sostituzioni temporanee applicate in memoria, senza duplicare il renderer nei consumer.

| Prova | Omero / avambraccio | Gomito X | Polsi X | Y riposo | Profondità riposo | Scala mano | Esito |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 01 — assi allineati | 132 / 120 | 145 | 85 / 94 | 423 / 426 | 30 | 1,14 | Lo scheletro lungo continua a irrigidire la postura. |
| 02 — appoggio raccolto | 120 / 96 | 150 | 82 / 92 | 421 / 424 | 20 | 1,14 | Riposo più chiaro; seconda scelta. |
| 03 — appoggio aperto | 120 / 96 | 146 | 88 / 98 | 421 / 424 | 25 | 1,14 | Meno composto nel rapporto fra palmo e dita. |
| 04 — gomiti raccolti | 112 / 88 | 138 | 86 / 96 | 424 / 427 | 20 | 1,14 | Le mani tornano troppo verticali. |
| 05 — polsi avanzati | 120 / 96 | 142 | 90 / 100 | 424 / 427 | 45 | 1,10 | La profondità accorcia di nuovo le dita. |
| 06 — dita distese | 120 / 94 | 150 | 80 / 90 | 421 / 424 | 20 | 1,10 | Base scelta: riposo più diritto, dita calme, polso leggibile. |

I valori X sono distanze dal centro, specchiate fra le due braccia; le coordinate sono nello spazio del personaggio. Le ossa restano costanti entro ciascun assetto: nessun allungamento durante il movimento.

## Rifinitura della base scelta

Il solo riposo migliore non risolveva il confronto bimanuale e la raccolta. Le prove 07–10 intervengono quindi sulla traiettoria e sulla pronazione, senza cambiare di nuovo materiali o identità.

- Il gesto comparativo alza il braccio: mostra le falangi, invece di presentare quattro punte scorciate come una zampa. La mano offerta ruota di tre quarti rispetto al fronte completo.
- La raccolta della prova 10 sostituisce l'incrocio a X con flessori e pronazioni asimmetrici. La mano superiore si raccoglie sull'altra; non viene presentata come una simulazione completa di dita intrecciate.
- Il controllo finale pronuncia meglio il dorso a riposo e arretra di tre unità gli appoggi verso il fondo del piano. Anche con busto inclinato le dita restano distinguibili e dentro il banco.
- L'apertura delle dita esplicative si raccorda continuamente ai gesti di precisione: nessuna soglia booleana può cambiare il curl in un singolo frame. La chiusura di indice e pollice e la supinazione hanno finestre più ampie. Il rilascio del supporto evita che un piccolo gesto produca un grande scatto dell'intera mano.

Tutta la costruzione vive nel kit canonico: `adult-arm.ts`, `adult-desk.ts`, `adult-wrist.ts` e `adult-hands.ts`. La GUI sceglie l'opzione `handStyle: 'anatomical'`; default e `shell` conservano il loro comportamento. Autenticazione, dati editoriali e pubblicazione rimangono nei consumer.

## Revisione del movimento

Il primo confronto completo comprende nove clip reali da otto secondi a 25 fps: tre gesti nei due formati più tre gesti della base verticale. Revisione indipendente con campioni ogni 250 ms: la prova 10 migliora chiaramente riposo, continuità del polso e leggibilità delle dita. Restano una raccolta stilizzata e palmi alzati più adatti all'enfasi che a un'offerta spontanea. Questo limite rimane esplicito nella GUI.

La GUI locale è `http://127.0.0.1:3107/podcast/tg/avatar`: **Mani rifinite** è selezionata, **Versione precedente** permette il confronto sullo stesso audio. La voce, i mood, il labiale e i due formati restano verificabili con i controlli esistenti. I filmati pubblicati non vengono sostituiti automaticamente.

Le verifiche tecniche e le prove finali della revisione sono registrate di seguito, separatamente dal giudizio artistico.

## Verifiche tecniche

- Kit: 171 test, typecheck, confini delle feature e risoluzione canonica dei consumer superati. I quattro test nuovi misurano proporzioni fisse, continuità visibile avambraccio–palmo, separazione delle dita e permanenza sul banco, otto mood e 56 cambi di mood. Le soglie non sono state allentate per far passare il risultato.
- Nel campione di controllo, il volume più avanzato delle dita a riposo arriva a Y 457,904 prima del bordo a 460; distanza minima proiettata fra le punte 3,485. Nei passaggi di mood il massimo spostamento articolare è 15,208 unità per 40 ms, rotazione del frame 14,114°. Queste misure individuano salti e compenetrazioni evidenti, non certificano una mano indistinguibile da quella umana.
- Onboarding: 82 test, lint e typecheck superati. Entrambe le build consumer isolate completate; tredici riferimenti dell'identità grafica corrispondenti.
- Meeting: 23 regressioni browser superate dopo il congelamento del codice, comprese selezione della nuova posa, confronto con la base, gesti, mood, audio, streaming e clock. Nessuna chiamata a provider. La selezione nella GUI non riattiva automaticamente la pubblicazione.

## Video e GUI della revisione

- Revisione separata: `public/daily-launch/revisions/avatar-hands-20261022/`. Presentazione completa di **36,88 s**, H.264/AAC a 25 fps, portrait 1080×1920 e landscape 1920×1080. Versione media `59e54a0c2436`.
- Il WAV è identico per SHA-256 alla sorgente conservata. I due MP4 decodificano integralmente; correlazione dell'audio decodificato con il master 0,999909, picco 0,8594. Nessuna nuova voce, allineamento o modifica del tempo.
- Il codice congelato è stato verificato di nuovo in nove clip complete, 200 frame ciascuna: `docs/images/daily-avatar-hands-20261022/motion-final/gesture-report.json`. Il replay è `node scripts/tg/review-avatar-hands.mjs`; il vecchio comando `review-avatar-anatomy.mjs` rimane un alias sottile.
- La GUI finale è stata aperta a 1440 e 390 px: nuova posa selezionata, confronto disponibile, laboratorio chiuso, nessun overflow o errore browser e clock audio in avanzamento. Report `final-gui-report.json` e schermate `final-gui-desktop.png` / `final-gui-mobile.png` nella cartella delle prove.
- Confronto a parità di frame: `hands-before-after.png`, base a sinistra e nuova posa a destra. Il materiale completo è accessibile dalla GUI locale; la pubblicazione dei filmati precedenti rimane separata da questa revisione.

Revisione visiva conclusiva dei due filmati completi a intervalli di mezzo secondo e delle scene a due conduttori a 26,5 e 28,5 secondi: approvata come versione di prova chiaramente migliorata, senza difetti materiali che richiedano un nuovo ritorno alla base. I palmi quasi di taglio possono ancora apparire sottili per brevi passaggi, e la raccolta resta una recitazione stilizzata. La presentazione viene consegnata per la revisione dell'utente, senza dichiararla perfetta o già approvata per la produzione.
