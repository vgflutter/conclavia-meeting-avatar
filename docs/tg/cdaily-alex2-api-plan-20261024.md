# Alex 2 — raccordo API al percorso Daily approvato

Stato al **24 ottobre 2026**: progetto di integrazione, non adattatore già
operativo. Nessuna credenziale è stata letta, creata o salvata con questo documento.

## Risultato da ottenere

Il worker deve usare la voce **Alex 2 - daily** già approvata, senza un fallback
a un altro conduttore. La generazione parte soltanto dal copione completo con
controlli A/B validi. I due video condividono la stessa registrazione; la
durata segue il take, con una pausa pulita di due secondi dopo l’introduzione,
mood per clausola e indice in basso sulla parola «commenti».

## Trasporto e tempi della voce

La [documentazione ufficiale del Text to Speech con tempi](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps)
descrive `POST /v1/text-to-speech/{voice_id}/with-timestamps`, che restituisce
audio e tempi per carattere. L’adattatore riutilizzabile va nel kit, sotto
`src/features/speech/server`, esportato da `/speech/server`; casting e policy
CDaily restano in Meeting. Non duplicare la sintesi nei consumer.

- Identificare la voce salvata dal catalogo dell’account, controllandone il nome;
  non sostituirla con una voce pubblica simile.
- Verificare modello e impostazioni del take approvato prima di configurarli.
  La [pagina ufficiale v4](https://elevenlabs.io/it/v4) documenta `eleven_v4`.
  Non dedurre la provenienza di un file dal suo nome.
- Decodificare l’audio reale e trasformare i tempi per carattere in ancore delle
  parole. Se testo normalizzato e copione non si allineano, fermare il job;
  non inventare tempi né dichiarare un allineamento misurato quando è stimato.
- Per la pausa usare un confine audio verificato oppure due take con continuità
  esplicita. Non contare un tag nel prompt come due secondi di silenzio misurato.
- La possibilità di usare i tempi restituiti insieme alla sintesi può evitare
  la successiva trascrizione: è un vantaggio atteso, da collaudare sul take reale.

## Configurazione privata server

Il 24 ottobre l’utente ha chiarito che **AWS non è usato dal progetto** e ha
autorizzato esplicitamente: «Sì, rimuovi il blocco AWS e usa la configurazione
privata». Il blocco generico AWS/Secret Safety in `AGENTS.md` è stato sostituito
con regole pertinenti al backend esistente. Per collegare ElevenLabs non
serve introdurre un servizio AWS né chiedere di nuovo la stessa autorizzazione.

Servono una chiave ElevenLabs già esistente, l’identificativo della voce
approvata e la selezione esplicita del modello, nella configurazione privata
server. Non creare una nuova chiave, cambiare piano o acquistare crediti come
effetto collaterale. Nessun valore deve entrare in Git, output, bundle browser,
manifest pubblico o chat; i controlli mostrano soltanto presenza e stato.

Il browser non è risultato raggiungibile neppure dopo il reset della sessione
e la ricerca nel catalogo dei plugin non ha trovato un collegamento ElevenLabs
utilizzabile. Questi controlli non dimostrano che l’account sia senza crediti
o senza una chiave: tali dati non erano stati letti.

## Collaudo prima di rimuovere il blocco

1. Test senza provider: risposta con tempi nativi, audio troncato, errore/quota,
   disallineamento, cache e assenza di fallback.
2. Raccordo consumer: clock naturale, pausa misurata e controlli sulla durata
   coerenti in produzione, approvazione e publisher; entrambi gli export a 50 fps.
3. Verifiche di feature, test del kit e dei player e build di entrambi i consumer.
4. Una prova reale breve con Alex 2, poi il Daily completo dopo i controlli del
   nuovo testo. Misurare audio, giunzioni, labiale e gesto finale nei due formati.
5. Rimuovere il blocco di readiness solo con evidenze reali. L’adattatore della
   voce non dimostra che gli account social o la task Work siano già collegati.
