# Alex: pose basate su un conduttore reale, 22 ottobre 2026

La revisione `avatar-standing-20261022` è stata respinta dall’utente: mani aperte vicino ai fianchi e polsi poco naturali. I test tecnici precedenti non costituivano accettazione visiva. Non rigenerare la presentazione di 36,88 secondi per ogni modifica alle mani.

## Riferimenti osservati

Due veri fotogrammi dello stesso conduttore Sky TG24, guardati prima delle modifiche:

- [Riposo: mani raccolte davanti all’addome](https://video.sky.it/news/economia/video/bollette-cosa-succede-a-chi-non-passa-a-mercato-libero-885191).
- [Spiegazione: mani separate, verticali e rivolte tra loro](https://tg24.sky.it/mondo/video/2025/07/03/previsto-boom-di-aria-condizionata-in-tutto-il-mondo-1021371).

Sono riferimenti per postura e composizione del gesto. Nessuna fotografia è incorporata negli asset distribuiti, nessuna motion capture o imitazione del volto del giornalista.

## Correzioni condivise

Nel solo rig adulto anatomico in piedi:

- Riposo davanti all’addome, con asimmetria di quota/profondità: una mano copre parzialmente l’altra. Dita raccolte, pollice vicino al palmo.
- Uscita laterale prima della salita del gesto: la mano non rimane incollata al petto durante il sollevamento. Articolazione completa di spalla e gomito, ossa di lunghezza fissa.
- Corretta la riflessione del riferimento trasversale delle dita: i pollici erano sul bordo inferiore, benché il normale del palmo e i limiti di rotazione risultassero plausibili. Il nuovo test osserva il vero bordo del pollice e il normale del palmo, non soltanto l’angolo dichiarato.
- Velocità lineare massima 160 unità/s e accelerazione massima 1000 unità/s²; restano i limiti di pronazione, deviazione e continuità. Nessuna soglia di regressione è stata allentata.
- Il rig seduto, quello legacy, voce, volto, giacca, marchi, font e studio rimangono conservati.

## Nuovo ciclo di lavoro rapido

`npm run tg:preview:hands` ricompila il proof autonomo in pochi istanti, senza Next build, sintesi vocale o allineamento. `npm run tg:render:hands` ricompila ed esporta il solo MP4 breve, con un massimo fisso di 150 fotogrammi; richiede Chrome e FFmpeg locali. Importa `/characters/robot` dal kit e la palette identitaria del prodotto; non contiene una copia del renderer.

Aprire `http://127.0.0.1:3107/daily-launch/hand-lab/index.html`:

- Sei secondi muti: raccolta, un gesto con una mano, breve apertura di entrambe, ritorno.
- Cursore, pausa e selezione delle tre pose.
- Il clock reale governa il movimento; una pausa congela anche dita e polsi.
- MP4 `public/daily-launch/hand-lab/hands.mp4`, 880×570, H.264, 25 fps, esattamente 6 secondi, senza traccia audio.
- Bundle generato `preview.js`, da ricompilare quando cambia il kit. I due export della vecchia presentazione non sono stati sostituiti.

Cinque iterazioni locali sono state osservate come sequenze di fotogrammi. Il quinto assetto è la candidata attuale, ancora da valutare dall’utente. La raccolta rimane stilizzata: non dichiararla equivalente all’anatomia o alla recitazione di una persona reale.

![Sequenza ravvicinata](../images/daily-avatar-human-reference-20261022/contact.jpg)

## Verifica

Kit: 186 test, typecheck, feature boundaries e risoluzione consumer superati. Onboarding: 82 test, lint, typecheck e build isolata superati. Meeting: typecheck e build isolata superati. Identità: 13 asset/impostazioni approvati verificati. Player rapido: desktop 1000 px e mobile 390 px, zero errori/overflow/richieste esterne; pausa stabile e circa 0,70 secondi di movimento dopo 0,70 secondi reali. MP4 decodificato interamente.

**40 regressioni browser pertinenti superate in 34,4 secondi:** mani, mood, margini nei due formati, audio clock, streaming e player. Una prima selezione più ampia è stata interrotta durante i cicli sugli stili estranei a questa modifica; non viene conteggiata come verifica completata. Nessuna acquisizione browser concorrente ai test. Lint Meeting completato senza errori o warning; il bundle generato è escluso, la sorgente TypeScript rimane verificata. Nessun provider, social, database reale o pubblicazione coinvolto.

## Rifinitura delle dita dopo il primo riscontro positivo

L’utente trova la direzione migliore e chiede dita più vive e più piene quando viste di taglio. Conservata la sequenza breve di sei secondi e la postura appena valutata.

- Aumentata di circa il 26% la profondità delle falangi anatomiche, mantenendo larghezza e lunghezza. Il raccordo delle nocche accompagna la nuova sezione. Il vecchio materiale a gusci conserva il profilo precedente.
- Nel rig in piedi la mappatura della mano aperta conserva le flessioni indipendenti: il precedente limite comune tendeva a fissare medio, anulare e mignolo allo stesso valore.
- Il motore articolato aggiunge un solo piccolo assestamento dopo l’accento del gesto, sfalsato fra le dita. Nessuna oscillazione casuale continua; gesti di precisione e indice puntato mantengono la propria autorità. Pausa e silenzio conservati.
- La verifica osserva il volume delle vere superfici delle falangi e lo spostamento indipendente dell’anulare nella mano aperta, oltre alle regressioni esistenti.

![Sequenza della rifinitura delle dita](../images/daily-avatar-human-reference-20261022/fingers/contact.jpg)

Verifica della rifinitura: 188 test kit e 82 test Onboarding superati; typecheck, lint consumer, feature boundaries e due build isolate superati. 40 regressioni browser pertinenti superate in 39,8 s, con il solo MongoDB temporaneo e provider disabilitati. Identità visiva conservata (13 impronte). Player breve verificato nuovamente su desktop/mobile dopo i test; MP4 rigenerato in 1,52 s e decodificato interamente. GUI locale aggiornata al build `.next-build-hand-fingers`.
