# CDaily — gesti per significato e labiale più morbido

23 ottobre 2026. Seguito autorizzato dopo l’approvazione delle [basi del formato](cdaily-format-foundation.md). Ambito: movimento, regia e labiale; stessa voce Alex 2, copione, date, studio, font, palette e proporzioni. Nessuna ricerca notizie, registrazione, trascrizione, nuova immagine, pubblicazione o chiamata a provider.

## Risultato e limiti

Il kit implementa `PerformancePhraseSpec.segments` e `variety: 'semantic'`. Un pensiero mantiene il proprio piano e appoggio, ma le famiglie di gesti seguono il mood/intenzione dei singoli cue. La memoria recente penalizza la frequenza delle famiglie per 28 s; conserva alternanza, quiete e recupero. Non è ancora il confronto percettivo completo di traiettorie previsto nel catalogo.

Il preparatore Daily e la regia della presentazione passano ora i sottosegmenti misurati al planner canonico. I piani già presenti nei manifesti approvati non vengono rigenerati implicitamente.

Il robot usa una coarticolazione più morbida: apertura circa 48 ms, riduzione fra forme vocalizzate circa 38 ms, larghezza circa 60 ms e mandibola al 90% dell’escursione precedente. Non si rallenta la voce né si spostano i tempi delle parole. Silenzio, stop esplicito e M/B/P restano immediati. Le forme derivate dal testo rimangono un’approssimazione, non fonemi misurati dal provider.

## Prova sul Daily approvato

Sorgente: `2026-10-23-it-pilot-r3`, media `1876a600e330`, 326,64 s. Revisione di regia: `2026-10-23-it-pilot-r4`. Il manifesto conserva parole, mood, intensità, audio, scene e tempi. Il gesto finale sui commenti e il suo anticipo sono copiati integralmente dall’approvato.

Un solo contatto esplicito nel passaggio sulle precauzioni dopo il terremoto: avvicinamento delle mani, polpastrelli a contatto (`steeple`), breve tenuta e rilascio. Non è un nuovo vincolo palmo–palmo e non viene applicato automaticamente alle tragedie. L’intreccio resta riservato alle scene da seduto; nessun contatto col volto introdotto senza la necessaria prova anatomica.

| Inventario pianificato | Prima | Revisione |
| --- | ---: | ---: |
| Accenti | 91 | 99 |
| `gather` | 24 | 15 |
| `explain` | 15 | 18 |
| `precision` | 15 | 12 |
| Quota delle tre famiglie | 59,34% | 45,45% |
| `compare` / `offer` | 9 / 7 | 14 / 11 |
| `underline` / `open` | 1 / 3 | 8 / 6 |
| `fold-hands` | 0 | 1 |

I numeri descrivono la selezione, non dimostrano da soli più naturalezza. Il giudizio riguarda gesto, contesto, transizioni e quiete. [Inventario e hash della sorgente](../../public/daily-launch/editions/2026-10-23-it-pilot-r4/acting-revision.json).

## Come rivederla

- [Confronto locale prima/dopo](http://127.0.0.1:3107/daily-launch/editions/2026-10-23-it-pilot-r4/review.html): dieci secondi, stesso tratto della registrazione (34–44 s), un solo player con selezione di formato e versione.
- [Nuovo estratto portrait](http://127.0.0.1:3107/daily-launch/editions/2026-10-23-it-pilot-r4/motion-proof-portrait.mp4) e [landscape](http://127.0.0.1:3107/daily-launch/editions/2026-10-23-it-pilot-r4/motion-proof-landscape.mp4), nativi 1080p50.
- [Laboratorio muto delle mani raccolte](http://127.0.0.1:3107/daily-launch/hand-lab/index.html?pose=steeple&wide=1), sei secondi, bocca a riposo.

Il server statico 3118 è stato usato per render e audit locali, poi chiuso. L’anteprima dell’app su 3107 è stata aggiornata alla nuova build verificata e rende disponibile il confronto. Non è un deploy pubblico; i master approvati restano conservati. Questa consegna prepara e controlla il nuovo piano intero ma esporta soltanto gli estratti brevi: non dichiarare rigenerati i due video da 5:27.

## Proprietà e riproduzione

- Planner, memoria e coarticolazione: `@conclavia/avatar-kit/performance`; adattatore della mandibola: `@conclavia/avatar-kit/characters/robot`.
- Selezione editoriale dei contatti, identità e score: app Meeting. Nessuna copia dell’engine nel consumer.
- `node --import tsx scripts/tg/refine-daily-acting.ts` prepara la revisione dal master r3, conservando i materiali sensibili al clock. Non genera né riscrive l’audio.
- `node scripts/tg/build-acting-render.mjs` compila una superficie di prova che usa il renderer e l’identità canonici; nessun Next runtime o provider richiesto.
- Il renderer/audit esistente accetta `TG_RENDER_PATH=/daily-launch/acting-render/index.html` con origine locale. La riproduzione delle prove ha un preroll reale di tre secondi per evitare snap nel primo frame.

## Verifiche concluse

- **231 test kit**, **81 test TG** (15 integrazioni Mongo saltate) e **82 test Onboarding** passano, senza chiamate provider. Le integrazioni saltate non vengono considerate riuscite.
- **23 regressioni browser** passano: otto mood, prese, due posture, dita indipendenti, pause, parole/audio e clock PCM.
- **Build Meeting e Onboarding pass**, TypeScript/lint dei file modificati pass. Confini feature e risoluzione dei consumer verificati; stesso kit canonico, nessuna copia.
- **32.664 frame pianificati**, 16.332 per formato, verificati a 50 fps: zero problemi numerici di posa, mani fuori quadro o testi sul volto. È un audit geometrico, non un giudizio automatico di naturalezza.
- Confronto prima/dopo controllato a **360, 390 e 1440 px**: 12 combinazioni, un solo player, formati corretti, audio attivo e clock fermo in pausa. Screenshot mobile e desktop ispezionati.
- Due nuovi estratti e due ritagli di confronto decodificati integralmente; 10 s e 1080p50 nei due formati. Prova muta: 300 frame, 6 s, nessun audio e bocca a riposo.
- **17 impronte dell’identità visiva** conservate. SHA256 dei due MP4 r3 invariati; audio WAV, testi, riassunto e VTT identici al pilota approvato.

[Gate della consegna](../images/daily-launch/semantic-20261023/delivery-gate.json), [tutti i frame](../images/daily-launch/editions/2026-10-23-it-pilot-r4/all-frame-audit.json), [player](../images/daily-launch/semantic-20261023/comparison-player.json).

La nuova build locale è attiva su 3107. I due master lunghi non sono stati riesportati né pubblicati; la revisione serve a giudicare rapidamente il passo avanti prima di un nuovo export completo.
