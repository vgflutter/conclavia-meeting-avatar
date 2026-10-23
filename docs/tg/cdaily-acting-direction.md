# CDaily — direzione di mood e gesti

Revisione del **23 ottobre 2026**, dopo l’approvazione del pilota Italia r3 e la richiesta di maggiore varietà. La specifica iniziale era documentale; gli aggiornamenti operativi sotto distinguono le capacità ora implementate dalle proposte. I video approvati restano conservati.

**Seguito operativo dello stesso giorno:** [regia per sottosegmenti e labiale più morbido](cdaily-acting-semantic-20261023.md). Implementati uso dei mood dei singoli passaggi, memoria delle famiglie e coarticolazione; provata una raccolta a polpastrelli nel sisma. Il testo sotto conserva la specifica iniziale e il suo inventario. Aggiornamento successivo: [score editoriale, palmi uniti e mento](cdaily-editorial-acting-20261023.md). Questi due gesti sono ora implementati nel rig anatomico e verificati in prove mute; guancia e tempia restano proposte. I master r3 non vengono sostituiti.

La [base del Daily](cdaily-format-foundation.md) conserva formato e identità. Il [catalogo condiviso](../../../conclavia-avatar-kit/docs/performance-repertoire.md) elenca tutti gli otto mood, le tredici intenzioni, i quindici gesti e i tre contatti oggi disponibili, oltre alle estensioni candidate.

**Correzione dei palmi:** [chiusura più raccolta e nuova prova ravvicinata](cdaily-palms-closer-20261023.md). Il tocco al mento apprezzato dall’utente resta invariato.

**Palmi approvati il 23 ottobre:** [leggermente più vicini e inclinati verso il petto](cdaily-palms-chest-20261023.md), accompagnati dagli avambracci. Conferma dell’utente: «ok adesso ci siamo». Riutilizzare questa posa e le transizioni nei prossimi Daily, con scelta semantica e durata commisurata alla frase. Il laboratorio usa il riferimento approvato; i master r3 e la posa approvata del mento restano conservati.

## 1. Perché il pilota può sembrare ripetitivo

Lettura del manifesto congelato `2026-10-23-it-pilot-r3`, media `1876a600e330`. Le coreografie condivise tra più cue sono contate una sola volta tramite la loro `key`; i numeri riguardano **accenti pianificati**, non una misura percettiva o il numero di gesti distinti che uno spettatore riconosce.

[Inventario ricavato dal manifesto](editions/2026-10-23-it-pilot-r3/acting-inventory.json), con hash della sorgente e conteggi per mood, intenzione e famiglia.

| Misura | Risultato |
| --- | ---: |
| Durata | 326,64 s |
| Cue emotivi | 23 |
| Coreografie uniche | 15 |
| Accenti pianificati | 91 |
| `gather` | 24 |
| `explain` / `precision` | 15 / 15 |
| `reflect` / `compare` | 9 / 9 |
| `offer` / `reassure` | 7 / 7 |
| `open` / `underline` / `point-down` | 3 / 1 / 1 |
| Richieste esplicite `fold-hands` | 0 |

Tre famiglie raccolgono **54 accenti su 91, circa il 59%**. La mano principale è già distribuita: 38 accenti a sinistra, 41 a destra e 12 bilaterali. Aumentare soltanto il numero di azioni o invertirne la mano lascerebbe gran parte della somiglianza.

I cue usano `attention` 8 volte, `curiosity` 7, `agreement` 4 ed `empathy` 4. Questa selezione è compatibile con il carattere delle notizie: non serve aggiungere allegria, sorpresa o disaccordo per spuntare tutte le emozioni.

Il preparatore conserva una sola coreografia per `thought`, ma oggi usa mood, intensità e intenzione del **primo cue** del gruppo per pianificare il corpo. I cue successivi mantengono il proprio mood per la resa espressiva, senza essere ripianificati come nuove intenzioni corporee. Questo è un limite concreto da affrontare conservando la continuità, invece di riavviare un gesto a ogni cambio emotivo.

Infine `contactStyles` permette di scegliere tra prese quando il copione richiede `fold-hands`; il pilota non lo richiede mai. Inserire il nome di una presa tra le opzioni non basta a farla apparire.

## 2. Criterio di regia

Partire dal **significato del passaggio**, scegliere l’atteggiamento emotivo appropriato, poi decidere se un gesto aggiunge qualcosa. Volto, sguardo, busto e mano devono sembrare parti della stessa intenzione.

- Introdurre, spiegare, confrontare, riconoscere un limite, riassumere e invitare hanno gesti diversi.
- Un cambio emotivo può essere raccontato soprattutto da sguardo, collo e spalle; non richiede sempre una nuova azione delle mani.
- Un pensiero mantiene il movimento già iniziato. L’energia e l’atteggiamento possono cambiare gradualmente durante il recupero o prima del successivo accento.
- Dare contrasto tra presenza quieta, gesto piccolo e apertura più evidente. Un’ampiezza costante rende simili anche gesti diversi.
- Niente oscillazione periodica del busto, palmi che si aprono a ogni frase o dita che continuano a muoversi senza uno scopo.
- Le pause sono vive: respiro, minimo assestamento, occhi presenti e recupero delle mani. Non una posa congelata né un’altra animazione continua vistosa.

## 3. Mood e impiego nelle notizie

La tabella è una direzione **CDaily**, non una regola universale dell’engine. Le intensità sono da calibrare nel laboratorio e sul parlato reale, senza assegnare lo stesso valore a tutto.

| Mood | Quando usarlo | Corpo e gesto candidati | Controllo editoriale |
| --- | --- | --- | --- |
| `attention` | Fatto principale, dato o conseguenza | Sguardo presente, torace composto, spiegazione o precisione; mani quiete tra gli accenti | Non trasformare tutta la puntata in una successione di accenti uguali. |
| `curiosity` | Domanda utile e spiegazione di un meccanismo | Piccola inclinazione, mano offerta, confronto o riflessione | Non sorridere soltanto perché viene fatta una domanda. |
| `doubt` | Dato provvisorio, limite o ipotesi da distinguere | Minima asimmetria, mano raccolta, breve sospensione; tocco al mento opzionale con intenzione `reflect` e capacità dichiarata | Il dubbio riguarda l’informazione esplicitamente incerta, non una persona o uno schieramento per scelta scenica. |
| `agreement` | Benvenuto, riconoscimento, raccordo con il pubblico | Lieve cenno, piccolo `acknowledge` o offerta | Non far sembrare che il presentatore approvi una scelta politica raccontata. |
| `empathy` | Persone coinvolte, difficoltà e temi delicati | Torace leggermente partecipe, spalle morbide, rassicurazione o raccolta delle mani | Niente sorriso automatico, drammatizzazione o mimica di lutto ripetuta. |
| `disagreement` | Una contraddizione documentata o una distinzione da chiarire | Confronto misurato, accento piccolo, ritorno composto | Non mimare disapprovazione politica o accusare con il dito. |
| `surprise` | Sviluppo realmente inatteso e verificato | Breve apertura di sguardo e postura, una sola reazione | Non è il preset obbligatorio di ogni titolo o numero grande. |
| `amusement` | Passaggio leggero pertinente, cultura o ironia del testo | Sorriso contenuto e gesto piccolo | Escludere nei passaggi su danni, vittime, malattia o sofferenza. |

Gravità, calma e interesse si ottengono usando e dosando le capacità presenti. Non aggiungere al JSON mood inventati che il motore non riconosce.

## 4. Mani unite e contatti con il volto

| Proposta | Decisione di regia | Stato tecnico |
| --- | --- | --- |
| Una mano accompagna l’altra | Buona pausa di sintesi, da alternare ai gesti aperti | `fold-hands` con `overlap` esiste; va richiesto e provato nel passaggio scelto. |
| Punte delle dita unite | Può dare un momento di attenzione o conclusione | `fold-hands` con `steeple` esiste; nessuna pressione dei palmi implicita. |
| Mani «in preghiera» | Esplorare **palmi uniti bassi**, breve raccolta davanti al torace, senza inchino o supplica | `palms-joined` implementato con vero orientamento contrapposto, distinto da `steeple`. Selezione opzionale da `reassure` e mood compatibile, mai da tragedia o tema religioso. |
| Dita intrecciate | Mantenere la posa raccolta gradita dall’utente nello scenario opportuno | `interlace` esiste; per CDaily resta **solo da seduto**. |
| Dito o mano sul lato del mento | Può accompagnare una vera riflessione breve | `chin-touch` implementato e verificato in prove mute: indice al lato del mento, segue la testa. Candidato occasionale per `reflect`, non un gesto obbligatorio. |
| Mano alla tempia o guancia | Candidata secondaria, da valutare dopo il mento | Non introdurla come tic, segno di esasperazione o reazione politica. Manca un contatto dedicato verificato. |

I contatti con il volto possono dare carattere, ma hanno una soglia di qualità alta: la mano deve raggiungere il punto giusto mentre la testa si muove, avere un polso credibile e uscire senza attraversare guancia, collo, giacca o accessori. Se non sono convincenti si mantiene una riflessione già supportata, senza tocco simulato.

## 5. Scelta dei gesti e memoria della ripetizione

Il flusso implementato segue questi passaggi; il confronto completo della somiglianza delle traiettorie resta un obiettivo successivo:

1. Individuare i cambi di significato all’interno del pensiero: fatto → spiegazione → limite → conseguenza, quando presenti nel testo.
2. Assegnare a ciascun passaggio mood e intensità coerenti, senza una nuova emozione obbligatoria per frase.
3. Scegliere tra gesto e quiete. Conservare i gesti richiesti esplicitamente, come la firma sui commenti.
4. Filtrare per postura, spazio, capacità anatomiche e azione già in corso.
5. Penalizzare la somiglianza recente considerando **famiglia, mano, palmo, traiettoria, ampiezza, presa e atteggiamento del torso**. La memoria degli ultimi due ID di gesto è una base insufficiente per misurare tutto questo.
6. Privilegiare un accento utile su una parola o un concetto. La variazione deterministica risolve soltanto scelte già ammissibili; non decide a caso il tono della notizia.
7. Conservare preparazione, accento, tenuta e recupero. Se manca spazio, ridurre o omettere l’accento, senza interrompere una posa a metà.

Nel laboratorio si possono confrontare finestre iniziali di memoria di circa 20–35 s e quiete di 2–5 s. Sono **ipotesi da provare**, non regole già implementate né quote temporali da imporre al video. È ammessa la ripetizione funzionale di una firma; non serve impedire sempre lo stesso gesto anche quando è quello giusto.

Esempio schematico, senza nuove affermazioni di cronaca:

| Passaggio dello stesso pensiero | Mood | Regia possibile |
| --- | --- | --- |
| Annuncio del fatto | Attenzione | Un gesto di spiegazione; spalle e collo lo anticipano. |
| Spiegazione delle conseguenze | Curiosità | Recupero della prima mano, piccolo cambio di busto, offerta con l’altra. |
| Limite ancora da chiarire | Dubbio contenuto | Mani più raccolte, lieve inclinazione, un breve momento quieto. |
| Sintesi utile al pubblico | Attenzione più distesa | `steeple` breve se c’è tempo per entrare e uscire; altrimenti mani rilassate. |

Questa sequenza non va incollata a ogni notizia. Serve a provare continuità e varietà; il testo reale può richiedere una successione diversa o meno gesti.

## 6. Prima migliorare l’uso del repertorio, poi ampliarlo

| Priorità | Lavoro | Criterio di riuscita |
| --- | --- | --- |
| P0 | Usare meglio quiete, famiglie esistenti e cambi corporei dei sottosegmenti, senza riavviare la coreografia | Più intenzioni riconoscibili e passaggi continui, senza aumentare automaticamente il numero di movimenti. |
| P1 | Integrare `overlap` e `steeple` nei passaggi di sintesi; provare varianti piccole di conclusione e confronto | Prese leggibili, ingressi e rilasci fluidi; niente raccolta identica dopo ogni frase. |
| P2 | Vero contatto palmo–palmo basso e contatto laterale col mento | Anatomia e contatto stabili in movimento, sia di fronte sia di tre quarti. |
| P3 | Conteggio delle dita, piccoli passaggi sequenziali, tempia/guancia e altre candidate del catalogo | Entrano soltanto le capacità che aggiungono chiarezza e passano il laboratorio. |

La configurazione deve restare semplice: un profilo naturale come base, con variazioni editoriali calcolate dall’AI. Un eventuale profilo «più espressivo» può cambiare contrasto e varietà, senza obbligare a configurare ogni dito o asse corporeo. Questi profili sono una proposta, non nuove opzioni già aggiunte alla GUI.

## 7. Protocollo di prova senza audio

Prima di un altro Daily completo:

- Brevi prove mute di **6–10 s**, stesso Alex e studio approvati, vista ampia e dettaglio. Non richiedere TTS, trascrizioni o nuove immagini.
- Separare: gesti esistenti ben collegati; `overlap` e `steeple`; vero palmo–palmo; contatto col mento. Non fare dipendere tutto da un solo filmato lungo.
- Usare un clock locale dichiarato, labbra a riposo e mood visibili. I tempi del laboratorio non sono falsi tempi ASR e non si trasferiscono automaticamente al parlato finale.
- Provare almeno due intensità, partenza da riposi diversi, passaggio ad altra posa, pausa/seek e ritorno. Intreccio valutato da seduto.
- Controllare sequenza, non soltanto posa centrale: mani piene di taglio, dita indipendenti, polso, gomito, spalla e busto coerenti; niente attraversamenti o cambi di lato.
- Rivedere in portrait e landscape, includendo la leggibilità a 360–390 px. Un gesto corretto in dettaglio può essere illeggibile nel quadro intero.

Il confronto finale è con il pilota approvato: la nuova regia deve aggiungere naturalezza e varietà senza distrarre dal racconto. La prova completa con il parlato torna utile dopo aver approvato le azioni brevi.

## 8. Responsabilità e stato della consegna

Le capacità riutilizzabili e la loro futura memoria/continuità appartengono a `performance` nel kit; anatomia e contatti a `characters/robot`. La scelta di quali gesti usare nel TG, il tono delle notizie e le frequenze editoriali restano nel consumer. Estendere contratti, test e manifesto della feature quando si implementa davvero una nuova capacità; mantenere i consumer sottili.

In questa consegna sono stati ispezionati codice e manifesto, scritto l’inventario e fissate le priorità. **Non sono state implementate o animate le nuove pose**; nessun master, audio, profilo runtime o pubblicazione è cambiato.

Verifiche documentali: collegamenti locali dei tre nuovi documenti validi, inventario corrispondente ai contratti attuali, hash dei due MP4 approvati invariati. `npm run check:features` passa. Nessuna modifica runtime: non sono state avviate build o chiamate provider come test di questi documenti.
