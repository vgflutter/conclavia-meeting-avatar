# Daily · espressioni e transizioni

La GUI locale espone `/podcast/tg/espressioni`, raggiungibile dalla navigazione dello Studio TG. Il viso usa il renderer canonico del kit e la palette Daily approvata; non esiste un secondo motore di animazione nel consumer.

## Espressioni

- **Attenzione**: Sguardo aperto, sopracciglia distese, bocca rilassata.
- **Curiosità**: Sopracciglia asimmetriche, occhi più aperti, testa inclinata.
- **Dubbio**: Un sopracciglio sollevato, palpebre raccolte, labbra più tese.
- **Accordo**: Sorriso contenuto, guance sollevate e sguardo morbido.
- **Divertito**: Sorriso più ampio, guance attive e occhi leggermente socchiusi.
- **Empatia**: Parte interna delle sopracciglia sollevata e sguardo più basso.
- **Dissenso**: Sopracciglia ravvicinate, occhi più stretti e labbra compresse.
- **Sorpresa**: Sopracciglia alte, occhi aperti e lieve arretramento della testa.
- **Ascolto neutro**: Intensità emotiva azzerata, bocca chiusa e piccoli movimenti di presenza.

L’ascolto neutro è un ingresso di prova con intensità zero, non un nono mood generato dall’AI. Gli otto mood rimangono quelli del contratto del motore. Il labiale resta chiuso perché la prova non riproduce audio. Il collegamento alla prova di conduzione permette di vedere gli stessi volti sul parlato esistente.

## Elenco completo

56 passaggi diretti tra gli otto mood e 16 da/verso l’ascolto: 72 per volto, 144 considerando Riccardo e Sofia. I passaggi nello stesso stato sono esclusi.

### Da Attenzione

- Attenzione → Curiosità
- Attenzione → Dubbio
- Attenzione → Accordo
- Attenzione → Divertito
- Attenzione → Empatia
- Attenzione → Dissenso
- Attenzione → Sorpresa
- Attenzione → Ascolto neutro

### Da Curiosità

- Curiosità → Attenzione
- Curiosità → Dubbio
- Curiosità → Accordo
- Curiosità → Divertito
- Curiosità → Empatia
- Curiosità → Dissenso
- Curiosità → Sorpresa
- Curiosità → Ascolto neutro

### Da Dubbio

- Dubbio → Attenzione
- Dubbio → Curiosità
- Dubbio → Accordo
- Dubbio → Divertito
- Dubbio → Empatia
- Dubbio → Dissenso
- Dubbio → Sorpresa
- Dubbio → Ascolto neutro

### Da Accordo

- Accordo → Attenzione
- Accordo → Curiosità
- Accordo → Dubbio
- Accordo → Divertito
- Accordo → Empatia
- Accordo → Dissenso
- Accordo → Sorpresa
- Accordo → Ascolto neutro

### Da Divertito

- Divertito → Attenzione
- Divertito → Curiosità
- Divertito → Dubbio
- Divertito → Accordo
- Divertito → Empatia
- Divertito → Dissenso
- Divertito → Sorpresa
- Divertito → Ascolto neutro

### Da Empatia

- Empatia → Attenzione
- Empatia → Curiosità
- Empatia → Dubbio
- Empatia → Accordo
- Empatia → Divertito
- Empatia → Dissenso
- Empatia → Sorpresa
- Empatia → Ascolto neutro

### Da Dissenso

- Dissenso → Attenzione
- Dissenso → Curiosità
- Dissenso → Dubbio
- Dissenso → Accordo
- Dissenso → Divertito
- Dissenso → Empatia
- Dissenso → Sorpresa
- Dissenso → Ascolto neutro

### Da Sorpresa

- Sorpresa → Attenzione
- Sorpresa → Curiosità
- Sorpresa → Dubbio
- Sorpresa → Accordo
- Sorpresa → Divertito
- Sorpresa → Empatia
- Sorpresa → Dissenso
- Sorpresa → Ascolto neutro

### Da Ascolto neutro

- Ascolto neutro → Attenzione
- Ascolto neutro → Curiosità
- Ascolto neutro → Dubbio
- Ascolto neutro → Accordo
- Ascolto neutro → Divertito
- Ascolto neutro → Empatia
- Ascolto neutro → Dissenso
- Ascolto neutro → Sorpresa

## Riproduzione

Ogni clip dura 4,4 secondi e cambia destinazione a 1,3 secondi. Sono disponibili pausa, seek con ricostruzione della storia del renderer, rallentatore 0,5× e sequenza completa da 316,8 secondi per volto. Le miniature mostrano gli stessi input del player. La pagina non legge o modifica il database e non invoca provider AI/TTS.

## Verifica e consegna, 19 ottobre 2026

La GUI locale 3105 usa `.next-daily-expression-review-final`. Primo piano ricavato dal renderer dello studio a doppia risoluzione, senza ingrandire una faccia già rasterizzata a bassa definizione. Tavole pubbliche delle espressioni in `/daily-performance/expressions/faces-0.png` e `faces-1.png`; le sequenze di tutti i passaggi, il report e le catture desktop/mobile sono in `docs/images/daily-expression-review/`.

Il test browser dell’atlante verifica tutti i 144 passaggi, direzione, variazione effettiva dei canali facciali, continuità al primo fotogramma del cambio e bocca chiusa senza audio. Verificati anche controlli reali, pausa, selezione dall’elenco, sequenza completa, rallentatore, miniature distinte e volto visibile sotto il menu mobile. Le sette regressioni di conduzione/parlato restano superate. Lint, typecheck, compatibilità del kit e build isolate Meeting/Onboarding completati. Il renderer canonico non cambia: SHA-256 `200e06191d8c3f381959b658b3f1997185041daaf79638bdd54dae839dbc0e68`.

La cattura della GUI finale copre entrambi i volti e tutti i 144 passaggi, senza errori browser o mutazioni HTTP. I link della pagina e delle tavole rispondono 200. Italia revisione 51 e World revisione 28 restano `needs_review`, senza consegne, con pubblicazione disabilitata e in pausa. Nessuna rigenerazione vocale o pubblicazione social per questo atlante.
