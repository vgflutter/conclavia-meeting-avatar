# CDaily — palmi e punte delle dita più vicini

23 ottobre 2026. L’utente ha approvato il tocco al mento e chiesto di ridurre il vuoto tra i palmi, soprattutto alle punte delle dita. La revisione riguarda soltanto `palms-joined`; il collegamento al copione editoriale resta quello [già implementato](cdaily-editorial-acting-20261023.md).

**Rifinitura successiva richiesta:** [palmi ancora un poco più raccolti e inclinati verso il petto](cdaily-palms-chest-20261023.md). Le prove locali puntano ora a questa versione; le immagini e i riscontri sotto documentano la revisione precedente.

## Correzione

- Inclinazione convergente dei palmi, al posto dell’apertura a V che allontanava le punte.
- Flessioni individuali calibrate per indice, medio, anulare, mignolo e pollice: le punte arrivano vicine senza accorciare o traslare le dita.
- Il canale pubblico esistente `handsContactGrip` distingue avvicinamento e chiusura finale dei polpastrelli. I polsi si assestano prima dell’ultimo contatto; sul rilascio si ricrea lo spazio prima del recupero delle braccia.
- La previsione della traiettoria libera si attenua durante il contatto, evitando che la mano oltrepassi il bersaglio per inerzia.

Implementazione canonica nelle feature `performance` e `characters/robot` del kit. Nessuna nuova API, regola per argomento, modifica alla grafica o copia dell’anatomia nei consumer.

## Prova breve

- [Figura intera, otto secondi muti](http://127.0.0.1:3107/daily-launch/hand-lab/index.html?pose=editorial-reassure).
- [Dettaglio delle dita, otto secondi muti](http://127.0.0.1:3107/daily-launch/hand-lab/index.html?pose=editorial-reassure&detail=1).
- [MP4 del dettaglio](http://127.0.0.1:3107/daily-launch/hand-lab/hands-editorial-reassure-detail.mp4).

Il pulsante «Espressione» usa il momento di chiusura dei palmi; la posa ravvicinata mantiene tutte le punte nell’inquadratura.

| Prima | Dopo |
| --- | --- |
| ![Palmi precedenti](../images/daily-palms-closer-20261023/before.jpg) | ![Palmi più raccolti](../images/daily-palms-closer-20261023/after.jpg) |

Stesso frame a 2,2 s, stesso crop e stessa scala, dal video a figura intera.

## Verifiche

- Test anatomico esteso a 36 traiettorie: due posture, tre stances, tre mood e 25/50 fps. Controlla tutti i volumi delle falangi durante ingresso/tenuta/rilascio, palmo opposto, ossa fisse e continuità dei polsi. Nella fase chiusa la distanza visibile delle quattro punte resta sotto 2,8 unità del rig e quella tra i riferimenti dei palmi sotto 3,2. Non sono millimetri o misure anatomiche reali.
- Nel riferimento a 2,2 s, separazione proiettata delle punte circa 1,6–1,9 unità del rig. Il [rapporto numerico](cdaily-palms-closer-verification-20261023.json) conserva campione, export e verifiche.
- **Tocco al mento identico:** tutti i 401 campioni di posa e geometria delle mani della prova da otto secondi coincidono con quelli precedenti. SHA-256 `e5557c1e7f09e6360042d2122aa579786070c92837af997ee55d0ef61bd66af4`. Il relativo MP4 non è stato rigenerato.
- [Verifica UI](cdaily-palms-closer-ui-verification-20261023.json): sei layout desktop/mobile, compreso il nuovo dettaglio, senza overflow; esecuzione nel renderer di produzione in portrait e landscape per entrambi i gesti.
- 234 test del kit e 84 test TG superati; 15 integrazioni Mongo non eseguite. Entrambe le build consumer, typecheck, confini delle feature, lint interessato e 23 regressioni browser passano. I 17 elementi dell’identità grafica coincidono con il lock approvato.

Solo prove mute brevi: nessuna voce, ASR, notizia nuova, puntata completa o pubblicazione social generata.
