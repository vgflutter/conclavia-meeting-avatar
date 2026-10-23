# Alex: intreccio opzionale delle dita, 22 ottobre 2026

L’utente trova la rifinitura precedente molto migliore e chiede un intreccio dito per dito e dita vive durante il gesto. Il riposo apprezzato e i gesti liberi restano conservati. Non sono stati rigenerati i video completi della presentazione.

## Prova rapida

- `http://127.0.0.1:3107/daily-launch/hand-lab/index.html?pose=interlace`
- Video muto di sei secondi: `public/daily-launch/hand-lab/hands-interlace.mp4`.
- Il collegamento **Gesti liberi** conserva la prova precedente. Nello studio completo c’è il gesto esplicito **Intreccia le dita**.
- Rigenerazione: `npm run tg:preview:hands`, poi `node scripts/tg/render-hand-motion-preview.mjs --interlace`.

## Direzione e solver

Osservata anche una [fotografia reale di mani intrecciate](https://www.br.de/mediathek/podcast/gesundheitsgespraech/maennersprechstunde/2089133). La foto non viene incorporata negli asset del progetto.

Dieci varianti brevi sono state osservate e misurate. Le prime facevano un nodo di falangi, piegavano le dita al contrario oppure interferivano vicino al pollice durante il rilascio. Sono state scartate. La candidata conserva queste fasi:

1. Le dita si distendono parzialmente mentre i palmi si allineano.
2. Il percorso dei polsi lascia spazio in profondità alle dita ancora aperte.
3. Le singole dita entrano sfalsate nelle corsie dell’altra mano e si raccolgono.
4. Nel rilascio si libera prima il contatto, poi le mani tornano al riposo.

`PerformanceStroke.contact: 'interlace'` è opzionale sul gesto `fold-hands`. Il nuovo `BodyPerformance.handsInterlace` vive nel motore generico, si interpola nel clock media e decade quando una frase successiva lo omette. Non viene scelto casualmente né imposto a tutte le conversazioni. Avatar che non implementano il contatto possono ignorarlo.

Nel kit, `adult-interlace.ts` coordina entrambe le geometrie reali. Il solver articola MCP/PIP/DIP verso il palmo, limita l’abduzione, conserva le lunghezze e usa distanze fra segmenti/capsule per evitare intersezioni profonde. Il DIP segue il PIP. Il passaggio alla soluzione avviene negli angoli articolari con inviluppi diversi per dito; non si interpola una mano intera come un blocco. Pollici e giunti hanno una gestione separata. Le superfici di entrambe le mani condividono la profondità del painter.

La nuova API pubblica `adultPresenterHands` in `/characters/robot` viene usata da pittura, misure del promo e prova rapida, così le regioni riportate corrispondono alle dita effettivamente disegnate. La logica non è copiata nel consumer.

## Limiti e verifica

L’intreccio è morbido e stilizzato, non una simulazione biomeccanica completa dei tessuti. Le capsule conservative ammettono una piccola tolleranza di contatto, inferiore a metà del raggio minimo delle dita; non sono una certificazione di assenza assoluta di ogni compenetrazione fra superfici.

Nella prova finale la massima traslazione di un’articolazione è circa 7,01 unità/frame a 25 fps. Il minimo margine delle capsule nelle fasi attive è circa −0,75 unità, contro compenetrazioni di quasi 7 unità nei tentativi respinti. La regressione controlla anche avvicinamento e rilascio; non solo il fotogramma chiuso. Il test richiede attraversamento della linea mediana per almeno tre dita per mano; il mignolo rimane più esterno.

191 test del kit, typecheck, feature boundaries e risoluzione dei consumer superati. Due build consumer isolate completate; Onboarding: 82 test, lint e typecheck superati. Identità e quattro fotogrammi dei gesti liberi restano invariati pixel per pixel rispetto alla versione appena apprezzata. Video H.264 880×570, 25 fps, sei secondi, senza audio, decodificato interamente. Export misurato in circa tre secondi.

![Sequenza dell’intreccio](../images/daily-avatar-interlace-20261022/contact.jpg)

Chiusura della verifica: 41 regressioni browser pertinenti superate in 39,6 s sul solo MongoDB temporaneo, provider disabilitati. Il player offre dettaglio delle dita e vista ampia dello stesso identico rig; la camera non modifica l’anatomia. Vista ravvicinata scelta come default del nuovo test, conservando la prova libera precedente. GUI locale sul build verificato `.next-build-hand-interlace`. Il video breve definitivo si rigenera in 2,87 s; nessuna pubblicazione social o modifica dei video completi.
