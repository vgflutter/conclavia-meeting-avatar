# CDaily — ingresso e rilascio della presa

22 ottobre 2026. Il movimento della revisione `compact` è stato respinto
dall'utente: durante la separazione le mani sembravano pinze. Il superamento
dei controlli di collisione non costituiva una verifica della recitazione.

## Causa e modifica

La stessa ampiezza governava raccolta, chiusura delle dita e ritorno delle
braccia. Due saturazioni mantenevano gli avambracci protesi in avanti;
le dita restavano nella presa mentre i polsi si allargavano lateralmente.

Il kit ora separa il trasporto dalla chiusura con il canale facoltativo
`handsContactGrip`. Le dita preparano una mano rilassata, si intrecciano
quando i polsi sono vicini e si aprono prima del rientro. I pollici si
accostano alle altre dita durante il trasporto. La piccola clearance di
sfilamento precede il ritorno: un polso si abbassa e rientra prima dell'altro.
Le due mani non percorrono più la stessa curva speculare.

Il renderer conserva stato, ossa, inerzia, clock, pausa e seek. La posa di
transito si dissolve e non sovrascrive l'indice di una frase successiva.
Fra due tipi di contatto prevale quello corrente sulle code del precedente.
Anatomia e animazione appartengono al kit; il consumer possiede laboratorio,
identità e scelta delle intenzioni.

## Prova breve

- [Vista ampia, 6 secondi](http://127.0.0.1:3107/daily-launch/hand-lab/index.html?pose=interlace&wide=1).
- [Dettaglio](http://127.0.0.1:3107/daily-launch/hand-lab/index.html?pose=interlace).
- MP4 locali `hands-interlace-wide.mp4` e `hands-interlace.mp4` nella stessa cartella.

I video completi rimangono nella revisione `avatar-palm-20261022` e la
chiusura nella corrispondente cartella: la nuova recitazione si valuta
prima nella prova breve. Voce, copione, font, studio e marchi sono conservati.

## Verifica

La nuova regressione misura il rilascio sui giunti effettivi: quando le
mani si separano, le falangi devono distendersi; il corridoio laterale
rimane contenuto e un avambraccio rientra prima dell'altro. Altri test
coprono il gesto successivo e il cambio di contatto. Le soglie di collisione
precedenti non sono state allentate.

Controllati 151 campioni della prova e 923 fotogrammi del template completo.
[Separazione dal palmo](../images/daily-launch/avatar-flow-20261022/palm-clearance.json)
e [continuità/composizione](../images/daily-launch/avatar-flow-20261022/motion-metrics.json)
sono salvate con i fotogrammi di ingresso, contatto e uscita. Non risultano
crop o overflow nel template. I controlli geometrici restano distinti dalla
valutazione estetica del movimento.

Nessuna nuova sintesi, trascrizione o chiamata a provider a pagamento.
Nessuna pubblicazione sui social o sul dominio pubblico.

Verifica conclusa il 23 ottobre: **211 test kit, 82 test Onboarding e
60 regressioni browser Meeting superati**, insieme a lint, typecheck,
confini delle feature e build di entrambi i consumer. Le tredici impronte
dell'identità sono conservate. Separazione minima dal palmo opposto:
**+3,46** nella prova e **+2,05** nel template completo.

Le due prove principali hanno 150 fotogrammi a 25 fps, durata di sei secondi
e nessun errore di rendering. La porta 3107 usa `.next-build-avatar-flow`;
il renderer temporaneo 3110 è stato chiuso. La valutazione artistica
rimane distinta da questi esiti tecnici.
