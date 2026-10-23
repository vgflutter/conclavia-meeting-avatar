# Alex — dita coordinate e presa chiusa dal riferimento, 22 ottobre 2026

L'utente chiarisce con una fotografia che per «intrecciate» intende una presa chiusa: dita alternate attorno alla mano opposta e pollici sopra. Respinto l'incrocio aperto precedente. Chiede inoltre che le dita accompagnino il movimento della mano, senza apparire un blocco fisso.

## Revisione da vedere

- Presa, sei secondi: `http://127.0.0.1:3107/daily-launch/hand-lab/index.html?pose=interlace`.
- Dettaglio delle dita, sei secondi: `http://127.0.0.1:3107/daily-launch/hand-lab/index.html?pose=fingers`.
- Presentazione e chiusura: `http://127.0.0.1:3107/daily-launch/revisions/avatar-clasp-20261022/index.html`.
- Studio dei mood e delle pose: `/podcast/tg/avatar`.

Presentazione `avatar-clasp-20261022`, 36,88 s, media `7c22348c50ee`; chiusura `avatar-clasp-closing-20261022`, 7,96 s, media `2b3578cee712`. Entrambe nei formati portrait e landscape. Il player conserva il confronto con la precedente `avatar-connected-20261022`.

![Presa chiusa nella prova breve](../images/daily-launch/avatar-clasp-20261022/clasp-final.png)

La fotografia è il riferimento della conversazione. La resa è una sua interpretazione nel rig illustrato approvato; non viene sostituita con una foto o una mano statica sovrapposta. Voce, copione, parole temporizzate, mood, studio, volto, palette, font e marchi sono conservati.

## Dita durante il parlato

`performance/finger-phrasing.ts` dirige raccolta, apertura sfalsata, accomodazione durante il gesto e richiamo. Indice, medio, anulare, mignolo e pollice hanno tempi diversi ma appartengono allo stesso pensiero. Il pollice accompagna la rotazione con opposizione distinta. Precisione e indice esplicito restano vincolati al proprio gesto.

Le variazioni hanno inizio e fine misurati nella frase; nessun ciclo di agitazione indipendente dall'audio. Le frasi lunghe possono avere un piccolo secondo assestamento, senza trasformare le dita in una sequenza ripetitiva.

`characters/robot/adult-finger-motion.ts` conserva inerzia e velocità delle falangi nel frame trasportato della mano. `RobotPose.standingFingerKinematics` è avanzato nel clock media: flessione fino a 4,5 rad/s, abduzione fino a 3,2 rad/s, accelerazioni rispettivamente 32 e 24 rad/s². Una pausa tiene la posa, un seek azzera la velocità. Le ossa non cambiano lunghezza.

Per leggere la geometria effettivamente dipinta usare `adultPresenterHands`. La funzione della singola mano `adultHandGeometry` resta un bersaglio geometrico senza lo stato delle falangi o il contatto bilaterale.

## Presa chiusa e transizioni

La chiusura porta i palmi uno verso l'altro e raccoglie i gomiti. Una piccola estensione del polso, entro il limite anatomico del rig, lascia alle dita lo spazio per avvolgere la mano opposta. Gli indici rimangono più distesi delle dita esterne. I pollici liberano la zona dell'indice e si appoggiano sopra con articolazioni proprie.

Sono state confrontate più costruzioni: inseguire ogni punta verso un punto di contatto produceva soluzioni instabili o falangi che attraversavano il palmo. La scelta usa profili articolari chiusi, inerzia delle singole falangi e un corridoio laterale di ingresso/rilascio. Durante la separazione non si ritira una falange attraverso il pollice della mano opposta.

`BodyPerformance.handsContactSettle` consente una sola accomodazione dopo il contatto: lieve richiamo delle dita e appoggio dei pollici, poi rilascio. L'adattatore può ignorarlo. La presa usa una risposta più cauta delle braccia; i gesti liberi mantengono la direzione vivace `vitality: 0.9` scelta in precedenza.

Le tre prese del repertorio restano disponibili: sovrapposte, polpastrelli a contatto e intreccio chiuso. Il planner le alterna nei passaggi che richiedono il contatto; non vengono imposte come riposo ad ogni frase. Nel promo rimane un solo intreccio esplicito, coerente con il copione.

## Controlli

- 205/205 test kit: geometria reale delle dita, apertura durante il pensiero, momento angolare, pausa/seek, presa chiusa, ossa costanti e separazione delle capsule su tutti i fotogrammi, otto mood e due profili. Conservati anche i controlli dei dodici gesti e delle 56 transizioni fra mood nei tre profili precedenti.
- Il test dell'indice usa ora la geometria effettivamente renderizzata, anche sulla breve frase misurata del Daily.
- 82/82 test Onboarding, lint/TypeScript, confini delle feature e consumer superati; entrambe le build isolate `.next-build-avatar-clasp` completate.
- 60/60 regressioni browser Meeting superate con fixture e Mongo temporaneo, AI e provider disabilitati.
- Audit dei 923 campioni del promo: zero tagli o overflow; massimi per frame di polso 8,92 unità, gomito 10,00, falangi 14,50 e orientamento del polso 8,77°. Il viaggio massimo delle falangi era 16,51 nella precedente versione, pur mantenendo la gestualità vivace.
- Prova breve della presa: massimo viaggio di un'articolazione 13,40 unità/frame; distanza minima fra capsule −0,67 unità, entro la tolleranza di contatto morbido verificata di −1,5. Non è un simulatore fisico generale per mani arbitrarie.
- Sei prove mute esportate: gesti liberi, dettaglio dita, sovrapposte, polpastrelli, intreccio e indice verso i commenti.
- Quattro MP4 H.264/AAC decodificati integralmente; master vocali identici alle sorgenti, correlazione audio superiore a 0,9999 e zero campioni saturi. Le 13 impronte dell'identità coincidono. Nessuna nuova sintesi, trascrizione o spesa per provider.

Sorgenti kit: `6cc0e7a7bb2c6d536023ab1ebb85c6e038c04f7227df0b6ec3e2f936f3bafe67`. Report e immagini in `docs/images/daily-launch/avatar-clasp-20261022/`. La revisione rimane locale: nessuna pubblicazione social o modifica dei dati reali. I test tecnici non sostituiscono il giudizio dell'utente sulla naturalezza della recitazione.

Controllo conclusivo sulla build attiva in porta 3107: otto combinazioni contenuto/formato/viewport, riproduzione dei veri MP4, pausa e sottotitoli; nessun overflow, errore browser o mutazione. Verificata anche la prova delle dita su telefono: zoom fisso che segue il polso, nessuna articolazione tagliata nei 151 campioni, estremi verticali 42,68–448,39 px nel canvas da 570 px. Il renderer temporaneo 3110 è chiuso. Report: `final-ui-report.json`; riferimenti macro `fingers-48.png`, `fingers-65.png`, `fingers-80.png`.

## Riutilizzo

Leggere la guida video e conservare identità, take e direzione centralizzata. Per una nuova revisione visiva usare una cartella distinta:

```sh
node --conditions=react-server --import tsx scripts/tg/prepare-avatar-delivery.ts --source=avatar-clasp-20261022 --target=avatar-nuova-revisione --vitality=.9 --replan
TG_AVATAR_REVISIONS=avatar-clasp-20261022,avatar-clasp-closing-20261022 node scripts/tg/verify-avatar-delivery.mjs
```

Per una singola posa ricompilare il laboratorio con `npm run tg:preview:hands`. Il bundle viene identificato dal contenuto per evitare animazioni precedenti dalla cache. La prova ravvicinata segue il polso per mostrare le dita; il video completo conserva la regia approvata.
