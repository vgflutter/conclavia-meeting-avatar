# Alex — gesti a due mani e sovrapposizione

**Revisione superata:** l'utente ha rifiutato la resa visiva delle mani di questa prova. Il coordinamento resta una capacità del motore; la costruzione grafica corrente è documentata nella [ricostruzione delle mani dalle reference](cdaily-avatar-shell-20261021.md). I test riportati sotto non costituiscono un'approvazione estetica.

L’appoggio separato rimane una posa di riposo. L’utente chiede espressamente di conservare la possibilità di gesticolare con entrambe le mani e di incrociarle: il repertorio viene ampliato con una sovrapposizione morbida, occasionale, coordinata con la frase.

## Prove nella GUI

`/podcast/tg/avatar` include **Prova i gesti a due mani**:

- **Spiega con entrambe**: confronto bimanuale, con apertura e tempi diversi per i due lati.
- **Sovrapponi le mani**: approccio, breve appoggio di una mano sopra l’altra e rilascio verso i due appoggi indipendenti.
- **Gesti del copione**: ripristina la recitazione della presentazione.

Ogni prova manuale riparte da zero e dura otto secondi sul medesimo clock dell’audio; non si ripete in loop. Premere **Avvia prova** per vederla in movimento. La voce è il take Alex 2 già disponibile: i pulsanti provano la grafica e non generano una nuova interpretazione vocale. Gli otto mood restano selezionabili.

[Tavola di approccio, appoggio e rilascio](../images/daily-avatar-coordinated-20261021/two-hands.png), [esempio nel copione](../images/daily-avatar-coordinated-20261021/presentation-19.6.png), [verticale](../images/daily-avatar-coordinated-20261021/portrait-fold.png).

## Coordinamento nel motore condiviso

L’intento `fold-hands` appartiene a `performance`. Produce un solo evento finito e non entra nel repertorio casuale dei mood. Il canale `BodyPerformance.handsFold` è neutro rispetto a provider, avatar e programma: il valore assoluto indica la raccolta, il segno sceglie la mano superiore. Pausa, recupero, interruzione, ascolto e movimento ridotto attraversano lo stesso assestamento del corpo.

L’adattatore seduto `characters/robot` possiede geometria e anatomia. Una mano passa davanti all’altra in profondità, con un piccolo arco di approccio; i polsi raccolgono gli appoggi mentre dita e pollice si assestano. L’ordine opaco del disegno segue la profondità, anche con la mano sinistra sopra. La mano inferiore non viene ridisegnata sopra quella superiore. Non è una posa a dita intrecciate né un’immagine statica incollata sul corpo.

L’appoggio separato e i gesti `compare`/`open` rimangono disponibili. Il segnale non aggiunge automaticamente il movimento agli avatar che non hanno il relativo adattatore. Questo mantiene distinti intento generico e capacità effettiva dei singoli rig.

## Applicazione alla presentazione

`directDailyLaunchMotion(sequence, {coordinatedHands:true})` dirige una sola sovrapposizione nella frase «Stiamo costruendo una redazione AI che cerca, racconta e ricontrolla le notizie», fra circa 17 e 22 secondi. Il resto conserva il repertorio della presentazione. L’opzione viene applicata alla candidata seduta e al suo export; la comparazione precedente conserva la direzione originale.

Versione media `15724865f633`. Nuova revisione locale: `public/daily-launch/revisions/avatar-coordinated-20261021/{portrait,landscape}.mp4`. I file delle versioni anteriori rimangono conservati.

```sh
TG_AVATAR_FINISH=sculpted \
TG_AVATAR_POSTURE=desk \
TG_RENDER_ORIGIN=http://127.0.0.1:3107 \
TG_LAUNCH_DIR=public/daily-launch/revisions/avatar-coordinated-20261021 \
TG_LAUNCH_QA_DIR=docs/images/daily-launch/revisions/avatar-coordinated-20261021 \
node --conditions=react-server --import tsx scripts/tg/render-launch-promo.ts
```

La prova rappresenta una sovrapposizione stilizzata delle mani. Non certifica una recitazione indistinguibile da quella umana o l’interlacciamento fisico di tutte le dita. Il nuovo movimento va giudicato in sequenza, conservando l’espressività di entrambe le mani.

## Verifiche completate

- 149 test del kit superati. Le cinque nuove prove coprono evento esplicito e finito, entrambe le mani dominanti, clock fermo, recupero in ascolto/movimento ridotto, apertura bimanuale e passaggio dall’incrocio ad altri quattro gesti.
- Controllo volumetrico delle falangi: distanza esatta fra i segmenti spaziali, con il raggio maggiore di ogni falange come margine conservativo. Nessuna penetrazione fra dita opposte nei 101 campioni di approccio per lato e nelle tre inclinazioni del busto; ossa 132/120 invariate. Verificate anche le sequenze interrotte, senza confondere sovrapposizione in proiezione con intersezione dei volumi.
- 23 regressioni browser Meeting superate: nuova prova manuale nei due formati, otto mood, margini, clock, pausa, stili, player e labiale. Mongo temporaneo 27018 e provider disabilitati.
- 82 test Onboarding, lint, TypeScript, confini delle feature e compatibilità dei consumer verificati. Entrambe le build consumer isolate completate. I 13 fingerprint dell’identità visiva approvata restano validi.
- Nuovi MP4 reali, versione `15724865f633`, 36,88 secondi: H.264 25 fps, 1080×1920 e 1920×1080, audio AAC stereo. Riproduzione browser con audio attivo e decodifica audio verificata in entrambi; PCM sorgente identico per SHA-256 al take Alex 2 precedente. Nessuna nuova chiamata vocale.
- [Fotogramma del vero MP4 verticale](../images/daily-avatar-coordinated-20261021/mp4-portrait-fold.png) e [orizzontale](../images/daily-avatar-coordinated-20261021/mp4-landscape-fold.png). La candidata e i nuovi controlli restano locali; nessuna pubblicazione social o sostituzione dei media pubblici.
