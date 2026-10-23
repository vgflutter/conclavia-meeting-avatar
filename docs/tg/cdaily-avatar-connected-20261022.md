# Alex — corpo coordinato e tre prese, 22 ottobre 2026

Richiesta: gesti ancora troppo lenti, spalle e busto troppo immobili, due o tre prese diverse quando le mani si incontrano, compreso l'intreccio. La revisione modifica la recitazione condivisa e la direzione CDaily, conservando voce, copione, mood, timing del parlato e identità visiva.

## Revisione disponibile

- Prova rapida: `http://127.0.0.1:3107/daily-launch/hand-lab/index.html`. Sei secondi per gesto; tre prese selezionabili e indice verso i commenti. Nessun audio o loop automatico.
- Video completi: `http://127.0.0.1:3107/daily-launch/revisions/avatar-connected-20261022/index.html`.
- Presentazione: 36,88 s, portrait e landscape, media `2b5ac11d3dd7`.
- Chiusura Daily: `avatar-connected-closing-20261022`, 7,96 s, nei due formati, media `fcdd0cab9c50`.
- GUI: `/podcast/tg/avatar`, con tutte le espressioni e le tre prese isolate.

Il player offre un video alla volta e conserva il confronto con la precedente `avatar-vivid-20261022`. La presentazione conserva un solo contatto esplicito nel suo copione: le tre varianti si confrontano nel laboratorio e sono disponibili al planner per le edizioni successive.

## Intervento sulla recitazione

L'inviluppo del gesto veniva filtrato prima dal sollevamento del braccio e poi dal controller spaziale; la risposta risultava tardiva anche abbreviando l'attacco pianificato. Il profilo vivace rende più pronti entrambi i passaggi, mantenendo velocità durante il cambio di bersaglio. Il test misura il vero polso all'accento verbale e richiede almeno 25 unità di avanzamento rispetto alla recitazione misurata, oltre a una partecipazione maggiore di clavicola e torace.

La direzione CDaily ora è centralizzata in `src/lib/tg/performance-direction.ts`: `articulated: true`, `vitality: 0.9`, `contactStyles: ['overlap','steeple','interlace']`. È usata da presentazione, produzione dei Daily e preparazione dei piloti. I manifesti già diretti restano congelati e non vengono riscritti durante la riproduzione.

La gabbia toracica si inclina e accompagna il gesto con uno spostamento laterale distinto dal bacino. Spalle, attacchi delle maniche, colletto e collo passano dalla stessa deformazione continua. Sul take completo, lo spostamento assoluto medio delle spalle passa da 1,18 a 2,59 unità del rig; l'inclinazione assoluta media del torace da 0,0061 a 0,0147 rad. Questi valori descrivono questo take, non una misura universale di naturalezza.

Il profilo a vitalità zero conserva i tempi e i limiti precedenti. Quello vivace ammette una traslazione più rapida con velocità/accelerazione limitate; pronazione totale entro ±85°, velocità angolare massima 2,4 rad/s e raccordo conservato. Le soglie per il viaggio delle dita nei test distinguono il profilo rapido dal precedente, mantenendo indipendenti i controlli di rotazione, ossa, velocità, accelerazione, pausa e seek.

## Tre rapporti tra le mani

| Presa | Comportamento |
| --- | --- |
| Sovrapposte (`overlap`) | Una mano raccoglie morbidamente l'altra, con quote e profondità diverse. |
| Polpastrelli (`steeple`) | Quattro coppie di polpastrelli si incontrano; i palmi rimangono separati e i pollici rilassati sotto l'arco. |
| Dita intrecciate (`interlace`) | Le dita entrano in corsie alternate e si sfilano prima di separare le mani. |

![Polpastrelli a contatto](../images/daily-launch/avatar-connected-20261022/contact-steeple.png)

![Mani sovrapposte](../images/daily-launch/avatar-connected-20261022/contact-overlap.png)

![Dita intrecciate](../images/daily-launch/avatar-connected-20261022/contact-interlace.png)

Il contatto dei polpastrelli è risolto in angoli articolari, con correzione della distanza fra le superfici. Le ossa non si allungano e le due mani rimangono mesh separate. L'apertura delle dita prepara il contatto; il rilascio recupera gradualmente il riposo. Il planner può alternare il repertorio fornito dal consumer senza ripetere una variante prima di attraversarlo; una scelta esplicita della frase prevale. Non vengono aggiunte prese dove non c'è un'intenzione `fold-hands`, né ad ogni cambio di mood.

Questa rimane una recitazione illustrata: contatti e occlusione sono una soluzione stilizzata, non una simulazione fisica completa o motion capture.

## Verifica

- 202/202 test kit, inclusi presa dei polpastrelli, alternanza deterministica, ossa costanti, contatto superficiale, pausa, recupero e arrivo del polso sull'accento.
- Dodici gesti e tutte le 56 transizioni dirette fra mood esercitati nei tre profili 0, 0,72 e 0,9; anche la separazione delle capsule nell'intreccio è verificata nel nuovo profilo.
- 82/82 test Onboarding; lint e TypeScript di entrambi i consumer, confini delle feature e risoluzione del kit superati.
- Entrambe le build isolate `.next-build-avatar-connected` completate.
- 60/60 regressioni browser Meeting superate, con soli fixture e Mongo temporaneo. Controlli di avatar, rig, otto mood, streaming/player e tre prese nei due formati; nessun provider a pagamento.
- Tutti i 923 campioni della presentazione controllati: zero overflow/tagli; massimi per frame di polso 8,92 unità, gomito 10,00, articolazioni delle dita 16,51 e orientamento del polso 8,77°. I limiti da soli non costituiscono un'approvazione estetica.
- Cinque prove mute di sei secondi esportate e controllate: gesti liberi, sovrapposizione, polpastrelli, intreccio e indice.
- Quattro MP4 decodificati integralmente; master vocali identici alle sorgenti, correlazione dell'audio AAC superiore a 0,9999 e zero campioni saturi. Le 13 impronte dell'identità coincidono.

Kit sorgenti: `ec8cf06ce072fd567e59e5c5728c04fa4555357bd2cc58d46773eceef8ffe025`. Metriche e report media in `docs/images/daily-launch/avatar-connected-20261022/`. La revisione è locale; nessuna pubblicazione social o modifica dei dati reali.

Player della build attiva sulla porta 3107 verificato in otto combinazioni di contenuto/formato/viewport, compresi caricamento e riproduzione dei veri MP4, pausa ferma e sottotitoli. Nessun overflow, errore browser o mutazione; sorgente della GUI coerente con l'export. Renderer temporaneo 3110 chiuso.

## Riutilizzo senza nuova sintesi vocale

```sh
node --conditions=react-server --import tsx scripts/tg/prepare-avatar-delivery.ts --source=avatar-vivid-20261022 --target=avatar-nuova-revisione --vitality=.9 --replan
TG_AVATAR_REVISIONS=avatar-connected-20261022,avatar-connected-closing-20261022 node scripts/tg/verify-avatar-delivery.mjs
```

Conservare i parametri di export `TG_AVATAR_FINISH=sculpted TG_AVATAR_POSTURE=standing TG_AVATAR_HANDS=anatomical`. Per una sola posa usare il laboratorio, ricompilabile con `npm run tg:preview:hands`: il bundle riceve un identificativo derivato dal contenuto per evitare una vecchia animazione dalla cache.
