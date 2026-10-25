# CDaily — produttore Mac, sito e Work

Decisione dell’utente del **25 ottobre 2026**: questo Mac prepara ogni Daily alle **07:30 Europe/Rome**, pubblica i file approvati sul sito e lascia la distribuzione social a ChatGPT Work. Il Mac resta acceso. Il precedente produttore editoriale sul VPS è disabilitato; non riattivarlo insieme al Mac.

## Responsabilità e calendario

```mermaid
flowchart LR
 M[Mac · 07:30] --> R[Notizie fresche e memoria del pubblicato]
 R --> E[Copione, scaletta, testo social e mood]
 E --> A[Verifica AI A]
 A --> B[Revisione AI B]
 B --> V[Alex 2 · take continuo e parole misurate]
 V --> F[Renderer approvato · 9:16 e 16:9 · 50 fps]
 F --> Q[Controlli tecnici e revisore finale AI]
 Q --> U[Mac · trasferimento privato con checksum]
 U --> S[Sito · pacchetto approvato e release immutabile]
 S --> W[Work · dalle 08:15 · social già configurati]
```

- **07:30:** il Mac avvia il lavoro. Il timer controlla ogni minuto il calendario nel fuso IANA, indipendentemente dal fuso della macchina; DB e lease garantiscono una sola edizione per data.
- **08:15:** obiettivo di uscita e avvio della task Work. I controlli non si saltano per rispettare l’orario.
- **08:45:** chiusura della finestra. Un lavoro tardivo, incompleto o non approvato non diventa una pubblicazione.
- Il 25 ottobre gli orari corrispondono a 06:30, 07:15 e 07:45 UTC. Non salvare UTC fissi nei calendari.

Il sito serve i media e verifica il pacchetto ricevuto; **non genera voce o video**. Work legge il sito e distribuisce soltanto il pacchetto odierno approvato; **non produce il Daily**. Le prove tecniche rimangono private.

## Installazione su questo Mac o su uno nuovo

1. Tenere affiancati `conclavia-avatar-kit`, `conclavia-meeting-avatar` e `conclavia-deploy`, con le revisioni compatibili salvate in Git. Non serve conservare il nome utente o il percorso `/Users/vins`: l’installer ricava i percorsi e l’eseguibile Node dalla nuova macchina.
2. Installare Node **22.21.1 o superiore**, FFmpeg/FFprobe e Google Chrome oppure il Chromium di Playwright. Nel kit e in Meeting eseguire `npm ci`. Se si usa Chromium, eseguire `npx playwright install chromium` in Meeting.
3. Ripristinare la configurazione privata esistente: `.env.local` di Meeting, configurazione del tool deploy e accesso SSH autorizzato. Servono gli stessi provider, ID Alex 2 e database; non creare un database sostitutivo, nuove voci o nuove chiavi come effetto dell’installazione. Le credenziali si trasferiscono con un canale privato e restano fuori da Git/chat.
4. Configurare l’alias SSH già previsto `mongo-tunnel`, con il forwarding locale sulla porta 27017 e autenticazione non interattiva. Verificare anche l’accesso deploy al server attraverso il suo setup SSH verificato. L’installer non legge né esporta chiavi private.
5. Dal repository Meeting:

```sh
npm run daily:mac -- doctor
npm run daily:mac -- install
npm run daily:mac -- status
```

L’installazione disattiva il timer editoriale VPS e registra tre LaunchAgent utente:

| Servizio | Funzione |
| --- | --- |
| `me.conclavia.daily-production` | Controlla la finestra e avvia la pipeline completa sul Mac |
| `me.conclavia.daily-mongo` | Mantiene il tunnel verso il database esistente |
| `me.conclavia.daily-awake` | Impedisce il sonno di sistema quando il Mac è alimentato, lasciando spegnere lo schermo |

I plist sono generati in `.daily-agent/` e registrati in `~/Library/LaunchAgents`. Non contengono chiavi API. Il Mac deve restare collegato all’alimentazione e l’utente deve aver effettuato l’accesso; dopo un riavvio con FileVault occorre accedere. Bloccare lo schermo non equivale a disconnettere l’utente. Non dipende dalla chat aperta o da `next dev`.

Il renderer viene compilato da sorgente e avviato su una porta **loopback temporanea** per ciascun lavoro, senza occupare 3000 o 3107. Serve soltanto il bundle locale e gli asset approvati; non serve credenziali, prove interne o cartelle arbitrarie. La GUI privata esistente rimane sotto `/podcast/tg/redazione` nell’app Meeting; non è necessaria aperta per produrre.

## Migrazione e ripristino

Sul vecchio Mac, prima del passaggio:

```sh
npm run daily:mac -- uninstall
```

Attendere la fine del lavoro corrente o conservare cache e ricevute prima di interromperlo. Sul nuovo Mac ripetere i passi di installazione: vengono rigenerati plist, percorsi, PATH e collegamenti. Un’installazione già gestita può essere riconfigurata anche dopo lo spostamento della cartella; non vengono sovrascritti LaunchAgent estranei.

Conservare privatamente `.tg-artifacts/` per riusare take, allineamenti e dossier, soprattutto per una lavorazione interrotta. `.daily-agent/` conserva ricevute e diagnostica; non trasferire lock e plist come se fossero configurazioni portabili: rigenerarli con l’installer. Il database condiviso mantiene archivio, revisioni, lease, tentativi e approvazioni. Non azzerare contatori o rigenerare una sintesi dall’esito incerto.

## Voce e produzione

Alex 2 resta la voce approvata, senza sostituzioni o rallentamenti artificiali. Una registrazione continua per passaggio può contenere più mood. La risposta vocale completa viene conservata prima di leggere i tempi; se i tempi nativi sono incoerenti, si allinea **lo stesso PCM** con una trascrizione OpenAI, senza una seconda sintesi ElevenLabs.

Il testo ASR deve coprire il copione completo: si ammettono soltanto punteggiatura/case e equivalenze numeriche intere controllabili; parole diverse o mancanti bloccano il take. Gli ancoraggi ASR raggruppati restano dichiarati tali; non diventano fonemi misurati o intervalli inventati. Le richieste ASR incerte hanno anch’esse un tentativo persistente, senza nuovi addebiti automatici. Il consenso dell’utente già registrato riguarda questo audio sintetico e il copione pubblico.

La prova vocale corrente è sotto `.tg-artifacts/.alex2-voice-proof`, legata alla configurazione e ai byte audio realmente verificati. Si rinnova dai take riusciti; non basta la presenza della chiave. Il vecchio recupero della cronologia resta conservato in `.daily-agent/alex2-voice-proof`.

Il motore conserva stile `avatar-refined-presence-20261023`, font, studio, mani anatomiche, regia semantica, data nel saluto, pausa reale di due secondi e gesto sui commenti. Il rendering usa gli stessi componenti canonici della presentazione e due composizioni native Full HD a 50 fps. Nessuna copia del motore nei consumer.

L’adattatore ASR esistente usa `whisper-1` per gli ancoraggi delle parole. La [documentazione ufficiale OpenAI](https://developers.openai.com/api/docs/guides/speech-to-text) ne indica la disponibilità di compatibilità fino al 26 febbraio 2027: migrare prima della scadenza dopo aver verificato il contratto dei timestamp, senza cambiare soltanto il nome del modello.

## Caricamento sul sito e Work

Il Mac prepara una directory privata con **soltanto** `portrait.mp4`, `landscape.mp4`, `audio.mp3`, `captions.vtt` e `transfer.json`. Il tool deploy trasferisce i file con SSH verificato:

```sh
# Da conclavia-deploy; normalmente lo esegue automaticamente il produttore Mac.
npm run conclavia -- daily-site upload --job=ID_EDIZIONE
```

Il ricevitore confronta job, data, approvazione, finestra e checksum con il DB effettivo, verifica i byte e attiva il publisher del sito. La pubblicazione usa le release immutabili e mantiene le ricevute; non carica manifesti privati, risposte dei provider o demo. Un invio ripetuto riconcilia il pacchetto già pubblicato. Il Mac non chiama i publisher social.

Work resta alle **08:15 Europe/Rome**, con il [prompt dedicato](cdaily-work-publication-task.md) e i canali già concordati. Il salvataggio della task e le sue ricevute vanno verificati nella chat Work, non dedotti dal timer Mac.

## Diagnostica e limiti verificati

- Stato locale: `npm run daily:mac -- status`; ultimo esito in `.daily-agent/mac-last-run.json`, problemi in `mac-last-error.json`, log privati dei LaunchAgent nella stessa cartella.
- Un `run` manuale rispetta data, finestra, stato e controlli; non forza la ripartenza di un giudizio editoriale negativo.
- L’edizione del **25 ottobre** era già bloccata nella selezione delle fonti, prima di copione e controlli A/B. Successivamente l’utente ha richiesto esplicitamente il primo giro nello stesso giorno. Il comando `npm run daily:mac -- commission` conserva lo snapshot precedente privatamente e nel record `commissioning`, mantiene tutti i contatori e applica una finestra straordinaria alla sola edizione odierna. Il piano ordinario resta alle 07:30. Questo ingresso non riapre un copione bocciato da A/B, un take pagato, una pubblicazione o tentativi esauriti; dopo la prima commissione non cambia nuovamente la finestra. L’esito reale è registrato nel dossier del collaudo.
- Prova locale con audio salvato: otto secondi in entrambi i formati, 50 fps, circa **18,14 secondi** di rendering totale. È una misura breve; il tempo di un Daily completo va osservato nel primo ciclo reale e non si garantisce per semplice proporzione.
- Recupero reale del probe da **8,88 s**, con allineamento ASR riuscito e nessuna nuova sintesi ElevenLabs. Non è una nuova puntata di notizie.
- Test con provider simulati e Mongo temporaneo; controlli di cache, concorrenza, esclusione delle prove e trasferimento alterato. Nessuna prova interna va esposta sul sito pubblico.
- Installazione verificata sul Mac il 25 ottobre: tutti e tre i servizi caricati, database connesso, Alex 2 verificato, produzione futura `full` alle 07:30. Sul VPS il timer editoriale risulta inattivo e disabilitato, quello del solo publisher sito attivo e persistente.
- Verifiche completate: 144 test TG, tre test del renderer/processi Mac, build di produzione Meeting, typecheck e lint dei file modificati; deploy con 65 test Node, 56 Python e verifica nativa Caddy. I test di arresto controllano anche che un discendente resistente a SIGTERM non rimanga in esecuzione oltre il timeout. Nessuna chiamata a pagamento nei test di regressione.

Durante il primo giro il selettore ha prodotto una coppia dello stesso editore. La validazione l’ha fermata prima della voce. Ora lo schema limita direttamente le coppie a origini indipendenti, referenziando gli ID del catalogo una sola volta; i controlli locali su date e riscontri restano obbligatori. Entrambe le fonti devono essere citate nei fatti della notizia. Il selettore vede handle brevi, che il codice riconduce agli ID originali senza modificare fonti o prove. I tentativi con reasoning medio hanno esaurito il budget senza un risultato e non sono diventati approvazioni; le generazioni conservano il reasoning precedente. Le tracce complete della ricerca sono private in `.daily-agent/research-trace/` e non diventano contenuti pubblici.

**Esito del primo ciclo:** fermato prima della voce per un copione di 404 parole, ancora insufficiente dopo l’unica correzione. Tre tentativi conservati, nessun video o invio. Vedere il [dossier del 25 ottobre](cdaily-first-mac-cycle-20261025.md): il calendario installato non equivale a una filiera editoriale già collaudata.

Riferimento Apple sul comportamento dei lavori durante sonno/risveglio: [Scheduling Timed Jobs](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/ScheduledJobs.html). Se il Mac è spento, disconnesso o non raggiunge i provider, il timer non prova che il video sia stato prodotto: conservare un esito esplicito e non pubblicare materiale sostitutivo.
