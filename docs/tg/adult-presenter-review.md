# Daily: cinque direzioni adulte, 18 ottobre 2026

Richiesta: superare il personaggio infantile, confrontare cinque prove con cinque subagent e scegliere autonomamente una presenza adatta a un notiziario. Cinque subagent distinti hanno prodotto e rivisto cinque coppie originali nello stesso motore animato. Le proposte sono visibili nella GUI `/podcast/tg/proposte`; le edizioni usano la scelta finale.

## Decisione editoriale

**03 · Inchiostro / graphic-novel.** È la proposta con la migliore combinazione di volto adulto, identità riconoscibili, leggibilità delle emozioni e coerenza con il TG. Due conduttori diversi per cranio, mascella, occhi, capelli e guardaroba. Non sono ritratti di persone reali.

La valutazione qui sotto è un giudizio visivo interno, non una metrica oggettiva o un test di gradimento del pubblico.

| Proposta | Giudizio | Punti forti | Limite del disegno |
| --- | --- | --- | --- |
| 01 · Ritratto editoriale | 7,5/10 | Volti adulti e morbidi, immediata familiarità | Identità più vicina all'illustrazione generica |
| 02 · Ceramica viva | 7/10 | AI evidente, fronte luminosa e tempie sintetiche | Espressione più clinica e meno calda |
| **03 · Inchiostro** | **8/10** | Piani del volto leggibili, proporzioni adulte, due personalità visive | La recitazione resta un'interpretazione illustrata |
| 04 · Sintesi | 7,3/10 | Cranio sfaccettato e costruzione industriale riconoscibile | Impronta più tecnologica del tono generalista del TG |
| 05 · Stampa | 7/10 | Pulizia e resa delle superfici piane | Linguaggio più da spiegazione illustrata che da conduzione |

La prima tavola non era convincente: stesso torso troppo quadrato, mani piccole, collo quasi invisibile e androidi simili a umani pallidi con capelli metallici. Il rig comune e le teste sono stati rivisti dopo il confronto. Per la coppia scelta sono stati eliminati il caschetto rigido e i tratteggi sulle guance; abiti e silhouette distinguono i due conduttori.

## Motore e regia

- Otto mood: attenzione, curiosità, dubbio, accordo, divertimento, empatia, dissenso e sorpresa. Muscoli di sopracciglia interne/esterne, palpebre superiori/inferiori, guance, angoli delle labbra, pressione labiale e mandibola. Le iridi e le pupille sono rotonde.
- Un'unica superficie per cranio e mascella; nessun secondo naso o mento sovrapposto. Labbra, denti discreti e profondità del cavo orale seguono i visemi e il livello PCM.
- Braccia con ossa fisse 132/120, polsi articolati, quattro dita indipendenti e pollice opposto. Gesti per frase con preparazione, accento, recupero e pause, più ascolto contenuto e battiti indipendenti.
- Le mani in appoggio sono disegnate dopo il banco e conservano una piccola ombra di contatto. Testa, collo, torso e mani hanno proporzioni adulte; il capo controbilancia il torso.
- Mood e gesti si assestano in modo continuo. Silenzio, M/B/P e visema sconosciuto chiudono subito la bocca. Il clock audio fermo mantiene la posa; rewind e seek ricostruiscono lo stato.
- Il verticale con due voci inquadra chi parla con un taglio di camera, mantenendo un volto grande. Il secondo continua a ricevere la propria posa di ascolto. L'orizzontale mostra la coppia. Nessuna dissolvenza sovrappone due facce.
- Le cinque prove usano lo stesso testo italiano preregistrato, senza nuove richieste vocali quando si apre o si configura la GUI.

Il motore rimane canonico in `@conclavia/avatar-kit/characters/robot`; identità Daily, palette, voci e studio sono nell'applicazione. La palette senza `design` conserva il renderer storico. Le altre applicazioni non cambiano personaggio automaticamente.

## Verifica

86 test del kit, 82 test Onboarding, 70 regressioni browser Meeting e build isolate di entrambi i consumer superati, con ulteriori sei regressioni mirate dopo le correzioni finali di coppia, appoggio e margini dei microfoni. Un test del refresh verifica anche la conservazione della cache vocale senza copiare i vecchi video. Le regressioni browser confrontano i pixel del volto: otto mood distinti per ciascuna delle cinque proposte, due identità, chiusura sulle pause/M/B/P, visemi diversi, player, seek deterministici, camera verticale e resa su telefono. Questi controlli individuano errori, ma non misurano da soli la bellezza o il realismo umano.

Le acquisizioni complete sono in `docs/images/daily-studio/adult-review/`. Le voci italiane native e l'audit del copione rimangono quelli documentati in `italian-native-trial.md`: questa iterazione modifica il disegno e il rendering, senza generare un nuovo notiziario o consumare altri crediti TTS. La pubblicazione resta disattivata e i piloti rimangono da revisionare.

Esportazione finale verificata nella GUI locale: IT revisione37, World16, entrambe da revisionare, zero consegne. Tre voci, quattro video90s con play/seek e layout390px controllati senza errori browser o mutazioni. L’audio italiano conserva lo stesso SHA-256 della verifica ASR nativa.
