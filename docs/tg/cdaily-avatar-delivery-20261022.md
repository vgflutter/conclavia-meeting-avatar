# Alex — revisione completa della recitazione, 22 ottobre 2026

Richiesta: migliorare autonomamente braccia, polsi, dita e raccordi, provare il video intero e reiterare prima della consegna. La base è la presentazione approvata con Alex 2, studio chiaro e identità bloccata. La revisione riguarda il personaggio e i video; non certifica la redazione autonoma/social nel suo insieme.

## File per la revisione

- Player: `http://127.0.0.1:3107/daily-launch/revisions/avatar-delivery-20261022/index.html`.
- Presentazione completa: revisione `avatar-delivery-20261022`, 36,88 s, portrait e landscape.
- Chiusura Daily con commenti: revisione `avatar-closing-20261022`, 7,96 s, portrait e landscape.
- Studio interattivo: `/podcast/tg/avatar`, con tutti gli otto mood e le pose singole.

Il player mostra un solo video alla volta. Seleziona il portrait sul telefono e il landscape su desktop, permette il cambio manuale e offre sottotitoli separati. La chiusura è una seconda scelta del medesimo player, non un secondo video affiancato.

## Iterazioni e scelta

1. **A — raccolta:** dita quiete più raccolte e una cascata distale diversa per mano. Riduce il ventaglio opposto delle dita a riposo.
2. **B — giunti e pensieri interi:** cuscinetti sui giunti flessi invece dei grandi vuoti scuri; un solo gesto può attraversare più mood della medesima frase. Si conservano i clock locali di voce e labiale.
3. **C — abduzione:** aggiunta continuità di velocità/accelerazione al polo del gomito. Da sola non risolveva il passaggio peggiore della sequenza.
4. **D — polo morbido:** saturazione morbida della soluzione IK in piedi, evitando l’accelerazione vicino al bordo del cerchio del gomito. Migliora la transizione, ma il polso sollevato rimaneva troppo vicino alla spalla in profondità.
5. **E — profondità, scelta finale:** la mano sollevata viene avanti rispetto al torace. Il gomito non deve più ripiegarsi dietro il busto per soddisfare lo stesso bersaglio. Conservati ossa, volumi, identità e limiti del polso.

Controllati i 923 campioni della presentazione e i 200 della chiusura a 25 fps, tutte le scene e i cambi, con confronti visivi dei passaggi critici. Fra D ed E, il massimo spostamento del gomito passa da circa 11,15 a 7,00 unità/frame; la massima rotazione del frame del polso da 10,07° a 6,21°/frame. Queste misure descrivono questo take, non sono una garanzia biomeccanica universale.

![Sequenza completa del renderer](../images/daily-launch/avatar-delivery-20261022/renderer-sequence.jpg)

## Regole riutilizzabili

- `performanceWindow` è la capacità condivisa del formato TG per raccordare un pensiero attraverso più cue emotivi. Il testo e la scelta dei raggruppamenti rimangono nel prodotto.
- Il planner articolato riserva una preparazione e un recupero completi; le clausole brevi possono muovere viso, sguardo e postura senza una nuova onda del braccio.
- Un solo intreccio esplicito durante il passaggio sulla redazione AI. Non diventa il riposo di tutte le frasi.
- Il gesto sui commenti usa il centro temporale misurato della parola «commenti» nel take già in cache, con una preparazione più lunga e un recupero morbido.
- Dita indipendenti, gomito accompagnato, polso distinto dalla manica; nessuna rotazione casuale per frame.
- Renderer, anatomia e performance vivono nel kit. Il consumer conserva intenzioni, gruppi, identità e GUI.

## Riproduzione

Per una nuova candidata preservare le revisioni precedenti:

```sh
node --conditions=react-server --import tsx scripts/tg/prepare-avatar-delivery.ts --source=avatar-standing-20261022 --target=avatar-nuova-revisione
```

Il tool accetta solo revisioni pubbliche brevi, copia il master audio in cache e congela il piano nel nuovo manifesto. Non chiama provider, non sovrascrive revisioni e non pubblica sui social. Per l’export usare il renderer esistente con `TG_AVATAR_FINISH=sculpted TG_AVATAR_POSTURE=standing TG_AVATAR_HANDS=anatomical` e una directory candidata `avatar-*` distinta.

Verifica dei quattro file finali: `node scripts/tg/verify-avatar-delivery.mjs`. Il report è `docs/images/daily-launch/avatar-delivery-20261022/media-verification.json`.

## Stato di consegna

La variante E è la scelta per questa direzione illustrata. I master vocali, le parole, i mood, i tempi dei fonemi e le durate sono identici alle sorgenti; cambiano solo le annotazioni del corpo. Conservati anche scene, testi, studio, viso, font, palette e marchi. Video H.264 con audio AAC in entrambi i formati decodificato integralmente, zero campioni saturi; correlazione del master originale con l’audio AAC superiore a 0,9999. Le 13 impronte dell’identità coincidono.

La licenza commerciale della voce rimane nello stato dichiarato dalla sorgente: l’utente aveva scelto di rimandare quel passaggio. La revisione tecnica non cambia i diritti del take. Nessuna nuova sintesi o spesa per provider, nessuna pubblicazione social.

Questa è la presentazione completa e la chiusura riusabile. Il vecchio pilota giornaliero di notizie datato resta un artefatto storico con correzioni editoriali pendenti; non viene ripubblicato come Daily attuale né certificato dalla qualità dell’avatar.


### Ultima rifinitura sul take effettivo

Nel primo export della chiusura, il mood a intensità 0,64 lasciava la pronazione più debole che nella prova lunga a 0,84. L’indice era diretto in basso, ma emergeva poco dalla sagoma del pugno. La candidata finale dà al solo canale esplicito `pointDown` autorità sufficiente sulla presentazione del palmo; gli altri gesti conservano la modulazione emotiva. La chiusura e la prova breve dell’indice sono state rigenerate e osservate di nuovo. Un test dedicato usa una frase di tre secondi, intensità 0,64 e accento misurato: richiede che l’indice rimanga distinto dalle altre dita durante la tenuta.

![Indice finale sul take Daily](../images/daily-launch/avatar-delivery-20261022/actual-closing-final.jpg)

Verifica tecnica: 196/196 test del kit; 82/82 test Onboarding; lint e typecheck; confini delle feature e risoluzione dei consumer; due build isolate completate. La prima suite browser pertinente ha superato 43/43 controlli in 50,4 s, con provider disabilitati e solo MongoDB temporaneo. L’ultima correzione mirata della chiusura riceve anche la riesecuzione dei controlli avatar/player. I master vocali e i 13 asset/impostazioni dell’identità restano invariati. Lo stato dei diritti del take non viene alterato.

Kit sorgenti finale: `e809a4681ccdcdb7cf1258c8c9ec90d4b7f0b28f13f77f47c89912f13158e064`.

Chiusura delle verifiche: 8/8 controlli avatar/player rieseguiti dopo l’ultimo ritocco, superati in 34,4 s. Il player della build definitiva `.next-build-avatar-delivery-final` è stato verificato in otto combinazioni di contenuto/formato/viewport, senza overflow, errori browser o mutazioni. Riproduzione dei file reali, pausa ferma, sottotitoli italiani e collegamenti dello studio coerenti. Renderer temporaneo 3110 chiuso; la revisione rimane disponibile sulla porta 3107, preservando gli altri servizi.

Versioni media finali: presentazione `9ad8870fa647`; chiusura `c885d604a977`. Il controllo di rendering e montaggio è superato per la direzione illustrata scelta. Il lancio sponsorizzato resta distinto dalla chiusura dei diritti della voce e dalla prontezza del backend editoriale/social.
