# CDaily — chiusura integrata nel pilota completo

Revisione tecnica del **21 ottobre 2026**, richiesta per inserire nel Daily
l'invito ricorrente ai commenti e alle richieste di approfondimento, con
l'indice rivolto verso il basso. Nuova copia locale:
`public/daily-launch/editions/2026-10-21-it-pilot-r6/`.
Il genitore r4 e la prova isolata della chiusura restano conservati.

## Copione e recitazione

> Scrivici nei commenti cosa vuoi approfondire: partiamo dalle tue domande.
> Meno rumore, più contesto.

Tre segmenti sullo stesso take continuo Alex 2:

| Passaggio | Mood / intensità | Intenzione |
| --- | --- | --- |
| Scrivici nei commenti cosa vuoi approfondire | Curiosità / 0,64 | Preparazione, indice verso il basso sulla parola «commenti», tenuta e recupero |
| Partiamo dalle tue domande | Accordo / 0,55 | Mano che torna all'invito verso il pubblico |
| Meno rumore, più contesto | Accordo / 0,44 | Cenno conclusivo, poi firma |

Testo, gesti, labiale e timestamp provengono dalla prova approvata
`daily-closing-20261021`, versione `0c1a92693589`. Nessuna nuova generazione,
trascrizione o accelerazione vocale. Il claim è seguito dal cartello con
CDaily, marchio Conclavia, invito ai commenti e sito per gli approfondimenti.
L'invito non promette una risposta individuale automatica a ogni commento.

## Montaggio e continuità

Il video mantiene **240 secondi** e le due composizioni originali 9:16 e 16:9.
Riutilizza i fotogrammi codificati del corpo r4 e quelli della chiusura
approvata, ricomposti in un nuovo master H.264/AAC. I fotogrammi del corpo
sono ricodificati, senza cambiare studio, avatar, font, marchi o tempi delle
notizie. Il lock dell'identità resta il riferimento canonico.

Il punto di taglio viene cercato nel PCM, su un confine di fotogramma dentro
una pausa dopo l'ultima parola della notizia: il solo timestamp ASR del vecchio
«Per le fonti…» arrivava dopo l'inizio sonoro effettivo e avrebbe lasciato un
frammento del vecchio finale. Il nuovo taglio elimina quel frammento. Raccordo
di 6 ms per lato nel silenzio, nessun nuovo tappeto musicale. Il volume del
take finale è allineato all'energia della voce nel tratto precedente, con
controllo del picco. Il resto del PCM, incluso il raccordo corretto a 0:14,829,
rimane identico prima della piccola finestra finale.

La firma tiene in silenzio fino a 4:00; non si rallenta il parlato per arrivare
al minutaggio. I cue e gli anchor delle parole ricevono soltanto l'offset
del montaggio. Copione e VTT corrispondono al nuovo finale; il capitolo
«Commenti e approfondimenti» lo rende raggiungibile nel player di prova.

Script ripetibile: `scripts/tg/integrate-daily-closing.py`; rifiuta di
sovrascrivere una revisione esistente. Controllo dei media e fotogrammi:
`scripts/tg/verify-integrated-daily-closing.py`.

## Ambito editoriale

Questa revisione integra **la chiusura**, non è una nuova selezione di notizie.
Il corpo conserva il pilota datato: trasporti, colloqui sull'Ucraina, ricerca
sull'acqua e bollettino Liguria, con le fonti del dossier originario. Restano
da applicare il saluto ampliato e le correzioni della
[linea comune](cdaily-editorial-line.md), compresa l'esclusione del normale
bollettino locale e delle formule «ieri sera» / «seconda storia».
Nessun nuovo controllo di attualità o approvazione editoriale del corpo.

Il riassunto `caption.txt` resta quello del pilota conservato. La prossima
edizione rivista richiede il riassunto completo e verificato previsto dalla
linea comune; questa modifica non presenta il vecchio testo come già conforme.
La pagina di prova segnala esplicitamente questi limiti. Nessuna nuova voce,
chiamata AI, modifica al database, al sito pubblico o ai canali social.

## Verifica

I report della revisione sono in
`docs/images/daily-launch/editions/2026-10-21-it-pilot-r6/`:
`closing-integration.json`, `final-media-proof.json` e `player-proof.json`.
I controlli automatici di integrità audio e riproduzione sono distinti dalla
valutazione editoriale e dal giudizio soggettivo sulla voce.

Esito finale: versione media **`4a851543de9d`**, due master da **240,00 s**,
H.264/AAC 1080 a 25 fps, decodifica integrale riuscita. Nuovo ingresso a
**230,60 s**; «commenti» e apice del gesto a **231,50 s** sul clock misurato.
Il punto PCM scelto ha RMS zero; nel decoded AAC il salto al raccordo è
circa 0,00000043. Il corpo PCM rimane identico fino a 230,594 s; tutte le
parole delle notizie restano uguali. Livello del take finale +3,20 dB, picco
del master non saturo; picco AAC medio dei canali circa 0,839, correlazione
col master 0,999944 in entrambi i formati. La media stereo è esplicita nelle
misure: il downmix mono predefinito alzerebbe di 3 dB una voce dual mono.

Esaminati dodici fotogrammi grandi e due tavole da 26 fotogrammi ciascuna,
comprendenti preparazione, tenuta e recupero dell'indice. Riproduzione reale
verificata a 360, 390 e 1440 px, senza overflow, errori browser, richieste
esterne o MP4 prima del play. Capitolo della chiusura e ultimi tre sottotitoli
verificati contro il clock e il testo del manifesto, nei due formati.

Regressioni editoriali e voce: **31 test superati**, senza provider a pagamento.
Lock visivo: tredici asset/impostazioni corrispondenti. Sintassi Python,
ESLint dei due helper del player e controllo whitespace superati.
Il kit e i runtime dei consumer non sono stati modificati; non sono state
rieseguite build applicative per questa composizione dei media locali.

Pagina locale di revisione:
`http://127.0.0.1:3107/daily-launch/editions/2026-10-21-it-pilot-r6/index.html?v=4a851543de9d`.
Il sito Daily pubblico e la presentazione selezionata restano quelli esistenti.
