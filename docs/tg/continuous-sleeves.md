# Daily · superficie continua delle maniche, 19 ottobre 2026

Il feedback riguarda il disegno a due pezzi di braccio e avambraccio. La precedente revisione aveva articolato mani e gomiti, ma conservava due sagome e due sfumature della manica; i capi dei segmenti accentuavano l'aspetto meccanico.

## Modifica

La feature canonica `characters/robot` ora dipinge l'intera manica dalla spalla al polso come una sola superficie, arrotondata sul gomito. Materiale e trama sono condivisi con il busto. La radice rimane dentro l'attacco della giacca, evitando una spallina tonda aggiunta alla silhouette. Una piega corta sul lato interno del gomito suggerisce il tessuto senza tracciare una divisione trasversale. Il polsino rimane un dettaglio distinto al polso.

La cinematica continua a usare le due ossa e i flessori indipendenti delle dita. Il cambiamento riguarda la pelle grafica, non tempi, pose o autorità audio. Le sei direzioni adulte usano lo stesso disegno continuo; API e palette rimangono compatibili.

Il passaggio davanti al tavolo ripristina la stessa superficie nella sola fascia del banco e poi le mani. La manica non viene ricostruita da un secondo pezzo al gomito; il desktop non cancella polsino e raccordo del polso. Renderer e geometria rimangono nel kit, senza copie nei consumer.

## Verifica

Esaminate le sequenze degli otto mood nel renderer effettivo, con particolare attenzione a spiegazione, domanda a due mani e gesto verso il petto. Campioni in `docs/images/daily-studio/sleeve-review/`; confronto con i frame precedenti di `gesture-review/`. Nel primo controllo la radice della manica aggiungeva un rigonfiamento sulla spalla: assottigliata prima della build finale.

97 test kit e 56 regressioni browser Meeting superati, inclusi polsini visibili sopra il tavolo nei due formati, espressioni dei sei stili, otto mood, due identità, pausa, visemi e player. Anche lint, typecheck, confini delle feature e compatibilità dei consumer superati. Onboarding: lint, typecheck, 82 test e build isolata `.next-build-daily-sleeves`; Meeting: build `.next-daily-sleeves`.

Le registrazioni vocali, il viso scelto e i contenuti delle edizioni pilota rimangono quelli precedenti. Nessuna nuova chiamata AI/TTS a pagamento o pubblicazione social è necessaria per questa revisione grafica. La resa resta un'illustrazione procedurale.

## Consegna completata

La GUI locale 3105 usa `.next-daily-sleeves`. Quattro prove da 36 secondi aggiornate (voce/otto mood, orizzontale/verticale) e quattro video pilota IT/World da 90 secondi rigenerati. Verificati H.264/AAC, 25 fps, pixel quadrati, durata esatta, coda silenziosa e otto mood nei due formati. Il confronto `/daily-performance/gestures-comparison.mp4?v=continuous-sleeves` mostra le maniche precedenti a sinistra e la superficie continua a destra, a parità di voce, istante e gesto. Master precedenti conservati in `.tg-artifacts/.audition-backups/20261019T163528Z-continuous-sleeves/`.

Verifica della GUI su audio realmente in riproduzione, pausa stabile, telefono a 390 px e play/seek dei quattro piloti superata. Nessun errore browser o mutazione nelle verifiche. Audio WAV/MP3, sottotitoli, copione, fonti, cue e cache/checkpoint dei piloti verificati invariati rispetto ai master precedenti. Italia revisione 49, World revisione 26, entrambe `needs_review`; pubblicazione disabilitata e in pausa. Nessuna nuova generazione AI/TTS o distribuzione pubblica.

Kit canonico verificato in entrambi i consumer: SHA-256 `b08e376000f5289727fad5e42ed52f0510b78546de131967a1d0335f25c304ed`. Report, sequenze, campione mobile, confronto e controlli di raggiungibilità in `docs/images/daily-studio/sleeve-review/`.

## Revisione successiva: distinguere maniche e busto

Il feedback successivo individua l'eccesso opposto: rendere uniformi tutte le superfici aveva fuso le braccia con il torso. La correzione conserva la continuità al gomito e recupera il volume della manica con luce/ombra longitudinali. Un'ombra di contatto e una cucitura discreta della spalla sono ritagliate sul profilo esatto della giacca e disegnate prima della manica, che può quindi nasconderle correttamente quando si solleva.

Il profilo del busto è leggermente più sagomato sotto le ascelle. Lo spazio reale fra braccia e torace nelle pose aperte rende leggibile la separazione anche senza una linea forte o due colori al gomito. La stanza e il banco rimangono fuori dalla maschera dell'ombra. Scheletro, dita, voci, viso e clock non cambiano.

Esaminate le sequenze degli otto mood, inclusi mani sollevate, ascolto e gesto verso il petto; campioni in `docs/images/daily-studio/arm-volume-review/`. 97 test kit, 56 regressioni browser Meeting e 82 test Onboarding superati; lint, typecheck, confini e build isolate dei due consumer completati. Build Meeting `.next-daily-arm-depth`, Onboarding `.next-build-daily-arm-depth`. Sorgente canonica SHA-256 `200e06191d8c3f381959b658b3f1997185041daaf79638bdd54dae839dbc0e68`.

### Consegna della revisione

La GUI locale su 3105 usa `.next-daily-arm-depth`. Le quattro prove da 36 secondi e i quattro video pilota da 90 secondi sono aggiornati nei due formati. Il confronto `/daily-performance/gestures-comparison.mp4?v=arm-depth` mostra a sinistra la precedente superficie uniforme e a destra la nuova separazione dal busto, con lo stesso audio e gli stessi gesti. I master delle prove precedenti rimangono in `.tg-artifacts/.audition-backups/20261019T172546Z-arm-depth/`.

Verificati otto mood, articolazione delle dita durante l'audio, pausa stabile, ritorno al riposo, layout a 390 px e riproduzione/seek dei quattro piloti nella GUI. Nessun errore browser o mutazione nelle verifiche. Export H.264/AAC a 25 fps, pixel quadrati e durate esatte; coda delle prove con bocca chiusa. WAV, MP3, sottotitoli, copione, fonti e cue dei piloti verificati invariati. Il WAV italiano conserva SHA-256 `1d3ce45edc3697ccaa2d48c1c8c84d835412dfb796b814c1b7f638895d4b39c8`.

Italia revisione 51 e World revisione 28 rimangono `needs_review`; pubblicazione disabilitata e in pausa. Nessuna nuova chiamata AI/TTS o pubblicazione social. Report, confronto, campioni mobili e stato finale in `docs/images/daily-studio/arm-volume-review/`.
