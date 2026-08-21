# Conclavia Meeting Avatar

Laboratorio open-source per portare un singolo avatar Conclavia dentro una riunione Microsoft Teams usando l'account del partecipante.

Il primo POC non è un bot Teams autonomo. Teams riceve:

- il video dell'avatar tramite **OBS Virtual Camera**;
- la voce generata tramite un dispositivo audio virtuale;
- l'utente continua a entrare nella riunione con il proprio account.

Questo approccio permette di validare rapidamente presenza, latenza e qualità del singolo MetaHuman prima di investire in un bot Teams ufficiale con identità separata.

## Stato

La fase 1 include:

- console locale responsive;
- preflight macOS per ffmpeg, OBS e routing audio virtuale;
- contratto TypeScript per trascrizione e comandi avatar;
- memoria locale della trascrizione: ogni frase finale viene conservata per il futuro contesto LLM;
- acquisizione continua di BlackHole 16ch con ffmpeg, PCM16 mono a 24 kHz e OpenAI Realtime;
- VAD server-side: le battute vengono segmentate automaticamente senza premere Registra;
- attivazione iniziale tramite wake word `Mary`, seguita da un dialogo naturale senza dover ripetere il nome a ogni frase;
- filtro contestuale di partecipazione: durante il dialogo l'LLM riceve ogni turno, ma Mary resta in silenzio davanti a conversazioni tra persone, intercalari, assensi brevi, frammenti incompleti e casi ambigui;
- registrazione dal microfono del browser e trascrizione reale con OpenAI;
- risposta reale tramite Responses API: quando Mary viene chiamata, l'intera memoria conservata viene inviata al modello;
- risposta divisa in frasi, ciascuna con un mood compatibile con il futuro MetaHuman;
- bridge verso il MetaHuman Unreal già presente in `conclavia-frontend`;
- sintesi vocale Conclavia, cue di regia e mood frase per frase sincronizzati con il lip-sync;
- player Pixel Streaming incorporato e link pulito da usare come sorgente OBS;
- modalità diagnostica testuale utilizzabile anche senza chiave OpenAI;
- test automatici del gate di attivazione.

L’acquisizione automatica è pronta per macOS: Teams deve inviare l’audio della riunione a `BlackHole 16ch`. Il microfono del browser resta disponibile come test rapido per singola frase. L’accensione della GPU Unreal e l’avvio dell’ascolto continuo restano azioni esplicite nell’interfaccia.

## Architettura target

```text
Microsoft Teams
      │ audio riunione
      ▼
Companion macOS ──► STT continuo ──► memoria conversazione ──► LLM
      ▲                                              │
      │                                              ▼
BlackHole ◄──────────── TTS ◄──── dialogo attivo con Mary
                                                     │
                                                     ▼
                                          Unreal / MetaHuman
                                                     │
                                                     ▼
                                           OBS Virtual Camera
                                                     │
                                                     └──► Teams
```

Il companion e il renderer Unreal restano processi separati. In questo modo il renderer può essere locale o su una GPU cloud senza cambiare l'integrazione Teams.

## Requisiti

- macOS
- Node.js 22 o successivo
- ffmpeg
- OBS Studio
- due percorsi audio virtuali distinti, consigliati:
  - BlackHole 2ch per la voce dell'avatar verso Teams;
  - BlackHole 16ch per acquisire la riunione;
  - in alternativa, Loopback semplifica il routing.

Due percorsi separati evitano che l'avatar riascolti la propria voce e crei feedback.

## Avvio

```bash
npm install
cp .env.example .env
npm run dev
```

Apri [http://127.0.0.1:4310](http://127.0.0.1:4310).

Per abilitare microfono, trascrizione e risposta reale, inserisci la chiave soltanto nel file locale `.env`:

```dotenv
OPENAI_API_KEY=la-tua-chiave
```

Il file `.env` è ignorato da Git. I modelli predefiniti sono `gpt-4o-mini-transcribe` per la trascrizione e `gpt-5.4-mini` per Mary; possono essere cambiati con `OPENAI_TRANSCRIPTION_MODEL` e `OPENAI_RESPONSE_MODEL`.

Per lo streaming Teams, i valori predefiniti sono:

```dotenv
CONCLAVIA_TEAMS_AUDIO_DEVICE=BlackHole 16ch
CONCLAVIA_TEAMS_SPEAKER_NAME=Partecipante Teams
CONCLAVIA_DIALOGUE_TIMEOUT_MS=120000
OPENAI_REALTIME_TRANSCRIPTION_MODEL=gpt-live-transcribe
```

La trascrizione Realtime non assegna ancora automaticamente i nomi: ogni battuta viene quindi attribuita al nome generico configurato. Questo non limita la memoria: ogni battuta finale e ogni risposta di Mary vengono conservate. Dopo aver chiamato Mary una volta, il dialogo rimane disponibile per due minuti dall'ultima risposta pertinente. In questa finestra l'LLM valuta ogni turno, ma produce voce e animazione solo quando riconosce una continuazione chiaramente rivolta a Mary. “Grazie Mary” o “Mary fermati” chiudono subito il dialogo.

Avvia anche il frontend Conclavia, che espone le API di voce e Unreal già esistenti:

```bash
cd ../conclavia-frontend
npm run dev
```

Il companion usa per impostazione predefinita `http://127.0.0.1:3000`; puoi cambiarlo con `CONCLAVIA_RENDERER_URL`.

### Prova guidata

1. Avvia il server e apri la console nel browser.
2. In Teams seleziona come altoparlante il dispositivo o il Multi-Output che include `BlackHole 16ch`.
3. Premi **Avvia ascolto Teams**. Lo stato deve mostrare il dispositivo BlackHole risolto.
4. Fai pronunciare una frase senza dire Mary: deve apparire nella memoria, senza risposta.
5. Attiva il dialogo, per esempio: “Mary, che cosa è stato detto prima?”.
6. Continua con una domanda come “E tu cosa suggerisci?” senza ripetere Mary: deve rispondere mantenendo il contesto.
7. Mary riceve l'intera trascrizione conservata, risponde e produce un mood per ogni frase.
8. Di' “Grazie Mary” per chiudere il dialogo prima del timeout.
9. Premi **Avvia MetaHuman**: le risposte vengono sintetizzate da Conclavia e riprodotte dal MetaHuman con cue e mood sincronizzati.

Il pulsante **Registra** permette lo stesso test dal microfono del browser senza configurare prima Teams.

Per il solo controllo dell'ambiente:

```bash
npm run preflight
```

Per verificare il gate senza browser:

```bash
npm run simulate -- "Mary, cosa ne pensi?"
```

## Primo test reale previsto

1. Configurare l’uscita Teams sul percorso che include BlackHole 16ch.
2. Avviare l’ascolto continuo e verificare memoria più gate “Mary”.
3. Instradare l’audio Pixel Streaming di Mary su BlackHole 2ch, usato come microfono Teams.
4. Aggiungere il player MetaHuman alla scena OBS e selezionare OBS Virtual Camera in Teams.
5. Migliorare l’attribuzione dei nomi dei partecipanti tramite caption Teams o diarizzazione dedicata.

## Prossimi passi

- Ridurre ulteriormente la latenza percepita della voce con generazione e riproduzione progressive, mantenendo voce, mood e lip-sync Conclavia.
- Aggiungere un cue `request-to-speak`: quando Mary rileva autonomamente un contributo utile, alza prima la mano senza parlare. La voce parte soltanto dopo un'autorizzazione esplicita o un nuovo invito rivolto a lei.
- Separare il rilevamento dell'intenzione di partecipare dalla generazione della risposta, con metriche dedicate a trascrizione, decisione, LLM, sintesi vocale e renderer.
- Integrare l'identità dei partecipanti per distinguere meglio una domanda rivolta a Mary da una conversazione tra persone.

## Sicurezza e privacy

Prima di trascrivere una riunione, tutti i partecipanti devono sapere che audio e testo vengono elaborati. I dati sensibili e le chiavi dei provider non devono essere salvati nel repository; `.env` è ignorato da Git.

## Comandi di qualità

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Licenza

MIT
