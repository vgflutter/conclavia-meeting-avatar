# Alex — revisione anatomica del polso e delle mani

Documento storico del primo tentativo. La successiva [revisione con sei assetti del 22 ottobre](cdaily-avatar-hands-20261022.md) sceglie una nuova posa per la GUI locale. L'esito sotto riguarda esclusivamente questa prima versione.

Stato finale: **gate visivo non superato; versione precedente ripristinata come default nella GUI**. L'utente aveva autorizzato il ritorno alla base se il miglioramento anatomico non fosse stato convincente. La ricostruzione rimane isolata e sperimentale nel laboratorio; non è stata esportata come nuova presentazione o pubblicata.

## Diagnosi verificata

Il vecchio `wrist` coincideva con fine polsino e origine del palmo. Il frame della mano ereditava soltanto l'angolo XY dell'avambraccio: pitch e pronazione restavano indipendenti dall'osso 3D. Misurando gli assi reali, anziché il solo scalar `deviation`, la piega risultava 42–46° a riposo e 74–91° nella presa. Le regressioni precedenti non coprivano questo errore anatomico.

Anche il disegno aveva un difetto distinto: ordinare interi poligoni per profondità media può dipingere i core scuri sopra gusci realmente più vicini nello stesso pixel. Cambiare i colori del raccordo non risolve né questa occlusione né la catena scheletrica.

## Costruzione separata dalla base

Opzione esplicita `RobotPalette.handStyle: 'anatomical'`. Default e `shell` rimangono disponibili e isolati. Il nuovo `adult-wrist.ts` espone `AdultWristFrame`: base 3D dell'avambraccio con pronazione, base della mano con piega limitata, fine cuffia, articolazione, tallone e origine del palmo. Le ossa del braccio e delle dita conservano le lunghezze esistenti.

La manica termina prima del giunto. Polsino, polso rastremato e palmo appartengono alla stessa coda di profondità. La pronazione riguarda il frame dell'avambraccio; la piega successiva del polso viene misurata e limitata in 3D. Il solver può mantenere un ramo esplicito del gomito per questa variante, evitando il salto quando il target attraversa il piano della spalla. Nessun cambio al ramo storico dei consumer.

## Gate visivo prima dell'export completo

- Appoggio sul piano reale: superficie di palmo e dita entro il bordo, non solo il punto del polso.
- Carpo distinto e continuo durante tutte le mezze rotazioni; niente mano che ruota direttamente sulla manica, cunei vuoti o portelli laterali.
- Una sola apertura a tre quarti, con quattro dita, pollice opposto e uscita delle falangi dalle nocche leggibili.
- Mani raccolte come sovrapposizione semplice: una sul dorso dell'altra, con entrambi i polsi esterni al contatto. Non si promette un intreccio anatomico completo.
- Confronto con la base sullo stesso audio, camera e clock, anche a larghezza mobile. Una still favorevole e i test geometrici non bastano per approvare il movimento.

GUI locale: `http://127.0.0.1:3107/podcast/tg/avatar`. La base precedente è selezionata all'apertura. Le altre due varianti sono sotto **Laboratorio delle mani** e dichiarate scartata/sperimentale; gli stessi controlli dei gesti possono applicarsi alle tre versioni. Nessuna nuova sintesi vocale o chiamata AI. I video pubblici non vengono sostituiti dalla prova.

## Esito del confronto sul movimento

Sono state prodotte nove clip reali di otto secondi a 25 fps: tre gesti nei due formati per `anatomical` e gli stessi tre gesti nella base verticale. Sorgenti e report in `docs/images/daily-avatar-anatomy-20261021/`; replay con `TG_RENDER_ORIGIN=http://127.0.0.1:3107 node scripts/tg/review-avatar-anatomy.mjs`. Le clip sono prove grafiche senza audio, non prodotti da pubblicare.

Il raccordo del polso e l'occlusione delle superfici migliorano. Il risultato complessivo non passa: nell'offerta la proiezione accorcia troppo le dita; nella spiegazione bimanuale i palmi assumono una posa a zampa; il riposo richiede gomiti divaricati e avambracci rigidi. La raccolta semplice è meno caotica, ma questo non compensa la perdita di naturalezza e leggibilità. Non si approva un renderer perché non collide o perché passa i test.

Prima di riprendere questa variante servono gesti ricalibrati nel frame reale, con landmark di palmo e dita e silhouette disegnate intenzionalmente. Un altro trattamento di materiale o di colore non basta. La base precedente resta il riferimento operativo.

## Verifiche tecniche distinte dal gate artistico

- 167 test kit, TypeScript, confini delle feature e risoluzione canonica dei consumer superati. I nove test aggiunti riguardano il frame anatomico e l'occlusione per pixel, non una certificazione estetica.
- Il nuovo `hand-depth.ts` interpola la profondità per pixel: un core nascosto non può più attraversare il guscio per errore dell'ordinamento medio. Buffer limitato a 1024², senza dipendenze DOM o provider. Il painter usa una superficie locale del Canvas solo per la variante anatomica.
- Misure nelle prove reali a 1080: rendering mediano circa 13–15 ms, P95 circa 16–20 ms; sono presenti outlier. Questi dati su questa macchina non certificano prestazioni di qualsiasi telefono. In pausa la GUI conserva il frame, senza ridisegnare le stesse mani a ogni RAF.
- 82 test Onboarding, entrambe le build consumer isolate, lint e typecheck superati. Identità approvata: 13 riferimenti corrispondenti.
- 23 regressioni browser superate: fallback esplicito, mood, gesti, performance, sincronia vocale, streaming e clock di riproduzione. Il controllo conclusivo della GUI conferma la base precedente selezionata e il laboratorio chiuso a 1440 e 390 px, nessun overflow o errore browser, audio esistente in riproduzione. Report: `docs/images/daily-avatar-anatomy-20261021/fallback-ui-report.json`; schermate `fallback-desktop.png` e `fallback-mobile.png` nella stessa cartella. Il controllo audio attende l'effettivo avanzamento del clock dopo il seek; un'attesa fissa di 400 ms era troppo breve per valutarlo.
