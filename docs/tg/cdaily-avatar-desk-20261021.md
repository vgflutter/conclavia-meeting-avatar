# Alex — mani raccolte e postura da conduttore seduto

**Revisione superata:** l’utente ha rifiutato la posa a dita incrociate perché innaturale. La candidata corrente è [mani separate sul tavolo](cdaily-avatar-relaxed-20261021.md). Il documento e i media qui sotto restano come storico, non come modello da riusare.

Richiesta: togliere l'effetto delle braccia arcuate ai fianchi e migliorare le mani, avvicinandosi alla presenza composta della reference. La correzione riguarda il rig e la regia, oltre alla finitura già definita del busto.

## Versione storica

- GUI: `/podcast/tg/avatar`, con alternanza precedente/nuova, stesso take Alex 2, otto mood e due formati.
- Media: `public/daily-launch/revisions/avatar-desk-20261021/{portrait,landscape}.mp4`, 36,88 s, versione `23710115cb2a`.
- [Posa raccolta](../images/daily-avatar-desk-20261021/landscape-3.5.png), [reazioni del corpo](../images/daily-avatar-desk-20261021/moods.png) e [portrait](../images/daily-avatar-desk-20261021/portrait.png).
- [Confronto dei veri MP4 a 3,5 secondi](../images/daily-avatar-desk-20261021/arm-comparison.jpg): precedente a sinistra, nuova posa a destra. Il confronto include la nuova inquadratura più vicina.
- Le versioni precedenti restano conservate. La nuova candidata non sostituisce automaticamente i media pubblici.

## Scelte

La posa di riposo porta gli avambracci davanti al corpo, con gomiti raccolti e contatto leggero delle dita al centro. Ogni mano si stacca dal piano e torna all'appoggio con lo stesso inviluppo continuo del gesto; non viene sovrapposta una fotografia di mani intrecciate. Gli accenti della presentazione rimangono quelli già diretti, adattati all'assetto seduto. Si conservano riposi tra i gesti e indipendenza dei due arti.

Le maniche mantengono una superficie unita, con un raccordo al gomito più corto che elimina l'arco a tubo. Le dita hanno un gradiente trasversale individuale, ombre più leggibili e una cascata distale meno chiusa nel riposo. L'articolazione delle tre falangi non viene sostituita da una sagoma fissa. Un piccolo raccordo scuro distingue polso e polsino.

La camera è più vicina per dare importanza a busto e mani: nel singolo, posizione/scala logica 16:9 `(340,67,1.3)` e 9:16 `(360,359,1.65)`. Il banco segue `adultDeskGeometry.deskY=460`; appoggio del polso a quota `455`, con compensazione del movimento del busto. La coppia si allinea al banco condiviso senza cambiare titoli e marchi. L'anatomia della testa e la registrazione vocale rimangono uguali.

## Engine riutilizzabile

Opzione pubblica del kit `RobotPalette.posture: 'desk'`, indipendente dalla palette e dal provider. Il solver delle due ossa viene condiviso in `adult-arm.ts`; il solo adattatore di postura vive in `adult-desk.ts`. Geometria pubblica: `adultPresenterArms(pose, 'desk')` e `adultDeskGeometry`. Senza l'opzione, le altre applicazioni e i design mantengono il percorso precedente.

La selezione di questa candidata è applicativa. L'export richiede sia `TG_AVATAR_FINISH=sculpted` sia `TG_AVATAR_POSTURE=desk` e una cartella separata `revisions/avatar-*`. Nessun cambiamento ai provider, all'archivio o allo scheduling deriva dalla nuova posa.

```sh
TG_AVATAR_FINISH=sculpted \
TG_AVATAR_POSTURE=desk \
TG_RENDER_ORIGIN=http://127.0.0.1:3107 \
TG_LAUNCH_DIR=public/daily-launch/revisions/avatar-desk-20261021 \
TG_LAUNCH_QA_DIR=docs/images/daily-launch/revisions/avatar-desk-20261021 \
node --conditions=react-server --import tsx scripts/tg/render-launch-promo.ts
```

Le prove numeriche di continuità, proporzioni e margini non certificano movimenti indistinguibili da quelli umani. La valutazione estetica resta una review dei video veri, non dei soli dati del rig.

## Verifiche completate

- 144 test kit superati. Le tre nuove prove verificano raccolta delle mani, appoggio che compensa inclinazione/respiro, immutabilità della posa, ossa 132/120 e tutte le 56 transizioni fra mood; margini delle dita e continuità del polso misurati a 25 fps.
- 22 regressioni browser Meeting superate, compreso il controllo dei margini di entrambe le mani sotto il viso durante ciascuno degli otto mood, nei due formati. Player, labiale, pausa/seek e sei design precedenti verificati con provider disabilitati e Mongo temporaneo 27018.
- 82 test Onboarding e le build isolate dei due consumer superati. TypeScript, feature boundaries, risoluzione del kit condiviso, lint applicativo e 13 fingerprint visivi precedenti verificati.
- Esame degli otto mood e dei fotogrammi dai MP4 reali; riproduzione dei due export con audio attivo. PCM uguale per SHA-256 al take Alex 2 precedente, zero nuova sintesi o trascrizione. Rapporti e immagini in `docs/images/daily-avatar-desk-20261021/`.
