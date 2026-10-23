# CDaily: presentazione in piedi e intreccio da seduto

23 ottobre 2026. Richiesta: mantenere la presa intrecciata soltanto negli scenari seduti; rifare la presentazione completa, con gesti moderati e coerenti con il linguaggio. Nessuna modifica a volto, studio, colori, font, montaggio o voce approvati.

## Consegna

- Revisione: `public/daily-launch/revisions/avatar-standing-word-20261023/`.
- Player: `http://127.0.0.1:3107/daily-launch/revisions/avatar-standing-word-20261023/index.html`.
- `portrait.mp4`: 1080 × 1920; `landscape.mp4`: 1920 × 1080; entrambi H.264/AAC, **50 fps**, 36,88 secondi, faststart.
- Versione media: `d3b238ac010e`.
- Sottotitoli italiani separati, attivabili; una sola finestra video con selettore di formato.
- Studio: `/podcast/tg/avatar`; anteprima: `/podcast/tg/presentazione`.

Il take WAV di Alex 2 è identico byte per byte alla revisione `avatar-palm-20261022`. Parole allineate, cue, mood e tempi delle scene sono conservati. Zero chiamate a TTS, trascrizione o altri provider; nessun invio ai social e nessun aggiornamento del sito pubblico eseguito da questa revisione locale.

## Regia da riutilizzare

**In piedi:** nessun intreccio nella presentazione. Sette azioni principali in 36,88 s, sei famiglie (`offer`, `gather`, `compare`, `explain`, `precision`, `underline`), con mano destra/sinistra e azioni bilaterali. Le frasi brevi conservano spazio per volto, ascolto e postura. La redazione AI viene spiegata con una mano, anziché interrompere il discorso per stringere le dita.

Gli accenti vengono dai centri temporali delle parole già misurate, fra cui “capire”, “contano”, “mondo”, “cerca”, “verificabili”, “politiche”, “Spotify”. Il planner conserva budget di recupero e memoria degli ultimi gesti. Le clausole di uno stesso pensiero condividono coreografia e finestra media, anche quando cambia l’emozione: non ricominciare il braccio a ogni cue.

**Da seduto:** la posa intrecciata resta disponibile come pausa composta esplicita. Il kit riusa controller, falangi e frame del polso, trasportando la coppia di mani alla quota della seduta. Le dita non vengono sostituite con una sagoma unica. In GUI “Intreccia le dita” seleziona la seduta; tornando “In piedi” si torna ai gesti del copione. La decisione CDaily è nel consumer, non nel motore universale.

`dailyPerformanceForPosture('standing')` esclude interlace dal repertorio CDaily; `'desk'` lo consente. Le coreografie editoriali esplicite di altre edizioni non vengono riscritte di nascosto dalla funzione di regia della presentazione. Passare sempre la postura a `advanceRobotPose` e leggere `adultPresenterHands` per la geometria effettivamente controllata.

## Verifica e iterazioni

1. Rimossa l’annotazione che forzava `fold-hands` nella frase “Stiamo costruendo una redazione…”. Nuova regia dalle parole, congelata in un manifesto separato con `--replan`.
2. Adattata la presa alla seduta usando lo stesso solver; prova di sei secondi per ingresso, tenuta e rilascio. Le pose statiche legacy restano disponibili; la nuova seduta temporale mantiene ossa 132/120.
3. Analizzata l’intera timeline a 25 fps in entrambi i layout (923 campioni ciascuno), poi esportati i due master a 50 fps. Riviste immagini delle fasi di spiegazione e la sequenza del master codificato. Nessun problema individuato che giustificasse dieci esportazioni identiche.

Metriche della presentazione nello spazio del personaggio, a intervalli di 40 ms: massimo spostamento polso 8,920; gomito 7,549; articolazione delle dita 16,226; rotazione frame polso 8,918°. Nessun ritaglio delle mani o testo fuori margine e nessun errore browser nelle due scansioni. Questi limiti misurano continuità e composizione, non dimostrano da soli una recitazione umana perfetta.

Corretto anche l’appoggio della presa sovrapposta da seduto: i polpastrelli restano prima del bordo anteriore del piano reale, invece di scendere sotto di esso.

La seduta conserva spazio positivo fra falangi e palmo opposto durante ingresso/rilascio, su 25 e 50 fps; sono verificati otto mood e tre stance, pausa e lunghezze ossee. Test condivisi: 221/221. Test Onboarding: 82/82. Lint/typecheck dei consumer, feature boundaries e compilazioni completati; 69 casi browser verificati (68 nella prima esecuzione, il caso rimanente passato dopo correzione dell’asserzione della prova a polpastrelli), più ricontrollo del cambio postura dopo il controllo del piano del tavolo. Cinque test di regia passati; 13 impronte di identità invariate.

Vedere [metriche portrait](../images/daily-launch/avatar-standing-word-20261023/portrait-motion-metrics.json), [metriche landscape](../images/daily-launch/avatar-standing-word-20261023/landscape-motion-metrics.json), [sequenza della spiegazione](../images/daily-launch/avatar-standing-word-20261023/explanation-transition.png) e `render-report.json` nella stessa cartella.

## Riproduzione del server finale

Riprodotti entrambi i master per intero su `127.0.0.1:3107`, player mobile largo 390 px, audio non silenziato e volume 1. Contatori di riproduzione: portrait 1844 frame, landscape 1932; zero frame persi in entrambi. I due MP4 contengono 1844 fotogrammi ciascuno; il contatore del player è riportato separatamente dai frame codificati. Nessun errore browser, richiesta di scrittura o overflow orizzontale. Il passaggio di formato viene verificato dopo il caricamento effettivo della nuova sorgente. [Report](../images/daily-launch/avatar-standing-word-20261023/playback-report.json).

Il server locale 3107 usa `.next-build-avatar-posture-release-20261023`; il renderer temporaneo 3110 è stato fermato. [Audit di consegna e hash dei file](../images/daily-launch/avatar-standing-word-20261023/delivery-audit.json).

## Limite della consegna

È una revisione completa e rivedibile della presentazione locale. La naturalezza resta una valutazione estetica: prima della distribuzione usare questi MP4 per la review, senza scambiarli con i vecchi file pubblici. La chiusura Daily separata non è stata rigenerata. Il nuovo workflow può essere riusato per il Daily di cinque minuti mantenendo la linea editoriale nel relativo dossier.
