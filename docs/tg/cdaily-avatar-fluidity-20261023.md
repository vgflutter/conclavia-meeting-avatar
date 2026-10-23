# CDaily — fluidità di mani, polsi e braccia, 23 ottobre 2026

L’utente continua a trovare poco fluida la prova del 22 ottobre. Questa revisione corregge il movimento del renderer condiviso e consegna una prova breve: non costituisce approvazione estetica dell’utente e non sostituisce i MP4 completi precedenti.

## Cambiamento

- Il rig anatomico in piedi avanza con sottopassi media di massimo 1/120 s. La frase viene ricampionata al tempo di ogni passo: il disegno a 25, 50 o 60 fps non cambia più sensibilmente la traiettoria di polsi e dita.
- La vecchia clearance restava ampia fino alla fine del rientro, poi si annullava in pochi fotogrammi: la mano scendeva e risaliva a scatto. La preparazione conserva lo spazio necessario; il richiamo usa una traiettoria meno profonda dopo lo sfilamento delle dita.
- L’intreccio non riceve anche la posa generica di sovrapposizione. Il pollice resta meno opposto durante il transito. Ricalibrate separatamente le corsie di anulare e indice per conservare la distanza fra le dita con il nuovo clock.
- La prova viene esportata a **50 fps**, 300 fotogrammi, sei secondi senza audio. Il cursore ricostruisce soltanto lo stato della posa e disegna una volta, evitando decine di disegni intermedi durante un seek. Il link al MP4 incorpora la revisione del bundle per evitare la cache di una prova precedente.

Identità, anatomia a ossa fisse, volto, studio, voce e tempi del copione completo sono conservati. Non sono state aggiunte animazioni casuali o loop.

## Prova da guardare

- [Vista ampia — sei secondi](http://127.0.0.1:3107/daily-launch/hand-lab/index.html?pose=interlace&wide=1&v=fluidity-20261023)
- [Dettaglio — sei secondi](http://127.0.0.1:3107/daily-launch/hand-lab/index.html?pose=interlace&v=fluidity-20261023)

I riferimenti prima/dopo sono campionati allo stesso clock a 25 fps. Nella prova il picco della terza derivata della posizione dei polsi scende da 18.689 a 4.783 unità/s³, circa **−74%**. Il tuffo tardivo del polso rispetto al riposo passa da 35,74 a 2,60 unità. Sono indicatori tecnici del difetto segnalato, non un voto sulla naturalezza.

La discrepanza massima fra i punti effettivi disegnati a 25 e 100 Hz passa da 6,96 a circa 0,71 unità. I nuovi test confrontano anche 24/30/50/60 Hz con 120 Hz e verificano pause e intervalli persi. Sul browser locale il disegno della prova ha mediana di circa 5,2 ms e p95 di 7,2 ms; queste misure non certificano altri dispositivi.

## Verifica dell’intero template

Ricostruiti i **923 campioni** della presentazione esistente, conservando manifest, take e coreografie. Zero errori browser, mani fuori quadro o testi in overflow. Viaggio massimo per fotogramma a 25 fps: polso 8,92, gomito 9,89, articolazioni delle dita 14,51 unità; rotazione del frame del polso 8,80°. Durante l’intreccio il raggio delle falangi mantiene almeno **2,94 unità** dal volume pieno del palmo opposto.

Le regressioni di contatto verificano dita e palmi effettivi a 25 e 50 fps, otto mood e due vitalità; restano anche le prove di durate, ricostruzione dopo seek, contatti alternativi e recupero dell’indice verso i commenti.

Artefatti: `docs/images/daily-launch/avatar-fluidity-20261023/`. `compare.json` conserva il confronto dei polsi; `frame-rate-metrics.json` il confronto numerico fra cadenze; `motion.json` e `palm-clearance.json` contengono la verifica del template completo. Le sezioni storiche `prior/current` del secondo file confrontano prove precedenti; la sezione `presentation` riguarda questa revisione.

## Stato della consegna

La GUI locale va servita dalla build `.next-build-avatar-fluidity`. I MP4 interi `avatar-palm-20261022` e `avatar-palm-closing-20261022` conservano la recitazione precedente: per la revisione del movimento usare la prova breve sopra. Nessuna nuova chiamata TTS/AI, modifica ai dati o pubblicazione social.

Verifica completata: **214/214 test del kit**, **82/82 Onboarding**, **60/60 regressioni browser di Meeting**, typecheck/lint e build di entrambi i consumer, confini delle feature e identità dei 13 asset approvati.

Controllo finale sulla GUI aggiornata, viewport 390 px: riproduzione fino a 6 s, cadenza RAF mediana 16,7 ms / p95 16,8 ms, nessun intervallo oltre 34 ms e zero errori browser. Il MP4 è effettivamente 300 fotogrammi a 50 fps; nella decodifica locale Chrome ha riportato un fotogramma scartato. Il link include la revisione `020a463cbbbf`.
