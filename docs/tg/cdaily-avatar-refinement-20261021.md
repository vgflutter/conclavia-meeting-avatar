# Alex — rifinitura grafica del 21 ottobre 2026

**Documento storico:** dopo questa rifinitura il primo [confronto anatomico](cdaily-avatar-anatomy-20261021.md) non supera il gate visivo. La successiva [revisione con sei assetti del 22 ottobre](cdaily-avatar-hands-20261022.md) sceglie una nuova posa per la GUI locale. I risultati e i conteggi sotto riguardano la prima rifinitura, non un'approvazione estetica delle mani successive.

Variante richiesta a partire dal ritratto fornito dall'utente: viso minerale chiaro, lineamenti leggibili, calotta metallica sfaccettata, giacca petrolio e dettagli sintetici discreti. È una **candidata da confrontare**, non una sostituzione automatica della presentazione pubblica o della visual lock approvata.

## Risultato consultabile

- GUI: `/podcast/tg/avatar`, voce **Rifinitura Alex** nello Studio TG. Alterna finitura precedente e nuova sullo stesso clock, con gli stessi movimenti e lo stesso take.
- Due composizioni video native, 36,88 secondi: `public/daily-launch/revisions/avatar-sculpted-20261021/portrait.mp4` e `landscape.mp4`.
- Revision media `6fe1dd79f4ff`. Manifest con `avatarFinish: sculpted`, `visualRevisionOnly: true` e sorgente `podcast-brisk-20261021`.
- Voce Alex 2 e PCM identici per SHA-256 al take precedente: nessuna nuova sintesi, allineamento, velocizzazione o chiamata a pagamento.
- [Tavola degli otto mood](../images/daily-avatar-refinement-20261021/moods.png), [portrait](../images/daily-avatar-refinement-20261021/portrait.png), [confronto precedente](../images/daily-avatar-refinement-20261021/original-detail.png) e [nuovo dettaglio](../images/daily-avatar-refinement-20261021/sculpted-detail.png).

## Cambiamenti e limiti

Un solo volto continuo conserva il rig della mandibola; ponte nasale a piani senza la precedente linea a goccia, occhi con sclera sfumata e iridi radiali, sopracciglia rastremate, ombra della calotta proiettata sulla medesima superficie, tempie sintetiche illuminate con misura. Collo più scuro e bande sottili; modellazione della stoffa e della maglia legata alla deformazione del torso; dettagli delle falangi legati alle articolazioni reali. Le dimensioni della testa e le proporzioni adulte approvate restano uguali.

L'illustrazione mantiene una resa 2D con profondità suggerita. Non riproduce la fotografia di riferimento e non certifica movimenti indistinguibili da quelli umani. La posa statica delle mani intrecciate e il microfono della reference non vengono incollati sopra l'animazione: le mani conservano cinque dita e la coreografia articolata esistente. La qualità dei gesti rimane distinta dalla rifinitura dei materiali.

Il test dei mood nella GUI può sovrascrivere intenzionalmente l'espressione e la coreografia visiva, mantenendo l'audio originale per confronto. Non è una nuova interpretazione vocale emotiva della registrazione. I pulsanti sono: Attenzione, Curiosità, Dubbio, Accordo, Divertito, Empatia, Dissenso, Sorpresa; durante la riproduzione il rig interpola tra i mood, in pausa il cambio consente di esaminare l'espressione ferma.

## Implementazione riutilizzabile

Il kit canonico espone l'opzione `RobotPalette.finish: 'sculpted'`, valida per `design: 'hybrid'`. Sorgente `src/features/characters/robot/proposals/hybrid-sculpted.ts`; dettagli facciali condivisi in `adult-face.ts`, corpo in `adult-presenter.ts` e falangi in `adult-hands.ts`. Nessuna copia del renderer nei consumer. I sei design e le impostazioni che omettono la finitura conservano il percorso precedente.

L'identità CDaily rimane in `dailyVideoIdentity`. La prova applica la finitura solo nella sua configurazione; la route di export accetta esplicitamente `?finish=sculpted`. Lo script impedisce di esportare questa candidata nella cartella della presentazione approvata: occorre una revisione separata `revisions/avatar-*`.

```sh
TG_AVATAR_FINISH=sculpted \
TG_RENDER_ORIGIN=http://127.0.0.1:3107 \
TG_LAUNCH_DIR=public/daily-launch/revisions/avatar-sculpted-20261021 \
TG_LAUNCH_QA_DIR=docs/images/daily-launch/revisions/avatar-sculpted-20261021 \
node --conditions=react-server --import tsx scripts/tg/render-launch-promo.ts
```

## Verifiche

- Esame visivo degli otto mood, dettaglio del volto e GUI desktop/mobile; nessun errore browser o richiesta esterna nella cattura.
- 141 test kit e 82 test Onboarding superati; controllo feature, consumer e TypeScript superati.
- 21 regressioni browser Meeting su confronto finiture, otto mood, pausa/clock, avatar, sei stili, due identità, streaming e labiale. Mongo temporaneo esplicito `mongodb://127.0.0.1:27018`, database `conclavia_e2e_*`; AI e provider disattivati.
- Build isolate Meeting e Onboarding superate. Lint dei file applicativi interessati e Onboarding superato.
- Le 13 impronte della visual lock pubblica restano valide: nessun cambio a loghi, font, fondali, palette predefinite o vecchia testa hybrid.
- Export H.264/AAC 25 fps, 1080×1920 e 1920×1080; audio originale conservato.

Questa è una revisione visiva della presentazione. La produzione del Daily giornaliero da cinque minuti e la revisione editoriale del pilota restano attività separate.
