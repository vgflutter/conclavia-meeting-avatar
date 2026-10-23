# CDaily — format approvato da cinque minuti

> Aggiornamento 23 ottobre: il numero e i budget qui sotto sono storici. La richiesta di maggiore copertura porta alla [scaletta con cinque notizie, pausa pulita e ritmo aggiornato](cdaily-five-news-format-20261023.md). Lo standard corrente è `cdaily-production-standard.md`.
**Decisione dell'utente, 21 ottobre 2026:** «ok allora articolalo in 5 minuti».
Vale per Italia e World: selezioni proprie, una voce al lancio, due master
con composizioni 16:9 e 9:16. Il totale standard è **300 secondi**.

## Scaletta

| Tempo | Durata | Funzione |
| --- | ---: | --- |
| 0:00–0:20 | 20 s | Saluto breve, una frase di orientamento e due o tre anticipazioni reali. Una ragione per restare, senza elenco rituale. |
| 0:20–1:50 | 90 s | Notizia principale: sviluppo nuovo, protagonisti e ruoli, contesto per chi non segue il tema, conseguenza documentata e prossimo passaggio verificabile. |
| 1:50–2:50 | 60 s | Seconda notizia: attacco naturale sul tema, fatto e spiegazione utile. |
| 2:50–3:50 | 60 s | Terza notizia: dati, confronto o breve cronologia secondo il materiale. |
| 3:50–4:50 | 60 s | Quarta notizia sostanziale, con lo stesso rigore; nessun riempitivo leggero o normale bollettino meteo locale. |
| 4:50–5:00 | 10 s | Invito ai commenti e agli approfondimenti, indice in basso su «commenti», claim e recupero finale. |

Le finestre sono un budget di scrittura e regia. L'importanza delle prove può
ridistribuire i tempi delle tre notizie secondarie, conservando il totale.
La verifica finale misura il vero audio e il vero video: non certifica ogni
blocco a un secondo esatto sulla base del solo numero di parole.

## Scrittura e voce

Circa 810–850 parole come punto di partenza italiano, da calibrare sul take.
Voce amica, agile, collegata; il minuto in più finanzia spiegazioni e contesto.
Non aggiunge un quinto titolo, una seconda voce obbligatoria, cautele ripetute,
musica lunga o pause artificiose. La sigla facoltativa rimane nei primi quattro
secondi già inclusi nel totale; poi voce sola, compresa la chiusura.

Ogni notizia risponde a: che cosa è successo, chi riguarda, perché conta e
che cosa sappiamo del passaggio successivo. Spiegare i termini necessari e
togliere nomi e numeri che non aiutano a capire. Il pubblico non deve avere
conoscenze politiche, geopolitiche o scientifiche pregresse.

Il corpo non parte con «ieri sera» e non numera le «storie». Le date reali
degli eventi restano accurate; i controlli di freschezza, novità e confronto
con il già pubblicato restano obbligatori. Un'analisi libera AI finale rimane
una proposta separata, non un nuovo segmento introdotto con questa decisione.

## Chiusura e recitazione

> Scrivici nei commenti cosa vuoi approfondire: partiamo dalle tue domande.
> Meno rumore, più contesto.

Un take continuo, con curiosità e indice verso il basso sulla parola misurata
«commenti», poi invito verso il pubblico e accordo nel claim. Viso, mani e
busto seguono il clock del parlato, con preparazione e recupero. Conservare
studio, Alex, marchi, font e palette della [guida video](cdaily-video-guide.md).
Il riassunto social resta obbligatorio: un punto per ciascuna delle quattro
notizie, verificato insieme al copione, nella lingua dell'edizione.

## Applicazione

- `src/lib/tg/format.ts` definisce il clock e la ripartizione; default IT/World
  a 300 s. La GUI mostra cinque minuti e la scaletta sintetica.
- Ricerca e scrittura mantengono quattro notizie a 300 s. Lo stesso vincolo
  vale prima della voce, dopo una riscrittura e prima dell'approvazione; resta
  valido anche sui job storici da 240 s. Prima di questa modifica il ramo
  300 s ricadeva su tre notizie e non aveva il controllo di copertura del Daily.
- La durata misurata e l'unico tentativo di riscrittura richiedono nuovi
  controlli. I job già creati conservano il proprio snapshot, senza migrazione
  silenziosa di copioni, audit o media approvati.
- I tool di importazione/render dei piloti accettano ora il clock da 300 s.
  I vecchi filmati restano conservati; non vengono rallentati per simulare
  un minuto di contenuto in più.
- La presentazione pubblica del format è allineata a cinque minuti in IT/EN,
  compresi i precedenti ingressi pubblici al progetto.

## Stato del nuovo video

Il pilota più recente `2026-10-21-it-pilot-r6` rimane **240 s**, con la chiusura
integrata e il corpo datato ancora da rivedere editorialmente. Questa decisione
non lo trasforma in una nuova puntata da cinque minuti. Per il nuovo master
servono un copione sviluppato, un take Alex corrispondente e nuovi tempi misurati.

Durante il controllo della scheda ElevenLabs dell'utente sono visibili **69
crediti residui**; la registrazione completa non è producibile con quella quota.
Nessun nuovo acquisto, abbonamento, TTS, ASR o post social viene eseguito da
questa modifica. La voce automatica API del worker è ancora il percorso
Inworld documentato: non viene presentata come integrazione API di Alex 2.

## Verifiche

Suite TG: 75 test superati, zero fallimenti, 15 integrazioni Mongo non eseguite.
Copertura del formato, blocco prima dei provider quando manca una notizia,
riscrittura e riapprovazione sono testati con fixture sintetiche. TypeScript
e build di produzione Meeting isolata superati. La lettura dell'API locale
conferma entrambe le edizioni a 300 s, revisione 0, disabilitate e non automatiche;
non sono stati riscritti record o inserite puntate nel database.

Le verifiche del sito e della GUI sono registrate con la relativa release.
Questa decisione non attiva lo scheduling o la pubblicazione autonoma.

GUI verificata sul server locale esistente `http://127.0.0.1:3107/podcast/tg`:
entrambe le schede riportano 5:00, il selettore mostra cinque minuti e il
riepilogo espone 20 / 90 / tre blocchi da 60 / 10 s. Cambio Italia→World→Italia
senza salvataggi o accodamenti. ESLint sui moduli aggiornati e helper offline,
sintassi Python e controllo whitespace superati.

Sito pubblico: release `web-20261021174303466-9bc68e`, senza reload o riavvio
del gateway e con applicazioni invariate. Controlli locali su dieci pagine
Daily IT/EN a otto larghezze e sulle due pagine TG precedenti; controllo HTTPS
della nuova durata su otto ingressi pubblici. Il manifesto statico verifica
tutti i 79 file. Il sito descrive il format da raggiungere e conserva il
trailer esistente; non annuncia un master da cinque minuti già prodotto.
