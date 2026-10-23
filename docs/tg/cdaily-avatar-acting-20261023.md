# CDaily — recitazione coordinata e presa bilaterale, 23 ottobre 2026

L’utente chiede un ulteriore sforzo sulla naturalezza. La revisione precedente migliorava il clock, ma rimaneva troppo dipendente da una traiettoria unica delle mani. Questa è una nuova candidata del renderer condiviso, non una dichiarazione di approvazione estetica o di perfezione.

## Scelta fra le varianti

| Variante | Valutazione e decisione |
| --- | --- |
| A — precedente | Confronto conservato. Rientro meno brusco, ma presa ancora trascinata dai movimenti del busto. |
| B — inseguimento più rapido | Scartata: maggior prontezza, ma cambio di accelerazione dei polsi troppo netto. |
| C — arco raccolto | Migliore silhouette nell’avvicinamento; da sola non risolve il trascinamento dei palmi. |
| D — falangi e torace coordinati | Migliora la recitazione, ma serve chiudere anche l’orientamento della presa. |
| E — vincolo bilaterale | Selezionata: compensa la spalla al polso, mantiene le mani insieme e conserva le articolazioni indipendenti. |

Il confronto usa clip di sei secondi e fotogrammi degli stessi passaggi. I tentativi scartati sono conservati in `/tmp/cdaily-acting-candidates`; la A è in `public/daily-launch/hand-lab/review-20261023/a-previous.mp4`.

## Cosa cambia nel motore

1. **Presa come catena bilaterale.** La posizione dei polsi non prende più due spostamenti di profondità opposti dal torace. Il palmo mantiene un frame di contatto; la pronazione dell’avambraccio e lo swing del polso, entrambi con inerzia angolare, compensano il movimento di spalle e gomiti, entro i limiti anatomici. Le dita non vengono trascinate dal movimento del busto.
2. **Articolazioni delle dita.** MCP, PIP e DIP hanno tempi di raccolta diversi, senza cambiare le lunghezze. Le falangi distali si liberano prima del distacco, invece di ruotare tutto il dito come un blocco.
3. **Recitazione collegata.** La preparazione delle clavicole è sfalsata; il torace conclude un solo assestamento dopo il contatto. Il trasporto usa curve con velocità e accelerazione nulle agli estremi. Il profilo vivace riduce il ritardo senza forzare la velocità contro un limite troppo basso.
4. **Fase esplicita di rilascio.** Il nuovo canale facoltativo `handsContactRelease` del contratto `/performance` permette di ricostruire la traiettoria di ritorno anche da un seek. Gli altri rig possono ignorarlo o interpretarlo con la propria anatomia; il frame di Alex resta nell’adattatore del robot.

I gesti liberi, gli altri tipi di contatto e i limiti di pronazione/swing rimangono compatibili. Voce, grafica, studio, font e identità sono conservati. Il motore non aggiunge agitazioni casuali o loop.

## Prove rapide

- [Recitazione completa — sei secondi](http://127.0.0.1:3107/daily-launch/hand-lab/index.html?pose=delivery&v=acting-20261023): spiegazione con una mano, intreccio, indice verso i commenti; tre mood sullo stesso clock, senza audio inventato.
- [Presa e rilascio — vista ampia](http://127.0.0.1:3107/daily-launch/hand-lab/index.html?pose=interlace&wide=1&v=acting-20261023).
- [Dettaglio delle dita](http://127.0.0.1:3107/daily-launch/hand-lab/index.html?pose=interlace&v=acting-20261023).

Ogni MP4 dura sei secondi a 50 fps. Il cursore permette passi di 0,02 secondi per vedere ogni fotogramma. La ricostruzione del cursore disegna soltanto il campione finale; il link al video è versionato contro la cache. L’identità rimane quella salvata in `dailyVideoIdentity`.

## Controlli specifici

- Otto mood e tre stance: durante la tenuta lo scarto massimo osservato del frame del palmo rispetto al contatto è circa **0,34°**.
- Spostamento esplicito delle clavicole e rotazione del torace: il controllo mantiene le punte delle dita entro **1,2 unità**, evitando il trascinamento di circa 3,15 unità osservato senza il vincolo di posizione completo.
- Capsule delle dita e volume pieno del palmo dopo il controller, a 25/50 fps, più durate diverse e ricostruzione dopo seek. Le soglie non vengono allargate per far passare una variante.
- La sequenza rapida spiega/raccoglie/indica verifica continuità dei punti articolari, nessuna falange nel palmo e nessuna apertura della bocca senza audio.

Le verifiche tecniche delimitano il comportamento; la naturalezza resta da valutare guardando la prova.

## Riferimenti del metodo

La scelta di traiettorie senza bruschi cambi di accelerazione è coerente con il modello di [Flash e Hogan sui movimenti del braccio](https://pubmed.ncbi.nlm.nih.gov/4020415/). La fase distinta delle articolazioni è un’interpretazione per questo rig, informata dagli studi sulla [coordinazione delle dita durante la presa](https://pubmed.ncbi.nlm.nih.gov/11850469/). Non è motion capture né una riproduzione misurata di uno specifico conduttore.

## Stato

Renderer canonico in `conclavia-avatar-kit`; nessuna copia nei consumer. GUI locale dalla build `.next-build-avatar-acting-final`. Il laboratorio è muto; l’estratto nello studio usa la registrazione già disponibile. Nessuna nuova chiamata AI/TTS/ASR, scrittura di dati o pubblicazione social. I video completi `avatar-palm-20261022` e `avatar-palm-closing-20261022` conservano la recitazione precedente: la verifica sul loro template non equivale a rigenerarne il MP4.


## Verifica finale

- **218/218 test del kit**, **82/82 Onboarding**, **61/61 regressioni browser di Meeting**, comprese le tre azioni e i mood sul laboratorio mobile.
- Build, lint e typecheck di entrambi i consumer; confini delle feature e stessa sorgente canonica verificati. SHA del kit: `f6788c234bf17a95e270e3ed73a99a2f2eb4dc9bf4ecf50ab690057772d2c652`.
- Template completo: **923 campioni per ciascun formato**, portrait e landscape, senza errori browser, testi in overflow o mani fuori quadro. Picco per fotogramma a 25 fps: polso 8,92, gomito 9,89, articolazioni delle dita 15,92 unità; rotazione del frame del polso 8,84°. Il controllo comprende lo stato angolare della flessione/deviazione effettivamente disegnato.
- Durante l’intreccio della presentazione la falange con il suo raggio mantiene almeno **2,51 unità** dal volume pieno del palmo opposto. Il frame del palmo mantiene lo scarto massimo osservato di circa **0,344°** nei 24 assetti mood/stance.
- Identità visiva: tutte le **13 impronte approvate** conservate.

Artefatti in `docs/images/daily-launch/avatar-acting-20261023/`; i file `portrait-motion.json`, `landscape-motion.json` e `palm-clearance.json` contengono le misure finali. La sezione `presentation` del controllo dei palmi riguarda questa versione; `prior/current` sono confronti storici conservati dal verificatore.


## Estratto nello studio con audio

[Apri il player della prova nello studio](http://127.0.0.1:3107/daily-launch/revisions/avatar-acting-proof-20261023/index.html?v=d4c2d18eecdf). Un solo video con selezione verticale/orizzontale: **sei secondi, 50 fps, 1080×1920 / 1920×1080, H.264 + AAC**. La clip corrisponde a 16,64–22,64 s della presentazione congelata. Non sostituisce la presentazione intera.

La voce WAV e le strutture `cues`, `scenes`, `words` risultano identiche al riferimento `avatar-palm-20261022`. È un nuovo render del solo estratto, non una nuova sintesi vocale. Versione media: `d4c2d18eecdf`; audio del portrait con volume medio −18,5 dB e picco −4,4 dB. Renderer GET-only, zero errori browser o mutazioni nel report `motion-proof-report.json`.

Il comando di rendering accetta ora `TG_RENDER_FPS=25|50`: default 25 compatibile; per le prove e le prossime esportazioni della recitazione vivace scegliere esplicitamente 50. Parametro e output non alterano il clock o la durata della registrazione.

Player finale sulla GUI 3107: viewport mobile 390 px senza overflow, clip portrait completata a 6 s con volume 1 e audio non silenziato, nessun fotogramma scartato nella prova Chrome locale. Selettore landscape con ripristino della pausa, laboratorio con flessione del polso effettiva e passi di 0,02 s. Zero errori browser o richieste di scrittura. Renderer temporaneo 3110 arrestato; la GUI locale rimane attiva sulla build finale.
