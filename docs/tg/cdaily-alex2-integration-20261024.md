# CDaily: Alex 2, clock del take e collaudo

24 ottobre 2026. Implementazione nel motore condiviso e nel ramo `cdaily-v1` Italia. **Chiave creata su autorizzazione esplicita, salvata privatamente e identità Alex 2 verificata via API. Audio reale recuperato; tempi nativi respinti e master completo ancora pendente.** Stile, asset, font e studio approvati conservati: controllo dei 17 fingerprint positivo. Nessun nuovo Daily o invio social in questa modifica.

## Percorso implementato

1. Selezione variabile di 5–7 notizie distinte e corroborate, senza riempitivi; copione con data, contesto, score semantico e chiusura esistenti.
2. Controllo locale di profondità: 480–1200 parole totali, principale almeno 90 e altre notizie almeno 45. Segnala compressione o eccesso, non certifica qualità. Nessun riempitivo per passarlo. Condivide il limite persistente di una correzione editoriale.
3. Controlli AI A e B sul testo completo e sul medesimo score; riscritture invalidano entrambi.
4. Verifica dell’ID privato: il nome deve essere esattamente `Alex 2 - daily`, senza voce pubblica simile o fallback. Modello esplicito `eleven_v4`, coerente con i metadati del riferimento approvato; le impostazioni effettive restano da confrontare con il take reale.
5. Paragrafi continui per notizia, fino a 3600 caratteri, con contesto vicino; i cambi di mood non spezzano la voce. Risposta PCM 24 kHz con tempi nativi per carattere. Copione diverso o tempi incoerenti bloccano la produzione.
6. Cache privata con hash di voce/modello/impostazioni/testo/contesto. Un marcatore scritto prima della sintesi impedisce addebiti automatici ripetuti se il risultato è incerto. PCM e tempi completi vengono riusati; cache alterata richiede un controllo esplicito.
7. Montaggio sul clock reale: pausa di 2 s in un corridoio audio misurato, rampe brevi, nessuna variazione di velocità. `product.seconds` resta l’obiettivo; `manifest.seconds` è il master. Limite tecnico 180–420 s; obiettivo editoriale circa 4–6 minuti, senza obbligo di 5:00.
8. Parole native per cue/mood e gesto sulla parola «commenti». Il labiale è una stima fonetica confinata ai tempi delle parole: non dichiarare fonemi misurati. Regia corporea e palette approvate riusate integralmente.
9. Composizioni native 1920×1080 e 1080×1920 a 50 fps; decodifica, durata, audio, FPS e digest verificati prima dell’approvazione. Il master ripreso deve corrispondere anche alla configurazione vocale privata corrente. Revisore finale e pubblicazione restano fasi separate.

Trasporto/tempi/labiale appartengono a `@conclavia/avatar-kit/speech` e `/speech/server`; casting, cache, regia, soglie editoriali e distribuzione rimangono in Meeting. Il percorso Inworld/clock storico degli altri snapshot rimane compatibile. World e un secondo presentatore richiedono casting dedicato; non ereditano Alex 2 automaticamente.

## Configurazione e prova reale

Nel file **privato** `.env.local` del backend:

```dotenv
ELEVENLABS_API_KEY=<chiave privata, mai in chat o Git>
TG_IT_ELEVENLABS_VOICE_ID=<ID della voce Alex 2 - daily salvata nell’account>
TG_ELEVENLABS_MODEL_ID=eleven_v4
```

È supportata anche `TG_ELEVENLABS_API_KEY`, con precedenza sulla variabile generica. Chiave e ID sono presenti in `.env.local`, con permessi `0600`; il confronto con la copia privata precedente conferma che le altre impostazioni non sono cambiate. Il modello è `eleven_v4`. Facoltativo `TG_IT_ELEVENLABS_SETTINGS`: JSON con sole `stability` e `similarity_boost`, entrambe 0–1, soltanto dopo confronto con le impostazioni approvate. Omissione conserva quelle salvate dal provider. Non inviare marcatori di mood o indicazioni Inworld a ElevenLabs.

La creazione è avvenuta tramite onboarding ufficiale `@elevenlabs/cli@1.7.1` e autorizzazione account dell’utente, dopo conferma immediata «Sì, crea e salva la chiave». Nessun cambio piano o acquisto di crediti. Nessun segreto è entrato in output o Git; non ricreare la chiave riprendendo il lavoro. Questo verifica il backend **locale**, non la configurazione del server di produzione.

```sh
npm run daily:voice -- status
npm run daily:voice -- check
npm run daily:voice -- probe --confirm
```

`status` non usa rete/DB/crediti; mostra solo booleani. `check` legge l’identità della voce. `probe --confirm` registra **una sola breve presentazione senza notizie**, senza cambiare piano, scheduler o pubblicare. Audio, tempi e ricevuta sono in `.daily-agent/alex2-voice-proof/`, ignorati da Git. Il marcatore di tentativo impedisce anche qui una seconda spesa cieca: prima di riprovare un esito incerto, controllare e archiviare esplicitamente quel tentativo. Non cancellare ricevute per fingere un successo.

La GUI e `daily:agent` distinguono configurazione da una sintesi realmente verificata, controllando digest e audio della ricevuta. Prova valida per sette giorni; cambi di voce/modello/impostazioni o alterazioni la invalidano. Questo stato non certifica il video completo né gli account social.

### Esito della prova reale e recupero senza nuova sintesi

Sono state eseguite due brevi richieste dello stesso testo pubblico di 143 caratteri. Il primo esito era generico; il secondo ha isolato `stage=timing`, `status=502`, ossia il rifiuto locale dei tempi restituiti, **non** un errore HTTP 502 accertato del provider. La diagnostica del comando ora conserva soltanto fase e codice controllati, mai corpi di risposta o identificativi privati.

La cronologia conferma entrambi i take: v4 li archivia come dialogo a una voce, con i campi principali `text` e `voice_id` vuoti. Il filtro per sola voce non li trovava: l’assenza di risultati di quel filtro **non prova che una richiesta non sia stata eseguita o addebitata**. Per il recupero sono stati letti al massimo 20 metadati recenti e conservate solo le corrispondenze esatte testo/voce nel singolo input di dialogo.

Il take più recente è stato scaricato dalla cronologia, senza rigenerarlo: **8,88 s**, PCM mono 24 kHz, RMS 0,139 e picco 0,923. È in `.daily-agent/alex2-voice-proof/recovered-take.wav`, con PCM, metadati e ricevuta privati. Non è ancora stato valutato all’ascolto. I 143 caratteri corrispondono al testo, ma 139 intervalli hanno fine precedente all’inizio; entrambe le varianti di allineamento sono incoerenti. Non reinterpretarli come durate o inventare ancore: mantenere il blocco.

Non è stata creata una `proof.json` positiva; `synthesisVerified` resta `false`, poiché certifica audio **e** sincronizzazione. Prima di altre spese: recuperare e riusare questo audio, correggere il percorso dei tempi con evidenza misurata e fixture pertinenti, quindi collaudare labiale/mood. Valutare l’allineamento del take già salvato con il consenso sintetico esistente, conservando la provenienza dei tempi. Nessun altro tentativo automatico, sostituzione di voce o forzatura della readiness.

Dopo l’ascolto del take breve: nuova edizione nella finestra corretta, contesto sufficiente, A/B aggiornati, master completi e revisione finale nei due formati. La bozza del 24 mattina resta bloccata: nessun recupero tardivo, azzeramento dei contatori o riuso di notizie scadute. La task Work e le destinazioni social richiedono ancora prove reali.

Riferimenti primari verificati: [sintesi e timing](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps), [identità della voce](https://elevenlabs.io/docs/api-reference/voices/get), [modelli](https://elevenlabs.io/docs/overview/models).

## Verifiche eseguite

- Kit: **244 test positivi**, typecheck, confini di feature e controllo di entrambi i consumer. Commit kit `f623bbb`.
- Meeting: **112 test Daily positivi**, 18 integrazioni DB escluse senza database di test esplicitamente fornito; typecheck e lint dei file modificati positivi.
- Browser Meeting: **26 test positivi** per player, labiale, avatar, contatti delle mani e master di presentazione approvato; provider disabilitati, server 3101 e Mongo temporaneo 27018.
- Build di produzione Meeting e Onboarding positive, in directory separate. Onboarding: **82 test**, typecheck e lint positivi; nessuna modifica al suo codice applicativo.
- Identità video: **17 fingerprint approvati invariati**. Gitleaks sul diff del kit positivo; nessuna credenziale in commit o output.
- Prove vocali eseguite soltanto con fixture sintetiche: non sono un ascolto di Alex 2 né una produzione completa reale. Il comando locale `daily:voice -- status` rileva modello predisposto, chiave e ID voce assenti, sintesi reale non verificata. Nessuna pubblicazione o acquisto effettuato.

La prova tecnica usa anche un take simulato di circa 200 s con obiettivo 300 s, senza rallentamenti, e verifica pausa/gesto, cache, esito incerto, configurazione cambiata e blocco di un testo troppo breve anche con rapporti AI precedenti positivi. I controlli numerici non sostituiscono l’ascolto e la revisione dei due master reali.

GUI locale aggiornata sulla porta **3107**, dopo verifica del processo precedente; health, redazione e API di sola lettura rispondono 200. Controllo browser a 1440 e 390 px: nessun errore JavaScript o overflow orizzontale. I controlli mostrano correttamente voce non verificata e job del 24 ancora bloccato. Ricevute e screenshot in `.local/alex2-newsroom-*20261024*`, privati. Il sito pubblico e i suoi master non sono stati modificati. La configurazione SSH/Mongo è conservata; nessuna azione di retry o pubblicazione sul job reale.
