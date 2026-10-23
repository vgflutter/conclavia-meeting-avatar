# Alex — volume del busto e del vestito

Riferimento per la finitura dei materiali. La [candidata successiva](cdaily-avatar-desk-20261021.md) conserva questa giacca e modifica postura, braccia e mani; è quella ora collegata nella GUI.

Il riferimento dell'utente mostra una giacca con spalle nette, rever ampi e piani di luce distinti. La prima rifinitura migliorava principalmente il volto; il busto restava uniforme e la trama orizzontale non gli dava sufficiente volume. Questa revisione affronta specificamente il vestito e le maniche.

## Candidata corrente

GUI `/podcast/tg/avatar`: alternanza fra disegno precedente e nuova finitura, stesso take e stesse pose. Export `public/daily-launch/revisions/avatar-tailored-20261021/{portrait,landscape}.mp4`, 36,88 secondi, versione `bbfce577691a`. La precedente candidata `avatar-sculpted-20261021` rimane conservata; nessuna sostituzione dei video pubblici.

La geometria facciale, il labiale, le articolazioni, i mood e il clock audio non cambiano. La palette e lo studio approvati rimangono quelli del prodotto. La veste riceve spalle più strutturate, modellazione di petto/fianchi, rever più ampi e ripiegati, un'ombra stretta sotto i bordi, pieghe sulla maglia e un vero filetto nel taschino. La trama a righe viene attenuata. Le maniche ricevono piani longitudinali di luce e ombra, entro il contorno unito esistente, per separare braccia e torso senza un taglio al gomito.

Sorgente canonica: `src/features/characters/robot/adult-tailoring.ts`, richiamata dal presenter tramite `finish: 'sculpted'`; maniche in `adult-sleeve.ts`. Le superfici del busto passano da `adultTorsoContext`; le facce delle maniche usano i nodi della stessa catena articolata. Non sono immagini fisse appoggiate su un corpo che si muove indipendentemente.

## Prove visive

- [Prima e dopo, alla stessa posizione del video](../images/daily-avatar-tailoring-20261021/body-comparison.jpg): precedente a sinistra, nuovo busto a destra; proporzioni di cattura conservate.
- [Dettaglio del busto](../images/daily-avatar-tailoring-20261021/torso.png).
- [Fotogramma completo](../images/daily-avatar-tailoring-20261021/after.png).
- [Busto negli otto mood](../images/daily-avatar-tailoring-20261021/body-moods.png).
- [Portrait](../images/daily-avatar-tailoring-20261021/portrait.png).

I dettagli vengono valutati sul telefono e durante i gesti. Le verifiche del rig restano distinte dal giudizio estetico: la maggiore profondità illustrata non equivale a un corpo fotorealistico o a movimenti umani perfetti.

## Riproduzione dell'export

```sh
TG_AVATAR_FINISH=sculpted \
TG_RENDER_ORIGIN=http://127.0.0.1:3107 \
TG_LAUNCH_DIR=public/daily-launch/revisions/avatar-tailored-20261021 \
TG_LAUNCH_QA_DIR=docs/images/daily-launch/revisions/avatar-tailored-20261021 \
node --conditions=react-server --import tsx scripts/tg/render-launch-promo.ts
```

Audio originale riutilizzato, nessuna nuova generazione vocale o pubblicazione social. Il lavoro sulla puntata Daily da cinque minuti resta separato da questa revisione grafica.

## Verifiche completate

141 test del kit superati; feature boundaries e risoluzione del medesimo kit nei due consumer verificate. TypeScript, lint del componente modificato e 13 fingerprint della visual lock superati. Build isolate di Meeting e Onboarding riuscite. Le 21 regressioni browser su confronto delle finiture, otto mood, sei design, avatar, labiale, clock e player passano su Mongo temporaneo 27018 con provider disabilitati. La cattura degli otto mood non registra errori browser né overflow. I due MP4 conservano il take originale per SHA-256; il controllo del player è registrato in `docs/images/daily-avatar-tailoring-20261021/playback.json`.
