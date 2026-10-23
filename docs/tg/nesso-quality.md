# NESSO — qualità dei presentatori e motore Conclavia

Direzione confermata dall’utente il 18 ottobre 2026: NESSO, made by Conclavia, deve sviluppare anche uno o due avatar di riferimento. Il progetto editoriale e la qualità della performance sono entrambi risultati necessari. Il motore ricavato da questo lavoro deve essere riutilizzabile negli altri prodotti Conclavia.

## Due risultati distinti

1. **NESSO:** identità visiva, uno o due personaggi riconoscibili, timbro e modo di parlare, scelta delle notizie, scrittura, esposizione e regia editoriale propri.
2. **Avatar Kit:** labiale, sincronizzazione audio, espressioni, transizioni, sguardo, battiti, postura e gestione dei turni in un’unica implementazione condivisa. Meeting e Onboarding devono poter cambiare carattere e registro senza copiare il renderer o ereditare quello del TG.

Il codice condiviso resta in `conclavia-avatar-kit`. Ricerca delle notizie, policy editoriale, persistenza, revisione, scheduling e pubblicazione restano nell’applicazione. La grafica NESSO non entra nel catalogo degli altri format.

## Priorità: un presentatore eccellente, poi il duo

Si rifinisce prima un presentatore completo nelle due lingue. Il secondo viene introdotto dopo una revisione soddisfacente del primo: deve avere silhouette, voce, ritmo, postura e reazioni propri. Due voci alternate o un disegno duplicato non costituiscono una coppia riuscita.

Il duo serve quando aggiunge una domanda utile, una spiegazione o una transizione naturale. Il TG mantiene un’esposizione chiara: la sovrapposizione competitiva appartiene eventualmente ad altri format di conversazione. Le reazioni d’ascolto non devono suggerire approvazione o dissenso politico rispetto a fatti letti dall’altro.

## Identità del personaggio

Per ogni presentatore si prepara una scheda versionata con: riferimento grafico frontale e a tre quarti; proporzioni e silhouette; palette; forme di occhi, sopracciglia e bocca; mano e pose consentite; voce/provider/modello/parametri; accento; pronunce; velocità e pause; registro lessicale; profilo di intensità e gestualità. L’ID del personaggio resta indipendente dall’ordine in scena e dalla voce scelta.

L’obiettivo è una caricatura editoriale adulta, sobria e riconoscibile, con calore e precisione. I tratti del volto devono appartenere allo stesso disegno. Vietati naso doppio, mento sovrapposto, iridi che escono dalle palpebre, denti fuori dalla bocca e giunzioni che cambiano durante il parlato. L’illustrazione statica della landing non è l’approvazione dell’avatar operativo.

La configurazione ordinaria deve rimanere semplice: preset NESSO, uno o due conduttori, lingua e durata. Parametri anatomici e di regia sono calibrazione del prodotto, non una serie di slider da impostare prima di ogni edizione. Gli altri progetti useranno profili propri sullo stesso motore.

## Regia della frase

Ogni frase mantiene testo, lingua, speaker, mood, intensità e riferimenti editoriali. La performance deve aggiungere tempi effettivi dell’audio, visemi, preparazione, enfasi, recupero e destinatario dello sguardo. Il clock dell’audio governa il labiale; il mood può cambiare sorriso, tensione e postura, ma non aprire la bocca in assenza di segnale.

Le emozioni devono essere leggibili e proporzionate al contenuto. Notizie dolorose richiedono compostezza ed empatia, senza sorrisi o comicità. Dati incerti richiedono chiarezza nell’esposizione: non si trasforma il dubbio in una smorfia caricata. Un risultato positivo può avere un calore misurato, senza entusiasmo automatico su qualsiasi argomento.

L’espressione coinvolge insieme occhi, sopracciglia, guance, labbra, testa e busto. Le transizioni devono accompagnare il senso della frase, non oscillare in un loop. Il silenzio deve avere una posa credibile; M/B/P richiedono chiusura labiale, F/V contatto labbro-denti, O/U un arrotondamento distinto. Entrata in scena, ascolto, cambio interlocutore, interruzione, recupero e fine frase richiedono revisioni dedicate.

## Voce ed esposizione

Le voci correnti restano la base del confronto; nessun provider viene sostituito senza un confronto di ascolto. Si verificano stabilità tra giorni, italiano e inglese, nomi propri, sigle, numeri, valute, date, sibilanti, respiri, attacchi, code, pause e consistenza del volume. Non basta rendere l’avatar sorridente per ottenere una voce più calda: il controllo dell’espressività del TTS è un lavoro distinto e ancora da calibrare.

La scrittura deve essere pronunciabile: una novità alla volta, numeri selezionati, attribuzioni comprensibili e nessuna corsa finale per rientrare nel minutaggio. I tre minuti si ottengono con selezione e riscrittura, non tagliando fatti, fonti o accelerando in modo innaturale.

## Accettazione della qualità

La promozione richiede revisione umana del risultato completo. I test automatici sono necessari, ma non provano la bellezza del volto, la naturalezza o la qualità editoriale.

| Area | Prova da vedere o ascoltare | Criterio di promozione |
| --- | --- | --- |
| Disegno | Tutti i visemi e mood, in silenzio e parlato, frontale/tre quarti | Anatomia coerente, nessuna sovrapposizione o salto visibile |
| Espressioni | Sequenze di notizia neutra, dolorosa, positiva e incerta | Emozione leggibile e pertinente, senza sorrisi fuori contesto |
| Voce | Stesso copione IT/EN con nomi, cifre e pause | Timbro stabile, pronunce corrette, ritmo e intenzione convincenti |
| Sincronismo | Audio e video insieme, inizio, stop, pause, M/B/P e F/V | Nessun ritardo percepibile, bocca chiusa sul silenzio e sulle occlusive |
| Duo | Almeno un minuto con cambi turno e ascolto | Due identità distinte, reazioni misurate, nessuna falsa articolazione |
| Formato | Puntata completa a 16:9 e 9:16 su desktop e telefono | Testo e volto leggibili, titoli non tagliati, composizione curata |
| Robustezza | Seek, replay, stop/ripresa, cambio scena e movimento ridotto | Nessun salto anomalo, vecchia energia audio o animazione bloccata |
| Editoriale | Puntata con fonti e pronunce riviste | Contesto corretto, incertezze dichiarate, esposizione comprensibile |

Ogni candidata conserva clip, copione, tempi, impostazioni e revisione, con problemi espliciti e confronto sulla stessa frase. Prima brevi prove diagnostiche, poi una puntata completa di tre minuti. Un punteggio medio non può compensare un difetto anatomico o una pronuncia errata evidente. Non si dichiara "impeccabile" una candidata sulla base del numero di test superati.

## Stato di questa iterazione

Prima base tecnica, non avatar definitivo: nuova geometria condivisa della bocca con chiusura sul silenzio/M-B-P e forme distinte per vocali/F-V; battiti continui e sfalsati per il duo; regia collegata alla posizione effettiva della frase e reazione del presentatore che ascolta; aspetto esplicito del personaggio rispettato nel renderer TG.

Restano da sviluppare e approvare: design definitivo NESSO, schede dei due personaggi, controllo vocale/prosodico supportato dal TTS, gestualità più ricca e calibrata, regia dello sguardo completa, campionario audiovisivo IT/EN e revisione percettiva delle puntate complete. Nessuna nuova generazione a pagamento, modifica alle voci salvate o promozione dei piloti esistenti è implicata da questa iterazione.

Verifiche della base: 62 test del kit, 31 test TG senza Mongo (9 integrazioni outbox escluse da questa esecuzione), 22 regressioni browser di mood/player/studio/esportazione e una nuova prova Canvas di articolazione. Quest’ultima confronta realmente i pixel della bocca su silenzio, M/B/P, rest, A e U e conserva otto campioni di mood. Chrome usa un unico backend Canvas nella prova, per evitare che il passaggio automatico GPU/CPU alteri l’antialiasing durante i confronti. Superati TypeScript, controllo dei due consumer, lint delle modifiche e build isolate Meeting/Onboarding in `.next-build-nesso`. Nessun deploy applicativo eseguito; i video pilota già presenti non vengono rigenerati o approvati automaticamente.
