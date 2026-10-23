# Alex — ritorno in piedi e controllo del polso

## Richiesta e correzione

L'utente respinge la postura seduta: la trova meno viva della precedente in piedi e segnala un polso girato al contrario. La verifica precedente limitava flessione, deviazione e salto fra frame, ma non limitava la pronazione complessiva rispetto a una posizione anatomica neutra. Un movimento continuo può quindi restare poco credibile. La candidata seduta non costituisce un'approvazione del risultato.

La nuova opzione pubblica `RobotPalette.posture: 'standing'`, insieme a `handStyle: 'anatomical'`, seleziona il rig libero. Le ossa mantengono le proporzioni adulte originarie 132/120. Le braccia seguono il corpo e si rilasciano nella corsa del gesto senza gli appoggi del banco. La versione `desk` e i percorsi legacy restano disponibili per confronto.

## Algoritmo riutilizzabile

La sorgente canonica è nel kit, in `src/features/characters/robot/adult-standing.ts` e `adult-wrist.ts`. L'intenzione continua a provenire dalla feature generica `/performance`. Il rig traduce gli obiettivi semantici nel suo spazio anatomico, senza incorporare dati editoriali, provider o configurazione di ambiente.

- La posizione neutra è il piano di stretta di mano, con il pollice alto, ricavato dal piano di flessione dell'intero braccio. La pronazione totale rimane entro ±85° da quel riferimento, anche quando un obiettivo vorrebbe prendere un altro ramo angolare. Una direzione opposta o quasi parallela viene regolarizzata invece di invertire il palmo.
- La traiettoria verticale usa l'inviluppo del parlato una volta sola. Nella prima prova, moltiplicare di nuovo il sollevamento per un rilascio non lineare concentrava troppa velocità a metà corsa.
- `advanceRobotPose` accetta la postura come sesto argomento facoltativo. Il rig libero conserva `standingKinematics` con posizione, velocità lineare, pronazione e velocità angolare delle due mani. Il controller smorza i bersagli e limita velocità e accelerazione nello spazio effettivo della mano; poi risolve di nuovo le ossa di lunghezza fissa.
- Limiti: 180 unità/s e 1200 unità/s² per la traslazione; 2,4 rad/s e 12 rad/s² per la pronazione. Le mani conservano la velocità al cambio di intenzione. Il tempo viene soltanto dal clock audio: pausa stabile, reset esplicito sul seek, nessun rumore o ciclo autonomo per simulare vitalità.
- Il polso conserva anche il cono di piega e la deviazione laterale massima di 15°. I limiti sulla sola piega non vengono usati come sostituto della verifica del braccio intero.

L'attore in piedi usa la regia della presentazione originale. La raccolta speciale introdotta per la versione seduta non viene forzata sul copione in piedi; rimane provabile nel laboratorio e conserva una posa stilizzata. Il frame libero e i relativi tipi sono raggiungibili dagli ingressi pubblici esistenti del kit, senza copie nel consumer.

## Verifiche

- **185 test del kit**, typecheck, feature boundaries e risoluzione dei consumer superati. Tre nuovi test coprono dodici azioni complete, gli otto mood con 56 cambi, posizione neutra, velocità/accelerazione, ossa fisse, permanenza nei margini, silenzio, pausa e seek. Le soglie preesistenti di 22,5°/frame e 16 unità per articolazione non sono state allentate.
- **82 test Onboarding**, lint, typecheck e build isolata superati. Build Meeting `.next-build-standing` completata.
- **24 regressioni browser** superate: audio/player, avatar, gesti, tutti i mood, margini nei due formati e confronto in piedi/seduto. Solo MongoDB temporaneo27018, provider e pubblicazione disabilitati; nessuna acquisizione grafica concorrente ai test browser.
- Dodici clip reali da otto secondi, 2400 frame complessivi, in `docs/images/daily-avatar-standing-20261022/motion-final/`. Il report del controller rileva velocità lineare massima145,85, accelerazione391,07 e limiti angolari rispettati. I numeri descrivono i campioni, non certificano naturalezza umana.
- Tredici impronte dell'identità grafica invariate. La GUI è stata controllata a1440 e390px: postura `standing` predefinita, nessun overflow o errore browser, clock audio in avanzamento.

Revisione visiva con tavole a4fps delle sei azioni portrait e campioni a1fps dei due master completi, salvati nella cartella `review/`: maggiore corsa delle braccia e rientri più progressivi, nessuna inversione evidente nei campioni esaminati. La geometria delle dita e la raccolta restano illustrative; i fotogrammi molto obliqui possono perdere separazione. I controlli quantitativi e questo campionamento visivo non sostituiscono il giudizio dell'utente.

## Video e GUI

Revisione separata: `public/daily-launch/revisions/avatar-standing-20261022/`, media **7d0e1c19a8d9**, durata36,88s. Portrait1080×1920 e landscape1920×1080, H.264/AAC25fps, decodifica integrale riuscita. WAV sorgente identico e PCM audio decodificato identico alla revisione precedente. Copione, voce, scene, font, colori e marchi conservati; nessuna nuova sintesi o trascrizione.

La GUI `http://127.0.0.1:3107/podcast/tg/avatar?v=7d0e1c19a8d9` usa la nuova build in background. Il controllo del browser ha verificato postura in piedi, selezione anatomica, stato del controller presente e obiettivo `palmUp` durante una vera offerta. Entrambi gli MP4 rispondono HTTP200. La versione seduta si apre con **Seduto · confronto**; i video pubblici non vengono sostituiti automaticamente.
