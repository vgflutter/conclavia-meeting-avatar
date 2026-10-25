# Italia: durata, ampiezza e registro degli scarti

Decisione del 25 ottobre 2026, successiva al primo collaudo serale. Il profilo `italia-morning-v2` sostituisce le precedenti indicazioni di durata e copertura **per le nuove edizioni**. L'identità video `cdaily-v1`, Alex 2 e la regia approvata restano gli stessi. Snapshot, contatori e giudizi dei giri precedenti non vengono riscritti.

## Soglie

- Obiettivo editoriale: **5–7 minuti** inclusi saluto datato, pausa e chiusura.
- Minimo **6 notizie distinte**, normalmente 6–8; massimo tecnico 9.
- Il master misurato deve durare **almeno 4:30 e meno di 10:00**. Non significa che nove notizie debbano avere lo stesso spazio o arrivare a dieci minuti.
- Stima iniziale: circa 800–1.150 parole. Il filtro locale respinge meno di 780 o più di 1.350 parole; non certifica da solo la durata audio.
- Se il testo è corto, sviluppare contesto riscontrato o cercare altre notizie. Vietati ripetizioni, rallentamenti, musica e silenzi per superare il minimo.

Una prova ridotta di quattro notizie può servire come prova tecnica dichiarata, ma **non soddisfa il formato dell'edizione ordinaria**.

## Ricerca prima della selezione finale

Il problema del primo giro non era dimostrare che in Italia esistessero soltanto quattro notizie: il selettore restituiva già pochi elementi e i successivi filtri riducevano ulteriormente la copertura.

Il nuovo profilo ricerca un bacino di riserva: obiettivo 14 candidate, massimo 18, tutte con una coppia di origini attuali sul medesimo fatto. Poi ricerca web, verifica delle fonti, accorpamento dei duplicati e selezione delle 6–8 migliori. Le candidate corroborate oltre il budget restano **riserve**, non diventano notizie false o vecchie. Se non restano almeno sei notizie solide **non si ferma l’edizione al primo giro**: parte subito la ricerca integrativa descritta sotto, senza abbassare le soglie. Il bacino non è una certificazione e non passa direttamente alla scrittura.

L'Italia comprende politica, giustizia, economia, lavoro, salute, società, cultura, scienza e sport nazionale di rilievo. Non servono una nuova legge o un effetto economico per rendere significativo un risultato sportivo italiano. Nessuna quota obbligatoria, calendario sportivo ordinario o gossip per riempire spazio. Una dichiarazione esperta può essere notizia, purché attribuita: non diventa per questo una previsione certa o una decisione pubblica.

Estero: conseguenze italiane documentate o evento mondiale eccezionalmente importante. Al massimo due eccezioni mondiali e maggioranza stretta di notizie italiane; le ulteriori candidate valide restano in riserva. Tra candidate forti già ammesse, una sezione mancante può avere spazio a scapito di una sezione già molto rappresentata. È ammessa **al massimo una notizia scientifica/sanitaria di conoscenza condivisa**, appena divulgata e ben riscontrata, anche senza un effetto italiano specifico. Deve mantenere popolazione, comparatore e limiti; uno studio congressuale non è una terapia disponibile a tutti. Non inventare un collegamento italiano per ammetterlo.

## Recupero automatico del minimo

Decisione successiva del 25 ottobre: la continuità quotidiana è un requisito operativo. Quattro notizie valide sono materiale da completare, non il motivo per abbandonare immediatamente la puntata.

1. Primo giro: bacino di riserva, verifica e selezione. Se sono almeno sei, proseguire.
2. Se sono meno di sei, **secondo giro immediato nello stesso job**: conservare le candidate valide e cercare soltanto nuovi sviluppi per colmare il deficit, con un margine di riserva. Esempio: quattro valide → mancano due → ricerca integrativa → nuova verifica dell'insieme → almeno sei.
3. Se il secondo non basta, terzo giro automatico più ampio sulle sezioni meno rappresentate. Il bacino locale espone progressivamente fino a 240/480/720 articoli, con massimo 24/48/72 per editore e bilanciamento fra sezioni. Più URL della stessa agenzia restano una sola origine. I feed vengono acquisiti una volta nel ciclo, le ricerche identiche riusano la cache valida.
4. Riscontri e selezione dell'insieme impediscono di contare due volte lo stesso evento. Candidate respinte senza modifiche non vengono riproposte alla ricerca di un sì. Scarti e giudizi precedenti restano nel rapporto.
5. `coverageRecovery` conserva i giri iniziati/completati, le candidate trattenute e i giudizi nel job. Un'interruzione o un cambio di lease riprende il budget salvato; non ricomincia da zero. Una richiesta manuale esplicita di nuova selezione archivia il ciclo precedente in `coverageRecoveryHistory` prima di aprirne uno nuovo; non lo riusa come ricerca fresca. Le candidate parziali non sono salvate come ricerca finale o come notizie trasmesse.
6. Soltanto dopo almeno sei notizie: scrittura completa, titoli/cartelli, sintesi social, A, B e il flag manuale già previsto. Il recupero non autorizza voce, video o pubblicazione.

Tre giri sono un budget operativo, non un permesso di inventare la sesta notizia o di spendere senza limite. Se dopo tutti e tre manca ancora il minimo, il job registra un problema operativo esplicito nella redazione privata; serve una correzione della raccolta. Un errore tecnico di credenziali, quota o provider si propaga subito, senza essere interpretato come poche notizie e senza un ciclo di richieste identiche. Restano la finestra di uscita, la freschezza, le due origini, il focus italiano e i controlli A/B. Non promettere una pubblicazione in presenza di un servizio indisponibile o della conferma manuale mancante.

Il comportamento è comune al worker Mac e al laboratorio privato. Il laboratorio salva la ripresa solo nei propri file, senza registrare prove nell'archivio del pubblicato.

## Criteri separati nel rapporto

1. **Riscontri:** il fatto centrale non è sostenuto da due origini distinte, le fonti parlano di eventi diversi oppure un dettaglio non è verificabile.
2. **Attualità:** manca un nuovo sviluppo nelle ultime 24 ore. Data della pagina e data dell'evento sono cose diverse; ieri può essere ancora nella finestra.
3. **Duplicazione:** stesso evento già pubblicato senza evoluzione oppure due slot della stessa edizione. Un tema importante può tornare con un fatto nuovo verificato.
4. **Rilevanza:** fatto vero e fresco, ma non abbastanza significativo per questa puntata. Questo giudizio non va mascherato come errore fattuale.
5. **Budget:** candidata valida lasciata in riserva per dare il giusto spazio alle altre.

Il controllo delle fonti conserva esito, motivazione e URL. I giudizi negativi precedenti restano disponibili. A verifica poi il testo effettivo, ogni titolo/cartello e la sintesi; B rilegge autonomamente quel medesimo testo e lo score. Il minimo di notizie non può forzare un sì dei verificatori. Nessun audio prima dell'OK manuale sul testo corrente.

## Che cosa è successo nella prova privata del 25 ottobre

Questo è un resoconto diagnostico dei rapporti conservati, non una nuova approvazione delle candidate e non un archivio pubblico di puntate.

| Candidata | Esito e criterio effettivo | Valutazione della regola |
| --- | --- | --- |
| Aggiornamenti dell'inchiesta Siher | Mantenuta al controllo delle fonti; accuse e ipotesi restano attribuite | Coerente |
| Congresso Lega / rielezione Salvini | Mantenuta; distinguere posizione del partito da decisione del governo | Coerente |
| Arresti/cortei collegati | Esclusa come slot ridondante rispetto all'inchiesta | Accorpare lo sviluppo utile; non contare due volte |
| Smentita vaticana sulle cure | Esclusa per minore novità sostanziale rispetto al precedente annuncio sulle cure | La smentita può essere nuova, il contenuto ripreso non lo diventa automaticamente |
| Risultato Antonelli ad Austin | Il rapporto dava riscontri, freschezza e focus italiano positivi, ma escludeva per limitata conseguenza pubblica | **Filtro troppo restrittivo**: lo sport italiano significativo è ammissibile; ricontrollare i fatti e le evoluzioni prima di scrivere |
| Studio oncologico presentato a ESMO | Dopo la chiarificazione sugli estratti RSS, il rapporto dava fatto centrale, coerenza e freschezza positivi; escludeva per assenza di impatto italiano specifico | **Filtro troppo restrittivo**: valutare nella singola eccezione scientifica, mantenendo tutti i limiti e i nuovi controlli |
| Ucraina, vecchio riferimento ai negoziati | Sviluppo diplomatico antecedente alla finestra | Scarto temporale motivato; non riproporlo cambiando il titolo |
| Ucraina, attacchi | Nell'ultimo testo il controllo temporale non riusciva a collocare con sufficiente precisione lo sviluppo nelle ultime 24 ore | Non inventare l'orario e non confondere numeri locali e aggregati; servono prove migliori |
| Voto dei magistrati per il CSM | Mantenuta: apertura del voto come sviluppo, distinta dal precedente calendario e dal successivo voto parlamentare | Coerente; non anticipare risultati |
| Ballottaggio in Brasile | Mantenuta come eccezione mondiale, con apertura delle urne confermata; nessun impatto italiano inventato | Coerente; non anticipare il vincitore |
| Allarme degli economisti sul welfare | Mancava una seconda origine giornalistica indipendente: l'altro testo riprendeva il materiale degli organizzatori | Non spacciare una ripresa del comunicato per riscontro indipendente; la sola assenza di una nuova legge non basterebbe a scartarlo |

Le quattro candidate passate al filtro delle fonti non equivalevano a un copione completo con entrambi i controlli A/B superati. La prova allargata conserva uno spazio privato separato: non scrive nell'archivio dei fatti trasmessi e non esclude quelle notizie dalla raccolta di domani.
