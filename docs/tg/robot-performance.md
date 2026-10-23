# Robot 02: prova animata 2D

**Prova attuale:** `/podcast/tg/performance` usa il volto avorio con tratti scuri e muscoli facciali indipendenti nello studio TG diurno, con tre campioni Inworld selezionabili: Gianni, Orietta e Ingegnere. La traccia iniziale è Gianni e i due MP4 della prova sono aggiornati. Le tappe Nicola/robot isolato e stanza scura descritte sotto restano la cronologia del prototipo. [Design attuale e limiti](daylight-facial-acting.md); [confronto vocale](adult-presenter-and-voices.md).

Aggiornamento della recitazione: la revisione successiva conserva lo stile, riduce la testa e aggiunge otto gesti semantici, busto indipendente, sguardo e dita articolate. È condivisa con lo studio operativo; vedere [seconda revisione Daily](daily-studio.md). Anche i due MP4 dimostrativi citati sotto sono stati rigenerati con il rig aggiornato, conservando la voce Nicola originale. I filmati precedenti sono archiviati localmente.

La terza revisione sostituisce l’oscillazione continua con accenti scanditi dalla durata delle cue e riposo fra i gesti. Integra palmi ridisegnati, dita rilassate, battiti indipendenti, labbra compresse e asimmetriche e correzione della direzione dello sguardo nella coppia. Non cambia la prosodia della registrazione originale.

Pagina locale: `/podcast/tg/performance`. Il 18 ottobre 2026 la prova attiva passa dal modello umano 3D al robot con volto digitale, seguendo la direzione scelta per l'esplorazione. Il character design definitivo non è ancora approvato.

La tavola di riferimento è `docs/images/daily-robot-concepts/02-volto-digitale.png`, generata con imagegen. Il nuovo rig è una ricostruzione vettoriale autonoma, più essenziale della tavola raster: la texture illustrata e la vista a tre quarti del concept non sono riprodotte integralmente. Il volto digitale e la palette prugna/ocra guidano la prima prova. Non si presenta una bitmap parlante come animazione completa.

## Confini e recitazione

Implementazione condivisa: `@conclavia/avatar-kit/characters/robot`, nel kit canonico. L'app contiene soltanto la palette di Conclavia Daily (`daily-robot-theme.ts`), la sequenza dimostrativa e la GUI. Gli altri formati non adottano automaticamente questa identità.

Occhi, pupille, palpebre, sopracciglia, bocca, testa, collo, busto e braccia sono disegnati come elementi distinti dello stesso personaggio. Non c'è naso e il bordo del viso è una sagoma continua, senza mento sovrapposto. Le mani hanno deliberatamente quattro dita meccaniche ciascuna. Le articolazioni delle braccia sono proiettate su canvas 2D, con due segmenti di lunghezza costante: nessuna scena 3D, nessun modello GLB, nessun contesto WebGL. La posa viene ricalcolata dalla base a ogni frame, senza accumulare trasformazioni.

Il modulo riusa `actorPerformance`, `settleActor`, `expression`, `presenterBlink` e `presenterMouth`. Il volto 2D usa i preset completi per l'apertura degli occhi e le due sopracciglia esterne, superando i limiti dei morph del precedente rig 3D: la sorpresa apre entrambi gli occhi e alza entrambe le sopracciglia; il dubbio mantiene l'asimmetria. I mood sono otto; la sequenza di 36 secondi include presenza, curiosità, dubbio, empatia, calore e ascolto. Le frasi hanno preparazione, gesto e recupero; la seconda mano accompagna con intensità inferiore. Il clock è `audio.currentTime`. Play, pausa, seek, replay e movimento ridotto sono gestiti anche durante la prova.

La bocca dipende dal visema e dal livello PCM. Nessun mood apre la bocca da solo. Le forme vocali si raccordano in 22 ms, mentre riposo, silenzio, M/B/P e visemi sconosciuti chiudono immediatamente. Il testo/PCM usa l'allineamento approssimato già disponibile: non viene dichiarata sincronizzazione fonetica di un provider. La voce resta Kokoro Nicola locale, senza nuova generazione o costi API; la prosodia emotiva non è modificata.

## Artefatti e rigenerazione

`public/daily-performance/robot-landscape.mp4` e `robot-portrait.mp4`: 36 secondi, 25 fps, H.264/AAC, 1280×720 e 720×1280, pixel quadrati e colore BT.709 in gamma video. I precedenti filmati `acting-*` della prova 3D rimangono artefatti storici separati. Il sito pubblico e la pubblicazione social non cambiano.

Con la GUI locale sulla porta 3106:

```sh
node scripts/tg/capture-performance-demo.mjs
# Per rifare solo il verticale dopo una modifica grafica:
node scripts/tg/capture-performance-demo.mjs --portrait
```

La cattura usa lo stesso renderer della GUI, blocca richieste diverse dalle letture locali e non chiama AI, TTS o database. Il report `robot-capture-report.json` contiene stati della recitazione e gli errori JavaScript. I fotogrammi per revisione sono in `docs/images/daily-robot-performance`. Non eseguire la cattura contemporaneamente alle regressioni Playwright.

## Accettazione

Controllare entrambi i filmati a velocità reale e ascoltare il labiale. Valutare separatamente leggibilità delle emozioni, passaggi, mani e qualità del disegno. Il funzionamento dei controlli e l'assenza di errori non approvano lo stile per la produzione. Il robot e lo studio sono ora collegati al renderer delle edizioni giornaliere: vedere [studio integrato](daily-studio.md). La prova in questa pagina rimane una calibrazione della recitazione. L’accettazione artistica e la prosodia emotiva IT/EN restano da valutare.

## Verifica finale del 18 ottobre 2026

76 test del kit e 82 test Onboarding superati, insieme a confini delle feature, collegamento dei consumer, lint, TypeScript e build isolate di entrambe le applicazioni. La selezione completa di 66 regressioni browser avatar/player è passata. Dopo le correzioni del volto e del ridimensionamento sono stati ripetuti con successo i cinque controlli mirati: due rig preesistenti, GUI 2D, otto mood e pixel del labiale.

La verifica visiva ha rilevato e corretto gomiti troppo larghi, una sorpresa troppo simile all'attenzione e un fotogramma vuoto nel cambio di formato. Il ridimensionamento ora conserva il canvas quando le dimensioni non cambiano e ridisegna subito dopo un cambiamento effettivo. Il test della GUI verifica anche la presenza di pixel del volto dopo il passaggio a schermo mobile e il ritorno all'orizzontale.

Entrambi i video contengono 900 fotogrammi con audio, 36 secondi e pixel quadrati. Il controllo della regione centrale del volto in tutti i fotogrammi non ha rilevato frame vuoti. Nessun errore JavaScript in cattura. Controllati fotogrammi di sei fasi e le otto espressioni in `docs/images/daily-robot-performance/moods`.

Su Chrome locale, 120 intervalli di animazione hanno mediana e p95 di 16,7 ms, circa 60 fps; l'export è a 25 fps. È una misura su questa macchina. La GUI a 390 px non presenta scorrimento orizzontale, conserva il volto dopo la cattura a pagina intera e riproduce il video verticale 720×1280. Report in `public/daily-performance/robot-gui-report.json`. La registrazione tecnica non certifica ancora il character design o la prosodia emotiva per la produzione.
