# Mood del corpo e motore condiviso

La GUI locale `/podcast/tg/espressioni` offre due inquadrature: **Viso** e **Corpo e gesti**. La seconda mostra una frase simulata senza audio: la bocca rimane chiusa, mentre postura, spalle, braccia, polsi e dita accompagnano il mood. Ascolto conserva reazioni più contenute. Riproduzione, pausa, selezione della coppia, rallentamento e seek sono gli stessi della prova facciale.

La recitazione non è implementata nel prodotto Daily. `@conclavia/avatar-kit/performance` possiede contratti neutri, coreografia semantica, tempi per frase e raccordi con conservazione della velocità. Il renderer Daily adatta le sole unità al proprio rig e conserva anatomia, IK e disegno. Il rig canonico 3D interpreta gli stessi canali su ossa e flessori; le illustrazioni classiche usano postura e gesti bilaterali, con mani dal contorno semplice. Modelli senza articolazioni o i renderer storici più limitati richiedono la relativa mappatura: un contratto comune non aggiunge automaticamente le dita a una fotografia.

## Verifica

- Test del kit: otto firme del corpo, 56 cambi fra mood, pausa/seek, intensità zero, movimento ridotto, ascolto, dita indipendenti e identità del solver fra input neutro e adattatore Daily.
- Test su entrambi i GLB reali: spalle, braccia e singole dita, nessuna deriva delle ossa, silenzio mantenuto.
- GUI: otto gesti con pixel del corpo distinti, 144 transizioni facciali sulle due identità, pausa e formato mobile; nessuna chiamata API.
- Build di entrambi i consumer e verifica che usino lo stesso kit.
- Prova Daily italiana esistente: nuovo rendering con lo stesso audio, testo e fonti; mantiene revisione editoriale e pubblicazione disabilitata.

`node scripts/tg/capture-body-review.mjs` produce due atlanti del corpo, catture desktop/mobile e campioni numerici dalla GUI realmente distribuita. `verify-mood-trial.mjs --id=be6e4f64aa8ad210795069e4` controlla la prova con quattro notizie e il mantenimento dell’audio. Sono verifiche offline con browser locale; non chiamano provider a pagamento.

Esito della verifica del 19 ottobre: 105 test del kit, 72 regressioni browser pertinenti (Daily, rig 3D, podcast e player), 82 test Onboarding, lint/typecheck e le due build completati. Il controllo dei consumer conferma un’unica sorgente condivisa. La prova italiana dura 96 s, contiene quattro notizie e 17 segmenti con sette mood; la revisione locale è 6, stato `needs_review`. Traccia originale/master: correlazione 0,998315; master/video: 0,999846; nessun campione clippato. Pubblicazione disabilitata e controllo globale in pausa. I due piloti precedenti sono rimasti invariati.
