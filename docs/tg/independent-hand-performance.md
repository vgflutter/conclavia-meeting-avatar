# Daily · dita indipendenti e braccia meno rigide, 19 ottobre 2026

Il feedback successivo alla revisione armonizzata segnala un problema reale: le mani avevano cinque dita disegnate e ossa articolate, ma quasi tutte ricevevano la stessa curva di flessione. Il gomito conservava una larghezza costante. I precedenti test anatomici non dimostravano una recitazione umana credibile.

## Correzione nel kit canonico

- Flessori indipendenti per indice, medio, anulare, mignolo e pollice, con opposizione del pollice. Preparazione, apertura, forma conversazionale e recupero hanno tempi sfalsati; nessun tremolio casuale continuo.
- Mano aperta di spiegazione, precisazione con l'indice, pinza pollice–indice e mano verso il petto. La mano di supporto ha una forma e un ritardo diversi. La pinza risolve il contatto geometrico su tre ossa fisse del pollice.
- Le falangi piegate vengono ricomposte davanti al palmo con un passaggio graduale. Prima il riempimento del palmo le cancellava, nascondendo parte della flessione reale.
- Il gomito si apre nel gesto e torna vicino al busto a riposo. Il polso percorre un arco con rotazione e flessione contenute. Le maniche condividono il colore al gomito e non tracciano un taglio trasversale fra due blocchi rigidi.
- Appoggio rilassato, con una lieve cascata di flessione e due mani differenti. Una prima versione della revisione mostrava ancora dita troppo chiuse a riposo: corretta dopo il controllo ingrandito e su telefono.

Il viso selezionato, la stanza e le registrazioni vocali rimangono quelli già scelti. I nuovi canali sono opzionali in `RobotHandPose` e condividono l'assestamento con velocità conservata; non aggiungono clock, timer, provider o logica applicativa. Implementazione in `conclavia-avatar-kit/src/features/characters/robot/`, ingresso pubblico `@conclavia/avatar-kit/characters/robot`, senza copie nei consumer.

## Verifica

97 test kit: oltre alle invarianti precedenti, movimento di un singolo dito senza trascinare gli altri, falangi fisse, contatto reale della pinza, curve distinte dei flessori durante una frase, gomiti mobili e pausa che congela tutti i canali. Rimangono i controlli degli otto mood, dei 56 raccordi durante il parlato/verso l'ascolto, dei margini e dell'autorità PCM sul labiale.

`scripts/tg/capture-gesture-review.mjs` cattura otto mood dal renderer effettivo, con otto istanti per ciascuna mano e diagnostica del rig. Evidenza: `docs/images/daily-studio/gesture-review/hand-0-sequence.png`, `hand-1-sequence.png`, corpi per mood e `report.json`. Le sequenze sono esaminate per apertura/raccolta, opposizione, attacco del polso e recupero; non bastano singole pose finali per valutare il movimento.

Nel controllo browser del vecchio player podcast è emersa un'assunzione errata della fixture: `AudioBufferSourceNode.ended` può arrivare prima che la coda raggiunga il dispositivo. Il controllo ora confronta gli intervalli PCM pianificati con il clock di uscita al momento in cui entrambe le bocche parlano, e richiede due intervalli simultanei. Restano verificati Stop e fine delle sorgenti. Nessun cambiamento al player di produzione. Tutti i nove test del file sono stati ripetuti con esito positivo.

La resa rimane un'illustrazione procedurale. Indipendenza delle dita, geometria e assenza di scatti non certificano una performance indistinguibile da una ripresa umana. Questa revisione non va descritta come movimento umano perfetto. Audio e notizie delle edizioni pilota sono quelli del 18 ottobre; la revisione riguarda la recitazione grafica.

## Consegna locale verificata

- GUI su `http://127.0.0.1:3105/podcast/tg/performance`, build `.next-daily-human-hands`; anche la build Onboarding `.next-build-daily-human-hands` è riuscita. Kit canonico verificato in entrambi i consumer: SHA-256 `a40eacdd2201a8e4cddc73032b4c6c2fed8e4f6a80081791e959820c53a36b5e`. Typecheck, lint, confini e controlli dei consumer superati; 97 test kit, 82 Onboarding, 20 regressioni grafiche finali e tutti i nove test del player podcast superati. Gli altri test pertinenti della selezione iniziale rimangono verdi.
- Quattro prove da 36 secondi aggiornate: voce e sequenza completa degli otto mood, ciascuna in 16:9 e 9:16, H.264/AAC a 25 fps, pixel quadrati. Il report `gesture-review/auditions-verification.json` verifica formato, canali delle dita nel bundle effettivo, otto mood e coda silenziosa.
- `verify-gesture-gui.mjs` verifica tutti gli otto mood, flessori che cambiano durante l'audio realmente in riproduzione, pausa stabile, appoggio finale e telefono a 390 px. Report `gesture-review/official-gui.json`, senza errori browser o mutazioni. Ripetuti anche confronto delle tre voci e verifica dei quattro player con play/seek.
- Rigenerati i quattro piloti IT/World da 90 secondi. Copione, fonti, cue, WAV/MP3/VTT e cache/checkpoint preservati. WAV italiano SHA-256 `1d3ce45edc3697ccaa2d48c1c8c84d835412dfb796b814c1b7f638895d4b39c8` invariato. Italia revisione 47, World revisione 24, entrambe `needs_review`, senza consegne. Pubblicazione disabilitata e in pausa, nessun deploy pubblico o nuova chiamata AI/TTS a pagamento.
- Confronto locale di 16 secondi in `/daily-performance/gestures-comparison.mp4`: crop simultanei di mani/braccia, PRIMA a sinistra e ORA a destra, stesso istante e audio. I master precedenti della prova sono conservati nella directory privata `.tg-artifacts/.audition-backups/20261019T160409Z-human-hands/`.
