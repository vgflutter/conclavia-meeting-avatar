# Daily italiano: prova con Gianni e Orietta

Prodotta il 18 ottobre 2026 nell'ambiente locale 3105. Puntata di prova da
**90 secondi**, con due conduttori, tre notizie attuali, dieci frasi e relativo
mood. Il master usa lo studio diurno e gli stessi renderer del worker.

- GUI: `http://127.0.0.1:3105/podcast/tg/redazione?job=6ad44479ee27dce522770c87`
- MP4 16:9 / 9:16 e MP3 sono nella scheda e nell'archivio privato del job.
- Stato: `needs_review`, revisione 31; nessuna approvazione o consegna social.
  Invii disabilitati e distribuzione in pausa.
- Il master precedente e il documento Mongo sono archiviati in
  `.tg-artifacts/.trial-backups/`; la versione World non è stata modificata.

## Correzione del backend vocale

Il difetto era concreto: la prova vocale usava Inworld, ma il produttore del TG
italiano selezionava ancora Kokoro Nicola/Sara. Il formato Daily usa ora il
modello completo `inworld-tts-2`, con Gianni/Orietta in italiano e casting
esplicito. Il trasporto e la decodifica restano nel kit canonico; solo casting,
direzione editoriale e cache dei master appartengono al modulo TG dell'app.

La direzione vocale richiede un'esposizione naturale, chiara e non pubblicitaria;
varia con il mood e conserva sobrietà nell'empatia. Le indicazioni non entrano
nel copione pubblico. La disponibilità della voce dipende da Inworld e non da
Kokoro; non c'è ripiego silenzioso sulla vecchia voce. La GUI mostra le voci
effettivamente registrate nel manifest.

I PCM completi sono salvati per hash di testo diretto, lingua, voce, modello e
velocità. Una revisione riusa solo segmenti identici. Il manifest registra la
provenienza e un master privo di questa provenienza non viene riutilizzato come
se avesse già la nuova voce. Voci, configurazioni e default dei Meeting e degli
altri Podcast restano quelli esistenti.

## Durata e limite emerso

Il tentativo da tre minuti ha prodotto 205 parole e, dopo la revisione automatica,
212: circa 95 secondi di audio. Non è un collaudo riuscito del formato ordinario
da tre minuti. Per questa prova si è scelto esplicitamente il formato da 90 s,
eliminando una frase generica e migliorando la chiusura. Il default delle nuove
edizioni resta 180 s; la capacità del redattore di raggiungerlo con materiale
sufficiente richiede ulteriore lavoro e non viene dichiarata pronta da questo
pilota. Il numero di parole da solo non prova durata o qualità editoriale.

Il master finale è di 203 parole (209 token lessicali per il confronto ASR), con
90,973 s grezzi inclusi gli stacchi. L'adattamento temporale è 1,0338, seguito da
due secondi di chiusura. L'accettazione ora limita l'adattamento al ±5%: fuori da
questo margine serve una revisione, senza deformare marcatamente il parlato.

## Controlli del vero audio e dei video

Una prima trascrizione del vero WAV ha segnalato la sigla “Anm” come “NEM”. La
battuta è stata corretta scrivendo “Associazione nazionale magistrati” e
rigenerata, con nuovo audit editoriale. La trascrizione del master finale ha
**zero modifiche lessicali su 209 token** dopo normalizzazione di punteggiatura,
maiuscole e accenti. Le istruzioni di recitazione non risultano pronunciate.
Il report associa la prova all'hash del WAV. Questo controllo non misura la
bellezza del timbro o la naturalezza percepita, che restano da ascoltare.

La verifica creativa del parlato usa `gpt-4o-mini-transcribe` tramite l'API
documentata nelle [OpenAI Docs](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create).
Le indicazioni vocali e il modello completo seguono la
[documentazione Inworld](https://docs.inworld.ai/api-reference/ttsAPI/texttospeech/synthesize-speech).
Le chiamate reali per produrre e verificare questo pilota sono distinte dalle
regressioni, che simulano i provider e non consumano crediti.

Due MP4 verificati: 90,000 s, 25 fps, H.264/AAC, SAR 1:1, 1920×1080 e 1080×1920.
Entrambe le voci hanno circa 2 dB di differenza nel livello RMS dei campioni
attivi. Verificati playback, pausa e seek nella GUI aggiornata
`.next-daily-voices`, oltre al layout mobile e all'assenza di richieste di
modifica durante il controllo. Fonte edizione: ANSA, Rai News ed Euronews Italia,
con collegamenti e verifiche consultabili dalla scheda.

Passati lint, TypeScript, build Meeting e **59 regressioni browser** TG/player.
I test TG hanno **34 casi superati e 9 di outbox persistente non eseguiti** in
questa invocazione; nessun caso fallito. I nuovi casi verificano entrambe le voci
Inworld, modello completo, cache PCM, testo pubblico senza istruzioni e corretta
invalidazione di un master con vecchia voce.

Report in `docs/images/daily-studio/acting/`:
`italian-native-media-report.json`, `italian-native-spoken-report.json` e
`official-gui-report.json`. Il riconoscimento Teams resta un collaudo distinto;
questa prova riguarda esclusivamente la traccia sintetica del TG.
