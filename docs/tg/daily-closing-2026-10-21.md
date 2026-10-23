# Chiusura ricorrente del Daily

«Scrivici nei commenti cosa vuoi approfondire: partiamo dalle tue domande. Meno rumore, più contesto.»

La frase entra nel copione tramite `dailyClosing` / `withDailyClosing` prima degli audit. Il budget della scrittura riserva saluto e chiusura, mantenendo il totale del prodotto. Il primo segmento usa `curiosity` e `point-down`, gli altri due `agreement` con invito e cenno conclusivo. Non si promette un riscontro individuale a ogni commento; il flusso di lettura/risposta sui social non è implementato da questa modifica.

## Prova audiovisiva

- Directory: `public/daily-launch/revisions/daily-closing-20261021/`.
- Versione media: `0c1a92693589`; durata **7,96 s** in entrambi i formati, H.264/AAC a 25 fps, 1080×1920 e 1920×1080.
- Una generazione creativa Alex 2 con due alternative; selezionata la prima. La UI mostrava Eleven v4 Turbo; il nome del download riportava `v4`. Non si deduce la versione del modello dal solo nome file.
- Parlato continuo di 6,269375 s, velocità originale; nessuna base musicale. Tre cue emotivi sullo stesso take, senza stacchi vocali.
- Allineamento ASR autorizzato e conservato in cache privata. «commenti» inizia a 0,72 s nel take e a 0,90 s nel video; il gesto si prepara prima dell'accento e recupera dopo la tenuta. I timestamp ASR rimangono una misura approssimata.
- Il rig estende l'indice e raccoglie le altre dita. La correzione del polso è limitata; non ruota la mano di mezzo giro. La stessa direzione è pubblica nell'engine e adattata ai rig 2D/3D, senza testo o marchio nel kit.
- Identità grafica: 13 asset/impostazioni approvati corrispondono. Render senza errori browser, mutazioni o testo eccedente. Decodifica integrale di entrambi i filmati riuscita; sequenza preparazione/tenuta/recupero esaminata anche su fotogrammi estratti.

Questa è un'anteprima locale della sola chiusura. Il pilota completo r3 e la presentazione restano conservati; nessun video viene pubblicato o sostituito sul sito di produzione.

## Integrazione nel Daily completo

Su successiva richiesta dell'utente, la revisione
`2026-10-21-it-pilot-r6` integra questa registrazione e il gesto nei due master
completi da 240 secondi. Conserva r4, senza nuove chiamate TTS/ASR e senza
cambiare il ritmo delle notizie. Raccordo misurato nel PCM e volume finale
allineato alla voce precedente. Il corpo resta quello del pilota datato,
con revisione editoriale ancora pendente. Dettagli e verifiche nel
[dossier r6](daily-pilot-2026-10-21-r6-closing.md).

## Regressioni senza provider a pagamento

Kit: controllo confini delle feature, compatibilità dei consumer e TypeScript superati; 47 test pertinenti di gesti, mani, performance, timeline e riproduzione superati. Meeting TG: 67 test superati, 15 integrazioni Mongo non eseguite in questa sessione. Browser Meeting: 12 regressioni avatar/player superate con Mongo temporaneo isolato. Onboarding: 82 test superati. Build di produzione isolate di entrambi i consumer riuscite.

Questi controlli verificano implementazione e compatibilità; non attestano movimenti indistinguibili da quelli umani o il collaudo di una nuova edizione completa da quattro minuti.
