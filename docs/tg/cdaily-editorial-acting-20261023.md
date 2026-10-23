# CDaily — dal testo editoriale ai contatti espressivi

Aggiornamento del 23 ottobre 2026. Richiesta: mani unite e contatto col volto scelti dal significato editoriale, senza associazioni fisse a terremoti, luoghi o categorie di notizie. Stile, voce e master approvati conservati.

**Rifinitura successiva:** [palmi e punte più vicini, mento conservato](cdaily-palms-closer-20261023.md).

## Flusso implementato

1. Il writer AI restituisce per ogni clausola `text`, `speaker`, `storyId`, `sourceIds`, `mood`, `intensity` e `intent`.
2. Le otto intenzioni ammesse nel nuovo output sono `explain`, `question`, `contrast`, `emphasize`, `reassure`, `invite`, `reflect`, `acknowledge`. Non sono nomi di pose fisiche. Output incompleto o con indicazioni fisiche viene rifiutato prima della voce.
3. Il revisore indipendente riceve anche lo score e deve bloccare atteggiamenti impropri, rassicurazione senza basi, drammatizzazione o approvazione politica implicita. Il digest include l’intento. I prompt sono aggiornati; questa verifica non ha eseguito chiamate AI reali.
4. Dopo la misurazione del parlato, clausole adiacenti dello stesso attore e della stessa notizia condividono piano e `performanceWindow`. Ogni clausola mantiene mood, fonemi e livelli locali. Un cambio di mood non riavvia braccia e busto.
5. Il motore riutilizzabile seleziona azioni compatibili con intento, mood, durata, memoria e capacità dichiarate dal rig. Non legge testo, titoli, nomi di notizie, categorie o parole chiave. Il seed rende riproducibile la variante; la quiete resta valida.

Esempio dimostrativo, non una notizia:

```json
{
  "text": "Resta una domanda aperta: quali elementi mancano ancora per arrivare a una conclusione?",
  "mood": "doubt",
  "intensity": 0.8,
  "intent": "reflect"
}
```

Non impone il mento: può produrre anche una riflessione aperta o quiete. Nella prova isolata con seed `editorial-score` seleziona un breve tocco. La stessa intenzione può avere una regia diversa nella puntata completa a causa del contesto recente.

## Gesti aggiunti e limiti

| Capacità | Candidato semantico | Resa anatomica |
| --- | --- | --- |
| `palms-joined` | `reassure` con attenzione, empatia o accordo misurato | Palmi realmente contrapposti, dita prima distese e orientate mentre le mani sono separate, polsi collegati agli avambracci; preparazione, breve tenuta e rilascio. Distinto da `steeple`. |
| `chin-touch` | `reflect` con attenzione, curiosità o dubbio | Indice sul lato del mento, altre dita raccolte; punto legato a testa e mandibola, seguito del movimento e ritorno. |

L’intento semantico deve avere almeno cinque secondi e spazio per il recupero. I contatti espressivi sono separati da almeno 18 secondi dalla fine del precedente. Non utilizzare palmi uniti come reazione automatica a sofferenza o religione, né il mento come tic di ogni domanda. L’intreccio resta riservato al Daily seduto. Guancia e tempia non sono implementate.

La cinematica risolve il contatto sul FK della stessa mano dipinta, mantenendo ossa 132/120 e inerzia di polso/dita. Il mento usa un ancoraggio laterale sulla testa disegnata: non è un generico simulatore fisico 3D del viso. Gli altri avatar devono implementare e verificare il proprio adattatore prima di dichiarare queste capacità.

## Prove da rivedere

- [Intenzione rassicurante: testo, score e canvas](http://127.0.0.1:3107/daily-launch/hand-lab/index.html?pose=editorial-reassure).
- [Intenzione riflessiva: testo, score e canvas](http://127.0.0.1:3107/daily-launch/hand-lab/index.html?pose=editorial-reflect).
- [MP4 rassicurazione](http://127.0.0.1:3107/daily-launch/hand-lab/hands-editorial-reassure.mp4) e [MP4 riflessione](http://127.0.0.1:3107/daily-launch/hand-lab/hands-editorial-reflect.mp4).

Entrambe: otto secondi, 400 frame a 50 fps, 880×570, mute, bocca chiusa e nessuna chiamata a pagamento. Pagine mobili con scrubbing, fotogrammi di riferimento e score leggibile. I test della singola posa restano disponibili come `pose=palms-joined&wide=1` e `pose=chin-touch&wide=1`.

La vecchia prova r4 aveva un contatto inserito a un indice fisso del copione. Quel ramo è rimosso dal preparatore attivo; il prossimo output è r5 e non sovrascrive gli artefatti r4. I master completi del pilota non sono stati riesportati in questa revisione.

## Proprietà e verifiche

- Kit: contratti, selezione, cooldown, canali, FK, polso e ancoraggio della testa nelle feature `performance` e `characters/robot`; renderer TG onora la postura anatomica esplicita.
- Meeting: schema/prompt/revisione, score, digest, raggruppamento sul clock reale e adattatore di produzione in `daily-production-studio.ts`. Nessuna copia di anatomia nei consumer.
- Nuovi test: `expressive-contact.test.ts` e `editorial-acting.test.ts`. Coprono selezione e fallback, cooldown, assenza di regole per argomento, clock continuo, puntamento finale, contatti, ossa, polsi, pausa e rilascio.

Verifiche completate: 234 test del kit, 84 test TG superati e 15 integrazioni Mongo non eseguite, 82 test Onboarding, 23 regressioni browser avatar/player, typecheck/lint, confini delle feature e build di entrambi i consumer. La [verifica UI locale](cdaily-editorial-acting-ui-verification-20261023.json) conferma quattro layout a 390/1440 px senza overflow e quattro esecuzioni del renderer di produzione (201 frame ciascuna, entrambi i formati e i gesti), senza voce, provider o scritture DB.

I 17 hash dell’identità grafica e i due SHA-256 dei master r3 coincidono con quelli approvati.

Le regressioni e il giudizio visivo sulle prove sostengono questa implementazione; non certificano naturalezza indistinguibile da una persona. La puntata completa successiva richiederà comunque revisione della recitazione sul suo parlato reale.
