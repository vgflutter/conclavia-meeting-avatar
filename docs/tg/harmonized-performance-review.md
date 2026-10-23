# Daily · recitazione armonizzata, 19 ottobre 2026

Obiettivo: trattare occhi, fronte, naso, collo, spalle, busto e mani come un personaggio continuo, oltre alle singole pose. L'identità Umanoide e lo studio TG luminoso rimangono quelli selezionati; il motore è nel kit canonico.

## Intervento

- Raccordi con smorzamento critico: posizione e velocità sopravvivono al cambio della destinazione emotiva. Occhi, viso, testa, spalle e mani hanno tempi coordinati; le mani completano il gesto più gradualmente. Il clock è quello audio, senza timer di animazione autonomi.
- Stesso frame per testa e attacchi della gola: il collo e la struttura sintetica si piegano fra cranio e collare. Rimangono un solo mento e una superficie continua del viso.
- Fronte e glabella si attivano con sopracciglia e contrazione; guance, ponte nasale e narice reagiscono sullo stesso profilo. Occhi e labbra conservano i canali espressivi indipendenti.
- Le spalle accompagnano tutti gli otto gesti e il respiro dell'identità. Braccia più misurate per la conduzione; ritorno all'appoggio mantenuto anche durante inclinazione e respiro del busto.
- `RobotPose.dynamics` è opzionale per i precedenti snapshot. `adultHeadFrame` e `adultFacialAnatomy` sono esposti da `characters/robot` per le verifiche anatomiche dei consumer. Nessuna copia del motore nelle app.
- Nella GUI `/podcast/tg/performance` e nel confronto delle proposte è disponibile **Test completo · 8 mood**, oltre alla normale prova vocale. La stessa registrazione attraversa tutti i mood e termina nell'ascolto; il testo della GUI chiarisce che è una verifica visiva, non una certificazione della prosodia vocale emotiva. La modalità normale rimane quella predefinita.

Il labiale resta subordinato a PCM/visemi, con chiusura immediata su silenzio e M/B/P: il raccordo emotivo non ritarda la riproduzione e non concede parola. Il nuovo parametro opzionale `frame(seconds, capture)` della superficie di rendering evita di serializzare immagini quando una verifica deve soltanto avanzare la recitazione; i chiamanti precedenti conservano il comportamento.

La revisione offline dei frame nella prova usa un timestamp esplicito senza accodare centinaia di seek al decoder audio. Quando si avvia Play, il player si riallinea una volta al punto di revisione e torna al suo clock reale. Verificati ripresa, pausa e cambio di formato dopo una scansione completa.

## Verifica grafica

`scripts/tg/capture-harmony-review.mjs` usa la stessa superficie e gli stessi asset del renderer dei video. Verifica otto mood su entrambe le identità e tutte le **112 transizioni ordinate** (56 per identità), con avanzamento a 25 fps e ritorno finale al silenzio. Le catture comprendono corpo, volto, gola e spalle; i fogli per ogni mood iniziale mostrano sei istanti del raccordo. Nessun provider, notizia reale o modifica al database.

Evidenza in `docs/images/daily-studio/harmony-review/`: `all-faces.png`, i sedici fotogrammi del corpo, i sedici fogli delle transizioni e `report.json`. Esame visivo di tutti i mood e dei passaggi ampi, incluso sorpresa → empatia, dubbio → accordo e divertimento → dissenso. La prova comprende anche entrambe le inquadrature usate nei video.

I test del kit esercitano tutti i 56 cambi anche a metà gesto, sia proseguendo il parlato sia passando all'ascolto. Controllano continuità della velocità e indipendenza dalla suddivisione dei frame, scatti di testa/spalle, attacco del collo, lunghezze delle ossa, margini delle dita, rotazione dei polsi e bocca silenziosa. Il controllo esteso ha portato ad ammorbidire il recupero delle mani verso l'ascolto.

L'animazione è un'illustrazione procedurale: le verifiche non certificano movimenti indistinguibili da riprese umane. Le edizioni di prova mantengono audio, notizie e data del 18 ottobre; questa revisione riguarda la recitazione grafica.

## Verifica finale completata

94 test del kit, 82 test Onboarding e 72 regressioni browser Meeting superati. Typecheck, lint, controllo dei confini delle feature e build isolate dei due consumer completati. SHA-256 della sorgente canonica verificata in entrambi i consumer: `e9f1bf232353fb36f726e74e496c31485d1345ff783dc76953e772f254a079f5`. La GUI locale sulla porta 3105 usa `.next-daily-harmony`; il secondo consumer è stato verificato con `.next-build-daily-harmony`.

Esportate quattro prove da 36 secondi (voce normale e sequenza completa, ciascuna in orizzontale e verticale), H.264/AAC, 25 fps e pixel quadrati. Il report della prova completa conferma tutti gli otto mood nei due formati e la bocca chiusa nella coda silenziosa. Rigenerati anche i quattro video IT/World da 90 secondi. Audio, copione, fonti, cue e sottotitoli verificati invariati rispetto ai master precedenti; cache e checkpoint vocali preservati. Nessuna nuova chiamata AI/TTS a pagamento per questa revisione.

La GUI principale ha superato la verifica di tre voci, otto mood, play/seek dei quattro video, ascolto, pausa stabile e ripresa dopo la scansione completa dei fotogrammi. Nessun overflow a 390 px, errore browser o mutazione nelle verifiche finali in sola lettura. Italia revisione 45, World revisione 22, entrambe `needs_review`; pubblicazione disabilitata e in pausa. Nessun deploy del sito pubblico o pubblicazione social.

Report: `docs/images/daily-studio/harmony-review/report.json`, `auditions-verification.json`, `official-complete-gui.json`, `final-state.json`, oltre ai report di verifica dei video e del player in `docs/images/daily-studio/`.
