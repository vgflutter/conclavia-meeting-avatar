# Alex — gesti più sciolti e mani più piene, 22 ottobre 2026

Richiesta: braccia meno lente, maggiore partecipazione del corpo e mani meno sottili viste di taglio. La revisione conserva voce Alex 2, copione, tempi del parlato, mood, volto, studio, palette, font e marchi della precedente.

## Risultato per la revisione

- Player locale: `http://127.0.0.1:3107/daily-launch/revisions/avatar-vivid-20261022/index.html`.
- Presentazione completa: `avatar-vivid-20261022`, 36,88 s, portrait e landscape.
- Chiusura Daily: `avatar-vivid-closing-20261022`, 7,96 s, portrait e landscape.
- GUI interattiva: `/podcast/tg/avatar`; otto mood, gesti isolati e sincronizzazione audio sullo stesso profilo.
- Le revisioni precedenti restano disponibili dal collegamento di confronto del player.

## Scelta della recitazione

Confrontati il profilo precedente, la variante moderata `vitality: 0.72` e una variante più spinta a 1. Scelta la moderata: i gesti generali arrivano prima, le tenute sono meno sospese e le frasi lunghe possono avere più accenti distinti, senza trasformarsi in un'agitazione continua. Preparazione e recupero dei gesti generali sono circa il 18–21% più brevi rispetto alla pianificazione precedente. Spalle e torace seguono la medesima intenzione; il controller conserva inerzia e raccordi.

L'intreccio e l'indice esplicito verso i commenti conservano tempi dedicati, per non sacrificare contatto e leggibilità. Il piano è deterministico, congelato nel manifesto, e non introduce casualità per fotogramma. Una pausa non cambia posa, nemmeno se nel frattempo viene selezionato un profilo diverso.

`vitality` è una capacità riusabile del modulo `/performance`; risposta e anatomia vivono in `/characters/robot`. Il valore 0,72 è una scelta CDaily. Omissione o zero mantengono il comportamento precedente per gli altri consumer.

## Mano di profilo

Il palmo anatomico passa da 7,85 a 9,65 unità di profondità, circa +23%, con raccordo del carpo e dell'eminenza del pollice. La sezione profonda delle falangi passa da 0,96 a 1,04 raggi, circa +8%. Larghezza frontale, ossa e colori restano invariati: viene corretto il volume che spariva nello scorcio.

![Volume della mano a tre quarti e di taglio](../images/daily-launch/avatar-vivid-20261022/palm-profile.png)

## Riproduzione senza nuove chiamate vocali

```sh
node --conditions=react-server --import tsx scripts/tg/prepare-avatar-delivery.ts --source=avatar-delivery-20261022 --target=avatar-nuova-presentazione --vitality=.72 --replan
node --conditions=react-server --import tsx scripts/tg/prepare-avatar-delivery.ts --source=avatar-closing-20261022 --target=avatar-nuova-chiusura --vitality=.72 --replan
```

Il tool copia il master in cache, ripianifica soltanto la direzione corporea e non sovrascrive una revisione. Per l'export conservare `TG_AVATAR_FINISH=sculpted TG_AVATAR_POSTURE=standing TG_AVATAR_HANDS=anatomical`. Verifica media:

```sh
TG_AVATAR_REVISIONS=avatar-vivid-20261022,avatar-vivid-closing-20261022 node scripts/tg/verify-avatar-delivery.mjs
```

## Verifiche

199/199 test kit, 82/82 test Onboarding, lint e TypeScript, confini delle feature e risoluzione dei consumer superati. Completate entrambe le build isolate `.next-build-avatar-vivid`. Le 43 regressioni browser pertinenti di Meeting sono passate con Mongo temporaneo e provider disabilitati. Le 13 impronte dell'identità coincidono.

Audit di tutti i 923 campioni della presentazione a 25 fps: nessun overflow o taglio; massimo spostamento del polso 7,26 unità/frame, gomito 8,32, articolazione delle dita 13,15; rotazione del frame del polso 8,18°/frame. I test esercitano dodici gesti e 56 transizioni dirette fra gli otto mood sia nel profilo precedente sia in quello nuovo. Queste misure verificano continuità e limiti del take; non certificano equivalenza alla biomeccanica umana.

Tutti e quattro gli MP4 H.264/AAC sono stati decodificati integralmente. Master vocali identici alle sorgenti, correlazione audio esportato superiore a 0,9999, zero campioni saturi. Nessuna nuova sintesi, spesa per provider o pubblicazione social.

Kit sorgenti: `f539178c354235ffa5d34879e491f27b57ee96bcdd821d4b27d64e058c362222`. Report media: `docs/images/daily-launch/avatar-vivid-20261022/media-verification.json`.

Verifica finale del player sulla build attiva `.next-build-avatar-vivid`, porta 3107: otto combinazioni contenuto/formato/viewport (390 e 1280 px), riproduzione dei veri MP4, pausa ferma, sottotitoli e GUI aggiornata. Nessun overflow, errore browser, richiesta esterna o mutazione. Aggiornate anche le tre prove mute di sei secondi del laboratorio con la geometria canonica finale: gesti liberi, intreccio e indice verso il basso. Renderer temporaneo 3110 chiuso.

Versioni media: presentazione `17a0318ab082`, chiusura `5f0aafa8e113`. Immagini del player e report finale nella stessa cartella del report media. Il confronto con la precedente è conservato nel player; la revisione è locale, senza distribuzione ai social.
