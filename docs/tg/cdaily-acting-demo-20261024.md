# CDaily — demo voce e recitazione, 24 ottobre 2026

L’utente ha chiesto una prova di circa un minuto con voce, gesture e mood. Questa autorizzazione riguarda **la demo isolata**: il prodotto schedulato resta in `productionMode=editorial`, senza sintesi, rendering o pubblicazione automatica. Nessun job, contatore editoriale, timer o collegamento social è stato modificato.

## Contenuto e identità

Demo del progetto, **non un notiziario di attualità**. Nessuna notizia inventata, ricerca di cronaca o riproposizione di fatti d’archivio. Il testo presenta comprensione, dubbio, rispetto e curiosità come direzione del progetto; non afferma che la filiera autonoma sia già completa. La revisione di questo copione dimostrativo non costituisce un esito A/B della produzione giornaliera.

[Score e copione](../../scripts/tg/editions/2026-10-24-it-pilot-r1.json), identificativo `2026-10-24-it-pilot-r1`. Apertura: «Ciao, questo è Conclavia Daily. Oggi è il ventiquattro ottobre. Questa è una prova: un minuto per conoscerci meglio.» Chiusura e invito sui social/Spotify conservati; sito per gli approfondimenti.

Identità `avatar-refined-presence-20261023`: stesso robot chiaro, mani anatomiche, postura in piedi, studio, font, marchio e impaginazione approvati. Controllo dei 17 fingerprint positivo. Nessuna musica e nessun sottotitolo impresso: VTT attivabile nel player. Due composizioni native, non un ritaglio.

## Take e sincronizzazione

- Una sola nuova sintesi API, voce verificata **Alex 2 - daily**, modello `eleven_v4`; nessun cambio di casting o acquisto di piano/crediti. Durata del take originale **58,24 s**. Risposta e PCM salvati privatamente prima del controllo dei timestamp.
- L’audio è valido, ma i tempi nativi del provider restano incoerenti: nessuna ricevuta di produzione positiva e nessuna reinterpretazione degli end come durate.
- Una sola trascrizione OpenAI del take sintetico/copione pubblico, coperta dal consenso permanente; cache ed evidenza grezza conservate. `whisper-1` fornisce tempi ASR approssimativi, non fonemi misurati.
- Unica correzione ortografica esplicita: `24` → `ventiquattro`, mantenendo i tempi originali. I sette ancoraggi ASR di durata nulla vengono accorpati a un vicino misurato nello stesso segmento, senza inventare intervalli.
- Labiale costruito con `buildWordAnchoredLipSync` del kit: stime dei visemi confinate alle parole e all’energia PCM, bocca a riposo nelle pause. È un miglioramento rispetto alla ripartizione sull’intera frase; non equivale ad allineamento fonetico.
- Pausa effettiva di **2 s** tra introduzione e primo passaggio: aggiunti 1,36 s al vuoto misurato; microfade di 6 ms, nessuna modifica alla velocità della voce.
- Master naturale **62,20 s**: voce, respiro iniziale e recupero finale. Export **1080×1920 / 1920×1080**, H.264, **50 fps**, AAC 48 kHz stereo. Il take sorgente rimane PCM 24 kHz mono; il ricampionamento non aggiunge dettaglio alla voce.

La nuova sintesi è disponibile privatamente in `.daily-agent/acting-demo-20261024/`; preparazione e cache ASR in `.tg-artifacts/.launch-promo/editions/2026-10-24-it-pilot-r1/`. Nessuna chiave o risposta privata va copiata in Git o negli asset pubblici.

## Regia della demo

Quattro mood, otto clausole, quattordici accenti corporei pianificati, con recuperi e quiete. Le intenzioni restano semantiche: nessuna categoria di notizia, titolo o parola «terremoto» seleziona una posa. Per questa dimostrazione sono stati confrontati **26 piani deterministici offline**, mantenendo testo/audio/clock e vincoli di recupero: non 26 richieste vocali o esportazioni. Il seed selezionato è salvato nello score, senza imporlo alle puntate future.

| Tempo del master | Passaggio | Mood / intento | Azione verificata |
| --- | --- | --- | --- |
| 0:00–0:08 | Benvenuto e data | agreement / acknowledge | Cenno e gesto contenuto |
| 0:08–0:10 | Pausa misurata | Recupero | Respiro, niente nuova onda delle mani |
| 0:10–0:25 | Capire oltre il titolo | curiosity / reflect | Tocco laterale al mento, poi gesti aperti e confronto |
| 0:25–0:33 | Dichiarare un dubbio | doubt / reflect | Raccolta e precisione, senza un secondo tocco ripetitivo |
| 0:33–0:41 | Persone e rispetto | empathy / reassure | Palmi uniti nella posa già approvata verso il petto |
| 0:41–0:48 | Collegare i fatti | curiosity / emphasize | Accento più energico e ritorno |
| 0:48–1:02 | Invito e firma | agreement / invite, curiosity / point-down | Indice in basso, recupero e claim |

Mento: preparazione 10,19 s, apice pianificato 11,54 s, recupero entro 13,77 s. Palmi: 33,09 / 34,44 / 36,66 s. Commenti misurati a 54,14–54,58 s; apice pianificato dell’indice a 54,36 s. Il solver e la mano visibile hanno inerzia: questi apici descrivono lo score, non una garanzia al fotogramma sulla punta del dito.

Niente intreccio delle dita in piedi. Spalle, busto, collo e dita vengono dal rig canonico, senza copie del motore nel consumer. Le immagini campione e il contact sheet mostrano entrata, contatto e recupero dei gesti; non dimostrano da soli una naturalezza umana perfetta.

## Verifiche e riuso

Asset locali di revisione: `public/daily-launch/editions/2026-10-24-it-pilot-r1/`. La pagina usa un solo player con scelta portrait/landscape, default mobile verticale. Comprende copione, riassunto e capitoli della demo; nessuna sezione di fonti vuota o etichetta che la presenti come quattro notizie.

Rapporti e immagini: `docs/images/daily-launch/demo-20261024/`. Typecheck Meeting e 14 test mirati voce/pausa/labiale positivi, senza provider a pagamento nei test. I due filmati hanno 3110 frame e durata identica. Nessun errore browser, richiesta mutativa o overflow durante il render. La verifica browser di riproduzione misura audio decodificato non nullo, volume e avanzamento del tempo: non certifica il dispositivo di ascolto dell’utente.

Tool di sintesi isolata: `scripts/tg/record-acting-demo.ts --confirm`, richiede `TG_PUBLISH_ENABLED=false`; cache con hash e marker persistente impediscono una ripetizione a pagamento automatica. La preparazione riusa `prepare-daily-pilot.ts` e il renderer di produzione. La nuova opzione `actingSeed` e il labiale a parole valgono per future preparazioni; non riscrivono i master storici.

Questa demo non abilita la filiera quotidiana. Restano da integrare e collaudare il recupero/allineamento dei take nella produzione autonoma e la distribuzione reale tramite Work. Il controllo nativo dei timestamp rimane giustamente bloccante nel worker finché non esiste una strategia esplicita e verificata.
