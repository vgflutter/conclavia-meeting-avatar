# Daily · Umanoide, 19 ottobre 2026

Il feedback sullo stile Inchiostro è che l'identità AI si è persa: la coppia sembra composta da persone illustrate. La nuova direzione **06 · Umanoide**, ID condiviso `hybrid`, cerca un equilibrio fra anatomia umana espressiva e costruzione artificiale riconoscibile.

Il volto rimane chiaro, con pupille rotonde, sopracciglia, palpebre, guance, labbra e una mandibola continua. Le tempie sono strutturali; il volume superiore della testa è composto da piani metallici, anziché capelli. Un raccordo sul collo e piccoli giunti sui polsi completano l'identità sintetica senza coprire la zona che esprime le emozioni. Due identità con cranio, materiali, iridi e guardaroba differenti.

La nuova direzione diventa la scelta Daily; le cinque precedenti restano nel confronto `/podcast/tg/proposte`, incluse Inchiostro e Sintesi. Il personaggio è nel kit canonico, mentre la scelta e le palette Daily restano nell'applicazione. Otto mood, gesti, appoggio delle mani, transizioni, camera verticale e voci già generate vengono preservati. Nessun nuovo provider di avatar.

Il test grafico riusa le edizioni del 18 ottobre e mantiene la loro data, le notizie e la revisione editoriale. Non è una nuova ricerca delle notizie del 19 ottobre. L'allineamento labiale resta quello approssimato da testo/PCM, con chiusura immediata sui silenzi e M/B/P.

Confronti dei dodici volti e dei sedici mood della coppia scelta in `docs/images/daily-studio/hybrid-review/`. Le immagini sono catture dello stesso renderer usato dai video.

## Verifica completata

- Kit canonico: typecheck, controllo feature e 86 test superati. Entrambi i consumer risolvono la stessa sorgente e mantengono i re-export di compatibilità.
- Meeting: typecheck, lint, build isolata `.next-daily-hybrid` e 70 regressioni browser superate, inclusi mood, labiale, riproduzione PCM e layout. Onboarding: typecheck, lint, 82 test e build superati.
- Esame visivo dei 12 volti, dei 16 campioni dei mood e dei fotogrammi delle edizioni italiane orizzontale/verticale. Confronto precedente preservato.
- Prova italiana animata di 36 secondi rigenerata nei due formati usando l'audio esistente. Tutti i campioni del report sono `hybrid`, senza errori browser e con bocca chiusa nella coda silenziosa.
- Quattro video delle edizioni IT/World rigenerati, ciascuno di 90 secondi: H.264/AAC, 25 fps, pixel quadrati, 1920×1080 o 1080×1920. Copione, fonti, cue, metadati vocali, WAV, MP3 e VTT verificati invariati rispetto ai backup.
- L'audio italiano Gianni/Orietta mantiene SHA-256 `1d3ce45edc3697ccaa2d48c1c8c84d835412dfb796b814c1b7f638895d4b39c8`; mantenuti anche `.speech`, `raw.wav` e il checkpoint. Nessuna nuova chiamata AI/TTS a pagamento per questa revisione grafica.
- GUI locale `http://127.0.0.1:3105`: tre voci riproducibili, otto mood, entrambi i formati, quattro video con play/seek, nessun overflow a 390 px e nessun errore browser. Verifiche in sola lettura, senza mutazioni.
- Edizioni in `needs_review`: Italia revisione 39, World revisione 18. Nessuna approvazione o distribuzione; pubblicazione disabilitata e in pausa. Le notizie mantengono la data del 18 ottobre.

Report finali: `docs/images/daily-studio/acting-export-verification.json`, `docs/images/daily-studio/acting/official-gui-report.json` e `docs/images/daily-studio/hybrid-review/final-state.json`. L'aggiornamento è locale; non è un deploy del sito pubblico.
