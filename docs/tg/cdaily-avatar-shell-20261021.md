# Alex — ricostruzione delle mani dalle reference

**Prova rifiutata dall'utente:** la resa anatomica e il raccordo del polso non sono accettabili in movimento. I controlli tecnici sotto non costituiscono un'approvazione estetica. La revisione successiva è documentata in [revisione anatomica](cdaily-avatar-anatomy-20261021.md).

L’utente ha rifiutato la resa di `avatar-coordinated-20261021`: le mani piatte a ventaglio e la sovrapposizione di due sagome aperte non corrispondono alle reference fornite. I nuovi riferimenti richiedono gusci avorio morbidi, giunti petrolio, palmo con spessore, dita raccolte e una presa centrale compatta; una mano aperta deve mostrare volume e una vera base del pollice.

## Correzione strutturale

Opzione riutilizzabile `RobotPalette.handStyle: 'shell'`, indipendente dal marchio e dal provider. La feature canonica `characters/robot` costruisce piccoli volumi procedurali e li proietta nel Canvas esistente. Non sostituisce le mani con un’immagine statica e non duplica il rig nel consumer.

- Palmo con dorso, superficie interna, pareti laterali e bordi smussati; eminenza del pollice modellata.
- Ogni dito conserva tre ossa articolate, rivestite da gusci avorio con giunti interni scuri.
- Le facce delle due mani condividono un unico ordinamento di profondità: un dito può passare davanti al palmo opposto senza ridisegnare l’intera mano sopra l’altra.
- Il riposo è più raccolto e asimmetrico. La posa centrale avvicina e orienta i palmi con flessioni distinte delle due mani, anziché sovrapporre due ventagli.
- Il polso eredita l’asse dell’avambraccio. Lo svincolo dall’appoggio è più graduale e l’orientamento viene interpolato sul ramo angolare più vicino, eliminando lo scatto osservato nell’apertura.
- La review del primo export di questa ricostruzione ha rilevato una presa troppo vicina all'anello del polso e palmi troppo frontali a riposo. La passata successiva tiene entrambi i polsi esterni al contatto, porta l'incontro sulle dita e ruota il riposo sul dorso con flessione ridotta. Il corridoio di approccio è stato adeguato conservando i controlli geometrici.
- La review della transizione nel MP4 ha individuato un raccordo carpale troppo scuro che, ruotando, sembrava un vuoto nel polsino. Il raccordo è ora un volume avorio pieno; rimane un solo anello petrolio sottile vicino alla manica.
- La posa aperta aveva troppo scorcio e flessione: si leggevano soprattutto le nocche. Il rig raccorda ora la flessione a dita più distese e riduce il pitch, mantenendo il pollice indipendente e senza cambiare il contatto vicino al petto. Il palmo aperto si legge frontalmente/obliquamente; non è una mano a coppa rivolta perfettamente verso l'alto.

API pubbliche in `@conclavia/avatar-kit/characters/robot`: `adultPresenterArms(pose, 'desk', 'shell')`, `adultHandGeometry`, `shellHandFaces(entries)` e `paintShellHands(context, entries)`. Ogni entry contiene geometria della mano, lato e colori del materiale. Le applicazioni che omettono l’opzione conservano la costruzione precedente.

## Criterio di review

Verificare a dimensione reale e in dettaglio: riposo, mezzo avvicinamento, posa raccolta, rilascio e palmo aperto, in entrambe le composizioni. Il palmo deve leggere come un volume unico; le dita devono avere estremità chiuse e articolazioni leggibili. La posa raccolta deve formare una sagoma compatta, senza otto tubi esposti che si attraversano. Lo stile resta illustrato: i soli test geometrici non costituiscono approvazione estetica.

La GUI `/podcast/tg/avatar` applica questa opzione alla candidata. Le versioni anteriori restano conservate come storico delle prove rifiutate; non devono essere presentate come l’ultima rifinitura.

## Prova consultabile

GUI locale: `http://127.0.0.1:3107/podcast/tg/avatar`. I due pulsanti confrontano le mani sullo stesso volto, giacca, banco, coreografia e audio. **Prova le pose delle mani** permette di vedere spiegazione bimanuale, palmo offerto e mani raccolte, con approccio e rilascio finiti. Gli otto mood restano disponibili; l'audio di confronto non viene risintetizzato dai pulsanti.

Catture delle pose: [riposo](../images/daily-avatar-shell-20261021/pose-refinement/rest.png), [mani raccolte](../images/daily-avatar-shell-20261021/pose-refinement/clasp.png), [palmo aperto finale orizzontale](../images/daily-avatar-shell-20261021/pose-refinement/offer-readable-landscape.png) e [verticale](../images/daily-avatar-shell-20261021/pose-refinement/offer-readable-portrait.png). Gli still di riposo/presa precedono il solo ritocco cromatico del polso; i MP4 e i loro fotogrammi sotto mostrano la resa finale. Questi still non sostituiscono il controllo delle transizioni nel MP4.

La presa rimane stilizzata e più geometrica del riferimento. Questa è una **prova di ricostruzione**, non la versione definitiva o una promessa di naturalezza umana. Le dimensioni della testa, lo studio, il logo, i font e il take Alex 2 restano quelli già disponibili. Nessuna pubblicazione o sostituzione dei video sul sito pubblico fa parte di questa prova.

```sh
TG_AVATAR_FINISH=sculpted \
TG_AVATAR_POSTURE=desk \
TG_AVATAR_HANDS=shell \
TG_RENDER_ORIGIN=http://127.0.0.1:3107 \
TG_LAUNCH_DIR=public/daily-launch/revisions/avatar-shell-20261021 \
TG_LAUNCH_QA_DIR=docs/images/daily-launch/revisions/avatar-shell-20261021 \
node --conditions=react-server --import tsx scripts/tg/render-launch-promo.ts
```

## Export e verifiche finali

- Nuovi MP4 reali, versione **`a1c3047f9e4c`**, durata 36,88 s: [verticale](../../public/daily-launch/revisions/avatar-shell-20261021/portrait.mp4) 1080×1920 e [orizzontale](../../public/daily-launch/revisions/avatar-shell-20261021/landscape.mp4) 1920×1080; H.264 25 fps, pixel quadrati, AAC stereo 48 kHz.
- Audio sorgente identico al take `podcast-brisk-20261021` per SHA-256 (`1669f9f588fc07341f242d7a6a182af1ef32c2f396215958e24618a9eadda333`). Decodifica e riproduzione browser con audio attivo verificate per entrambi i file. Nessuna nuova chiamata vocale o AI.
- [Sequenza estratta dal MP4 fra 17 e 23 secondi](../images/daily-avatar-shell-20261021/mp4-fold-sequence.png): controllati pronazione, avvicinamento, presa e ritorno. [Fotogramma verticale](../images/daily-avatar-shell-20261021/mp4-portrait-fold.png) e [orizzontale](../images/daily-avatar-shell-20261021/mp4-landscape-fold.png). La review resta positiva come prova stilizzata; non certifica equivalenza alla reference o un intreccio anatomico perfetto.
- 158 test kit superati, compresi volumi, estremità dei gusci, profondità, collisioni conservative delle falangi e continuità; typecheck, confini feature e risoluzione canonica dei consumer verificati.
- 23 regressioni browser Meeting superate sullo stato finale: otto mood, confronto, mani nei due formati, approccio/rilascio, silenzi, streaming, labiale e clock. Database temporaneo esplicito sulla porta 27018; AI e provider disabilitati.
- 82 test Onboarding superati. Build isolate Meeting e Onboarding completate dopo l'ultimo ritocco al polso. Lint mirato e `git diff --check` superati. I 13 riferimenti della visual lock approvata restano validi.
- GUI controllata a 1440 px e 390 px: nessun overflow, link di entrambi gli export allineati al nuovo hash. [Desktop](../images/daily-avatar-shell-20261021/gui-desktop.png), [mobile](../images/daily-avatar-shell-20261021/gui-mobile.png), [report media](../images/daily-avatar-shell-20261021/media-report.json), [report browser](../images/daily-avatar-shell-20261021/browser-review.json).

La prova e i controlli sono locali. Il sito pubblico, la presentazione già pubblicata e le voci predefinite dei prodotti non sono stati sostituiti.
