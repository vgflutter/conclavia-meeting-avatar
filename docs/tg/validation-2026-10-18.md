# Verifica Conclavia TG — 18 ottobre 2026

## Esito

**Studio locale utilizzabile, lancio di produzione non accettato.** La GUI è in `http://127.0.0.1:3105/podcast/tg`. La preparazione giornaliera e la distribuzione esterna sono disabilitate. Gli account delle due edizioni non sono ancora collegati; nessun video è stato pubblicato.

## Verifiche automatiche

- 39 casi TG, inclusi nove casi di outbox persistente su Mongo temporanea e controlli di revisione, binding, pausa e connettore Metricool: fonti attuali e indipendenti, ID e URL consultati, mood, correzione editoriale limitata, misura e revisione della durata, invalidazione dell'audit, schede di testo pubblico, verifica web per ogni storia, timeline/caption e publisher con rete simulata.
- 60 regressioni del podcast: passate.
- 13 casi browser TG, inclusa la GUI dedicata di redazione, approvazioni concorrenti, ritiro, annullamento, riconciliazione e ripresa sessioni: identità grafica e due edizioni, verticale, viewport 320/1440, nessuna generazione all'apertura, coda concorrente idempotente, conflitti configurazione, protezione bozze, lease, retry tecnico/editoriale e hash del copione.
- Encoding vero FFmpeg H.264/AAC dei due orientamenti: verificato su un **filmato tecnico di quattro secondi**, con MP3, VTT, manifest e checksum. Non è una puntata giornalistica completa.
- Build Meeting e Onboarding passate, controllo della proprietà del kit passato. Regressioni condivise avatar/player: 58 casi kit e 82 Onboarding passati nella sessione.
- Gateway: 62 casi Node, 40 casi Python e integrazione con Caddy passati. Configurazione preparata, non distribuita sul server remoto.
- Audit dipendenze **di produzione Meeting**: zero vulnerabilità note al controllo. Non equivale a un audit di tutti gli ambienti o delle dipendenze di sviluppo.

## Piloti con notizie e voci reali

Le due prove sono state eseguite nel database temporaneo `conclavia_e2e_podcast_preview` su `127.0.0.1:27018`, separato dai dati reali. Le fonti originali, i copioni, le verifiche e i motivi delle riprese manuali sono conservati localmente. Le chiamate reali sono separate dalle regressioni senza crediti.

Entrambi i piloti sono arrivati a **`needs_review` con pacchetto completo**: `landscape.mp4`, `portrait.mp4`, `audio.mp3`, `captions.vtt`, `manifest.json`. Le due tracce video sono H.264/AAC, 1920×1080 e 1080×1920; FFprobe misura **90,000 s**. I testi a video e quelli pronunciati sono legati all'audit tramite hash del copione. La revisione umana finale di contenuti e ascolto è ancora necessaria.

Il controllo visivo su fotogrammi dei filmati reali ha rilevato due frasi troncate nelle schede italiane: sono state ridotte alle sole frasi complete, sottoposte a un nuovo audit e il video è stato rigenerato. I sottotitoli sono stati ingranditi e distanziati dalla barra di avanzamento. Il controllo di volume ha trovato l'italiano più basso dell'inglese: entrambi i master vengono uniformati con target -16 LUFS e picco -1,5 dBTP, senza cambiare testo o timing.

Le prime ipotesi di 180/240 s e il successivo test da 120 s hanno evidenziato il rischio di aggiungere spiegazioni non documentate per allungare i testi. I piloti tecnici di questa fase restano **90 s per lingua**. La revisione strategica successiva porta l’impostazione delle nuove edizioni a **180 s per lingua**, con 3–4 notizie; non rappresenta un risultato di audience già misurato. La durata resta configurabile e il workflow mantiene i controlli di evidenza e misura: non basta ridurre il tempo per approvare un copione negativo.

Le prove hanno inoltre portato a ricerche indipendenti per ogni notizia effettivamente in onda, citazioni vincolate alle fonti recuperate, audit in blocchi esaustivi, schede indicizzate per notizia e rimozione dei titoli di ricerca non utilizzati dal video. I primi tentativi bloccati rimangono nella cronologia. Nessun blocco fattuale è stato convertito direttamente in approvazione.

## Cosa manca al lancio

1. Rivedere i due piloti completi: contenuti, ritmo, ascolto della voce, labiale, sottotitoli e grafica su telefono e desktop. Il controllo tecnico e visivo svolto non sostituisce questa accettazione editoriale.
2. Migliorare selezione e riscrittura per evitare inferenze non documentate e rendere Italia realmente distinta dalla selezione esteri. La sola assenza di orientamento politico non è una misura sufficiente di qualità editoriale.
3. Collegare i canali di proprietà delle due edizioni e verificare caricamento e pubblicazione effettivi. I test mock non sono una pubblicazione reale.
4. Collegare e collaudare il connettore Metricool implementato per TikTok; l’utility Direct Post interna resta disabilitata. Integrare l'host/gateway video Spotify effettivamente scelto.
5. Collaudare worker persistente, rete voce, volume condiviso, immagine container, riavvio e monitoraggio nell'infrastruttura destinata alla produzione.
6. Ogni edizione richiede revisione umana; gli invii successivi all’approvazione sono autonomi. Misurare pubblico e costi per 14 giorni prima di considerare ottimali formato e orario.

Dettagli di avvio e limiti: [operations.md](operations.md). Metodo e motivazioni editoriali: [editorial-study-2026-10-18.md](editorial-study-2026-10-18.md).

## Controllo finale nella GUI e sui master

Entrambe le edizioni si caricano nella GUI con stato “Da rivedere e approvare” e durata del player di 90 s, senza errori JavaScript. L'ultima edizione viene selezionata automaticamente passando da Italia a World. I quattro MP4 finali misurano 90,000 s. Dopo la rifinitura, gli MP3 misurano circa -16,76 LUFS (Italia) e -16,69 LUFS (World), con picchi reali rispettivamente -1,94 e -1,92 dBTP. Sono misure tecniche; resta l'ascolto e l'accettazione editoriale dell'utente.


## Redazione e distribuzione autonoma dopo revisione

La GUI `/podcast/tg/redazione` è compilata e disponibile nel runtime locale. Il worker aggiornato mantiene il battito e non può scavalcare la revisione neppure con una configurazione legacy automatica. La prova sul runtime con i due piloti esistenti ha verificato video da 90 s, caricamento senza errori JavaScript e assenza di overflow a 1440 e 390 px. Le configurazioni inattive della sola anteprima sono state portate a 180 s; i due piloti, le fonti e i media non sono stati rigenerati né approvati.

La distribuzione resta in pausa e `TG_PUBLISH_ENABLED=false`; preparazione giornaliera disabilitata. Nessun post è stato creato, programmato o pubblicato sugli account reali. Il controllo dei brand collegati ha trovato soltanto un progetto diverso da Conclavia TG, che non viene usato. Restano necessari account TG, autorizzazioni, accesso API Metricool, adattatore dell’host video Spotify effettivo e collaudo reale revisionato di ciascun canale.

Il collaudo della nuova outbox copre worker concorrenti, pubblicazione parziale, pausa anche durante il dispatch, timeout ambiguo, invalidazione dei media, controllo delle ricevute dopo scadenza, attesa crescente e arresto dei retry, crash durante la finalizzazione Instagram. Le prove di YouTube e Metricool usano rete simulata, anche per ripresa sessioni e trasferimenti media; non costituiscono accettazione sui servizi reali.

## Studio e robot nella pipeline operativa

Il vecchio avatar umano semplificato dei piloti è stato sostituito con il robot 2D e lo studio illustrato Daily, anche nel renderer automatico e nei quattro MP4 dei piloti locali. L’ambiente ha fondali dedicati per 16:9 e 9:16, tavolo, microfono, titoli e sottotitoli; palette e asset restano propri del prodotto, motore e rig nel kit. I piloti precedenti sono archiviati. Audio, sottotitoli, copione e fonti sono preservati e i nuovi master restano da revisionare.

Verificati playback e seek dei quattro video nella GUI locale aggiornata sulla porta 3105, desktop/mobile, senza errori o invii esterni. Superati 65 controlli browser TG/avatar/player, 76 test kit, 82 test Onboarding e le due build consumer. [Architettura, fondali, prompt e collaudo](daily-studio.md). Questo aggiornamento risolve la separazione tra demo grafica e video del backend; non approva automaticamente il character design o l’edizione e non attiva i social.

## Seconda revisione della recitazione

Testa più piccola, postura e sguardo indipendenti, polsi e quattro dita meccaniche articolate per mano, otto gesti semantici e raccordi fra mood. I controlli del kit ora sono 80: inclusi lunghezze delle braccia su tutte le coreografie, recupero del gesto, accenti nelle frasi lunghe, ascolto e transizioni. Passati nuovamente 65 controlli browser TG/avatar/player, 82 test Onboarding, lint, TypeScript, confini delle feature, collegamento dei consumer e build isolate di entrambe le app.

Ri-render eseguito sui due piloti, quattro video da 90 s a 25 fps, H.264/AAC e pixel quadrati. `track.wav`, MP3, VTT, cue, storie, fonti e prodotto coincidono con il master precedente: `docs/images/daily-studio/acting-export-verification.json`. I piloti restano in `needs_review`, revisione 4, distribuzione in pausa e invii reali disabilitati. Nuovo runtime locale: `.next-daily-acting` sulla porta 3105. Nessun deploy remoto, generazione AI/TTS o pubblicazione social durante questa revisione.

## Terza revisione: coreografia e ascolto

La durata misurata delle cue determina ora preparazione, gesto e recupero con riposo fra gli accenti. Corretti sguardo del secondo conduttore e mantenimento della posa durante la pausa audio. Aggiunti battiti indipendenti, pressione e asimmetria delle labbra, inclinazione delle palpebre e lieve prospettiva della testa; palmi ridisegnati e microfoni ai lati per liberare le mani.

Superati 82 test del kit, tutti i 40 casi TG inclusi i nove casi di outbox persistente con rete simulata, 65 regressioni browser TG/avatar/player e 82 test Onboarding, oltre a lint, TypeScript, confini delle feature, collegamento dei consumer e build isolate di entrambe le app. La cattura degli otto mood e le regressioni browser sono state eseguite in fasi separate. Il runtime locale è `.next-daily-natural` sulla porta 3105. Il confronto artistico resta distinto dai controlli tecnici; la prosodia della traccia originale non è stata cambiata.

Completati quattro MP4 dei piloti e due MP4 della prova di 36 s. Piloti in revisione 6, `needs_review`, distribuzione in pausa. Verificati formati, durata, audio e contenuti invariati, playback e seek nella GUI, otto mood e layout mobile. Analizzata anche la regione busto/braccia dei veri video, escludendo viso e bocca, per verificare che il movimento non sia limitato al labiale. Report e frame aggiornati in `docs/images/daily-studio/acting`.

## Volto adulto e nuove prove vocali

La prova `/podcast/tg/performance` è ora nello stesso studio TG delle puntate, con volto più adulto e tre audio reali Inworld (Gianni, Orietta, Ingegnere) sulle stesse sei frasi. La generazione creativa esplicita è separata dai test; aprire e usare la GUI legge soltanto file già prodotti. Gianni è il riferimento iniziale della prova, non la voce definitiva dei piloti.

Passati 82 test kit, 82 test Onboarding, le due build consumer, lint, TypeScript, verifica delle feature e dei collegamenti. Passate 66 regressioni browser complete e poi 15 controlli mirati dopo la correzione del titolo al seek. La GUI ufficiale ha riprodotto i tre audio, gestito cambio voce, pausa e due orientamenti senza errori o richieste di modifica; nessun overflow a 390 px.

Anche i quattro video dei piloti usano il volto aggiornato. Audio, VTT, cue, prodotto, storie e fonti coincidono con il master precedente. I due piloti restano `needs_review`, revisione 8, con distribuzione in pausa e invii reali disabilitati. Runtime `.next-daily-adult`, porta 3105. [Dettagli e limiti del confronto vocale](adult-presenter-and-voices.md).

## Studio diurno e muscoli del volto leggibili

Il volto scuro è sostituito con una superficie avorio e tratti scuri; palpebre,
guance, sopracciglia e angoli labiali hanno canali distinti e accenti della frase.
La mandibola articola sullo stesso contorno. Nuovi fondali diurni v2 e palette
petrolio/salvia sostituiscono l'ambiente prugna/ambra. Nel verticale il conduttore
è più vicino; titolo e sottotitoli restano separati, senza etichetta “In primo
piano” né ulteriore blocco minuto di contesto. [Design, asset e limiti](daylight-facial-acting.md).

Passati 83 test kit, 82 test Onboarding, 68 regressioni browser TG/avatar/player,
lint, TypeScript, controllo delle feature e collegamento dei consumer. Riuscite
le build isolate `.next-daily-light` e `.next-build-daily-light` delle due app.
I controlli dei pixel richiedono una fronte effettivamente chiara e otto
espressioni diverse nella regione occhi/sopracciglia/guance, escludendo bocca,
contorno e rotazione della testa. Il test mobile verifica dimensioni di viso e
titolo alla scala di un telefono, oltre all'assenza di overflow.

La GUI ufficiale 3105 usa `.next-daily-light`. Le tre voci statiche si avviano,
si fermano e si possono confrontare senza richieste di generazione. Nei due
formati la luminanza misurata della fronte è 240/255; il canvas nella GUI mobile
è largo 358 px e il volto circa 128 px. Verificati otto mood e playback/seek dei
quattro MP4 dei piloti. Nessun errore JavaScript o richiesta di modifica in
queste prove GET-only. Report in `docs/images/daily-studio/acting/`:
`daylight-gui-report.json` e `official-gui-report.json`.

I due filmati della prova sono 36 s, 900 fotogrammi, 25 fps, H.264/AAC e SAR 1:1,
con Gianni. La correlazione dell'audio decodificato rispetto al campione Gianni è
0,99982 in entrambi: `daylight-movie-verification.json`. La cattura usa adesso il
canvas sincrono del renderer, evitando attese instabili dei controlli DOM.

I quattro video delle edizioni sono 90 s a 25 fps, 1920×1080 / 1080×1920. Audio,
MP3, VTT, copione, cue, storie e fonti coincidono con i master archiviati:
`acting-export-verification.json`. Entrambi i piloti sono `needs_review`,
revisione 10, senza consegne social. Distribuzione in pausa e invii disabilitati.
Nessun deploy remoto o nuova sintesi vocale. I soli nuovi asset raster sono i
due fondali creati con imagegen integrato; [prompt e provenienza](daylight-studio-prompts.txt).

## Daily italiano con voci native

Il produttore italiano usava ancora Kokoro nonostante la prova vocale Inworld.
Corretto il collegamento: Daily usa casting Inworld esplicito e modello completo
TTS-2, cache dei PCM e provenienza nel manifest. Readiness, worker e GUI sono
allineati. I vecchi master privi di provenienza vengono risintetizzati quando
si richiede una nuova produzione.

Nuova puntata italiana di **90 s, due conduttori Gianni/Orietta e tre notizie
attuali**, con copione e audit indipendente nuovi, nello studio chiaro. Dopo il
controllo del vero audio, la sigla Anm è stata espansa e la sola battuta corretta
è stata rigenerata. La trascrizione finale coincide con i 209 token normalizzati
del copione, senza istruzioni di recitazione lette. Non è una misura della
gradevolezza del timbro. Due video 90,000 s H.264/AAC verificati e riprodotti nella
GUI, nessun errore browser e nessun overflow mobile. L'edizione World è invariata.

34 test TG superati, 9 outbox saltati nell'invocazione, 59 regressioni browser,
lint, TypeScript e build Meeting riusciti. Prova locale `needs_review`, revisione
31, nessuna approvazione/consegna. Runtime `.next-daily-voices`, porta 3105;
worker aggiornato, pubblicazione disabilitata. Il primo tentativo da tre minuti
non ha raggiunto il minutaggio: questa prova breve non lo convalida. Default
ordinario 180 s preservato. [Procedura, controlli e limite aperto](italian-native-trial.md).

## Cinque direzioni adulte e scelta Inchiostro

Cinque subagent distinti hanno realizzato cinque coppie animate: Ritratto
editoriale, Ceramica viva, Inchiostro, Sintesi e Stampa. Dopo più confronti
visivi è stata scelta **03 · Inchiostro** per Daily. La comparativa rimane
nella GUI `/podcast/tg/proposte`, con otto mood, una/due identità, tre voci
preregistrate e formati orizzontale/verticale. Teste, corpo e mani sono nel
kit canonico; palette, studio e scelta del prodotto restano nell'app.

Rivisti anatomia, collo, spalle, mani a cinque dita e appoggio sul banco,
occhi con pupille rotonde, labbra e un'unica mandibola. Nel verticale a due
voci la camera inquadra chi parla; i microfoni conservano capsula e base
complete entro il fotogramma. Gli otto mood sono distinguibili anche nei
pixel della parte superiore del volto, senza dipendere dalla bocca.

86 test del kit, 82 test Onboarding, 70 regressioni browser Meeting e sei
regressioni mirate ripetute dopo i ritocchi finali; lint, TypeScript,
confini delle feature, controlli dei due consumer e relative build isolati
superati. Un test aggiuntivo verifica che il refresh grafico preservi i
PCM/checkpoint vocali senza riutilizzare vecchi video.

Riesportate la prova da 36 s e le due edizioni da 90 s, ciascuna in entrambi
i formati: H.264/AAC, 25 fps, SAR 1:1. I quattro master del notiziario sono
1920×1080/1080×1920. Copione, fonti, cue, provenienza vocale, WAV, MP3 e VTT
corrispondono agli archivi precedenti; l'hash del WAV italiano coincide
anche con quello dell'ultima verifica ASR. Nessuna nuova chiamata TTS o AI.
Cache dei PCM e checkpoint intermedi conservati e recuperati dagli archivi
con lo stesso hash audio, per evitare spese vocali nei successivi tentativi.

Accettazione GET-only sulla GUI ufficiale locale: tre voci con play/pausa,
otto mood, quattro video reali con play/seek, layout 390 px, nessun errore
browser o mutazione. Acquisite cinque coppie e sedici esempi dei mood della
coppia scelta. Valutazione visiva in `adult-presenter-review.md`; il labiale
mantiene l'allineamento approssimato da testo/PCM. La verifica automatica
non equivale a una garanzia di recitazione umana o gradimento del pubblico.

Runtime finale `.next-daily-mature-gui`, porta 3105. IT revisione37, World16,
entrambe `needs_review`; nessuna approvazione/consegna. Distribuzione in
pausa e invii disabilitati. Il test italiano resta da90 s; questa iterazione
non convalida il default ordinario da180 s né modifica i copioni.
