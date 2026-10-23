# CDaily — correzione delle falangi attraverso il palmo

22 ottobre 2026. Revisione locale dell'anatomia dell'intreccio. L'immagine
dell'utente documentava un difetto reale: alcune falangi attraversavano
il palmo opposto. La verifica precedente misurava le capsule delle dita
fra loro e lasciava scoperto il volume del palmo.

## Correzione condivisa

L'implementazione rimane in `@conclavia/avatar-kit/characters/robot`.
`interlace-profile.ts` calibra profondità e separazione dei polsi,
flessione delle tre falangi e abduzione distinta per dito. Il ridotto
sfalsamento in profondità permette alle dita di chiudersi oltre il bordo
del palmo opposto. Radici, lunghezze ossee e controller temporale rimangono
vincolati. Ingresso e rilascio conservano il corridoio laterale.

`hand-palm.ts` fornisce le sezioni alla mesh e ad `adultPalmCollider`.
Il controllo comprende palmo, eminenza del pollice e tutta la falange con
il proprio raggio. Un involucro convesso conservativo comprende il piccolo
incavo del polso. Le misure sono effettuate sulla geometria restituita da
`adultPresenterHands`, dopo l'inerzia delle dita. Il renderer mantiene la
profondità per pixel: nessuna maschera copre le punte difettose.

## Materiale da rivedere

- Prova muta di sei secondi: `/daily-launch/hand-lab/index.html?pose=interlace`.
- Player completo: `/daily-launch/revisions/avatar-palm-20261022/index.html`.
- Presentazione: 36,88 secondi, portrait e landscape.
- Chiusura Daily: 7,96 secondi, portrait e landscape; conserva l'indice in basso.
- Confronto precedente nel player: `avatar-clasp-20261022`.

Sono conservati esattamente take Alex 2, parole, cue, mood, coreografie,
scene, font, studio e marchi. Le nuove revisioni hanno cartelle proprie;
i file precedenti restano disponibili. Nessuna nuova sintesi o trascrizione.

## Verifica e limiti

La regressione sull'intreccio percorre tutti i fotogrammi di ingresso,
tenuta e uscita con otto mood e due vitalità. Verifica anche frasi di tre
e nove secondi, intensità diverse e ricostruzione dopo seek. Comprende
test del volume, delle superfici della mesh e di una falange che attraversa
il palmo pur avendo entrambi gli estremi esterni.

La nuova misura riproduce il difetto precedente: minimo **−9,31** unità
di rig. Il segno positivo indica separazione fra superficie del dito e
palmo. La prova finale ha minimo **+2,97**; la presentazione completa
**+1,19**. I valori della prova finale e della presentazione completa sono
salvati in [palm-clearance.json](../images/daily-launch/avatar-palm-20261022/palm-clearance.json).
La presentazione viene controllata su **923 fotogrammi**, compresi i
374 in cui è attivo il canale dell'intreccio. Crop, testi e continuità
sono nel [rapporto del movimento](../images/daily-launch/avatar-palm-20261022/motion-metrics.json).

Le capsule dito/dito restano conservative e conservano la piccola
tolleranza di contatto dei test esistenti. Per il palmo opposto si richiede
clearance non negativa. Questa calibrazione del rig illustrato non è
una simulazione universale di contatto delle mani né un'approvazione
estetica dell'utente.

La verifica dei media controlla i quattro MP4, i master audio invariati,
le durate, i due formati e la conservazione di copione e cue. Le prove
usano file locali e fixture isolate, senza provider a pagamento o
pubblicazione sui social.

Esito finale: **208/208 test kit**, **82/82 test Onboarding**,
**60/60 regressioni browser Meeting**, tre test della direzione promo,
typecheck e lint applicativi, confini delle feature e due build consumer.
Le otto viste del player (contenuto, formato, desktop/mobile) non hanno
overflow o errori. Le tredici impronte dell'identità sono conservate.
I quattro MP4 sono decodificabili integralmente, con master audio identici,
zero clipping e correlazione AAC superiore a 0,9999.

Server di revisione locale: porta **3107**, build `.next-build-avatar-palm`.
Il renderer temporaneo 3110 è stato chiuso. La nuova revisione non è stata
pubblicata sul dominio o sui social.
