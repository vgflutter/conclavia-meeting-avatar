# Alex: indicare i commenti, 22 ottobre 2026

L’utente chiede una prova breve del gesto verso il basso, da usare nella chiusura del Daily per invitare a commentare e chiedere approfondimenti. Il video completo rimane al passaggio successivo, dopo la revisione di questo gesto.

## Prova locale

- Player: `http://127.0.0.1:3107/daily-launch/hand-lab/index.html?pose=point-down`.
- MP4 muto di sei secondi: `public/daily-launch/hand-lab/hands-point-down.mp4`.
- Sequenza: mani raccolte, preparazione, indice in basso con breve tenuta, recupero.
- Rigenerazione rapida: `npm run tg:preview:hands`, poi `node scripts/tg/render-hand-motion-preview.mjs --point-down`.
- Anche lo studio completo offre il gesto **Indica in basso** nei due formati.

## Tre candidati e correzione scelta

La prima prova del gesto esistente portava l’indice in alto: il nome del canale e i test di continuità erano corretti, ma la geometria non esprimeva l’intenzione. La seconda abbassava davvero l’avambraccio, però il pugno nascondeva l’indice. La terza coordina bersaglio inferiore del polso, gomito vicino al fianco e pronazione obliqua. L’indice rimane disteso mentre medio, anulare e mignolo si raccolgono separatamente. Il pollice mantiene opposizione morbida.

La soluzione vive nel kit, in `adult-standing.ts` e `adult-wrist.ts`, consumata tramite `/characters/robot`. Non si ruota una mano staccata e non si aggiunge un giro arbitrario del polso. Lunghezze delle ossa, limiti di pronazione, cono di flessione e controller di velocità/accelerazione restano quelli condivisi. Il movimento rimane stilizzato; la prova tecnica non sostituisce il giudizio visivo dell’utente.

L’indicazione è un’intenzione esplicita `point-down`, già presente nel motore `/performance`. Non entra nel repertorio casuale dei mood. Il testo e la parola a cui sincronizzarla appartengono al copione Daily. Per l’export completo usare l’accento misurato della frase sui commenti, non un tempo ipotizzato sull’audio precedente.

## Continuità e verifiche

Il take breve non contiene audio o chiamate AI. Non sono stati rigenerati né sostituiti la presentazione e il Daily pubblico. Voce, faccia, font, studio, abito e marchio rimangono quelli conservati.

Quattro fotogrammi dei gesti liberi sono identici byte per byte alla rifinitura delle dita già apprezzata. Il nuovo test del kit osserva l’anatomia proiettata di entrambe le mani attraverso l’intera tenuta: direzione inferiore, indice oltre la sagoma delle altre dita, flessioni distinte e ritorno. Rimangono attive le verifiche sui dodici gesti e sui 56 cambi di mood.

![Sequenza breve](../images/daily-avatar-point-down-20261022/sequence.jpg)

Verifica conclusa: 192/192 test del kit, typecheck, confini delle feature e risoluzione dei consumer superati. Onboarding: 82/82 test, lint, typecheck e build isolata superati. Meeting: lint, typecheck, build isolata e 42/42 regressioni pertinenti del player/avatar superate in 53,1 s, solo MongoDB temporaneo e provider disabilitati. I 13 asset/impostazioni dell’identità risultano coerenti con il lock.

Il player breve è stato controllato su 1000 e 390 px: nessun overflow o errore browser, geometria ferma in pausa, MP4 raggiungibile. Il gesto è leggibile sopra il banco sia in 16:9 sia in 9:16. Il server locale 3107 usa ora `.next-build-hand-point-down`; gli altri servizi sono preservati. MP4 H.264 880×570, 25 fps, 6,00 s, senza traccia audio, decodificato integralmente; export del solo test in 1,46 s.

Kit sorgenti: `3b0ac51156825d40a0b82865023d1edc757f5fcafaa31c9013ec9061639c50a9`. La chiusura resta da inserire e sincronizzare nel prossimo export completo dopo il riscontro dell’utente sulla prova breve.
