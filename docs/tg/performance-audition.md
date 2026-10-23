# Prova di recitazione di Conclavia Daily

Nota storica: questo documento descrive la prima prova 3D. Dopo il riscontro dell'utente la pagina attiva passa al [robot 2D](robot-performance.md); i video `acting-*` documentati qui restano disponibili separatamente. I risultati di questa prova non approvano il disegno o le prestazioni del robot.

La pagina `/podcast/tg/performance` contiene una prova animata di 36 secondi. È separata dal renderer TG corrente e non cambia le impostazioni degli avatar. La navigazione dello studio include «Prova di recitazione».

La sequenza passa da presenza a curiosità, dubbio, empatia, calore e ascolto. Il testo è originale e dimostrativo: non contiene notizie reali. Il mood muove sopracciglia, sorriso, occhi, testa, busto e mani attraverso lo scheletro e i morph del modello. Ogni frase ha un gesto con preparazione e recupero; le pause fermano la bocca e riportano le mani a riposo. Il clock è `audio.currentTime`, anche durante pausa e seek. Il canvas non viene serializzato durante la riproduzione ordinaria.

Questa è una verifica tecnica della recitazione, non l'approvazione del design per il lancio. Il modello MakeHuman/MPFB CC0 è provvisorio; crediti completi serviti da `/avatars/rigged-v1/LICENSE.md`. Il trattamento di superficie e le proporzioni sono modifiche locali. Il volto resta più vicino al 3D umano che a un personaggio illustrato originale. Non presentarlo come il nuovo stile definitivo scelto dall'utente.

Voce: Kokoro Nicola, generata sul servizio locale già disponibile. I visemi sono approssimati dal testo e dall'energia PCM, non da allineamento fonetico del provider. Il mood agisce sul corpo e sul volto; la prosodia vocale non viene trasformata da questa prova. Non valida quindi una performance emotiva completa o la qualità di un eventuale provider esterno.

## Riproduzione e rigenerazione

La pagina carica soltanto fixture locali: non chiama AI, TTS, Mongo o pubblicazione. I file in `public/daily-performance` sono materiale dimostrativo locale, non un'edizione pubblicata.

```sh
# Solo per rigenerare esplicitamente la voce tramite Kokoro locale 8766.
node --conditions=react-server --import tsx scripts/tg/build-performance-demo.ts

# Con la GUI già avviata su 127.0.0.1:3106, registra lo stesso renderer.
# Non eseguire contemporaneamente alle regressioni Playwright.
node scripts/tg/capture-performance-demo.mjs
```

L'esportazione produce `acting-landscape.mp4` (1280×720) e `acting-portrait.mp4` (720×1280), 25 fps, H.264/AAC con il WAV originale, pixel quadrati e colore BT.709 in gamma video. Le dimensioni sono esplicite; i JPEG intermedi vivono solo in una cartella temporanea. I testi del formato verticale seguono la dimensione del riquadro anche nell'export. Il report raccoglie stati a intervalli e gli errori browser. Play, pausa, seek e confronto tra i due formati sono disponibili nella GUI, insieme al player del video esportato.

## Criteri di valutazione

Valutare continuità, leggibilità delle espressioni, labiale, gesti e silenzi separatamente dal disegno. Non basta vedere un valore numerico di mood cambiare. Guardare il filmato a velocità reale, con audio, soprattutto nei passaggi fra dubbio ed empatia e quando torna in ascolto. Controllare volto e mani anche in 9:16.

Il design originale, la regia delle notizie, la prosodia IT/EN e la validazione con un contenuto editoriale completo rimangono necessari prima del lancio. Nessuna chiamata a provider a pagamento e nessuna pubblicazione social sono richieste per questa prova.

## Verifiche del 18 ottobre 2026

71 test del kit, TypeScript, confini delle feature e collegamento dei consumer superati. Build isolate Meeting e Onboarding riuscite. Le 61 regressioni preesistenti selezionate su rig, mood, labiale e player sono passate; i tre nuovi test coprono il movimento e la stabilità degli scheletri maschile/femminile e i controlli della GUI senza chiamate API. La prima prova del nuovo test usava il nome non sanitizzato di un nodo GLTF: corretto il lookup della fixture, la verifica è passata su entrambi i modelli.

Controllati fotogrammi di sei fasi in entrambi i formati ed export di 900 fotogrammi ciascuno, 36 secondi con audio. WAV a 24 kHz, picco misurato −1,5 dBFS. Nessun errore JavaScript nella cattura. Il runtime di sviluppo emette l'avviso Three.js sulle due istanze importate dai checkout collegati; non è un errore di render, ma la deduplicazione del bundle resta da sistemare prima dell'integrazione definitiva. Queste verifiche tecniche non costituiscono approvazione estetica o ascolto editoriale del prodotto finale.

Ultimo controllo della GUI: viewport mobile 390 px senza scorrimento orizzontale, player verticale riconosciuto come 720×1280 / 36 s. Sul Chrome locale usato per la prova, 120 intervalli di animazione hanno mediana e p95 di 16,7 ms (circa 60 fps); il filmato esportato è a 25 fps. È una misura su questa macchina, non un benchmark per tutti i dispositivi. Esito salvato in `public/daily-performance/gui-report.json`. Nel verticale l'etichetta del mood è stata spostata sopra il personaggio per lasciare libere le mani.
