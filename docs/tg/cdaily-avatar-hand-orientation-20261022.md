# Alex — direzione naturale di mani e avambracci

## Problema e obiettivo

La revisione delle sei posture migliorava riposo, dita e continuità del polso, ma l'utente rileva ancora mani quasi sempre orizzontali anche nei gesti. Un sistema può rispettare le lunghezze anatomiche e non avere scatti, pur mantenendo una recitazione ripetitiva. I test precedenti non certificavano una varietà di orientamenti adeguata.

L'obiettivo di questa revisione è dare a ogni azione una direzione leggibile: offrire, distinguere due concetti, precisare, riflettere e indicare non devono condividere la stessa mano frontale. Riposo, raccolta, identità visiva, studio, voce Alex 2, copione e clock restano i riferimenti precedenti. Il risultato deve essere rivisto in movimento; una posa migliore isolata non basta.

## Struttura riutilizzabile

Le intenzioni appartengono alla feature condivisa `performance`, non alla policy editoriale del Daily. Quattro canali facoltativi esprimono obiettivi normalizzati: `palmUp` (palmo verso l'alto), `palmIn` (verso il centro del corpo), `palmForward` (verso l'interlocutore) e `fingerUp` (asse delle dita in salita). Sono indipendenti dalla sagoma specifica di Alex; il rig determina come realizzarli.

Il gesto segue preparazione, trasferimento, accento, assestamento e ritorno nel tempo della frase. La preparazione anticipa la rotazione; un apice sostenuto si assesta invece di diventare un fermo immagine. La variazione è deterministica nel clock del parlato: niente rumore casuale a ogni fotogramma e niente loop perpetuo indipendente dal discorso. Le due mani possono avere compiti diversi nello stesso confronto.

Il rig seduto applica l'obiettivo alla catena completa: traiettoria del polso, soluzione del gomito, pronazione dell'avambraccio, oscillazione limitata del polso, palmo e dita. Il polso rifinisce la direzione raggiunta dal braccio; non deve compensare un avambraccio inadatto con una piega eccessiva. Il frame spaziale viene trasportato dal piano di flessione del gomito; i casi di direzioni quasi parallele e gli attraversamenti angolari devono evitare inversioni improvvise.

La candidata V5 mantiene un ramo di rotazione continuo per ogni famiglia di intenzioni e combina gli obiettivi con salienze quadratiche: un accenno secondario non deve contro-ruotare l'offerta principale. La rotazione semantica usa direttamente l'inviluppo della frase, senza moltiplicarlo per una seconda soglia di sollevamento del braccio. Quel doppio filtro accumulava una rotazione rapida durante il rientro e lasciava un'indicazione bassa soltanto a metà della pronazione. L'offerta può quindi preparare il palmo prima del distacco dal tavolo; la raccolta attenua l'autorità semantica fino a conservare la posa di contatto.

L'offerta usa un obiettivo obliquo di tre quarti, non un palmo piatto frontale. Il gomito ha una modesta abduzione aggiuntiva e il polso segue una traiettoria più bassa: questa combinazione lascia lunghezza proiettata all'avambraccio e rende leggibili dita e palmo. L'indicazione in basso ha un orientamento proprio e un indice distinguibile dalle altre dita raccolte.

Le sorgenti canoniche sono nel kit: `src/features/performance/hand-orientation.ts`, contratti/coreografia/engine della stessa feature, `src/features/characters/robot/adult-desk.ts` e `adult-wrist.ts`. I consumer usano gli ingressi pubblici esistenti. La costruzione della mano e la coda di profondità rimangono condivise; nessuna copia del renderer viene introdotta nell'applicazione.

## Criteri di accettazione

- Offerta, precisazione e presentazione frontale devono produrre orientamenti spaziali distinti, oltre a etichette diverse nel campione del motore.
- I gesti vanno valutati dalla partenza al rientro: trasferimenti, apice, assestamento e contatto finale con il banco.
- La variazione deve coinvolgere anche l'avambraccio, con un raccordo continuo tra manica, polso e palmo.
- Nessuno scatto quando cambiano mood, gesto o frase; il medesimo clock in pausa conserva tutti i canali.
- Le mani restano leggibili nei due formati, senza trasformare ogni offerta in un palmo di arresto rivolto alla camera o in quattro dita viste soltanto di taglio.
- Ossa di lunghezza fissa, assi ortonormali, determinante corretto per entrambi i lati e limiti del polso conservati. Le soglie preesistenti di continuità e permanenza sul banco non si allentano per far passare una nuova posa.
- Riposo e raccolta precedenti restano utilizzabili; una richiesta di orientamento nulla conserva il percorso di compatibilità.

## Cinque iterazioni effettive

I contatti dei sei gesti per ciascuna candidata sono conservati in `docs/images/daily-avatar-hand-orientation-20261022/study-v1/` fino a `study-v5/`. Il registro `study-report.json` riporta nove fasi per gesto, dal riposo al recupero, campionate in sequenza dal renderer reale a 25 fps.

| Candidata | Cambiamento | Giudizio |
| --- | --- | --- |
| V1 | Intenzioni semantiche con i precedenti limiti di rotazione e una prima traiettoria del braccio | Respinta: offerta ancora verticale e di taglio. |
| V2 | Polso offerto più basso e target verso l'interno | Respinta: avambraccio di nuovo quasi orizzontale, dita scorciate. |
| V3 | Target diagonale, rami angolari continui e salienza morbida | Traiettoria migliore, silhouette troppo sottile e dita sovrapposte. |
| V4 | Obiettivo del palmo verso l'alto di tre quarti nel frame spaziale reale | Più superficie leggibile, ma non ancora il rapporto giusto fra profondità e posa frontale. |
| V5 | Abduzione del gomito adatta all'azione, autorità diretta dell'inviluppo, indicazione in basso leggibile | Scelta per la revisione dei filmati completi. |

I contatti delle candidate intermedie spiegano la scelta; le prove complete finali usano il codice definitivo con il limite di deviazione composto corretto.

## Verifiche tecniche

Baseline prima del cambiamento: 171 test del kit e typecheck, feature boundaries e consumer resolution superati; 82 test Onboarding, lint e typecheck superati. Tredici impronte dell'identità grafica invariate. Questi risultati descrivono la compatibilità iniziale, non l'approvazione artistica della nuova recitazione.

La candidata V5 congelata supera **182 test del kit**, typecheck, confini delle feature e risoluzione canonica dei consumer. Gli undici controlli aggiunti verificano intenzioni temporizzate, orientamenti realmente diversi, assi/determinante e limiti del polso, raccordi fra famiglie e singolarità, compatibilità a canali nulli, una posa completa della scena e l'indice diretto in basso. Uno di questi controlli intercetta la somma di deviazione ordinaria e obiettivo semantico: il limite di 15° viene applicato anche alla loro composizione, prima del cono finale. Le verifiche dell'intera scena impediscono che un piccolo scheletro di test corretto nasconda un target del braccio inadeguato nel renderer reale.

Negli otto mood e nei 56 cambi, la massima rotazione del frame rilevata è circa **16,53° per 40 ms**, con spostamento articolare massimo **14,664 unità**: entro le soglie preesistenti di 22,5° e 16. Ossa, appoggi e test di continuità non hanno soglie indebolite. Questi limiti contrastano scatti e inversioni, non dimostrano da soli naturalezza umana.

Onboarding: **82 test, lint, typecheck e build isolata `.next-build-verify` superati** sulla candidata V5 finale. Meeting: **23 regressioni browser superate**, comprese le nuove prove di otto mood attraverso il planner articolato della GUI, le mani nei due formati, il clock in pausa, i gesti bimanuali e il player PCM/streaming. La finestra delle regressioni è separata da ogni acquisizione grafica. I test browser usano esclusivamente MongoDB temporaneo `mongodb://127.0.0.1:27018` e un database `conclavia_e2e_*`, con provider e pubblicazione disabilitati. ESLint della GUI, dei render/capture script modificati e delle regressioni superato; tredici impronte dell'identità grafica corrispondenti. **Build Meeting isolata `.next-build-hand-motion3108` superata**, inclusa la verifica TypeScript di Next.

Il primo tentativo della build Meeting rimaneva fermo nella compilazione Turbopack dentro il sandbox. Verificati comando, directory di lavoro e lock `.next-build-hand-motion3108/lock`, sono stati fermati soltanto i due processi di quel tentativo e ripetuta la stessa build con l'accesso locale necessario: completata senza modificare il codice per aggirare un errore. I server applicativi e il database reale non sono stati toccati dalla verifica.

Log della revisione locale: `/tmp/cdaily-hand-motion-kit-tests.log`, `/tmp/cdaily-hand-motion-kit-typecheck.log`, `/tmp/cdaily-hand-motion-features.log`, `/tmp/cdaily-hand-motion-consumers.log`, `/tmp/cdaily-hand-motion-onboarding-*.log`, `/tmp/cdaily-hand-motion-meeting-build.log`, `/tmp/cdaily-hand-motion-meeting-lint.log` e `/tmp/cdaily-hand-motion-browser.log`. Impronta delle sorgenti del kit verificate: `b08d2827ddfd18bbe1461caca086f70e7b83430e0fddc54dba0d31bafcb94798`.

Questa revisione è locale. Le prove riusano l'audio già conservato e non autorizzano automaticamente la sostituzione dei video pubblici, la pubblicazione social o nuove chiamate a provider vocali.

## Attivazione locale verificata

La build verificata `.next-build-hand-motion3108` è attiva sulla porta **3107**, con processo in background. Il browser ha aperto `/podcast/tg/avatar?v=153a6a05a9bd`, verificato la nuova directory audio, la selezione anatomica e un gesto reale con `palmUp` 0,913; nessun errore o richiesta esterna osservata. Entrambi i nuovi MP4 rispondono HTTP 200 con supporto alle richieste parziali. Report: `docs/images/daily-avatar-hand-orientation-20261022/final-production-smoke.json`.

La GUI offre anche precisione, riflessione, apertura e puntamento, oltre al confronto e alla raccolta. Le otto prove di mood usano il planner articolato condiviso, così verificano la direzione di volto e corpo con lo stesso engine invece di ricadere nel vecchio percorso di animazione. La presentazione conserva gesti generalmente piccoli e composti; le prove isolate mostrano più chiaramente la nuova varietà di orientamenti.

## Filmati e revisione visiva finale

Le dodici prove finali in `docs/images/daily-avatar-hand-orientation-20261022/motion-final/` mostrano offerta, confronto, precisione, riflessione, indice in basso e raccolta in portrait e landscape. Sono 2.400 frame complessivi, otto secondi per filmato a 25 fps. Il report registra zero errori browser e zero richieste esterne bloccate. Il replay è `node scripts/tg/review-avatar-hands.mjs`, con il percorso di uscita della revisione; il vecchio comando di anatomia rimane un alias sottile.

La presentazione completa è in `public/daily-launch/revisions/avatar-hand-orientation-20261022/`: revisione **153a6a05a9bd**, **36,88 secondi**, H.264/AAC a 25 fps, portrait 1080×1920 e landscape 1920×1080. Entrambi i filmati decodificano integralmente. Il master ha la stessa impronta della sorgente precedente e l'AAC decodificato coincide campione per campione con il precedente: nessuna nuova sintesi o variazione del parlato. Il report è `final-media-report.json`.

La GUI è stata verificata a 1.440 e 390 px: nessun overflow, errore o chiamata esterna; il clock dell'audio avanza a 9,123 secondi. `final-gui-report.json` e le due schermate conservano il risultato. La GUI espone le sei azioni con gli stessi obiettivi usati dal renderer, oltre al percorso dei mood.

La [revisione artistica indipendente](../images/daily-avatar-hand-orientation-20261022/art-review.md) seleziona V5: il difetto delle mani sempre sullo stesso piano è visibilmente ridotto, con polsi continui e gesti distinti nei due formati. Sono stati controllati i dodici clip ogni 250 ms e i due master completi a intervalli di un secondo, approfondendo a 250 ms il passaggio a due presentatori. Nei campioni non emerge un nuovo difetto materiale che richieda un ritorno alla base.

Restano limiti illustrati: dita che si sovrappongono quando il palmo è molto obliquo, confronto ancora composto e formale, raccolta stilizzata anziché intreccio fisico completo. Il copione della presentazione usa soprattutto piccoli gesti vicini al banco: le sei prove isolate rendono la nuova direzione più evidente del montaggio reale. Il risultato è consegnato per la revisione dell'utente, senza dichiararlo indistinguibile da una recitazione umana o già approvato per la produzione.
