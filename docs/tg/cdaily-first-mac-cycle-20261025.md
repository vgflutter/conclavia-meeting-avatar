# CDaily — primo ciclo reale sul Mac, 25 ottobre 2026

## Esito

**Collaudo eseguito, produzione non completata.** Il job `6adda56e3a80c1de325ac33e` è `blocked`: nessuna voce sintetizzata, nessun video prodotto e nessun caricamento sul sito. I controlli AI A/B sul copione e il revisore video non sono stati raggiunti. Il sito continua a rispondere `kind: waiting` per l’ultima edizione Italia.

Il writer ha restituito **404 parole**, anche dopo l’unica correzione editoriale, con 74 parole dedicate all’apertura della prima notizia. Il controllo di profondità richiede almeno 480 parole complessive e 90 per la prima notizia, senza considerare queste soglie una prova di qualità o un clock garantito. Non sono state abbassate per far passare il collaudo. Il take reale, quando disponibile, resta l’unica misura della durata.

## Avvio e tracciabilità

L’utente ha chiesto «vogliamo farlo oggi come giro di prima?» dopo l’installazione delle 07:30. L’edizione mattutina precedente era in modalità editoriale e si era fermata nella selezione, senza copione o media. Il nuovo ingresso esplicito `daily:mac commission` conserva quel record in uno snapshot privato e nel campo DB `commissioning` escluso dalle risposte pubbliche. Applica alla sola edizione del 25 ottobre la finestra 09:14–10:29 Europe/Rome, con obiettivo 09:59. Il piano ordinario rimane **07:30 → 08:15**, senza modificare le altre giornate.

I contatori sono rimasti persistenti: **tre tentativi di worker e una correzione editoriale**. Nessun giudizio negativo è stato trasformato in approvazione e non è stato azzerato alcun limite per proseguire. La voce Alex 2, gli asset, il font, lo studio, le mani, i mood e le due composizioni approvate non sono stati modificati.

## Problemi emersi e correzioni tecniche

1. **Accoppiamento delle fonti.** Il primo risultato del Mac indicava due articoli del Sole 24 Ore come origini indipendenti. Il validatore lo ha respinto. Un’unica correzione AI limitata agli ID già citati ha di nuovo scelto due articoli dello stesso editore ed è stata respinta; non è diventata ricerca approvata.
2. **Dimensione del contratto.** Due richieste con reasoning medio sono terminate per `max_output_tokens`, senza risultato utilizzabile. Gli esiti non sono stati accettati come risposte complete. L’esperimento è stato ritirato: nessun cambiamento globale al provider o al modello delle altre funzioni.
3. **Schema e identificativi.** Il contratto ora impone origini diverse tramite definizioni condivise e usa handle brevi nel solo input/output della selezione. Il codice li riporta agli ID immutabili del catalogo. L’ultima richiesta ha completato una selezione di cinque candidate e 15 fonti. È una validazione meccanica, **non un fact checking riuscito**.
4. **Pertinenza dei riscontri.** L’ispezione ha trovato anche una fonte AGI sul babysitting nella coppia dichiarata per gli autotrasportatori, pur non essendo citata nei relativi fatti. È stato aggiunto un blocco anticipato: entrambe le fonti della coppia devono comparire nei fatti della notizia. Questo non prova da solo la corroborazione semantica, che resta da giudicare; il nuovo vincolo non viene retroattivamente presentato come controllo superato dal job odierno.
5. **Copione insufficiente.** Il controllo prima della voce ha respinto il testo iniziale e la successiva correzione, rimasta a 404 parole. Questo è il blocco finale registrato nel DB. Nessun take a pagamento è stato avviato su quel testo.

Le correzioni tecniche della selezione e le richieste incomplete sono conservate sotto `.daily-agent/commission-20261025/`, con marker distinti prima di ogni chiamata. Le risposte e i registri completi rimangono in `.daily-agent/research-trace/`. Non copiarli negli asset pubblici, non presentare le cinque candidate come notizie già approvate, non ripetere quei helper per cercare casualmente un verdetto positivo.

## Cosa manca prima di dichiarare riuscito il ciclo

- Corroborazione del fatto centrale già nella ricerca, con recupero puntuale di evidenze indipendenti e riserve realmente verificabili. Due editori distinti non bastano se parlano di fatti diversi.
- Generazione del copione per notizia con budget proporzionati alla rilevanza e sviluppo per non esperti; il prompt con un totale di parole non ha garantito il rispetto della profondità. Nessun riempimento o dettaglio inventato per allungare il testo.
- Un copione completo che superi A e B, poi Alex 2, allineamento, entrambi i master, revisione finale e trasferimento verificato. Questi passaggi non sono collaudati end-to-end dal risultato odierno.
- Verifica del salvataggio e di una vera ricevuta della task Work. Il suo stato non è deducibile dal timer del Mac.

La schedulazione delle 07:30 rimane installata e attiva. Un futuro avvio può nuovamente fermarsi ai controlli: non dichiarare pronta la filiera editoriale soltanto perché i servizi sono caricati.

## Verifiche delle modifiche

37 regressioni su fonti, editoria, calendario e commissione manuale; 60 regressioni podcast; typecheck e lint dei file modificati superati. Provider simulati nei test, nessuna sintesi reale nei test. Le chiamate AI sopra sono il collaudo creativo autorizzato, distinto dalla regressione.

Guida operativa: [produttore Mac](cdaily-mac-producer.md). Il dossier conserva un esito negativo reale, senza sostituirlo con i risultati delle prove brevi precedenti.
