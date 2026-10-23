# CDaily — raccordo audio del pilota e apertura più ampia

Riesame del **21 ottobre 2026**, successivo ai rilievi editoriali sul pilota r3.
Questa è una **copia tecnica per verificare l'audio**, non una nuova edizione
approvata. Contenuti e selezione delle notizie devono ancora essere riscritti
secondo la [linea comune](cdaily-editorial-line.md), compresa l'esclusione del
bollettino Liguria. Nessuna nuova raccolta di notizie o verifica di attualità.

## Rumore segnalato e causa

L'utente indica «secondo 00:14 appena parte la prima notizia». Il punto di
montaggio è a **14,829375 s**, fra il sommario e «La prima notizia arriva dai
trasporti». R3 rimuoveva il vecchio «Partiamo.» concatenando direttamente due
campioni non raccordati. Il salto misura circa **0,4013** nel PCM vocale mono;
la conversione del mix lo attenua ma lascia un transiente, presente anche negli
AAC dei due MP4. Non era clipping: il conteggio dei campioni saturi è zero.

## Correzione isolata

- Genitore conservato: `2026-10-21-it-pilot-r3`, versione `e707d625a41c`.
- Nuova copia: `2026-10-21-it-pilot-r4`, versione **`0fc4eaf0d9d4`**.
- Raccordo a coseno rialzato di **6 ms per lato**, su una finestra totale di
  12 ms, senza aggiungere o togliere campioni.
- Master PCM invariato fuori da 14,823375–14,835375 s; stesso intervento sulla
  copia privata della voce. Nessun denoiser su tutta la registrazione.
- Parole, cue, scene, date, take, velocità e sottotitoli invariati.
- Flussi video copiati: hash del bitstream identici ai precedenti. Nuovo AAC
  dal master corretto per entrambi i formati; durata ancora **240,00 s**.
- Nessuna chiamata TTS/ASR/AI, nessun worker o invio social.

Nel decoded AAC il salto sul punto passa da circa **0,2045 a 0,000153**, con lo
stesso risultato nei due formati. La misura dimostra il raccordo del transiente;
la conferma percettiva del punto segnalato resta all'ascolto.

Script ripetibile senza sovrascrivere il genitore:
`scripts/tg/repair-daily-pilot-splice.py`. Report:
[prova tecnica](../images/daily-launch/editions/2026-10-21-it-pilot-r4/audio-repair-proof.json).
La pagina di prova è etichettata esplicitamente come revisione audio.

## Apertura: regola per i prossimi montaggi

Budget iniziale **18 s**, intervallo **18–20 s**, incluso nei quattro minuti.
Breve saluto, una frase per orientare, due o tre anticipazioni reali e raccordo
alla prima notizia. La voce mantiene il ritmo agile; niente silenzi o musica
aggiuntivi. Si ridistribuiscono i secondi del corpo, senza allungare il Daily.
La scrittura riserva ora circa 45 parole a orientamento e passaggi, oltre al
saluto apposto dal server, anziché il precedente budget di 25.

Esempio di sola struttura, da completare con fatti verificati:

> Ciao, questo è Conclavia Daily. Quattro minuti per capire le notizie che
> contano. [Due o tre anticipazioni]. [Ingresso nella prima notizia].

Istruzioni degli agenti, linea comune, guida video e scaletta sono aggiornate.
**Questa copia r4 conserva ancora l'apertura vocale precedente**: non simula
parole nuove con pause o ricomposizioni artificiali. La nuova apertura entra nel
prossimo take con il copione rivisto; non è stata registrata in questa correzione.

## Verifiche

Decodifica completa dei due MP4, hash del video, durata esatta e controllo del
PCM fuori dalla finestra superati. Player verificato a 360, 390 e 1440 px:
portrait/landscape, capitoli, sottotitoli separati, nessun MP4 prima del play,
nessun errore browser o richiesta esterna. Nessuna modifica al kit condiviso.

Suite TG: 73 test superati, 15 integrazioni Mongo non eseguite; TypeScript,
ESLint sui moduli aggiornati, sintassi Python e controlli di non sovrascrittura
superati. Il test del player è stato ripetuto sulla pagina finale etichettata
come prova audio. Questi controlli non costituiscono una nuova approvazione
editoriale del vecchio pilota.
