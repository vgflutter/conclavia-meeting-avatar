# Revisione dell'attesa e della posa delle braccia

La precedente revisione non risolveva il problema visivo: gli avatar inclinavano periodicamente testa e busto, mentre il fumetto teneva ancora la mano davanti al torso. Il passaggio dei test tecnici non bastava a dimostrare una resa convincente. Questa revisione parte da quei due difetti e dalle inquadrature inviate dall'utente.

| Stile | Correzione | Cosa osservare |
| --- | --- | --- |
| Fumetto 2D | Braccio rilassato lungo il fianco, mano sotto la vita; avambraccio ridisegnato durante la salita, raccordo continuo del gomito e ritaglio esplicito del quadro | La mano non attraversa il petto a riposo e non riappare sotto il ritratto nella vista alta. Il busto resta fermo; occhi e testa fanno piccoli movimenti separati, poi si fermano. |
| Personaggio 3D | Tolte le rotazioni periodiche della colonna e della testa; respiro limitato alla superficie del torace, capelli meno puntinati | Sguardo laterale, breve sguardo in basso, assestamento locale di una spalla e ritorno all'attenzione frontale. La vita resta ferma. |
| Ritratto 2.5D | Eliminati lo spostamento laterale del ritratto e le oscillazioni del corpo/parlato | Breve inclinazione locale della testa, assestamento, azione isolata della spalla, poi soste. Il volto conserva le proprie proporzioni e la base del busto resta ferma. |

Il labiale conserva le transizioni con costante di 22 ms, l'apertura legata all'audio e la chiusura immediata su silenzio/stop. Il gesto esplicito della mano rimane distinto dall'attesa. Le impostazioni di movimento ridotto disattivano le azioni automatiche; le schede nascoste sospendono i renderer.

## Verifica visiva

Sono state registrate sequenze reali di 40–45 secondi per entrambi gli aspetti, con le pagine Identità e Voce e movimenti. La revisione include riposo, traiettoria intermedia, mano alzata e rientro; la vista alta del fumetto è stata controllata anche dopo il ritaglio definitivo.

La verifica finale usa la build standalone e la stessa inquadratura 720 × 900 per tutti gli stili. Ogni clip comprende 45 secondi di osservazione, oltre al breve caricamento iniziale. Nessuna delle sei registrazioni ha prodotto errori del browser o richieste di scrittura: [riepilogo delle catture](images/avatar-presence/review.json).

| Stile | Maschile | Femminile |
| --- | --- | --- |
| Fumetto 2D | [Attesa, 45 s](images/avatar-presence/editorial-male.webm) | [Attesa, 45 s](images/avatar-presence/editorial-female.webm) |
| Personaggio 3D | [Attesa, 45 s](images/avatar-presence/stylized_3d-male.webm) | [Attesa, 45 s](images/avatar-presence/stylized_3d-female.webm) |
| Ritratto 2.5D | [Attesa, 45 s](images/avatar-presence/portrait_2_5d-male.webm) | [Attesa, 45 s](images/avatar-presence/portrait_2_5d-female.webm) |

Il [confronto prima/dopo](images/avatar-presence/before-after.png) mostra la posa e la resa statica; per giudicare movimento e pause vanno usati i video. I dettagli delle azioni sono visibili anche nei [fotogrammi 3D](images/rigged-motion/male-attention-contact-sheet.png) e nelle [sequenze 2.5D](images/portrait-motion/waiting-discrete-frames.png).

Il 3D rimane un modello stilizzato. Il 2.5D conserva i limiti di un ritratto animato: non simula una rotazione completa del volto o uno sguardo tridimensionale. I video servono a valutare la resa concreta, senza dedurla dal numero dei test.

## Ripetere l'osservazione

Su `/avatar/test`, lascia l'avatar a riposo per circa 45 secondi; usa poi il comando della mano per verificare salita e ritorno. Controlla anche `/avatar`, dove l'inquadratura è più alta. Nessun salvataggio è necessario per cambiare stile nell'anteprima.

Lo script seguente registra il renderer originale della pagina Identità ingrandito a 720 × 900, con clip, fotogrammi e campioni diagnostici. Richiede un'app locale già avviata, blocca tutte le richieste di scrittura e non chiama il servizio vocale:

```sh
node scripts/review-avatar-presence.mjs \
  --url http://127.0.0.1:3102 --output /tmp/conclavia-avatar-presence --seconds 45
```

Per una singola variante si possono aggiungere `--styles editorial` e `--appearances business_clay`. Le registrazioni includono il breve caricamento iniziale della pagina, conservando la cattura del browser senza ricostruire l'animazione.

I controlli automatici usano esclusivamente MongoDB temporaneo su `127.0.0.1:27018`, con database `conclavia_e2e_*`. Le misure PCM verificano il browser locale e non costituiscono una validazione Teams. Il riepilogo dei controlli integrati è in [Avatar styles](avatar-styles.md).
