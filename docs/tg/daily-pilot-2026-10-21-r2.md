# CDaily: prima revisione da quattro minuti

Il pilota r2 corregge la prova lenta di 96,40 secondi. Il video finale dura
**240,00 secondi** in entrambi i formati; la prima prova resta conservata.
Identità, personaggio, studio, font e palette approvati sono invariati.

Pagina locale: <http://127.0.0.1:3107/daily-launch/editions/2026-10-21-it-pilot-r2/index.html>.
Versione media: `8d7728fefa9e`. Un player sceglie portrait sul telefono e
landscape sul desktop; i capitoli cercano nello stesso video.

| Passaggio | Inizio | Fine |
| --- | --- | --- |
| Apertura rapida | 0:00 | 0:13 |
| Trasporti: fondi e proteste | 0:13 | 1:05 |
| Ucraina: colloqui a Oslo | 1:05 | 2:11 |
| Scienza: acqua e satelliti | 2:11 | 3:13 |
| Liguria: riepilogo del bollettino | 3:13 | 3:49 |
| Sito e invito finale | 3:49 | 4:00 |

Sono tempi misurati, arrotondati al secondo. Il contenuto resta un riepilogo
datato degli aggiornamenti del 20 ottobre sera; non è un bollettino meteo live.
Il copione e i titoli sono in `scripts/tg/editions/2026-10-21-it-pilot-r2.json`.

## Ritmo, voce e montaggio

Una richiesta ElevenLabs, con due alternative offerte dal prodotto: scelta la
prima, circa 259,24 secondi. Stessa voce Alex 2; interfaccia su v4 Turbo,
stabilità 35%, somiglianza 75%, direzione di lettura più vivace. Il nome del
download riporta s50/v4: è conservato come evidenza separata e non prova che il
provider abbia applicato i valori mostrati nell'interfaccia.

Il montaggio elimina circa 18,70 secondi di silenzio a basso livello, conservando
almeno 180 ms nei vuoti editati. Una correzione del tempo dell'1,313%, ad altezza
invariata, porta il take a 237,42 secondi; il master aggiunge attacco e coda.
La densità finale è circa 168 parole/minuto. Originale, WAV lavorato e lista
dei tagli restano nella cache privata. Nessuna nuova voce, ricarica o
attivazione di abbonamento.

La sigla originale locale dura soltanto i primi **quattro secondi**: poi voce
sola, senza musica sulle storie o in chiusura. Dopo 4,1 secondi il mix correla
con la sola voce per circa 0,999991. Non contiene campioni del video YouTube
citato come riferimento. La nuova politica audio è salvata nel mixer
`compose-daily-intro.py` e nella guida video.

Il parlato non rimanda più a elementi «accanto al video». La destinazione per
fonti e approfondimenti è il sito. L'indirizzo viene scritto in forma URL nel
copione visibile, corrispondente alla destinazione riconosciuta nell'audio.

## Fatti, allineamento e recitazione

Le fonti sono state riaperte. La prima revisione AI ha prodotto rilievi anche
su informazioni già attribuite e distinte correttamente nel testo: il risultato
negativo resta in cache. Un secondo modello ha confrontato il copione con i
passaggi ricontrollati delle fonti e non ha trovato contraddizioni bloccanti.
Questo è un controllo editoriale della prova, non un'attestazione di filiera
autonoma o di pubblicazione.

Il WAV finale è allineato con richieste ASR entro i limiti del componente
condiviso: tre parti e ricontrolli mirati dei passaggi omessi o trascritti male.
Gli ASR originali sono conservati. Numeri e nomi hanno una revisione ortografica
esplicita legata all'hash del take, senza modificare i tempi misurati. Due
ancore sovrapposte sono unite per intervallo; un cue raccoglie due frasi con lo
stesso mood, evitando di inventare un confine individuale.

Il risultato contiene 51 cue con mood/intenzione, labiale derivato dal PCM e
regia del kit canonico. I titoli seguono i cue e non rimangono bloccati sulla
terza scheda per il resto della notizia. I mood restano coerenti con i fatti:
attenzione sulle notizie sensibili, curiosità nella spiegazione scientifica,
invito nella chiusura.

## Verifiche e stato

- 1080×1920 e 1920×1080, H.264 a 25 fps, AAC stereo 48 kHz, durata 240,00 s.
- Decodifica completa; correlazione audio con il master circa 0,999936.
- Nessun clipping nel master; controllo di tutti i 12.000 frame senza problemi
  di margini del testo, testo sul volto, mani tagliate o pose non finite.
- Player reale a 360, 390 e 1440 px, capitoli, sette fonti e nessun MP4 prima del play.
- Test TG: 49 passati, 12 saltati; test vocali/editoriali mirati 23 passati;
  typecheck, lint dei file coinvolti, build Meeting e lock visivo passati.
- Durata 240 s salvata anche nello Studio locale per Italia e World; entrambe
  le edizioni restano disabilitate e senza modalità automatica.

Prove: `docs/images/daily-launch/editions/2026-10-21-it-pilot-r2/`.
La voce è stata generata con il piano Free: uso commerciale da risolvere prima
della distribuzione. Nessuna pubblicazione, sponsorizzazione o sostituzione
della presentazione pubblica è stata avviata. La naturalezza e il tono restano
da valutare all'ascolto; i controlli tecnici non certificano il gusto editoriale.
