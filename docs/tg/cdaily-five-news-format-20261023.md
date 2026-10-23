# CDaily — copertura più ampia e stacco pulito

> Documento storico del pilota. Il [riesame successivo](cdaily-italia-world-duration-review-20261023.md) supera l’obbligo di cinque notizie e cinque minuti e chiarisce il focus italiano. Restano valide le verifiche tecniche della pausa e del gesto.

23 ottobre 2026. L'utente chiede di riesaminare le quattro notizie, ricordare la pausa fra introduzione e prima notizia, conservare il gesto finale e riprendere lo stile della presentazione. Questa revisione supera conteggio e budget della scelta del 21 ottobre; non riscrive i vecchi filmati.

## Scelta editoriale

**Cinque notizie in cinque minuti**, con una gerarchia. Una principale da circa 75 s e quattro notizie da circa 48 s consentono di ampliare gli argomenti conservando una spiegazione comprensibile. Con sei o più notizie lo spazio medio diminuirebbe ulteriormente: questa prova valuta cinque prima di aumentare ancora. È una scelta editoriale da collaudare, non un risultato già dimostrato dai follower.

La selezione cerca sviluppi italiani e internazionali e più ambiti di interesse, senza quote rigide. Ogni notizia deve meritare lo spazio per novità, conseguenze e prove. Se non ci sono cinque fatti sufficientemente solidi, la ricerca continua entro il budget e poi la produzione si ferma: niente meteo ordinario o curiosità di riempimento. Due riprese della stessa agenzia non sono due origini indipendenti.

## Clock indicativo, totale 300 secondi

| Tempo | Funzione |
| --- | --- |
| 0:00–0:18 | Saluto, orientamento, anticipazioni di due o tre temi reali. |
| 0:18–0:20 | Pausa pulita: voce ferma, avatar vivo e recupero del gesto. |
| 0:20–1:35 | Principale: fatto nuovo, contesto, conseguenza e limite utile. |
| 1:35–2:23 | Seconda notizia. |
| 2:23–3:11 | Terza notizia. |
| 3:11–3:59 | Quarta notizia. |
| 3:59–4:47 | Quinta notizia. |
| 4:47–5:00 | Rimando al sito, commenti, claim e recupero finale. |

Sono budget redistribuibili, da misurare sul take. Non allungare la voce, accumulare cautele o leggere velocemente sei titoli per simulare ampiezza. Punto di partenza circa 800–830 parole italiane; ritmo e comprensibilità prevalgono sul conteggio delle parole.

## Suono e recitazione

Alex 2, parlato colloquiale e agile, frasi collegate, enfasi misurata. **Nessuna musica in questa prova.** La pausa reale di due secondi evita un attacco schiacciato; la giunzione va inoltre corretta tecnicamente con bordi audio continui, senza click, effetti o tagli delle consonanti. Conservare e verificare il prima/dopo in PCM. Aggiornare tempi delle parole, mood, labiale, sottotitoli e scene dopo ogni inserimento; non dichiarare la pausa realizzata perché è scritta nel prompt.

Mantenere esattamente studio, avatar, materiali, marchi, font e palette della presentazione approvata `avatar-refined-presence-20261023` (media `12c91abdf743`). Mani anatomiche, gesti con preparazione e recupero, spalle/busto/collo collegati, dita vive senza loop. In piedi nessun intreccio da seduto.

Chiusura:

> Fonti e approfondimenti su daily.conclavia.me.
> Scrivici nei commenti cosa vuoi approfondire: partiamo dalle tue domande.
> Meno rumore, più contesto.

Conservare la direzione approvata di `avatar-comments-gesture-20261023`; ritimare l'apice sulla parola misurata **commenti** nel nuovo audio. Nessun gesto verso il basso anticipato al rimando al sito.

## Condizioni per l'export

Freschezza e confronto con il pubblicato; dossier delle cinque scelte; controllo fattuale AI A e revisione editoriale AI B distinti, registrati sullo stesso copione e riassunto social. Nessun commento politico o opinione AI finale introdotto automaticamente. Non dire «ieri sera» o «seconda storia»; spiegare i temi a chi non li conosce.

Due composizioni native, 9:16 e 16:9, 50 fps; sottotitoli separati. Misurare il master da 300 s, la pausa reale, i bordi audio, la chiusura e il gesto; ispezionare i file finali e il player mobile. Lo stato della puntata e gli eventuali blocchi sono nel dossier datato, mai sostituiti da un esito di test tecnico.

## Procedura ripetibile per un nuovo pilota

1. Nuovo copione datato in `scripts/tg/editions/` e dossier: cinque fatti freschi, confronto con il pubblicato, titoli brevi e riassunto social. Conservare i rapporti AI A/B e legare l’esito all’impronta del copione; distinguere rilievi bloccanti e osservazioni motivate, senza cancellare i rapporti negativi.
2. Take Alex 2 originale conservato privatamente, impostazioni e piano osservato nel dossier. Verificare il ritmo sul take; se si applica un lieve tempo senza cambiare intonazione, eseguirlo **prima** dell’allineamento. Non rigenerare voce già disponibile per un test grafico.
3. `scripts/tg/prepare-daily-pilot.ts` con ID e file espliciti, `TG_PUBLISH_ENABLED=false`, consenso ASR già documentato. La cache evita di ritrascrivere parti riuscite. Una trascrizione incompleta blocca: ricontrollare le giunzioni con finestre sovrapposte, conservare gli scarti; gli aggiustamenti ortografici restano espliciti e mantengono i tempi del provider. Mai inventare intervalli delle parole per completare un copione.
4. Il preparatore inserisce il silenzio nel PCM misurato e riallinea le ancore. Assemblare `audio.wav` solo dalla voce risultante, nessuna musica per questa versione del format. `scripts/tg/apply-approved-daily-closing.mjs --id=…` riprende la forma del dito approvata e ne sposta il clock sulla nuova parola «commenti».
5. Anteprima dei sette momenti editoriali; controllo aggiuntivo del vero gesto, non solo un fotogramma di apertura. Export con `scripts/tg/render-launch-promo.ts --edition-pilot`, `TG_RENDER_FPS=50` e cartelle dedicate al nuovo ID. Non usare i flag delle prove estetiche per cambiare il look.
6. `scripts/tg/audit-daily-pilot-audio.mjs --id=…`: 300 s, due secondi fra le parole, giunzione silenziosa, take intatto fuori dalle rampe, dito sul commento. Audit geometrico con `scripts/tg/audit-creative-pilots.ts --edition=…` e `TG_AUDIT_FPS=50`; decodifica dei due MP4, esame delle immagini effettivamente codificate e sequenza della chiusura.
7. `scripts/tg/build-daily-pilot-page.mjs --id=…` crea un unico player con selettore di formato e riassunto. `scripts/tg/verify-daily-pilot.mjs --id=…` verifica 360, 390 e 1440 px, tutti i capitoli delle notizie, audio/video e sottotitoli. Nessun caricamento automatico dei due video prima del play. Aggiornare il dossier con esiti reali e link, poi consegnare per la review.

La procedura è per la produzione locale esplicita del pilota. Il worker di pubblicazione non è attivato da questi comandi; il suo adattatore vocale e la regia devono ancora essere portati alla stessa configurazione prima di dichiarare attiva la filiera autonoma completa.
