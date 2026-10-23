# Alex — seduto, con mani separate

**Estensione successiva:** [gesti a due mani e sovrapposizione](cdaily-avatar-coordinated-20261021.md). L’appoggio separato è una posa di riposo; non vieta gesti bimanuali o incroci intenzionali.

Revisione del 21 ottobre 2026. L’utente accetta il conduttore seduto ma rifiuta la posa a dita incrociate della revisione `avatar-desk-20261021`: la simmetria e le intersezioni risultano artificiali. Questa prova cambia appoggi e orientamento delle mani, mantenendo volto, studio, marchi, font, voce e montaggio.

## Consultazione

- GUI locale: `http://127.0.0.1:3107/podcast/tg/avatar`.
- Nuovi media: `public/daily-launch/revisions/avatar-relaxed-20261021/{portrait,landscape}.mp4`, revisione `0268e9ce2267`.
- Take Alex 2 già disponibile, 36,88 secondi. Nessuna nuova sintesi o trascrizione.
- [Riposo](../images/daily-avatar-relaxed-20261021/landscape-3.5.png), [gesto con una mano](../images/daily-avatar-relaxed-20261021/landscape-8.8.png), [otto mood](../images/daily-avatar-relaxed-20261021/moods.png), [portrait](../images/daily-avatar-relaxed-20261021/portrait.png).

## Scelta grafica

Mani separate sul piano visibile, con appoggi a distanza e profondità diverse. I polsi non costringono più le dita a incontrarsi al centro. Un dorso è più obliquo dell’altro; le dita hanno una lieve cascata di flessione e un’apertura ridotta, con il pollice meno opposto. La mano di appoggio rimane sul piano quando il busto respira o si inclina, mentre l’altra può accompagnare la frase.

Raccordo carpale più pieno e polsino chiaro continuo. Rimosso il piccolo cappuccio scuro che accentuava lo stacco. L’ombra di contatto segue palmo e dita effettivi: il precedente ovale generico diventava un alone fuori posto durante la pronazione. Materiale delle falangi più morbido, mantenendo le tre articolazioni per dito e l’ordinamento spaziale nei gesti.

Il tavolo ha un piano superiore visibile di profondità 52 unità locali, separato dal bordo frontale sottile. Questa superficie evita di far apparire le mani sospese o pendenti oltre una linea senza profondità.

## Sorgente condivisa

Tutto il rig è nella feature canonica `characters/robot` del kit. Nessuna anatomia duplicata nel consumer.

- `RobotPalette.posture: 'desk'` continua a essere esplicita.
- `adultDeskGeometry`: bordo `deskY=460`, inizio piano `surfaceBackY=408`, quota di riferimento polsi `419`, semidistanza di riferimento `92`.
- `adultDeskSupport(-1) = {x:-88,y:417}` e `adultDeskSupport(1) = {x:104,y:426}`; l’API è esportata nell’ingresso pubblico della feature.
- `adultPresenterArms(pose, 'desk')`: stessi canali semantici e stessa catena spaziale 132/120. Il contatto si rilascia progressivamente nel gesto.
- `adultHandGeometry`: rotazione del dorso, flessione, opposizione e ampiezza del carpo interpolano con il medesimo supporto. Il ritorno non cambia scheletro o clock.
- `TgPromoRenderer`: banco e camera condividono la geometria del rig nei due formati e nelle scene a due.

```sh
TG_AVATAR_FINISH=sculpted \
TG_AVATAR_POSTURE=desk \
TG_RENDER_ORIGIN=http://127.0.0.1:3107 \
TG_LAUNCH_DIR=public/daily-launch/revisions/avatar-relaxed-20261021 \
TG_LAUNCH_QA_DIR=docs/images/daily-launch/revisions/avatar-relaxed-20261021 \
node --conditions=react-server --import tsx scripts/tg/render-launch-promo.ts
```

## Stato della review

Candidata grafica da valutare nei due MP4. La posa precedente e i video pubblici sono conservati; il test non cambia pubblicazioni, scheduling o provider. La resa resta un’illustrazione procedurale e non equivale a una ripresa umana. La separazione delle dita è una correzione concreta; la naturalezza va giudicata sul movimento completo, non dal solo superamento dei test anatomici.

## Verifiche concluse

- 144 test del kit superati, compresi i vincoli di separazione delle due mani a riposo, permanenza delle punte sul piano durante respiro/inclinazione e continuità delle 56 transizioni tra mood. Ossa e articolazioni conservano lunghezze fisse; nessuna mutazione della posa sorgente.
- 22 regressioni browser Meeting superate su avatar, player, streaming, labiale e stili; i tre test specifici della rifinitura sono stati ripetuti con successo dopo l’ultimo aggiustamento all’angolo della mano. Solo Mongo temporaneo 27018, fixture `conclavia_e2e_*` e provider disabilitati.
- 82 test Onboarding, lint e TypeScript superati; entrambe le build consumer isolate completate sulla geometria finale. Confini delle feature e compatibilità dei consumer verificati.
- I 13 fingerprint di marchi, font, fondali e impostazioni già approvate restano validi.
- Due MP4 reali H.264 a 25 fps, AAC stereo 48 kHz: 1080×1920 e 1920×1080, durata 36,88 secondi. Riproduzione browser con audio attivo, avanzamento del clock e decodifica audio verificati in entrambi (`playback.json`).
- PCM sorgente identico per SHA-256 al take `podcast-brisk-20261021`: zero nuove chiamate vocali. Nuova versione media `0268e9ce2267`.
- [Sequenza dai veri fotogrammi del video](../images/daily-avatar-relaxed-20261021/mp4-timeline.jpg), [riposo orizzontale](../images/daily-avatar-relaxed-20261021/mp4-landscape-rest.png), [riposo verticale](../images/daily-avatar-relaxed-20261021/mp4-portrait-rest.png). Le prove numeriche verificano stabilità e limiti geometrici; non sostituiscono il giudizio estetico della recitazione.
