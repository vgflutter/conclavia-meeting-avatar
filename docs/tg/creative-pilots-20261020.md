# Tre piloti creativi — 20 ottobre 2026

Pagina di confronto: `/podcast/tg/presentazione/prove`. Sei MP4 reali, due formati per ciascun contenuto; nessuna pubblicazione o campagna avviata.

| Pilota | Durata | Voci | Uso proposto |
|---|---:|---|---|
| Un dato, il suo limite | 36,16 s | Alex, voce già approvata | Primo contenuto: offre una spiegazione concreta prima della presentazione del marchio |
| Il confronto che chiarisce | 32,80 s | Alex + Roberta | Approfondimento a due: domande, verifica della lettura e una conclusione condivisa |
| La traccia della notizia | 23,60 s | Alex | Manifesto da fissare sul profilo: sviluppi, fonti e correzioni visibili |

## Valutazione dell’agente

Giudizio creativo, non risultati del pubblico: **dato 8/10, confronto 7/10, traccia 7,5/10**. Il primo fornisce il motivo più concreto per seguire il progetto. Il dialogo rende utile il secondo avatar, ma ha ancora margine nella regia e nella differenziazione dei personaggi. Il manifesto è breve e riconoscibile; da solo non dimostra la qualità di un notiziario.

Verificati fotogrammi di ogni scena, sequenze estratte dai veri MP4, fonte e data dei due approfondimenti. I tre filmati usano sottotitoli brevi, intenzioni per frase, transizioni, sguardo, mani, busto e reazioni d’ascolto. Nel dialogo il labiale segue soltanto la voce del personaggio attivo; i fumetti conservano l’ultima battuta dell’altro. Il marchio compatto Daily proviene dal PNG canonico approvato, senza ricostruzione del lettering. Il logo generale e le icone del workspace sono quelli forniti.

La qualità percepita della voce richiede ascolto e confronto: le verifiche di trascrizione, sincronizzazione e livello non la dimostrano. Alex riusa l’identità approvata; Roberta è una seconda voce candidata. Non sono stimate retention, conversioni o follower.

## Contenuto e limiti

I primi due piloti spiegano lo [studio ILO–NASK del 20 maggio 2025](https://www.ilo.org/publications/generative-ai-and-jobs-2025-update), distinguendo esposizione potenziale da perdite di posti. Non sono edizioni del giorno. La data è visibile nei filmati e nelle descrizioni. Il terzo presenta un obiettivo editoriale in sviluppo, senza simulare fatti di cronaca.

Questi sono montaggi creativi, non pacchetti TG approvati dal revisore finale. Non vanno inseriti in coda cambiando il loro stato in “approvato”. Una vera edizione quotidiana richiede ricerca attuale, controlli editoriali indipendenti, revisione del pacchetto finale e canali verificati. La generazione vocale dei piloti è stata gestita tramite la GUI ElevenLabs; non prova un’integrazione API vocale autonoma in produzione.

## Riproduzione e controlli

- `src/components/tg/daily-creative-pilots.ts`: copy, fonti, ipotesi, mood e scene di proprietà del prodotto.
- `scripts/tg/prepare-creative-pilot.ts`: import esplicito di una registrazione sintetica pubblica, cache ASR e controllo completo delle parole. È ammesso un solo tentativo correttivo esplicito, in cache separata, se la prima trascrizione non copre il copione. Nessun ciclo automatico a pagamento.
- `compose-launch-audio.py`: musica sintetizzata originale, master della voce con tempo naturale.
- `render-launch-promo.ts`: renderer canonico del kit, FFmpeg, export 1080×1920 / 1920×1080 a 25 fps, copertine, VTT e versione media.
- `check-media.ts --pilot=dato|confronto|traccia`: decodifica completa, durata e dimensioni, presenza audio, livello e saturazione. Non chiama AI o social e non equivale a revisione editoriale.

Report e tavole: `docs/images/daily-launch/pilots/<id>/`. Registrazioni e cache private: `.tg-artifacts/.launch-promo/pilots/<id>/`. Materiali da visionare: `public/daily-launch/pilots/<id>/`. I test non usano provider a pagamento né il database reale.

Accettazione locale: 120 test kit, confini dei moduli e dei consumer, build Meeting/Onboarding, 18 regressioni browser su player, mood, personaggi e video, più verifica tecnica dei sei MP4. La GUI conserva il punto di visione nel cambio di formato e riporta il copione con le intenzioni. Nessun dato di audience è stato raccolto.

## Seconda revisione visiva

Corretti quattro problemi emersi nel ricontrollo: punteggiatura assente nei sottotitoli ASR, fumetto vuoto prima del primo intervento del secondo avatar, scorrimento iniziale del busto separato dalle mani e linea di transizione sovrapposta al volto. Il dialogo ha ora i nomi dei due interlocutori e più spazio tra titolo, fumetti e testa nel formato orizzontale. Le didascalie rispettano anche la fine della frase.

`punctuateSpeechWordAnchors` ripristina maiuscole e punteggiatura solo dopo la corrispondenza completa delle parole normalizzate; conserva i tempi misurati. Nessuna registrazione è stata rigenerata. I manifest precedenti sono conservati nella directory privata della revisione.

`audit-creative-pilots.ts` controlla 4.628 fotogrammi delle sei composizioni usando dal renderer gli ingombri di testa/dita, le righe di testo effettivamente disegnate e l'attribuzione delle battute. Il report include variazione di viso, busto, collo e singoli flessori delle dita. Il controllo geometrico e di sincronizzazione resta distinto da una valutazione percettiva dell’animazione o della voce. I dettagli di viso e mani sono estratti anche dai veri MP4. I test kit diventano 122; le regressioni browser verificano pure punteggiatura del pacchetto, nomi, assenza di fumetti anticipati e ingombri.
