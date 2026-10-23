# Daily · revisione delle mani, 19 ottobre 2026

Il feedback riguarda qualità anatomica e movimento delle mani dello stile Umanoide. La correzione è nel kit canonico, condiviso da entrambi i consumer, senza modificare voce, labiale, formato editoriale o le sei direzioni del personaggio.

## Difetti e correzioni

- Dita rese come cilindri e segmenti che ruotavano lateralmente: sostituite con contorni affusolati continui, articolazioni in profondità, quattro dita con tre falangi e pollice con metacarpo e due falangi. Le lunghezze rimangono fisse durante la flessione.
- Polso con rotazione indipendente dal braccio: orientamento ricavato dall'avambraccio, con deviazione contenuta. Il gomito laterale evita il collasso della proiezione e i ribaltamenti del polso durante il sollevamento.
- Tutti i palmi aperti simili a un segnale di stop: inclinazione prospettica distinta per palmo offerto, verticale, gesto verso il petto e dorso appoggiato.
- Appoggio che seguiva il respiro del busto: posizione dei polsi risolta nello spazio dello studio e compensata durante respiro, inclinazione e spostamento laterale.
- Dita troppo raccolte nella posa a riposo: mano allungata e orientata verso il centro del tavolo, con dorso visibile e dita rilassate distinguibili.
- Polsino coperto dal piano del tavolo mentre la sola mano veniva ridisegnata davanti: avambraccio, polsino e mano passano insieme davanti al banco. Rimane compatibile l'API `paintRobotHands`.

`adultHandGeometry` e `adultPresenterArms` sono esportati da `@conclavia/avatar-kit/characters/robot` per verificare anatomia, contatto e continuità. Nessuna copia nei consumer e nessuna nuova dipendenza.

## Evidenza

- 91 test kit superati, inclusi lunghezze delle falangi, simmetria sinistra/destra, origine del pollice, attacco al polso, appoggio stabile, proiezione dei bracci, margini delle dita e continuità nei movimenti degli otto mood.
- 71 regressioni browser Meeting superate, incluse grafica, mood, PCM, player e il nuovo controllo dei pixel del raccordo manica/polso sopra il tavolo in orizzontale e verticale. Nessun provider a pagamento nei test.
- Meeting: lint, typecheck e build isolata `.next-daily-hands-release`. Onboarding: lint, typecheck, 82 test e build `.next-build-daily-hands`. Entrambi risolvono la stessa directory del kit; esiti delle build e verifiche finali dei video riportati sotto.
- `scripts/tg/capture-hand-review.mjs` cattura dal renderer reale riposo, preparazione, culmine e rientro degli otto mood. Campioni e contact sheet in `docs/images/daily-studio/hand-review/`. Controllo visivo dei collegamenti manica/polso, della silhouette e dell'orientamento delle dita.

La recitazione resta un'animazione illustrata con cinematica procedurale; i controlli non certificano movimenti indistinguibili da riprese umane. Il copione delle edizioni di prova mantiene la data del 18 ottobre.

## Versione finale

Entrambe le build isolate sono riuscite dopo l'ultima correzione della posa a riposo; confermati 91 test kit, 82 test Onboarding e 71 regressioni browser Meeting. SHA-256 della sorgente condivisa verificata in entrambi i consumer: `6581df0f360d5932972fff16dc3f7f2f5756e17444adb1d4df77c1ce7703a55f`.

La GUI locale sulla porta 3105 usa `.next-daily-hands-release`. La prova italiana da 36 secondi è stata rigenerata nei due formati con lo stesso audio già disponibile; il report registra 25 fps, stile `hybrid`, nessun errore browser e chiusura labiale nella coda silenziosa. Le versioni precedenti della prova sono archiviate nella directory privata degli artefatti.

La verifica del filmato a due ha rilevato un gomito vicino al bordo sinistro: il layout orizzontale ora lascia margine ai due corpi e mantiene i gesti fuori dal testo delle notizie. Nuovo test geometrico su gomiti e dita degli otto mood, più 13 regressioni browser pertinenti ripetute con esito positivo dopo la correzione. La camera verticale conserva il primo piano sul conduttore che parla.

Verifica finale completata: quattro video IT/World da 90 secondi, audio e contenuti editoriali invariati. Player verificati con play/seek, tre voci della prova, otto mood, entrambi i formati e nessun overflow su telefono, errore browser o mutazione. Italia revisione 43, World revisione 20, entrambe in `needs_review`; pubblicazione disabilitata e in pausa. L'audio italiano mantiene SHA-256 `1d3ce45edc3697ccaa2d48c1c8c84d835412dfb796b814c1b7f638895d4b39c8`, con cache e checkpoint preservati. Nessuna nuova chiamata AI/TTS a pagamento per la revisione grafica.
