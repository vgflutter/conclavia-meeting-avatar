# Daily: robot e studio integrati

**Versione attiva:** studio diurno chiaro e volto avorio con muscoli facciali
indipendenti. Il runtime 3105 usa `.next-daily-light`; prova vocale e quattro
video delle edizioni sono aggiornati. [Design attuale, fondali e controlli](daylight-facial-acting.md).
Le sezioni successive conservano la cronologia delle revisioni precedenti.

## Terza revisione: ritmo e ascolto

La recitazione usa ora la durata misurata di ciascuna frase. I palmi non rimangono sospesi: preparazione, accento, recupero e riposo sono eventi finiti, con tempi e forza diversi nelle frasi lunghe. La variante resta deterministica, quindi diretta, replay ed export usano la stessa coreografia. Una pausa del clock audio mantiene la posa anche se il browser continua a chiamare il renderer.

Corretto lo sguardo del conduttore sulla destra: guarda verso sinistra quando ascolta il collega. I battiti sono irregolari e indipendenti, senza ripartire al cambio di frase. Il volto usa anche inclinazione delle palpebre, pressione delle labbra e angoli asimmetrici; la testa accenna una prospettiva nei piccoli movimenti laterali. I palmi hanno un profilo più organico e dita rilassate verso l’interno; i microfoni sono spostati ai lati, all’esterno della coppia, per liberare mani e braccia.

Ambiente, proporzioni approvate, colori, voci e testi rimangono quelli della seconda revisione. La recitazione è procedurale 2D: non interpreta automaticamente ogni parola o gesto umano. I controlli tecnici non sostituiscono la valutazione artistica dei video a velocità reale.

I quattro video dei piloti sono stati rigenerati e confrontati con l’ultima versione archiviata: WAV, MP3, VTT, cue, storie, fonti e prodotto coincidono. Verificati nella GUI ufficiale gli otto mood, playback e seek dei quattro filmati da 90 s, composizioni 16:9 e 9:16 e assenza di overflow mobile. Nessun errore JavaScript o richiesta di modifica durante il controllo (`acting/official-gui-report.json`). I due piloti sono in `needs_review`, revisione 6. Runtime locale aggiornato alla build `.next-daily-natural`, pubblicazione disabilitata e distribuzione in pausa.

Rigenerati anche i due video della prova Nicola: 36 s, 900 fotogrammi, 25 fps, H.264/AAC e pixel quadrati, senza nuova sintesi o errori di cattura. Nei quattro MP4 dei piloti sono stati inoltre analizzati 450 campioni per video della sola regione busto/braccia, escludendo volto e bocca: il movimento è presente nel video codificato, oltre che nei valori del rig (`acting/body-motion-verification.json`). La variazione dei pixel non misura la naturalezza o l’approvazione artistica.

## Recitazione più viva — seconda revisione del 18 ottobre

Conservati ambiente e palette. La testa è più stretta del 18% rispetto al primo rig, con collo raccordato e busto che ruota indipendentemente. Il volto aggiunge piccoli spostamenti dello sguardo, accenti delle sopracciglia e cenni di ascolto; restano otto espressioni riconoscibili. Non è motion capture umana: è una recitazione procedurale 2D da valutare a velocità reale.

Ogni mood ha una gestualità propria: spiegazione a palmo aperto, domanda con due palmi, precisazione con indice, cenno di accordo, risposta di spalle nel divertimento, mano verso il petto nell’empatia, palmo verticale nel dissenso, mani aperte nella sorpresa. Polsi, pollice e falangi sono articolati; le dita si distendono durante il gesto e si rilassano al recupero. I due segmenti di ogni braccio mantengono lunghezza costante. Le frasi lunghe hanno piccoli accenti secondari; cue diverse possono cambiare la mano che guida, senza estrazioni casuali durante il rendering.

Il clock audio governa anche la nuova recitazione. Pausa e seek restano deterministici, i raccordi non scattano fra mood, il movimento ridotto conserva l’espressione ma elimina la gesticolazione. La bocca continua a dipendere soltanto dal livello PCM e dal visema: nessuna apertura emotiva durante silenzio o M/B/P. La voce e la sua prosodia non sono state rigenerate.

Nella GUI `/podcast/tg`, «Prova un’espressione» permette di scegliere gli otto mood o la sequenza automatica. È un controllo della sola anteprima, non una modifica della configurazione editoriale o del mood dei piloti. `scripts/tg/capture-acting-review.mjs` cattura tutte le espressioni nei due formati dal renderer reale, senza API a pagamento o modifiche al database. Frame e diagnostica: `docs/images/daily-studio/acting`.

Il 18 ottobre 2026 il vecchio presentatore umano semplificato viene sostituito nel percorso operativo del TG da un robot 2D con volto digitale e ambiente caldo prugna/ocra. Lo studio è visibile in `/podcast/tg`; la stessa composizione produce i file del worker in `/podcast/tg/render`. Non è una tavola statica indipendente dalla pipeline.

## Proprietà del codice e identità

- Nel kit: `TgStudioRenderer`, `loadTgStudioAssets` e `tgStudioLayout`, pubblici in `@conclavia/avatar-kit/formats/tg`; `paintRobot` e `advanceRobotPose`, pubblici in `@conclavia/avatar-kit/characters/robot`. La feature `formats/tg` dichiara la dipendenza da `characters/robot`. I vecchi renderer ed export restano compatibili.
- Nell’app: `daily-studio-theme.ts` sceglie palette, varianti dei due conduttori, font, logo e fondali. Questi elementi non diventano automaticamente l’identità degli altri format Conclavia.
- I renderer sono Canvas 2D. Nessun GLB, WebGL, avatar fotografico, LiveAvatar o generazione di frame per ogni frase.

Il fondale è una plate illustrata statica, con luci calde, nicchia in legno, libri, piante e un pannello per le notizie. Robot, volto, mani, tavolo, microfoni, titoli, fonti e sottotitoli sono livelli distinti. Il robot non è una bitmap con la bocca sovrapposta. Occhi, sopracciglia, bocca, testa e corpo usano la recitazione condivisa; visemi e livello PCM provengono dalle cue del manifest. Ogni frase mantiene mood e intensità. Il silenzio e M/B/P chiudono la bocca immediatamente. La texture leggera del tessuto non modifica la geometria del rig.

Il verticale usa un fondale dedicato e una regia propria: titolo sopra, conduttore più grande, tavolo e spiegazione sotto, sottotitoli nella fascia bassa. Due conduttori restano possibili, con palette distinte e ascolto silenzioso. Titoli e testi si adattano allo spazio senza tagli a metà frase; passaggi tra notizie hanno un raccordo breve. Il motore rispetta il movimento ridotto e ricostruisce le pose dopo un seek all’indietro.

## Asset e provenienza

Creati con lo strumento imagegen integrato, senza CLI/API esterne, e salvati nel progetto:

- `public/daily-studio/studio-landscape-v1.png`
- `public/daily-studio/studio-portrait-v1.png`

Prompt integrali: [orizzontale](landscape-prompt.txt) e [verticale](portrait-prompt.txt). Il secondo fondale usa il primo come riferimento dell’ambiente. Nessun logo o testo è generato dentro i fondali. Il marchio bianco è una copia invariata dell’SVG approvato dell’utente; DM Sans e Instrument Serif mantengono le rispettive licenze OFL nella stessa cartella pubblica. Queste immagini rappresentano lo studio, non fotografie documentali delle notizie.

## Piloti e revisione

`scripts/tg/refresh-studio-pilots.ts` è un’operazione esplicita limitata alla Mongo locale temporanea (`127.0.0.1:27018`, database `conclavia_e2e_*`) e con pubblicazione disabilitata. Accetta solo ID di piloti non approvati in revisione, senza ricevute esterne. Usa il manifest e `track.wav` esistenti: nessuna chiamata AI/TTS, nuova selezione di notizie o riscrittura del copione.

Il rendering avviene in una cartella di staging. I master precedenti vengono archiviati in `.tg-artifacts/.studio-backups/`; i nuovi asset ricevono checksum aggiornati. Il record torna a `needs_review`, senza approvazione o piano di pubblicazione ereditati. Il worker non può reclamare il job durante il refresh grazie alla lease rinnovata. Un errore ripristina i file precedenti. Il player della redazione usa il checksum nel proprio key per non mantenere in memoria il video vecchio dopo l’aggiornamento.

I piloti preservano il minutaggio originale di 90 s e le voci originali IT/EN. La nuova impostazione di tre minuti resta riferita alle prossime edizioni. Il nuovo look non implica che le notizie o la qualità artistica abbiano ricevuto l’approvazione finale. La prosodia emotiva completa rimane da affinare.

La seconda revisione ha rigenerato i quattro MP4 dei piloti e i due video della prova di 36 s, archiviando i master precedenti. Il confronto con l’ultima versione conferma audio, VTT e contenuto editoriale identici (`acting-export-verification.json`). La GUI ufficiale è stata ricontrollata con selezione degli otto mood, playback e seek dei quattro piloti, layout a 390 px, nessun errore JavaScript e nessuna richiesta di modifica: `acting/official-gui-report.json`. Il runtime usa ora la build isolata `.next-daily-acting` sulla porta 3105; piloti in revisione 4, distribuzione ancora in pausa.

## Verifiche

La selezione browser esercita pipeline TG, redazione, rendering reale H.264/AAC, due orientamenti, due conduttori, otto mood, pixel di silenzio/M/B/P, seek deterministico e titoli completi, oltre alle regressioni avatar/player e clock del parlato. Gli invii esterni sono simulati; la produzione giornaliera e la distribuzione dei piloti restano disabilitate. Le immagini di revisione sono in `docs/images/daily-studio` e negli artefatti Playwright.

### Esito del collaudo locale

Aggiornati i due piloti esistenti e i quattro MP4 nella redazione locale sulla porta 3105. FFprobe conferma 90,000 s, H.264/AAC, 25 fps, pixel quadrati, 1920×1080 e 1080×1920. Confronto con gli archivi: `track.wav`, MP3 e VTT identici byte per byte; cue, fonti, storie e configurazione del manifest identiche. Il file `docs/images/daily-studio/export-verification.json` riporta il controllo.

La GUI ufficiale usa il nuovo renderer ed è stata verificata a 1440 e 390 px: riproduzione e seek dei quattro video, nessun overflow, nessun errore JavaScript o richiesta di modifica. Report `official-gui-report.json`, frame dei player e schermate nella stessa cartella. Worker attivo, distribuzione in pausa, invii reali disabilitati; entrambi i job tornati in revisione. Il runtime locale dello studio è stato aggiornato alla build isolata `.next-daily-studio`; nessun deploy remoto o pubblicazione social.

Superati 65 controlli browser Meeting TG/avatar/player, 76 test del kit, 82 test Onboarding, confini delle feature, collegamento dei consumer, lint e typecheck, build isolate di Meeting e Onboarding. Le catture grafiche e le regressioni Playwright sono state eseguite in fasi distinte. La bocca è stata controllata anche sui pixel; il test del worker ha prodotto veri MP4 di quattro secondi in entrambi i formati senza provider a pagamento. Il ri-render dei piloti ha riusato soltanto audio e copioni esistenti; i soli nuovi asset generati sono i due fondali imagegen.
