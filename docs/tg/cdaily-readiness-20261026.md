# Daily del 26 ottobre — consegna operativa

Verificato il 25 ottobre 2026. Questa pagina registra predisposizione e collaudi tecnici, non attesta una puntata futura prodotta o pubblicata.

## Domani

1. **07:30 Europe/Rome (06:30 UTC)**: il timer del Mac avvia una nuova edizione Italia datata 26 ottobre. Raccolta e memoria del pubblicato, selezione, copione completo, score semantico, titoli, scaletta e testo social; controlli AI A/B obbligatori.
2. Con `productionMode: full`, `textReviewMode: manual` attualmente salvati, il sistema si ferma a **Testi verificati**. Aprire la [GUI sul Mac](http://localhost:3107/podcast/tg/redazione), leggere testo e regia, inserire il revisore, spuntare la conferma e premere **Conferma testo e avvia produzione**. Un errore editoriale resta un blocco da correggere; non viene approvato per rispettare l’orario.
3. Al controllo successivo del timer, la stessa versione confermata riprende: attualità/A/B, Alex 2, allineamento, avatar e master nativi portrait/landscape, revisione finale AI. L’approvazione del testo non approva automaticamente i media.
4. Il Mac carica soltanto il pacchetto completo approvato sul sito. **08:15** è l’obiettivo Work; **08:45** chiude la finestra. Work deve usare solo il Daily odierno realmente rilasciato, altrimenti attende o segnala il blocco.

Il Mac deve restare alimentato, acceso e con utente connesso. Non occorre lasciare aperta questa chat. La GUI serve per l’OK manuale; la produzione non dipende dal server Next della GUI.

## Verifiche e limiti

- I tre LaunchAgent risultano caricati: tunnel del database esistente, caffeinate e produttore. Configurazione persistente letta dal backend: Italia attiva, 07:30, fuso Europe/Rome, sito prima dei social, revisione manuale attiva. Nessuna prenotazione anticipata con notizie del giorno precedente.
- Prerequisiti Mac presenti, identità Alex 2 già verificata dalla prova salvata; 17 impronte di asset e impostazioni grafiche corrispondono allo stile approvato. La disponibilità futura dei provider e dei crediti non è certificata da questi controlli.
- Ricevitore sito verificato in sola lettura: installato, timer attivo/abilitato, nessuna generazione o distribuzione social sul server.
- L’azione manuale usa revisione e lease, A/B correnti, hash del testo/score, data e archivio. Due conferme concorrenti non accodano due produzioni. Modifiche o controlli non validi impediscono la conferma. Contatori e precedenti errori rimangono conservati.
- Collaudo finale: **179 test Daily superati, comprese tutte le integrazioni** su `mongodb://127.0.0.1:27018` e database `conclavia_e2e_*` dedicati; **14 test GUI superati**, incluso il nuovo passaggio manuale e le larghezze 320/390/1440 px. Typecheck, lint dei file modificati e build Webpack separata `.next-build-verify` superati. Nessun provider reale usato nei test; le applicazioni esistenti sono state preservate.
- La task **ChatGPT Work delle 08:15 non è verificata da questo strumento**. Prompt completo: [task Work](cdaily-work-publication-task.md). Un link Spotify o una pagina social non certificano una connessione di caricamento; gli esiti dipendono dalle connessioni effettive di Work.
- Il primo Daily completo da notizie fresche fino alle ricevute social resta da osservare. Non garantire un master in 45 minuti finché non è misurato. Nessun nuovo take, video o post reale prodotto per questi test di predisposizione.

## Ripresa rapida

Per il lavoro ordinario leggere [entrata rapida](cdaily-quick-start.md) ed eseguire `npm run daily:context`; per stato reale `npm run daily:mac -- status`. I file privati in `.daily-agent/` e `.tg-artifacts/` conservano diagnostica e cache. Non azzerare gli errori del job storico del 25 ottobre né trasformare il suo laboratorio in un’edizione odierna. Migrazione Mac: [produttore portabile](cdaily-mac-producer.md).
