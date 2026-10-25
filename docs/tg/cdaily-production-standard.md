# CDaily — standard approvato per ogni nuova puntata

> **Aggiornamento del 25 ottobre — decisione corrente:** [testo prima del video, limite sotto dieci minuti e verifica manuale configurabile](cdaily-editorial-standard-20261025.md). Il Mac parte alle 07:30. Nel percorso completo (`productionMode: full`), `textReviewMode: manual` aggiunge l’OK esplicito dell’utente dopo AI A/B e prima della voce; `ai` prosegue automaticamente dopo gli stessi controlli. La verifica manuale è attualmente attiva. `productionMode: editorial` resta un arresto tecnico separato. Work distribuisce solo un pacchetto effettivamente approvato e rilasciato sul sito.


Consolidato il **23 ottobre 2026**, dopo l'approvazione dell'utente: «partendo da questo stile che adesso è ok». Questo è il punto di ingresso operativo; le revisioni cronologiche restano materiale di confronto. Leggere anche [linea editoriale](cdaily-editorial-line.md), [flusso](editorial-workflow.md) e [guida video](cdaily-video-guide.md).

**Base del Daily confermata dopo la visione del pilota Italia r3:** [basi del formato giornaliero](cdaily-format-foundation.md), media `1876a600e330`, 326,64 s. Dalla prossima edizione pronunciare giorno e mese nell’apertura. [Direzione di mood e gesti](cdaily-acting-direction.md): la maggiore varietà è specificata come prossimo sviluppo, senza modificare i master approvati o dichiarare già disponibili nuovi contatti col volto.

**Pipeline del copione aggiornata:** [fonti ampliate, score espressivo e controlli AI A/B prima dei media](cdaily-text-production-pipeline-20261023.md). Il saluto automatico ora include il giorno dell’edizione; il secondo revisore è obbligatorio anche sulle riprese e dopo le riscritture.

## Riferimento visivo da conservare

- Master approvato: `avatar-refined-presence-20261023`, media **`12c91abdf743`**. [Rivedi](http://127.0.0.1:3107/daily-launch/revisions/avatar-refined-presence-20261023/index.html). [Dossier e immagini](cdaily-avatar-presence-20261023.md).
- Alex adulto, ibrido umano/robot, volto chiaro, espressioni leggibili, tempie sintetiche, collo articolato, giacca petrolio snella. Finitura `sculpted`, mani `anatomical`, postura `standing`.
- Studio TG luminoso, pietra chiara, legno e piante; asset esistenti. Riutilizzare `dailyVideoIdentity`, `dailyRobotPalette` e il renderer canonico. Nessun nuovo volto generato, calotta, logo, font o scenario a ogni Daily.
- Marchio CDaily e firma by Conclavia; Bricolage Grotesque locale con licenza OFL; colori esistenti. `node scripts/tg/check-video-identity.mjs` deve passare.
- Due composizioni native: **1080×1920 9:16** e **1920×1080 16:9**, 50 fps, H.264/AAC, faststart. Nessun ritaglio automatico del landscape per ottenere il Reel.
- Un titolo breve per notizia, una sola idea visiva alla volta; pochi numeri significativi. Sottotitoli separati e attivabili, nessun testo integrale fisso o blocco grigio ingombrante. Nessuna etichetta permanente sul petto «presentatore e voce AI»; trasparenza AI nella pagina e nei metadati.
- Il player del sito è uno, adattivo o con selettore di formato; non affiancare un telefono gigante e un video orizzontale nella hero.

Applicazione verificata dello stile a una puntata completa: [prova grafica r8 e dossier](daily-style-proof-20261023.md), media `23e1146cdc02`. Usa l'audio d'archivio del 21 ottobre, quattro minuti: è un riferimento di resa e integrazione della chiusura, non di selezione o formulazione delle nuove notizie.

## Voce, suono e ritmo

- Voce **Alex 2 - daily**, ElevenLabs, identità già salvata. Amica, giovane, informale, scorrevole; tono narrato e partecipe, senza cadenza istituzionale o lettura solenne.
- Registrare frasi collegate in un take coerente; pause brevi fra concetti. Usare la velocità naturale e, solo dopo ascolto, un lieve aggiustamento. Non accelerare immagini e audio separatamente né allungare il parlato per riempire il clock.
- Nessuna sostituzione silenziosa della voce se i crediti sono insufficienti. Conservare take e impostazioni; dichiarare il blocco e completare gli altri materiali.
- Musica facoltativa nei primi **quattro secondi**, poi voce sola, anche in chiusura. Per la prima nuova prova scegliere **nessuna musica**. Evitare effetti o stacchi rumorosi all'inizio della prima notizia; il vecchio difetto a 00:14 non è un riferimento sonoro.
- Misurare durata reale, pause, picchi e giunzioni. Fra ultima parola dell’introduzione e prima parola della notizia inserire una pausa reale di 1–2 s (base 2 s, già compresi nel clock), con brevi rampe PCM ai bordi e zero colpi sonori; non tagliare consonanti o code vocali. La pausa di regia non sostituisce la correzione della giunzione. Parole e labiale derivano dall'audio vero; non inventare tempi uniformi. È autorizzato l'allineamento del solo audio sintetico Alex e del copione pubblico mediante il provider già usato.

## Recitazione riutilizzabile

- `dailyPerformanceForPosture('standing')`: articolazione continua, `vitality: .9`, `phrasing: 'connected'`. Lo scheletro, i limiti articolari e la geometria vivono nel kit, non in copie del consumer.
- Più mood nello stesso periodo; segmenti per significato con intensità misurata. Un unico pensiero mantiene la coreografia attraverso i cambi di mood.
- Braccia, polsi, dita, collo, spalle e busto si preparano, accompagnano e recuperano insieme. Gesti misurati e vari, con pause: niente loop casuali, pendoli continui o gesti a ogni parola.
- Mani piene anche di taglio, polsi anatomici, dita indipendenti. Le prese non sono il riposo obbligatorio. Intreccio **solo da seduto**; in piedi alternare offerta, confronto, accento e mani raccolte.
- Indice in alto solo su un punto realmente importante, ancorato a una parola misurata. Indice in basso sulla parola **«commenti»** nella chiusura. Non imporre a una nuova edizione l'accento «ricontrolla» della presentazione.
- Nessun sorriso sulle tragedie o accusa mimata assente dal testo. Il corpo deve seguire lo stesso significato del viso.
- La regia ora conserva la traiettoria del pensiero e sceglie le famiglie sui sottosegmenti emotivi, anziché soltanto sul primo cue. Preparatore e nuova regia usano il profilo di varietà semantica; i piani congelati restano tali. [Prova breve e stato del labiale](cdaily-acting-semantic-20261023.md). Usare il [catalogo e le priorità di regia](cdaily-acting-direction.md), senza introdurre pose nuove attraverso ID non supportati nel prompt.

## Formato editoriale: Italia, World e durata

**Riesame successivo del 23 ottobre:** Italia ha un baricentro italiano; World è un prodotto globale separato in inglese. Estero in Italia solo con rilevanza concreta documentata o eccezione mondiale motivata. Nessun obbligo di 5:00 esatti o di cinque notizie. Ipotesi da provare: circa 4–6 minuti, con margine motivato verso 6–7, e 5–7 notizie con una gerarchia; nessun riempitivo per raggiungere un numero. [Criteri e stato tecnico](cdaily-italia-world-duration-review-20261023.md).

Un presentatore; tono informale e comprensibile ai non esperti. Niente enfasi faziosa o promessa di neutralità infallibile. Il clock sotto descrive il pilota già realizzato: è un esempio storico, non il vincolo delle prossime edizioni.

| Finestra indicativa | Contenuto |
| --- | --- |
| 0:00–0:18 | Nel vecchio pilota: saluto, orientamento e anticipazioni. Nelle prossime edizioni aggiungere la data pronunciata, con tempo commisurato al testo. |
| 0:18–0:20 | Pausa pulita di 2 s: respiro e recupero dell’avatar, nessuna musica o effetto. |
| 0:20–1:35 | Principale, con sviluppo nuovo e contesto concreto (75 s). |
| 1:35–2:23 | Seconda notizia sostanziale (48 s). |
| 2:23–3:11 | Terza notizia sostanziale (48 s). |
| 3:11–3:59 | Quarta notizia sostanziale (48 s). |
| 3:59–4:47 | Quinta notizia sostanziale (48 s). |
| 4:47–5:00 | Sito per fonti, commenti, claim e breve recupero (13 s). |

Il vecchio pilota r2 è stato esportato a **300 s**; la base Italia r3 successivamente apprezzata dall’utente dura **326,64 s**. Per le nuove edizioni il tempo segue selezione e chiarezza; non allungare con silenzi e non comprimere il parlato per questo vecchio clock. Dal 24 ottobre `cdaily-v1` segue il take reale, con pausa misurata e 50 fps; il percorso legacy conserva il clock configurato. Il nuovo codice è testato offline: manca la prova API reale con Alex 2 e la revisione del master completo. [Stato e comandi](cdaily-alex2-integration-20261024.md).

- Apertura delle prossime puntate: «Ciao, questo è Conclavia Daily. Oggi è il [giorno] [mese].» Generare la data dai metadati dell’edizione e dal fuso configurato, coerente con pagina e testo social. Il «22 ottobre» dell’esempio dell’utente non è una costante. [Regole complete ed esempio datato](cdaily-format-foundation.md#2-apertura-pronunciare-la-data-delledizione).
- Aprire la giornata; evitare «ieri sera». Le date reali dei fatti restano accurate.
- Evitare «seconda storia»; preferire un passaggio sul tema, oppure «seconda notizia».
- Ogni notizia: cosa è successo, chi riguarda, perché conta, contesto per non esperti e cosa resta da confermare. Spiegare sigle; pochi nomi e numeri utili.
- Niente bollettino meteo locale ordinario o curiosità di riempimento. Eventi meteo gravi entrano solo per conseguenze eccezionali documentate; nessun obbligo di una quarta notizia leggera.
- Priorità a sviluppi verificati nelle ultime 24 ore, riscontri entro 36 ore; sette giorni solo per il contesto. Distinguere data dell'evento e dell'articolo, confrontare con il **pubblicato**, non soltanto con i titoli dei vecchi piloti. Un tema ricorrente richiede un fatto nuovo concreto.
- Fonti primarie quando disponibili più origini editoriali distinte. Due copie Reuters sono una sola origine. Reddit/tendenze sono segnali, non prove. Non dichiarare «50 fonti consultate» se la singola edizione non le ha consultate.
- Doppio controllo AI separato: A su fatti/date/prove; B su selezione, chiarezza, omissioni e tono, con ricontrollo centrale. Conservare rapporti e rilievi; un controllo mancante non è un esito positivo.
- Nessuna opinione libera AI ricorrente: resta una proposta da discutere. Conseguenze documentate e incertezze sono già parte della spiegazione.
- Nessun richiamo a «qui accanto al video». Per le fonti o gli approfondimenti indicare il sito.

Chiusura ricorrente, con gesto verso il basso su «commenti»:

> Scrivici nei commenti cosa vuoi approfondire: partiamo dalle tue domande.
> Meno rumore, più contesto.

Il gesto e la frase sono approvati dall'utente il **23 ottobre 2026** con «perfetto»: riferimento `avatar-comments-gesture-20261023`, media `1f326b7fe9b3`. Per integrarli nella prova d'archivio conservare la coreografia verificata, traslandone solo il clock assoluto. Per una nuova registrazione adattare il gesto ai tempi reali della parola «commenti», senza sorteggiare una variante diversa dopo l'approvazione.

## Pacchetto di ogni edizione e verifica finale

Conservare in una cartella datata manifesto, copione, sorgenti/prove, tempi delle parole, take, MP4 dei due formati, copertine, VTT e testo social. Dossier Markdown dedicato con candidate escluse, scelta di ciascuna notizia, cutoff, differenza dal pubblicato, rapporti A/B, scaletta/mood e limiti.

Riassunto autonomo obbligatorio in `TgScript.description`: **80–130 parole, massimo 1100 caratteri**, tutte le notizie effettivamente incluse, nello stesso ordine, senza fatti nuovi. Il post aggiunge invito, sito, attribuzione AI e fonti; il publisher non riscrive la caption dopo la verifica.

Prima di consegnare: ascoltare apertura e passaggi, rivedere scene e transizioni, controllare mani/viso e tutti i mood usati, verificare il gesto finale, assenza di tagli/overflow a 360–390 px, audio presente, due durate coerenti e sottotitoli allineati. Una prova locale non equivale alla pubblicazione o alla filiera autonoma attiva.

## Prova italiana a durata naturale, 23 ottobre

[Pilota Italia r3, durata naturale e verifiche](cdaily-italia-pilot-r3-20261023.md). I tool isolati del pilota seguono il take e mantengono pausa reale e gesto approvato. Dal 24 ottobre anche il ramo `cdaily-v1` implementa questo comportamento, con collaudo provider reale ancora pendente; gli altri snapshot mantengono il clock storico. La prova non abilita pubblicazione o autonomia end-to-end.


### Testo editoriale e repertorio fisico — aggiornamento 23 ottobre 2026

Per nuove generazioni sono obbligatori mood, intensità e intento semantico per clausola. Il writer non nomina pose fisiche; il motore sceglie tra gesto compatibile e quiete. L’AI revisore valuta anche l’appropriatezza espressiva, con digest legato al medesimo score. Le edizioni storiche senza intento mantengono compatibilità.

Palmi uniti e tocco laterale al mento sono ora disponibili con opt-in del rig anatomico. I nuovi render del worker usano un adattatore articolato esplicito (`daily-production-studio.ts`); l’identità grafica approvata resta nel proprio modulo. Il collegamento dei cue emotivi usa tempi misurati e un piano corporeo continuo, senza azzerarsi a ogni frase. Non assegnare questi gesti in funzione di categoria, luogo, parola chiave o indice di notizia. [Dossier e prove mute](cdaily-editorial-acting-20261023.md).

**Riferimento `palms-joined` approvato il 23 ottobre:** [palmi raccolti e inclinati verso il petto](cdaily-palms-chest-20261023.md), confermati con «ok adesso ci siamo». Conservare la convergenza delle punte, l’inclinazione, il sostegno degli avambracci e ingresso/rilascio verificati. Inserire il gesto soltanto quando intento e mood lo rendono appropriato, adattandone i tempi alla frase; il tocco al mento mantiene la versione già apprezzata.
