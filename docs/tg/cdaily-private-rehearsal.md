# Prova privata del Daily, senza influenzare le prossime edizioni

La prova usa notizie e verifiche reali, ma rimane su file privati. Non registra job nel database, non modifica il calendario e non rilascia nulla nel catalogo pubblico. L’archivio di deduplicazione legge soltanto uscite confermate nel database: un copione o un master della prova non diventano notizie già raccontate domani.

Avvio della fase scritta:

```sh
npm run daily:editorial -- --rehearsal=prova-serale
```

Percorso: `.tg-artifacts/rehearsals/AAAA-MM-GG/prova-serale/`. La sessione, il dossier `review.md`, le ricerche e le revisioni rimangono separati dal laboratorio ordinario del giorno. Gli export sono sotto `artifacts/`; nessun asset viene scritto in `public/`. Ripetere lo stesso comando riprende la stessa prova e conserva errori e contatori; usare un altro nome soltanto per una prova realmente distinta, mai per cancellare un fallimento.

La finestra straordinaria è congelata soltanto nella copia privata del prodotto, con preparazione all’avvio e due ore totali. `enabled` è falso; la pianificazione reale delle 07:30 non viene toccata. La ricevuta `isolation.json` registra esclusione dalla distribuzione e hash della configurazione di produzione letta. L’archivio del pubblicato è acquisito in sola lettura e conservato come prova, non aggiornato.

Le sorgenti supplementari della prova per il CSM (cronache firmate e avvisi della giustizia) vengono abilitate soltanto nel processo della prova; non modificano il catalogo sorgenti del produttore di domani. Nessuna configurazione di provider, `.env.local` o notizia del 26 ottobre viene preparata/sostituita da questo comando.

Prima del video occorrono gli stessi controlli A/B e la conferma esplicita del testo e dello score esatti. La fase scritta non dispone di porte per sintesi, rendering o pubblicazione. Se i controlli sono scaduti, vengono rinnovati: non basta ritrovare uno stato `editorial_ready` salvato.

Il comando separato per i media può anzitutto verificare lo stato senza rete o generazione:

```sh
npm run daily:rehearsal-media -- --rehearsal=prova-serale --dry-run
```

Solo dopo l’OK dell’utente alla versione consegnata si esegue lo stesso comando con `--confirm-text`, `--reviewer=NOME`, `--script-sha256=HASH_TESTO` e `--review-input-sha256=HASH_INPUT_B`, senza `--dry-run`. Non ricavare un OK dalla richiesta generica di fare una prova. Il comando non scrive nel database né importa uploader o scheduler; produce media sotto gli artefatti privati, esegue la revisione finale AI e salva `media-result.json`, sempre con `publicationEligible:false` e `videoUploaded:false`. Una riscrittura impone di nuovo A/B e conferma. Nessun esito della prova viene trasferito nel catalogo o nell’archivio del pubblicato.

Per la prova del 25 ottobre il materiale della mattina era ormai fuori dalla validità del controllo di attualità. La prova serale avvia nuova raccolta e verifica senza azzerare, sovrascrivere o pubblicare i precedenti tentativi. Il Daily del 26 ottobre dovrà effettuare la propria ricerca; un argomento potrà essere selezionato se rilevante e fresco, senza essere escluso perché comparso nella prova privata.
