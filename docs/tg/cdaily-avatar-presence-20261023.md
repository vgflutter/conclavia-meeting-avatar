# CDaily — presenza grafica e recitazione, 23 ottobre 2026

## Scelta

Rifinire Alex come presentatore ibrido adulto, chiaro e riconoscibile. La richiesta più recente autorizza anche la grafica dell'avatar, dopo la precedente fase limitata ai movimenti. La presentazione mantiene studio, font, logo, palette prodotto, copione, voce Alex 2 e tempi delle parole. Non è un nuovo format né un cambio di identità.

Revisione locale: `public/daily-launch/revisions/avatar-refined-presence-20261023/`, derivata da `avatar-connected-motion-20261023`. Entrambe le precedenti revisioni complete restano disponibili. Durata 36,88 secondi, 50 fps, 1080×1920 e 1920×1080. [Player locale con selettore di formato](http://127.0.0.1:3107/daily-launch/revisions/avatar-refined-presence-20261023/index.html).

## Analisi critica e interventi scelti

1. Il volto chiaro perdeva volume sul fondo luminoso. Una luce laterale continua e il decadimento verso mandibola/tempie ne leggono meglio la forma, senza aggiungere maschere o un secondo mento.
2. Occhi, naso e labbra erano sottili e poco leggibili sul telefono. Orbite morbide legate alle palpebre, bordo superiore più definito, ponte nasale illuminato e volume del labbro seguono gli stessi muscoli e visemi. Il viso resta chiaro.
3. I riflessi della manica si incrociavano al gomito, generando faccette sovrapposte. Campi di luce continui, ritagliati nella sagoma esistente, puliscono il piegamento senza spezzare il braccio.
4. Le falangi bianche tendevano a fondersi. Maggiore contrasto sui piani laterali rende più leggibili dita e polso. Mesh, spessori, lunghezze e profondità per pixel sono conservati; non si nascondono collisioni cambiando l'ordine di disegno.
5. Il collo aveva una resa da barra piatta. Nucleo più pieno e materiale in lega sfumato migliorano il raccordo con la superficie chiara e il colletto, conservando gli attacchi mobili.

Il primo studio rendeva le orbite troppo simili a ovali dipinti e manteneva riflessi frammentati sui gomiti. La candidata scelta sfuma le orbite fino alla trasparenza ed elimina le strisce auto-intersecanti. Queste sono correzioni visive deliberate, non un rifacimento casuale dell'avatar.

## Continuità dei movimenti

Conservato il profilo condiviso `phrasing: 'connected'`: inviluppi con accelerazione nulla agli estremi, variazione dell'accelerazione dei polsi limitata, guida del bersaglio di 45 ms, percorso diverso fra ingresso e richiamo e assestamento coordinato di torace/spalle/testa. Il riposo converge senza oscillazione residua. Le dita hanno risposta prossimale/distale distinta.

L'indice in alto sottolinea una sola volta «ricontrolla», sul centro misurato della parola (20,595 s); non diventa un loop. Sei accenti complessivi, con recuperi e pause. L'intreccio resta riservato alle scene da seduto; i contatti calibrati conservano il loro percorso precedente. La nuova finitura non cambia la coreografia della revisione `avatar-connected-motion-20261023`.

## Riuso e limiti

- Implementazione canonica in `@conclavia/avatar-kit/characters/robot`, con performance condivisa. Il consumer possiede colori, voce, scene e regia editoriale.
- Riutilizzare `finish: 'sculpted'`, `handStyle: 'anatomical'` e `dailyPerformanceForPosture(posture)`. Per successive sole revisioni grafiche partire dal manifesto congelato senza ripianificare i gesti.
- Le impronte originali di studio, marchio e font restano identiche. Il visual lock aggiunge i sorgenti della finitura ora selezionata, con motivazione della revisione.
- Audio sintetico in cache SHA-256 `1669f9f588fc07341f242d7a6a182af1ef32c2f396215958e24618a9eadda333`. Nessuna nuova generazione vocale, trascrizione o chiamata a pagamento.
- È animazione vettoriale stilizzata: i controlli tecnici non dimostrano recitazione indistinguibile da un essere umano. L'approvazione estetica finale resta un giudizio sul video.
- Questa consegna aggiorna anteprima e Studio locali; non attesta una pubblicazione sui social o un deploy del sito pubblico.

## Verifica

Materiali controllati in studi ravvicinati e nelle otto espressioni della GUI (attenzione, curiosità, dubbio, accordo, divertimento, empatia, dissenso e sorpresa); poi verifiche nel renderer effettivo e nei file codificati. I report di esportazione, immagini e playback sono in `docs/images/daily-launch/avatar-refined-presence-20261023/`. Il rapporto finale di consegna registra esiti di test, dimensioni, durata, impronte e controllo dei due formati.

Versione dei media: `12c91abdf743`. Tavola delle otto espressioni: [immagine](../images/daily-launch/avatar-refined-presence-20261023/moods-contact-sheet.jpg).

Verifiche completate: **228 test kit, 82 Onboarding, 6 regia e 73 regressioni browser**; build di entrambi i consumer, lint e typecheck. Audit a 25 campioni/s: 923 campioni per formato, nessun taglio, overflow o errore browser. Dodici prove brevi rigenerate con la stessa finitura. File completi: 1844 fotogrammi per formato, audio AAC stereo 48 kHz, picco −4,3 dBFS. [Rapporto di verifica](../images/daily-launch/avatar-refined-presence-20261023/validation-report.json).

Riproduzione integrale conclusa sulla GUI 3107: entrambi i file arrivano alla fine con audio attivo, nessun errore browser o scrittura, pagina entro 390 px. Contatore player: 0 fotogrammi persi in portrait, 1 in landscape; il contatore totale del secondo formato include anche caricamenti/seek precedenti e non è il numero di frame codificati. Verificata anche la presa intrecciata da seduto. [Rapporto playback](../images/daily-launch/avatar-refined-presence-20261023/playback-report.json).
