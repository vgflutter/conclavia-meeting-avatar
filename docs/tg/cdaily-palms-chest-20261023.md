# CDaily — palmi più raccolti e inclinati verso il petto

23 ottobre 2026. Richiesta: «un filo più vicine e inclinate verso il petto». Segue la [chiusura dei palmi](cdaily-palms-closer-20261023.md); il tocco al mento apprezzato dall’utente è conservato.

**Approvata dall’utente il 23 ottobre 2026:** «ok adesso ci siamo». Questa posa e le transizioni della prova muta diventano il riferimento per `palms-joined` nei nuovi Daily. Export di riferimento: figura intera `27b414a3cfb4`, dettaglio `78c5cc7fd318` (prefissi SHA-256; impronte complete nel rapporto). Conservare vicinanza, inclinazione verso il petto, accompagnamento degli avambracci e rilascio; adattare il clock alla frase reale. Il tocco al mento già approvato resta invariato.

## Rifinitura

I palmi convergono un poco di più e le dita si inclinano all’indietro verso il petto. Il riferimento di contatto sale verso lo sterno e arretra in profondità: accompagnano anche gli avambracci, invece di piegare soltanto i polsi. La superficie e la direzione delle dita condividono lo stesso frame interno del rig.

Restano separati avvicinamento, ultimo assestamento dei polpastrelli e rilascio. Il gesto continua a dipendere da intento semantico, mood compatibile, durata e memoria; nessuna associazione a terremoti o ad altri argomenti. Implementazione nelle feature canoniche `characters/robot` e `performance`, senza nuove API o copie nei consumer. Grafica, voce e repertorio degli altri gesti conservati.

## Rivedere la prova

- [Figura intera, otto secondi muti](http://127.0.0.1:3107/daily-launch/hand-lab/index.html?pose=editorial-reassure&v=palms-chest-20261023).
- [Dettaglio, otto secondi muti](http://127.0.0.1:3107/daily-launch/hand-lab/index.html?pose=editorial-reassure&detail=1&v=palms-chest-20261023).
- [MP4 figura intera](http://127.0.0.1:3107/daily-launch/hand-lab/hands-editorial-reassure.mp4?v=palms-chest-20261023) e [MP4 dettaglio](http://127.0.0.1:3107/daily-launch/hand-lab/hands-editorial-reassure-detail.mp4?v=palms-chest-20261023).

La camera del dettaglio segue il nuovo livello delle mani senza tagliare le punte. Il pulsante «Espressione» mostra la posa raccolta. I file sono prove locali: nessuna puntata completa, registrazione o pubblicazione rigenerata.

| Figura intera | Dettaglio |
| --- | --- |
| ![Posa raccolta verso il petto](../images/daily-palms-chest-20261023/full.jpg) | ![Palmi e punte convergenti](../images/daily-palms-chest-20261023/detail.jpg) |

[Sequenza di ingresso e rilascio](../images/daily-palms-chest-20261023/sequence.jpg), verificata insieme alla posa a 2,25 s. Il contatto non resta incollato durante il recupero.

## Controlli anatomici

- 36 traiettorie: posture `standing`/`desk`, tre stances, tre mood compatibili, 25 e 50 fps. Verificati ingresso, tenuta e rilascio, volumi di tutte le falangi contro dita e palmo opposti, lunghezze fisse 132/120, continuità del frame e silenzio.
- Durante la tenuta, direzione effettiva delle dita rivolta verso il petto in ogni caso verificato (`forward.z < −0,045`). Intervallo misurato circa 3,5–12,6° all’indietro rispetto al piano frontale; nessun aumento dei limiti articolari.
- Nel riferimento in piedi a 2,2 s, le quattro punte hanno separazione proiettata circa 1,5 unità del rig. Non sono millimetri o misure anatomiche reali. Il modello verifica capsule e volumi del rig attuale, non una simulazione fisica generale di ogni possibile gesto.
- Tocco al mento identico nei 401 campioni della prova apprezzata: SHA-256 `e5557c1e7f09e6360042d2122aa579786070c92837af997ee55d0ef61bd66af4`. Il suo MP4 non viene rigenerato.

Riscontri numerici, export e verifiche applicative sono conservati nel [rapporto](cdaily-palms-chest-verification-20261023.json) e nel [controllo UI/renderer](cdaily-palms-chest-ui-verification-20261023.json).

234 test kit e 84 TG passano; 15 integrazioni Mongo restano escluse. Passano typecheck, confini delle feature e dei consumer, lint interessato, build Meeting/Onboarding e 23 regressioni browser. Sei layout del laboratorio, compreso il dettaglio a 390 px, e quattro esecuzioni del renderer reale verificano pausa, silenzio e attivazione dei due gesti in portrait/landscape. I 17 riferimenti grafici e gli SHA-256 dei master r3 coincidono con quelli precedenti.
