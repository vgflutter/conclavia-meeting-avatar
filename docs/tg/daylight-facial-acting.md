# Daily: volto chiaro e studio diurno

La richiesta del 18 ottobre riguarda la leggibilità dei piccoli movimenti del
volto e un tono visivo più chiaro, adulto e giornalistico. Il precedente monitor
scuro e la stanza prugna/ambra sono sostituiti nella prova vocale, nello Studio,
nel renderer delle edizioni e nei successivi export.

## Personaggio e regia

- Superficie avorio continua, con tratti petrolio, iridi verdi e labbra distinte.
  Tempie e collo mantengono l'identità robotica. Non c'è una seconda piastra del
  mento; la mandibola deforma lo stesso contorno e segue solo l'articolazione.
- Sopracciglia indipendenti, palpebra inferiore, piega superiore, guance e angoli
  delle labbra reagiscono al mood. Un accento finito della frase anima anche il
  viso, separatamente da testa, busto e mani. Le transizioni si assestano senza
  scatti. Pausa, seek e preferenza di movimento ridotto restano rispettati.
- Studio diurno in pietra chiara, rovere e vetro, con luce neutra. Palette del
  conduttore blu/petrolio; seconda conduzione salvia. Il marchio approvato resta
  nei tracciati originali e nei suoi colori.
- Nel verticale il conduttore è più vicino. Il titolo breve ha una zona distinta
  sopra il volto e i sottotitoli una zona inferiore. Tolta l'etichetta ridondante
  “In primo piano”. Il contesto esteso resta nel formato orizzontale, senza
  duplicare un secondo blocco di testo piccolo sul video mobile.

## Proprietà e limiti

Geometria, muscoli facciali, timing e composizione sono canonici nel kit;
identità, palette e fondali sono di Daily nell'app. Le vecchie proprietà delle
palette restano compatibili. Le tre prove vocali già generate vengono riusate;
questa revisione non sceglie una nuova voce per le edizioni già prodotte.

È una recitazione stilizzata in 2D, non motion capture umana. Il labiale segue
l'audio PCM e fonemi approssimati; non viene presentato come allineamento esatto.
Le prime prove devono essere valutate in movimento e con audio, non soltanto
attraverso un fermo immagine favorevole.

## Asset

I nuovi fondali sono `public/daily-studio/studio-landscape-v2.png` e
`public/daily-studio/studio-portrait-v2.png`. Generati con image_gen integrato;
prompt e provenienza in [daylight-studio-prompts.txt](daylight-studio-prompts.txt).
Font e licenze OFL precedenti sono preservati. Il logo diurno è
`public/daily-studio/conclavia-logo.svg`, copiato dal file approvato.

## Controlli richiesti

Oltre ai test di articolazione, seek, ascolto, mani e transizioni, i controlli sui
pixel verificano che la fronte sia effettivamente chiara e che gli otto mood
cambino occhi/sopracciglia/guance anche escludendo bocca, silhouette e rotazione.
Il test del verticale misura viso e testo alla scala di un telefono di 390 px.
Build e regressioni di entrambi i consumer restano obbligatorie, senza provider
a pagamento nei test. Le puntate di prova rimangono in revisione editoriale.
