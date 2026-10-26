# CDaily — revisione narrativa del 26 ottobre 2026

Revisione richiesta dall’utente sul generatore e sul revisore B, con confronto reale sulla stessa edizione italiana. Questo documento è interno e non annuncia una pubblicazione.

## Implementazione

- `src/lib/tg/narrative-policy.ts`: criteri comuni per ascolto, contesto documentato, attribuzioni necessarie, personalità di Alex e regia semantica. La proiezione `writingEvidence` esclude dal payload del writer il solo `whyItMatters`, motivazione interna del selettore: fatti, fonti, date e incertezze restano presenti, e A/B conservano la ricerca integrale. Nessuna sequenza obbligatoria accaduto/contesto/conseguenza, previsione o riepilogo finale per notizia.
- `src/lib/tg/agents.ts`: writer consolidato, rimosse istruzioni duplicate e riferimenti all’apertura estesa/quattro notizie. Budget totale esplicito, pesi diversi e nessuna quota narrativa per notizia. B riceve anche il saluto registrato dell’applicazione: il giorno e il nome del mese pronunciati soddisfano la data, senza inventare l’obbligo di anno o giorno della settimana. Mantiene il controllo esaustivo di fatti, date, attribuzioni e score e valuta anche naturalezza, ripetizioni e contesto essenziale nei campi `form`, `coherence`, `coverage` e `delivery` esistenti.
- `src/lib/tg/editorial.ts` e `format.ts`: eliminate indicazioni espositive in conflitto; invariati forma JSON e contratti pubblici, validazione, profili, soglie e vecchi clock archiviati. Cambia la richiesta privata al modello: ogni notizia può usare da uno a otto segmenti (il massimo si riduce quando serve a rispettare il tetto pubblico di 70), senza il precedente minimo di 180 caratteri per segmento. Restano obbligatori tutti gli ID, fonti e campi di regia; profondità e copertura sono controllate sul copione completo.
- `src/lib/podcast/llm-provider.ts`: opzioni JSON per singola chiamata, compatibili con i chiamanti esistenti. Writer Daily usa ragionamento e verbosity `medium`; B e il controllo di attualità di A usano ragionamento `medium` e risposta compatta. Queste chiamate hanno timeout esplicito 240 secondi, entro un massimo ammesso di 300; gli altri chiamanti conservano `low/low` e 120 secondi. Nessun cambio di modello, piano o credenziali.
- `src/lib/tg/script-review.ts`: l’impronta dell’input include i criteri narrativi e le opzioni del revisore realmente usati. I vecchi esiti B richiedono una nuova verifica; il rapporto conserva gli stessi campi/versione. Nessun passaggio aggiunto alla pipeline.
- `src/lib/tg/freshness.ts`: su successiva richiesta dell’utente, ricerca, selezione e revisori condividono il criterio di precisione temporale proporzionata. Data, parte della giornata e cronologia attendibile possono bastare; ora esatta solo quando risolve un dubbio materiale sul limite della finestra o sul precedente pubblicato. Il revisore riceve l’intervallo UTC calcolato localmente e confronta la novità con il nostro archivio trasmesso, non con la semplice presenza del fatto sui giornali del giorno precedente. Un annuncio documentato nella finestra è valutato come annuncio, preservando il futuro del passaggio atteso. Finestre 24/36 ore, indipendenza e duplicati invariati; nessuna eccezione per partito o singola notizia.
- `scripts/tg/editorial-workshop.ts`: le cache di generazione e revisione includono i nuovi criteri e opzioni, così il riuso locale non restituisce una vecchia risposta come nuova verifica. La politica temporale entra anche nell’impronta B.
- `tests/tg/narrative-adapter.test.ts` e `script-review.test.ts`: provider simulati per contratti di writer/score/fonti, chiusura, vecchi esiti e blocchi fattuali/narrativi prima dei media.
- Aggiornati standard editoriale e pagina rapida; il copione e la sintesi controllati vengono consegnati nel dossier datato.

L’algoritmo delle gesture, il renderer, la grafica, il rig, la voce e la configurazione della conferma manuale non sono stati modificati. La revisione dello score prima dell’audio verifica il significato e la continuità testuale, non certifica un’animazione o un labiale non prodotti.

## Metodo di verifica reale

Salvata privatamente la versione precedente di 855 parole con ricerca, score, fonti, rapporti A/B, revisione e contatori. Nessuna sovrascrittura degli esiti storici, conferma fittizia o azzeramento dei tentativi.

La prova è avvenuta sulla stessa scaletta di sei notizie, non su un esempio scelto per far apparire migliore il risultato. I tentativi negativi sono conservati con i loro difetti. Le prime due generazioni (777 e 712 parole) sono state fermate dal filtro di profondità; la seconda conteneva anche una card troncata e sintassi di serializzazione nel parlato. Questi tentativi hanno portato a consolidare il prompt effettivo e a rendere esplicito il budget dell’edizione, senza ridurre le soglie.

Confronto diagnostico separato: B aggiornato ha letto originale e secondo tentativo sulle stesse prove già acquisite. Ha respinto entrambi per rilievi concreti. Sul secondo ha rilevato anche corruzione del testo e della card. Sull’originale non ha bocciato la coerenza narrativa: il solo cambio di istruzioni non dimostra una capacità infallibile di riconoscere testi poco coinvolgenti. L’esito è conservato integralmente, non reinterpretato come un successo narrativo.

La terza generazione (871 parole) ha superato il filtro locale ma è stata respinta da A per interpretazioni non attribuite, tra cui effetti italiani non documentati e la certezza implicita sul mondiale. I tentativi successivi di 758, 691 e 695 parole sono rimasti sotto soglia. Nessuno di questi è stato promosso. Il semplice aumento del target di parole non ha risolto il problema e non è stato mantenuto. È emersa anche l’impostazione globale `low/low` del backend: la prova con override medium ha superato il vecchio timeout, perciò il limite è ora specifico e finito per il Daily. Il timeout è registrato come errore tecnico, mai come giudizio positivo.

Le successive verifiche della versione corrente usano le ricerche e i documenti acquisiti nella stessa revisione, A esaustivo e B separato, senza fornire a B il giudizio di A. Solo dopo entrambi positivi il dossier può tornare in `editorial_ready`, sempre senza ricevuta manuale, audio, rendering o pubblicazione.

## Regressioni

- 205 test Daily superati, zero saltati, inclusi i test MongoDB sul server temporaneo esplicito `127.0.0.1:27018` e un database `conclavia_e2e_*`. La regressione aggiunta ammette una cronologia corroborata del pomeriggio precedente senza ora inventata e continua a rifiutare date vecchie e verdetti negativi; gli adapter A/B ricevono la medesima politica.
- Le suite con fixture condivise sono eseguite con `--test-concurrency=1`: la prima esecuzione concorrente ha causato collisioni/cancellazioni tra le fixture; la ripetizione sequenziale ha eliminato quelle interferenze, senza modificare il codice di produzione per far passare i test.
- 61 test provider/podcast superati con `npm run test:podcast`, con verifiche esplicite sui default invariati, override per chiamata e rifiuto dei timeout fuori limite prima della rete.
- Typecheck ed ESLint sui file modificati superati; `git diff --check` senza errori.
- Identità video: 17 asset/impostazioni approvati corrispondono. Nessuna chiamata vocale o video nei test.

I test simulati provano i contratti e i blocchi, non la qualità della prosa. Il confronto seguente distingue osservazioni editoriali da esiti AI e misura un solo caso reale: non è una garanzia per tutte le prossime edizioni.

## Copione corrente e confronto

Il [copione rivisto](editions/2026-10-26-it-editorial-review.md) conserva sei notizie, apertura con il 26 ottobre e chiusura identiche, due secondi di pausa previsti e puntamento sui commenti. La durata è soltanto stimata, circa cinque minuti; non è stato prodotto un take per misurarla.

| Misura locale | Prima | Dopo |
| --- | ---: | ---: |
| Parole del parlato | 855 | 809 |
| Notizie | 6 | 6 |
| Clausole dello score | 29 | 27 |
| Parole della sintesi social | 162 | 113 |
| Caratteri della sintesi social | 973 | 704 |
| Occorrenze di sei formule campionate | 7 | 0 |

Il campione cerca `il fatto confermato`, `in sintesi`, `il punto nuovo`, `quello che sappiamo stamattina`, `quindi il quadro`, `qui il punto`. È una misura descrittiva di questo confronto, non un nuovo filtro lessicale o una prova semantica di qualità. Le parole sono contate separando gli spazi; non sono durate audio.

| Passaggio | Prima | Dopo | Vantaggio osservato |
| --- | --- | --- | --- |
| Giustizia | «Quindi stamattina i due piani da tenere distinti sono questi…» | «Che cosa significa convalida? È il controllo del giudice sul fermo e sulle condizioni previste dalla legge per disporlo.» | Spiegazione di un termine indispensabile, mantenendo la distinzione dall’accertamento della colpevolezza. |
| Politica | «Sul fronte politico, il fatto confermato è che…» e chiusura «In sintesi…» | «Nella Lega, Matteo Salvini riparte dalla riconferma a segretario…»; le tensioni sono attribuite direttamente a Repubblica. | Il fatto e l’interpretazione restano distinti senza una lezione sulle procedure di verifica. |
| Formula 1 | «Quindi il quadro è semplice: Antonelli ha fatto un altro passo enorme…» | «La vittoria di una gara e il titolo mondiale sono due risultati diversi. Il campionato si decide con i punti raccolti durante la stagione…» | Contesto per chi segue poco lo sport, al posto di un giudizio enfatico e di un riepilogo. |
| Editoria | «Qui il punto è non correre troppo…» | «Opa è l’acronimo di offerta pubblica di acquisto: un’offerta rivolta agli azionisti per comprare le loro azioni alle condizioni indicate.» | Il gergo viene spiegato e la fase preliminare resta esplicita senza chiudere con una ricapitolazione. |

Il confronto reale B a ragionamento medium ha respinto il testo precedente anche per la sequenza sistematica di mini-riassunti, citando cinque passaggi concreti. Ha dato `coherence: true` alla rifinitura, ma ha continuato a bloccare difetti fattuali: prima un’attribuzione troppo ampia ad Adnkronos, poi dati ufficiali Formula 1 non collegati ai `sourceIds` delle clausole. Entrambi i rilievi sono stati corretti concretamente: ridotto il dettaglio a quello sostenuto dall’agenzia e acquisito l’articolo primario con il metadato originale `2026-10-25T22:56:39.955Z`, collegandolo a fatti, storia e frasi.

Il successivo confronto diagnostico sulle stesse due copie ha invece promosso entrambe, inclusa la coerenza dell’originale. Il riconoscimento AI della ripetitività non è quindi riproducibile in modo affidabile su questo campione: conserviamo entrambi gli esiti, senza scegliere il solo confronto favorevole. La riduzione delle formule e gli esempi sopra sono osservazioni verificabili del testo; un verdetto narrativo soggettivo resta distinto dalla verifica fattuale e non dimostra una qualità autonoma garantita.

## Esiti e limiti del giro reale

**Esito corrente: A e B positivi sulla stessa versione di 809 parole, stato `editorial_ready`, revisione 71.** A ha verificato 47 target complessivi, incluse 22 clausole fattuali, e tutte le sei notizie per attualità e novità. B ha letto separatamente tutte le 27 clausole con score e prove: `coherence`, `impartiality`, `opening`, `closing` e `coverage` positivi. Il dossier riporta orari, hash, fonti ed esiti correnti. Nessuna conferma manuale è stata rilasciata. La revisione testuale non riapre la finestra automatica mattutina né autorizza un’uscita tardiva o la ridatazione al giorno successivo.

Il dubbio temporale sulla Lega è stato colmato acquisendo resoconti originali del pomeriggio del 25 ottobre: corpo e metadati, non soltanto la data di un articolo ripubblicato il 26. Su richiesta dell’utente il criterio comune ora richiede precisione proporzionata: non l’ora esatta di ogni voto. Nell’esito corrente il congresso è ammesso come evento del pomeriggio precedente. Non esiste una deroga per la Lega o per altri soggetti politici.

Le prove intermedie hanno mostrato contraddizioni dei revisori, conservate integralmente. A chiedeva ancora un atto giudiziario completato benché il testo raccontasse la richiesta attesa; B ha anche dichiarato assente il mese pur citando «ventisei ottobre». Il solo primo chiarimento della policy non era bastato. Sono stati resi espliciti l’intervallo UTC calcolato localmente, il confronto con il nostro archivio trasmesso, l’ammissibilità di un annuncio recente come annuncio e il saluto registrato dell’applicazione. Il controllo di attualità ora usa ragionamento medium con timeout finito. Il nuovo A ha ammesso il caso Siher nella forma attesa, senza certificare un deposito o una decisione già avvenuti; il nuovo B ha riconosciuto il saluto completo. Gli esiti negativi precedenti non sono stati cancellati o sostituiti retroattivamente. Le ripetizioni sono seguite a correzioni concrete di istruzioni, prove o provenienza e a un recupero tecnico registrato, non a un ciclo automatico fino al primo sì.

I timeout del monitor MongoDB hanno interrotto due passaggi di verifica. Il collegamento è stato ricontrollato sul database esistente, senza creare database o cambiare configurazione. Nel recupero conclusivo i revisori hanno lavorato sullo snapshot esatto, salvando i propri esiti privatamente prima del nuovo accesso al database. Il salvataggio finale ha richiesto la stessa revisione, nessun lease concorrente e l’archivio pubblicato invariato. Questo è il recupero della sessione richiesta, non un nuovo stadio installato nella pipeline.

**Limite osservato del writer:** le nuove istruzioni, i segmenti più liberi e l’override medium non hanno garantito da soli il raggiungimento delle 780 parole. L’ultima generazione grezza era di 700 parole. Il testo di 809 parole comprende una rifinitura editoriale dell’agente in questa sessione, basata sulle prove acquisite; non è presentato come output autonomo grezzo del writer. La rifinitura non è un nuovo stadio installato nella pipeline: il ciclo ordinario conserva il suo budget di correzione e si ferma se non supera profondità/A/B. Non abbiamo quindi dimostrato una produzione autonoma affidabile al primo tentativo. Questa è una limitazione reale, non risolta abbassando soglie o riempiendo il parlato.

Sono conservati tutti i tentativi, i giudizi e i contatori: due tentativi worker e quindici correzioni registrate, senza reset. Il pacchetto non ha conferma manuale, manifest audio/video, asset prodotti o pubblicazione; l’archivio delle notizie trasmesse non è stato modificato.

## Riferimenti tecnici consultati

La [documentazione ufficiale OpenAI sul deployment](https://developers.openai.com/api/docs/guides/deployment-checklist) distingue verbosity e completezza della risposta; la [pagina del modello GPT-5.4](https://developers.openai.com/api/docs/models/gpt-5.4) documenta il supporto a reasoning effort medium. Questi parametri sono un controllo della generazione, non una prova che la scrittura migliori: la prova resta il copione effettivo con i suoi controlli. È stata applicata la skill OpenAI Docs per verificare questa modifica dell’adapter, senza cambiare modello.
