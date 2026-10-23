# CDaily: indice in alto

23 ottobre 2026. Aggiunta richiesta dall’utente dopo il riscontro positivo sulla presentazione in piedi.

## Gesto

Un avambraccio sale vicino alla spalla; l’indice si distende verso l’alto, le altre dita si raccolgono in modo distinto e il pollice resta rilassato. Spalla e busto accompagnano l’accento. Segue una breve tenuta e un rientro continuo alla posa raccolta. La mano di supporto resta indipendente. Il dito non copre il volto.

Uso editoriale: sottolineare un punto importante, ad esempio la parola “importante” in «C’è un dato importante». Impostare `intent: 'point-up'` e, quando disponibile, il centro temporale della parola in `accents`; non inserirlo come loop o associazione automatica a un mood. Il gesto è neutro rispetto all’identità dell’avatar e alla linea editoriale del prodotto.

## Prova

- Laboratorio: `http://127.0.0.1:3107/daily-launch/hand-lab/index.html?pose=point-up`.
- Figura intera: stesso URL con `&wide=1`.
- MP4: `hands-point-up.mp4` e `hands-point-up-wide.mp4` nella stessa cartella; sei secondi, 50 fps, 880 × 570, senza audio.
- GUI: `/podcast/tg/avatar` → Prova le pose delle mani → **Indice in alto**.

La presentazione completa approvata, `avatar-standing-word-20261023`, resta identica. La prova serve a valutare questo gesto aggiuntivo prima di usarlo in un nuovo copione.

## Implementazione condivisa

`point-up` è esportato dai tipi e dal vocabolario pubblico `/performance`. Il canale opzionale `HandPerformance.pointUp` guida la catena completa; il target non viene ottenuto piegando soltanto il polso. Nessun nuovo provider, audio o clock. Posizione, velocità e falangi usano i controller canonici del kit; omettere il canale preserva gli altri gesti. Il gesto funziona su entrambe le mani, seduto e in piedi, e viene adattato anche ai rig articolati condivisi.

Preparazione, accento, tenuta e rilascio sono finiti e seguono il clock della frase. Pause e cambi di frase non introducono un secondo timer. Le dita mantengono la lunghezza e i limiti esistenti; il puntamento rispetta il cono del polso. La politica di utilizzo CDaily rimane nel consumer; il motore non incorpora nomi di format o contenuti delle notizie.

## Verifica

Prove geometriche su otto mood, entrambe le mani e le due posture: indice realmente rivolto in alto e distinguibile dalle altre dita, ossa fisse, continuità, ritorno e pausa. Test dedicati sul planner esplicito e sul rilascio del canale quando una frase successiva lo omette. I bersagli dei gesti precedenti non acquisiscono `pointUp`.

224 test del kit passati. Quattro nuovi casi browser passati: composizione portrait/landscape, prova breve mobile e direzione verso l’alto sui rig maschile/femminile. 56 regressioni esistenti di avatar/player passate, 82 test Onboarding passati, cinque test di regia passati. Entrambe le build dei consumer, lint/typecheck e feature boundaries passati; le 13 impronte dell’identità approvata sono invariate. Gli hash dei due master della presentazione sono identici alla consegna precedente.

[Figura intera](../images/daily-launch/avatar-point-up-20261023/point-up-wide.png) · [Dettaglio](../images/daily-launch/avatar-point-up-20261023/point-up-detail.png).

Verifica del server finale: GUI disponibile sulla porta 3107 con la build `.next-build-avatar-point-up-release-20261023`; comando «Indice in alto» funzionante. Riprodotto il MP4 a figura intera per tutti i sei secondi, zero fotogrammi persi, errori browser o richieste di scrittura. [Report locale](../images/daily-launch/avatar-point-up-20261023/live-report.json) · [Prova nello studio](../images/daily-launch/avatar-point-up-20261023/studio-point-up.jpg).
