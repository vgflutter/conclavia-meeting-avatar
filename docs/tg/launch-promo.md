# Conclavia Daily · primo video fissato sul profilo

## Anteprima degli approfondimenti a due avatar — 20 ottobre 2026

La scena 24,80–31,14 s diventa un’anteprima animata del podcast tematico: due avatar dello stesso studio, palette distinte, sguardi reciproci, domanda e punto di vista alternativo su «L’AI nella vita di tutti i giorni». I fumetti evidenziano il turno; i corpi e le espressioni reagiscono indipendentemente. Le etichette AI e tecnologia / Scienza / Società esemplificano possibili temi, senza annunciare una cadenza o puntate già disponibili. La scena dichiara «Anteprima del format · approfondimenti tematici».

È una scena illustrativa sotto la registrazione Alex già approvata: non è una nuova conversazione parlata né una seconda voce generata. Le pose dell’anteprima non ricevono PCM o visemi inventati. Copione parlato, VTT, audio master, 77 parole, 16 cue, sette scene e durata 36,96 s rimangono invariati. Nessuna chiamata TTS/ASR/AI o pubblicazione social. Backup della revisione precedente: `.tg-artifacts/.launch-promo/before-podcast-preview-20261020/`.

La nuova composizione `conversation` e i microfoni appartengono alla feature canonica `formats/tg`; testo, temi, mood dei turni, palette e asset dello studio rimangono nel consumer. Il renderer mantiene il precedente report `actor` e aggiunge `actors`/`active`. Raccordi del corpo, pausa, seek e movimento ridotto usano lo stesso clock.

Preview aggiornata su 3105 con `.next-daily-podcast-preview`, `mediaVersion=4a6ab8513827`. Audio SHA-256 `bfdbaee293df98216b729452fc68c1a5e8159dbd8dcc536354e63f6315b60307`, identico alla revisione precedente. Passati 119 test del kit, 82 Onboarding e 24 regressioni browser Meeting, compresa la nuova verifica di due attori indipendenti in entrambi i formati. Entrambe le build, typecheck, lint e confini/consumer del kit verificati. Controllati i veri MP4 e le due fasi del confronto; correlazione master/MP4 0,999939, zero clipping, errori browser o richieste mutanti. Evidenze `docs/images/daily-launch/actual-*-invitation*.jpg`.

## Approfondimenti e invito a seguire — 20 ottobre 2026

La revisione vocale cita nel parlato «Notizie e approfondimenti, raccontati con curiosità e un tono informale» e chiude con «Segui Conclavia Daily». La scena di invito mostra «NOTIZIE E APPROFONDIMENTI»; la firma finale usa «SEGUI CONCLAVIA DAILY» e «Segui Daily». La descrizione del post presenta la redazione autonoma come obiettivo del progetto.

Una sola nuova generazione ElevenLabs attraverso la GUI, con la voce originale approvata Daily IT — Alex / Eleven v4 e gli stessi parametri: 523 caratteri, 523 crediti (due alternative restituite dalla singola generazione, usata Generation 1). Sorgente 34,2727 s; montaggio finale 36,96 s, 16 cue e sette scene. Le 77 parole ASR coincidono con il copione. Due timestamp puntuali vengono conservati nell’evidenza e raggruppati tramite la funzione canonica, senza inventare durate di singole parole. I tempi restano misure ASR approssimate.

Il 20 ottobre l’utente ha risposto «sempre» alla richiesta specifica di trascrivere la nuova registrazione sintetica Alex e il relativo copione pubblico con OpenAI. Il consenso è registrato in `AGENTS.md` per le successive revisioni dello stesso flusso; non comprende registrazioni personali, dati dell’account o altri file. Eseguita una sola trascrizione, poi riusata la cache. Nessuna nuova configurazione di chiavi/provider o pubblicazione social.

Cache privata `.tg-artifacts/.launch-promo/voices/alex-v4-approfondimenti-20261020/`; backup del promo precedente in `.tg-artifacts/.launch-promo/before-approfondimenti-20261020/`. Gli argomenti `TG_LAUNCH_DIR` e `TG_LAUNCH_VOICE_DIR` dell’import permettono revisioni separate, limitate alle directory del launch. Media attivati dopo la decodifica completa, con il manifest pubblicato per ultimo; `mediaVersion=ffce449990e2`. Audio master SHA-256 `bfdbaee293df98216b729452fc68c1a5e8159dbd8dcc536354e63f6315b60307`. Preview locale su 3105, build separata `.next-daily-editorial-update`.

Verifica di questa revisione: build e lint Meeting superati, dieci regressioni browser del promo/player passate. Entrambi gli MP4 H.264/AAC stereo 48 kHz, 25 fps, 1080×1920 e 1920×1080, durata 36,96 s; decodifica completa riuscita. Correlazione sorgente/master vocale 0.997273, voce/mix 0.971395, master/MP4 0.999939 in entrambi i formati. Zero clipping, errori browser o richieste mutanti nella verifica dei media.

## Mani vicino al busto e coordinazione del corpo — 20 ottobre 2026

La revisione del corpo mantiene la silhouette approvata e rilassa dita/pollice nei gesti di spiegazione e domanda. Preparazione e recupero hanno tempi più morbidi; la mano diretta verso il petto cambia profondità, orientamento del polso e lettura dorso/palmo. Un'ombra discreta aiuta il contatto visivo con la giacca. Il gomito segue un raccordo continuo con apertura limitata, conservando le lunghezze delle ossa.

Busto e appoggio del peso accompagnano l'asimmetria del gesto. Clavicole, collare e gola seguono le spalle; testa e mani assorbono gli accenti con tempi diversi. I canali generici e il loro assestamento appartengono alla feature `performance`; anatomia, IK e disegno alla feature `characters/robot`, nel kit canonico. Nessuna implementazione viene duplicata nei consumer.

Quella preview locale usava `.next-daily-body-coordination`; i due MP4 sono identificati da `mediaVersion=d184514613d3`. Backup in `.tg-artifacts/.launch-promo/before-body-coordination-20261019/`. Voce Alex, audio master, copione, 16 cue, timestamp, mood, durata e VTT sono gli stessi della revisione precedente. Audio master SHA-256 `c8fbe801d36b48b2534efd2cd76c88cfe3a1bbce28d6ac1e3c751bff5fa32c23`. Nessuna nuova chiamata AI/TTS/ASR, pubblicazione o spesa pubblicitaria. Gli altri MP4 archiviati non vengono rigenerati automaticamente.

Verifica della sequenza: `scripts/tg/review-body-contact.mjs` analizza 4.192 fotogrammi del renderer reale: otto mood a piena intensità e promo intero, entrambi nei due formati. Per attenzione, curiosità ed empatia produce anche sei tavole, ciascuna con 51 fotogrammi consecutivi a 25 fps, nell'avvicinamento e recupero delle mani (1,20–3,20 s). Controllati visivamente contorni, dita, polsini e orientamento; ossa fisse e coordinate finite verificate per ogni campione. Il report conserva gli spostamenti massimi misurati senza considerarli una certificazione di naturalezza umana. Evidenze in `docs/images/daily-studio/body-coordination-review/`.

Passati 118 test del kit, 82 test Onboarding e 35 regressioni browser Meeting: otto mood, tutte le 56 transizioni ordinate, due identità, pausa/seek, player, reazioni podcast e rig 3D. Build di entrambi i consumer, typecheck, lint, confini delle feature e compatibilità dei consumer verificati. Controllati i veri MP4 nella GUI desktop/mobile con la nuova revisione nell'URL. H.264/AAC stereo 48 kHz, 25 fps, 1080×1920 e 1920×1080, entrambi 35,52 s; decodifica completa riuscita. Correlazione master/MP4 0,999949 in entrambi i formati, zero clipping, errori browser o richieste mutanti nella verifica dei media.

## Revisione precedente: silhouette e mani — 19 ottobre 2026

La revisione precedente introduce una giacca sagomata su torace e vita, maniche più sottili e spalle raccordate. Il volto resta quello scelto. Le mani sono leggermente più grandi e meno scorciate nei gesti offerti; dita, pollice e polsi conservano articolazione indipendente. La pelle delle falangi è resa come unione di volumi, eliminando piccoli anelli causati da contorni che si incrociavano nelle dita piegate. Il vincolo del gomito ha un raccordo continuo fra riposo e apertura. Tutta l'anatomia/disegno rimane nella feature canonica `characters/robot`.

Rigenerati i due MP4 da 35,52 s usando lo stesso `audio.wav`: SHA-256 `c8fbe801d36b48b2534efd2cd76c88cfe3a1bbce28d6ac1e3c751bff5fa32c23`. Copione, 16 cue, timestamp, mood e VTT coincidono con la versione precedente. Nessuna nuova chiamata AI/TTS, invio a provider o pubblicazione social. La versione precedente è conservata in `.tg-artifacts/.launch-promo/before-slim-body-20261019/`. Gli altri piloti archiviati non sono stati rigenerati da questo intervento.

Quella preview usava `.next-daily-slim-body`. Il manifest identifica i nuovi media con `mediaVersion=822619842f9e`; player, copertine e download usano quella revisione nell'URL e il manifest viene riletto senza cache. Il valore deriva dai due MP4 e non cambia la timeline vocale. I file precedenti non vengono riusati dal player dopo un aggiornamento grafico.

Verifica: 117 test del kit, 82 test Onboarding e 20 regressioni browser Meeting superati, inclusi otto mood, 56 passaggi del corpo, tutte le transizioni facciali sulle due identità, polsini, pausa, seek, media download e voce. Build di entrambi i consumer, lint, typecheck e confini del kit verificati. Analizzati entrambi gli atlanti delle mani con preparazione/apertura/flessione/recupero; confronto alla stessa posizione del parlato in `docs/images/daily-studio/slim-body-review/before-after.jpg`. Controllati i veri MP4 nella GUI desktop e mobile, non soltanto il renderer di anteprima.

Audio sorgente/master: correlazione 0,995814; voce/mix 0,971840; mix/MP4 0,999949 nei due formati. Nessun campione clippato, errore browser o mutazione HTTP nella verifica. Nuovi MP4 H.264/AAC, 25 fps, 1080×1920 e 1920×1080, durata esatta 35,52 s. La resa resta un'illustrazione procedurale: le verifiche anatomiche non equivalgono a una valutazione della naturalezza umana.

## Versione corrente: Alex, 19 ottobre 2026

L'utente ha scelto una voce originale creata in ElevenLabs e salvata come **Daily IT — Alex**: maschile giovane adulta, informale, colloquiale e con passo leggermente vivace. La presentazione è stata letta una volta attraverso la GUI ElevenLabs con `Eleven v4` (504 caratteri; due alternative restituite dalla stessa generazione). La registrazione importata dura 32,8359 s; il montaggio finale, con firma e coda, 35,52 s. Il copione aggiornato presenta ricerca, racconto e revisione editoriale AI, fonti verificabili e distinzione fra fatti e opinioni.

La GUI `/podcast/tg/presentazione` e i download principali usano ora Alex in entrambi i formati. La versione precedente è conservata nella cache privata, insieme alla sorgente importata. Le edizioni del TG, i profili salvati di Meeting/Onboarding e la pubblicazione automatica non sono stati cambiati. L'integrazione API ElevenLabs per le edizioni giornaliere non è ancora configurata: questo test usa la registrazione esportata, non un collegamento automatico al nuovo provider.

Una singola trascrizione temporizzata OpenAI è stata eseguita dopo il consenso esplicito dell'utente a inviare quella registrazione sintetica e quel copione. Tutte le 75 parole coincidono con il testo. Quattro timestamp ASR di durata zero vengono conservati nell'evidenza originale e raggruppati con un vicino misurato nella stessa frase, tramite `coalesceSpeechWordAnchors` del kit. I tempi sono ASR approssimati, non timestamp nativi ElevenLabs. Nessuna durata della singola parola viene inventata. Il video ha sette scene e sedici segmenti emotivi; bocca e movimenti seguono il PCM originale senza accelerazione.

`import-launch-voice.ts --file=<registrazione-assoluta> --prepare-only --confirm` prepara il file senza servizi esterni. Il primo `--align --confirm` consente una trascrizione, previa autorizzazione al relativo invio; i successivi import usano la cache e non richiedono `--align`. Richiede sempre `TG_PUBLISH_ENABLED=false`. I test non invocano questi servizi. Per preparare una variante senza sostituire il video principale, `compose-launch-audio.py` accetta `TG_LAUNCH_DIR` e `TG_LAUNCH_VOICE_DIR`; il renderer accetta `TG_LAUNCH_DIR`. Le destinazioni rimangono nelle directory del launch. La voce approvata è sotto `voices/alex-v4`; gli script di casting OpenAI rimangono prove esplicite separate dalla scelta del prodotto.

Verifica dei media finali: 1080×1920 e 1920×1080, 25 fps, H.264/AAC stereo 48 kHz; decodifica completa riuscita. Correlazione registrazione → master vocale 0,995814; master mixato → ciascun MP4 0,999949. Nessun campione clippato, nessun errore browser o richiesta mutante nella verifica. Nessuna pubblicazione social o spesa pubblicitaria.

## Prima proposta conservata: Gianni / Inworld

Prima proposta italiana: **Il mondo corre. Meno rumore. Più contesto.** Il video presenta la promessa editoriale e invita a seguire il progetto. Non simula un’edizione di notizie e non è una campagna già pubblicata.

- 32,32 secondi, sette scene, quattordici segmenti emotivi e quattro mood appropriati al copione.
- Reel 1080×1920 e YouTube 1920×1080; composizioni distinte, 25 fps, H.264/AAC stereo.
- Voce Gianni, Inworld TTS-2: una sola lettura continua a velocità naturale, conservata in cache. Nessuna accelerazione o chiamata per ciascun mood.
- Confini delle frasi e sottotitoli da timestamp nativi delle parole; i visemi restano approssimati da testo e PCM. Il moto del corpo usa l’engine canonico.
- Musica e accenti sonori sintetizzati appositamente, senza campioni di terzi, sotto la voce. Copertine per i due formati, VTT e testo del post inclusi.
- Logo dai tracciati ufficiali forniti, fondali del Daily esistenti; font e attribuzioni OFL conservati.

Sequenza: apertura tipografica → firma Daily → conduttore nello studio → le tre domande → fonti/revisione → invito → firma finale. I contenuti funzionano anche senza audio. La dichiarazione di presentatore e voce AI rimane visibile.

## Uso e riproduzione

GUI `/podcast/tg/presentazione`, sezione «Presentazione» nello Studio TG. La bozza è scaricabile, con il video verticale selezionato inizialmente. La pagina non chiama provider o API di pubblicazione.

Il copione e le scelte del prodotto stanno in `src/components/tg/daily-launch-storyboard.ts`; scena, layout e animazione sono nel kit condiviso, feature `formats/tg`, tramite `TgPromoRenderer` e `tgPromoFrameAt`. Nessuna implementazione dell’avatar è copiata nel consumer.

1. `prepare-launch-promo.ts --confirm`: richiesta vocale creativa esplicita, limitata a un solo testo breve e con cache privata; richiede voce abilitata e pubblicazione disabilitata. I test non lo eseguono.
2. `compose-launch-audio.py`: crea la base originale e il master; non usa servizi esterni.
3. `render-launch-promo.ts --preview`: verifica fotogrammi dei due formati e impaginazione.
4. `render-launch-promo.ts`: esporta i due MP4, le copertine e i sottotitoli. Browser GET-only; non pubblica.

Asset in `public/daily-launch/`; cache privata sotto `.tg-artifacts/.launch-promo/`. Le edizioni giornaliere e il database non vengono modificati. Prima di sponsorizzare, la bozza completa richiede la revisione del proprietario del progetto. Nessuna spesa pubblicitaria è stata avviata.

## Esito della prima proposta

GUI locale aggiornata sulla porta 3105. Verifiche completate: 108 test del kit, 23 regressioni browser pertinenti, 82 test Onboarding, lint/typecheck e build di entrambi i consumer. I due MP4 durano 32,32 s, decodificano senza errori e contengono audio AAC stereo 48 kHz. Registrazione originale → voce master: correlazione 0,996834; master → entrambi i video: 0,999832. Nessun campione clippato nel controllo del master. Catture di tutte le scene dai video finali e viste della GUI in `docs/images/daily-launch/`. Nessun errore del browser, nessuna richiesta mutante e nessuna pubblicazione.


## Presentazione pubblicata sul sito Daily — 20 ottobre 2026

Il video originale Alex di 36,96 s è stato riesportato con il renderer corrente, la firma compatta approvata, le correzioni di animazione e `daily.conclavia.me` nella chiusura. Revisione `db77e268188f`; master audio SHA-256 `bfdbaee293df98216b729452fc68c1a5e8159dbd8dcc536354e63f6315b60307`, invariato. I due formati hanno audio decodificato identico; correlazione master/MP4 0,999939, nessun clipping, errore browser o richiesta mutante. `verify-launch-promo.mjs` richiede per questa versione `TG_LAUNCH_VOICE_DIR=.tg-artifacts/.launch-promo/voices/alex-v4-approfondimenti-20261020`: la cache predefinita appartiene alla lettura precedente. `check-media.ts --launch` superato senza chiamate AI.

La presentazione è disponibile su https://daily.conclavia.me/presentazione/ e https://daily.conclavia.me/en/presentation/ (audio italiano, sottotitoli inglesi dichiarati). Il sito statico importa solo i media pubblici selezionati con checksum, senza renderer o manifesti applicativi. La GUI distingue questa pubblicazione sul sito dalla distribuzione social ancora da avviare. Le tre prove creative rimangono separate. Nessuna nuova voce, spesa pubblicitaria o pubblicazione sui social è stata avviata.

## CDaily / revisione pulita — 20 ottobre 2026

La nuova firma breve è CDaily, con «by Conclavia» dai tracciati originali del marchio principale. La voce Alex continua a pronunciare Conclavia Daily: è il nome completo del progetto. La tipografia Manrope, il fondo chiaro e l’accento blu sono condivisi con il sito mobile-first. Le sorgenti del wordmark del programma sono SVG a tracciati in `public/brand/`; il font originale mantiene la propria attribuzione OFL. Il logo Conclavia approvato non è stato modificato.

Il nuovo master apre con il conduttore nello studio e conserva una sola titolazione principale per volta. Le tre domande scorrono sulle rispettive cue; niente righe di supporto ridondanti. La scena di podcast mantiene i due avatar e il loro clock di recitazione, ma elimina fumetti e temi in pillole. La chiusura usa firma, claim, indirizzo del sito e stato di sviluppo. L’implementazione riutilizzabile è nel kit canonico, con opt-in `visualStyle: clean` e `captions: separate`; gli altri formati mantengono i default.

I sottotitoli sono ora tracce VTT selezionabili, non parte dei pixel degli MP4. La GUI offre italiano e inglese; il sito non forza la traccia italiana e usa la traduzione inglese sulla pagina EN. Le trascrizioni automatiche delle piattaforme non sostituiscono i sidecar corretti già disponibili.

Revisione media `ef1dbd2efd7d`, 36,96 s, 16 cue e sette scene. Il master vocale e il mix sono invariati: nessuna nuova sintesi, trascrizione, spesa o chiamata a provider. Backup precedente in `.tg-artifacts/.launch-promo/before-cdaily-clean-20261020/`; esportazione separata in `public/daily-launch/clean-20261020/`, attivata dopo decodifica dei due file.

Verifiche: 123 test del kit, confini e compatibilità dei due consumer; build Meeting e Onboarding; 82 test e typecheck Onboarding; dieci regressioni browser su promo, otto mood e riproduzione; quattro ulteriori test del promo con verifica di ogni frame nei due formati: una titolazione e nessuna sovrapposizione con volto o mani. I veri MP4 hanno H.264/AAC stereo 48 kHz, 25 fps, decodifica completa e correlazione master/MP4 0,999939; zero clipping, errori browser o richieste mutanti. I controlli visivi non sono una certificazione di naturalezza umana. Report e fotogrammi reali in `docs/images/daily-launch/`; nessuna pubblicazione social.


## Alex 2 e invito a social / Spotify — 20 ottobre 2026

L’utente ha salvato e approvato «Alex 2 - daily» nel proprio account ElevenLabs. La presentazione usa ora quella voce con Eleven v4, stabilità 0,5, similarità 0,75 e velocità naturale 1. Il copione italiano collega le frasi, presenta la redazione autonoma come obiettivo in costruzione e invita esplicitamente: «Segui Conclavia Daily sui social e su Spotify». Conserva sette scene, sedici cue con mood e l’anteprima illustrativa del confronto a due avatar.

Il primo take ha letto parte delle indicazioni di stile inglesi inserite nel campo del parlato. La trascrizione lo ha respinto prima del montaggio. È conservato soltanto nella cache privata `voices/alex2-spotify-20261020`; non è una versione distribuibile. La registrazione corretta contiene esclusivamente il copione italiano, senza istruzioni descrittive fra parentesi nel campo TTS. Due generazioni GUI complessive: 873 crediti per il take scartato e 557 per quello finale, due alternative per generazione. Nessuna nuova chiave o integrazione API ElevenLabs.

La sorgente finale dura 36,1273 s e il montaggio 38,84 s; nessuna accelerazione o variazione di altezza. Il consenso permanente registrato in AGENTS.md copre le due trascrizioni della sola voce sintetica e del copione pubblico; i risultati sono conservati in cache. Audio, labiale e performance sono rigenerati dai tempi misurati, con le approssimazioni ASR già documentate. Cache finale `.tg-artifacts/.launch-promo/voices/alex2-spotify-it-20261020/`; backup della precedente presentazione `before-alex2-spotify-20261020/`.

Esportazione separata `public/daily-launch/alex2-spotify-20261020/`, poi attivazione dei media canonici con manifesto per ultimo. Revisione `e802f981f80d`: H.264/AAC stereo 48 kHz, 25 fps, 1080×1920 e 1920×1080. Il cartello finale clean visualizza la CTA della sequenza sopra l’indirizzo; il renderer condiviso riserva spazio distinto a firma del marchio, claim, invito e stato di sviluppo. Il font e i tracciati approvati rimangono invariati. Sottotitoli IT/EN separati; nessun testo sottotitolo incorporato negli MP4.

Verifiche: 123 test del kit, typecheck, confini e compatibilità; build di entrambi i consumer; otto regressioni browser su performance/player e quattro del promo, con tutti i fotogrammi nei due formati. Decodifica completa degli MP4, correlazione master/MP4 0,999934, nessun clipping, errore browser o richiesta mutante. Evidenze in `docs/images/daily-launch/alex2-spotify-20261020/`. Non è una certificazione percettiva di naturalezza. Il sito importa solo i media selezionati e aggiorna copione, poster reali e sottotitoli inglesi. Nessuna distribuzione social o campagna pubblicitaria è stata avviata da questo task.

Pubblicazione sul sito verificata: `web-20261020192742095-192e65`, senza riavvio gateway/app. La suite pubblica completa passa su dieci pagine IT/EN e sei larghezze; i dati visibili indicano 00:39 e Alex 2. https://daily.conclavia.me/presentazione/ serve il nuovo video. Nessun caricamento su piattaforme social o Spotify.

## Firma editoriale e banco leggero — 20 ottobre 2026

Revisione grafica `d5196b4012f4`, su richiesta dell'utente: rimosso il testo visibile «PRESENTATORE E VOCE AI», nuova firma CDaily con C aperta e sottolineatura blu, lettering Bricolage Grotesque a tracciati. La scrittura e i colori del marchio Conclavia principale rimangono i file approvati. Il font locale e la sua licenza OFL sono in `public/brand/`; `scripts/tg/create-daily-wordmark.py` riproduce i tracciati dalla sorgente ufficiale.

Il promo sceglie `deskStyle: 'slim'` dal renderer condiviso: piano più basso e sottile, fronte caldo chiaro senza la grande sfumatura grigia, inquadratura verticale che lascia più corpo visibile. La scena a due usa margini distinti per mani e microfoni; le basi seguono la curva reale del piano. Firma in testata e cartello finale più compatti. Il default del kit resta la composizione precedente, per conservare gli altri programmi. Il sito usa lo stesso display font e conserva la spiegazione del progetto AI.

Voce Alex 2, master audio, durata 38,84 s, sette scene e sedici cue misurate sono invariati. I due MP4 sono stati esportati in una directory separata, decodificati completamente e poi attivati con manifesto per ultimo. Backup privato `before-editorial-identity-20261020/`; fotogrammi reali e verifiche in `docs/images/daily-launch/editorial-identity-20261020/`.

Verifiche: 123 test condivisi, typecheck, confini/compatibilità, build di Meeting e Onboarding, lint Meeting e dodici regressioni browser su promo, mood, mani e player. Margini di testa/mani controllati su tutti i frame nei due formati; nessuna uscita dal canvas. H.264/AAC stereo, 25 fps, entrambi i 1080; correlazione master/MP4 0,999934, zero campioni clippati, errori browser o richieste mutanti. Nessuna nuova voce, trascrizione, chiamata a provider, pubblicazione social o spesa pubblicitaria.

Il sito seleziona questi media nella release statica `web-20261020200413601-3eb18d`, verificata sul dominio pubblico in entrambe le lingue e a sei larghezze. Nessun riavvio gateway o cambiamento ai container applicativi. Entrambi gli helper di preparazione/import del lancio mantengono ora vuoto il campo dell'overlay, per non reintrodurlo nelle prossime esportazioni.

## Coreografia diretta senza ripartenze a ogni mood — 20 ottobre 2026

Revisione `9b54b2933025`. L'utente ha approvato l'identità e chiesto di variare braccia e busto lasciando il resto invariato. `daily-launch-motion.ts` annota le frasi con intenzioni editoriali (spiegare, confrontare, invitare, sottolineare, rassicurare); chiama il planner puro `planPerformancePhrases` del kit e applica il piano ai cue e ai turni dell'anteprima. L'annotazione è deterministica e non viene ricalcolata per ogni frame. Il test del prodotto rimuove solo queste annotazioni e confronta l'intera sequenza con l'originale: nessun cambiamento a copione, mood, voce, livelli PCM, fonemi, parole temporizzate, scene, titoli o durata. Font, marchi, studio, colori e inquadrature sono gli stessi.

Il repertorio condiviso contiene dieci famiglie di gesto, selezionate per mood e intenzione con memoria delle ultime due. Alterna la mano che guida, usa la seconda soltanto quando serve, varia preparazione/tenuta/rilascio e conserva una pausa tra gesti anche attraverso i confini dei cue. Le clausole di collegamento possono restare senza gesto delle mani. Il corpo esprime anche i mood tramite peso, torsione, inclinazione e risposta delle spalle. Palmi e dita hanno forme distinte, con pollice e dita temporizzati separatamente. Il planner non chiama provider e non usa casualità a ogni frame. Pausa, seek e movimento ridotto continuano a usare il solver e il clock audio canonici.

Il piano del conduttore seleziona otto famiglie diverse; il 68,5% dei frame con il conduttore singolo ha entrambe le mani vicine al riposo, con postura/sguardo/respiro ancora attivi. Le traiettorie di guida sinistra e destra sono distinte. Il report non certifica naturalezza umana: descrive variazione e vincoli del modello illustrato. Piani delle frasi, audit numerico, sequenza di fotogrammi decodificati e catture dei veri MP4 sono in `docs/images/daily-launch/body-direction-20261020/`. La prima prova, più trattenuta, non è stata attivata.

Verifiche: 127 test del kit, typecheck e confini/compatibilità; build di entrambi i consumer; lint e test delle annotazioni; tredici regressioni browser, incluso ogni frame nei due formati per margini di volto/mani, titoli e fasi di quiete. Tutti gli otto mood sono esercitati con le catene anatomiche reali di mani e braccia. I due MP4 finali decodificano completamente; durata 38,84 s e master audio identici alla revisione precedente, correlazione master/MP4 0,999934 e nessun campione clippato. Zero errori browser o richieste mutanti. Backup privato `before-body-direction-20261020/`. Nessuna nuova sintesi vocale, trascrizione o distribuzione social.

Pubblicazione statica `web-20261020202820664-6e2a6f`, senza riavvio gateway e con container applicativi invariati. L'accettazione sul dominio pubblico passa su dieci pagine IT/EN e sei larghezze con playback e sottotitoli dei nuovi file. Il portrait selezionato ha hash `03ddb879f430`, il landscape `59943e135f07`.

## Torace articolato e guida di continuità — 20 ottobre 2026

Revisione `c2a74cad524c`, in risposta alla richiesta di rifinire busto/spalle e salvare l'identità per i video successivi. Il kit introduce un'opzione di colonna articolata: torace e bacino hanno canali e tempi distinti; i tracciati originali di giacca, maglia, risvolti e trama vengono deformati come una superficie continua. Spalle e raccordi del collo condividono quella geometria. La testa conserva il volto esistente e il proprio frame. Le mani hanno appoggi più rilassati, raccolti o asimmetrici, con variazione stabile anche per identità dell'attore; i due personaggi non sono obbligati allo stesso riposo.

La prova interna di 12 s usa `--proof=12.36:24.36`, con i relativi 12 s dell'audio originale; non sostituisce i master o il manifesto. Dopo la verifica sono stati esportati i due file completi. Voce Alex 2, mix, copione, fonemi/PCM, parole, mood, scene e durata 38,84 s sono identici al backup `before-articulated-body-20261020/`. La prima esportazione intermedia è stata rifinita ulteriormente per distinguere gli appoggi dei due avatar, prima dell'attivazione.

`docs/tg/cdaily-video-guide.md` raccoglie impostazione, font, palette, sorgenti, voce, composizioni 9:16/16:9, mood, procedura di produzione e otto immagini di riferimento. L'identità è estratta senza variazioni in `daily-video-identity.ts`; il vecchio export `dailyLaunchConfig` resta compatibile. `cdaily-visual-lock.json` e `check-video-identity.mjs` controllano tredici asset/impostazioni, incluse le sorgenti grafiche del volto. README e AGENTS indirizzano alla guida per i lavori successivi. Codice fisico e rendering restano nel kit canonico.

Verifiche: 131 test del kit, inclusi tutti i 56 cambi articolati, typecheck, confini e consumer; build Meeting/Onboarding; lint e test delle annotazioni; tredici regressioni browser con margini di volto/mani su tutti i frame nei due formati. I veri MP4 sono H.264/AAC stereo 48 kHz a 25 fps, decodifica completa, nessun clipping; correlazione master/MP4 0,999934, zero errori browser o richieste mutanti. Scene reali, prova breve e report sono in `docs/images/daily-launch/articulated-body-20261020/`. Nessuna nuova sintesi, trascrizione o chiamata a provider; nessun invio ai social o spesa pubblicitaria.

Release statica `web-20261020210135428-65d409`, precedente `web-20261020202820664-6e2a6f`: HTTPS/checksum verificati, gateway non riavviato e container applicativi invariati. L'accettazione pubblica passa su dieci pagine IT/EN e sei larghezze con i nuovi video e sottotitoli. Portrait `fde46b2d0922`, landscape `1a49f4b25545`. La presentazione è aggiornata su `https://daily.conclavia.me/presentazione/`; la guida resta un documento del repository, non una pagina operativa pubblica.

## Riposo delle mani, recitazione e dissolvenze coerenti

Revisione media `36a55a3d4eae`, rifinitura richiesta al team dopo la valutazione della v1. Tre incarichi distinti hanno curato dita/occlusioni, tempi della recitazione e revisione critica del vero MP4; il processo principale ha integrato appoggi, traiettorie, adattatore facciale e compositing. Il riposo precedente sembrava una posa con palmi sui fianchi. Ora i polsi sono più bassi, i gomiti raccolti e le dita si rilassano in cascata; il polso conserva un angolo quieto minore. Lo splay diminuisce durante la flessione. Il recupero dell'offset di riposo avviene lungo il tratto inferiore del gesto, senza uno svincolo brusco iniziale. La mano libera non riceve una falsa ombra da appoggio sul banco.

Preparazione, apertura e recupero di indice, dita ulnari, pollice e polso hanno tempi distinti. Le falangi piegate rimangono opache e rispettano la profondità del palmo, con l'ombra circolare della nocca mascherata. Sguardo, testa e torace anticipano e seguono l'accento in momenti diversi; le frasi senza mani ricevono un solo piccolo accento del volto. L'adattatore 2D applica alla superficie facciale il delta della recitazione rispetto al mood di base. Il fuoco visivo rimane stabile per attore tra i cue.

La revisione frame per frame ha inoltre scoperto un difetto preesistente nei primi fotogrammi della conversazione: alcuni painter ripristinavano alpha=1 e lasciavano comparire rever/tempie prima del corpo. Il promo ora dissolve ciascun avatar completo su un livello locale, con ingresso coerente anche dei microfoni. A opacità piena usa il percorso di disegno diretto. La nuova regressione browser legge i pixel veri, ricostruisce separatamente lo studio e verifica il limite di contrasto dell'opacità di gruppo, in entrambi i formati.

139 test del kit, typecheck, confini e compatibilità; build Meeting e Onboarding; lint Meeting; quattordici regressioni browser. Test anatomici comprendono otto mood e tutti i 56 cambi, ossa fisse, polsi, dita e silenzio. Confronti prima/dopo, master, fotogrammi finali, transizione a 25 fps e controlli del player sono in `docs/images/daily-launch/natural-delivery-20261020/`. La guida riutilizzabile è aggiornata, senza cambiare il lock dei tredici asset/impostazioni approvati.

Voce Alex 2, master WAV, copione, livelli PCM, visemi, parole/mood, sette scene e durata 38,84 s sono identici al backup `before-natural-delivery-20261020/`. I due MP4 H.264/AAC decodificano integralmente; correlazione master/audio codificato 0,999934, clipping zero, nessun errore browser o richiesta mutante nel player ufficiale. Portrait `e43f4e342ac0`, landscape `351a80eed146`. Nessuna chiamata a provider, nuova sintesi o trascrizione, distribuzione social o spesa pubblicitaria. L'animazione resta un personaggio illustrato: i test non certificano una ripresa indistinguibile da una persona reale.

Release statica `web-20261020220546226-cf1053`, precedente `web-20261020210135428-65d409`: verifiche SSH/HTTPS e checksum completate, gateway non riavviato, container applicativi invariati. Il sito seleziona i master della revisione `36a55a3d4eae`.

Accettazione finale sul dominio pubblico: dieci pagine IT/EN, sei larghezze, video e sottotitoli reali, zero errori browser o richieste esterne. Prova salvata nel repository web in `docs/images/daily-natural-delivery-live-proof-20261021.json`.
