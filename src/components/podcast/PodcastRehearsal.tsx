"use client";

import type { VideoTopicSettings } from "@/lib/podcast/video-topic";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PODCAST_VOICES } from "@conclavia/avatar-kit/lib/podcast-voice-catalog";
import { runPodcastRehearsal, type RehearsalVoice } from "@/lib/podcast/rehearsal-player";
import { createSpeechAudioMixer } from "@conclavia/avatar-kit/lib/speech-audio-mixer";
import { getLlmModel } from "@/lib/podcast/llm-models";
import type { Participant, TalkInput, TalkResponse } from "@/types/podcast";
import type { TalkRunMessageResponse, TalkRunResponse } from "@/types/podcast-run";
import { studioSelectionQuery, type StudioCast, type StudioGuestMode, type StudioThemeId } from "@/lib/podcast/studio-themes";
import { defaultPodcast } from "./podcast-defaults";
import { DEFAULT_DIRECTION, PodcastStageView, resolvePodcastDirection, type PodcastDirection, type PodcastEmotion } from "./PodcastStageView";
import { Field, podcastRequest, readableError, usePodcastCopy } from "./PodcastUi";
import styles from "./Podcast.module.css";
import rehearsal from "./PodcastRehearsal.module.css";
import { PodcastVisualSettings } from "./PodcastVisualSettings";
import { normalizeStudioScenario, type StudioScenarioId } from "@/lib/podcast/studio-scenarios";
import { podcastPerformanceFrame } from "@/lib/podcast/performance-playback";
import type { SpeechPlaybackProgress } from "@conclavia/avatar-kit/lib/streaming-voice-player";
import { PodcastPerformanceText } from "./PodcastPerformanceText";
import { PodcastMoodReadout } from "./PodcastMoodReadout";
import { PodcastPersonalityFields } from "./PodcastPersonalityFields";

type RehearsalPhase = "idle" | "preparing" | "ready" | "generating" | "buffering" | "speaking" | "pause" | "complete" | "stopped" | "error";
interface Capability {
  ai: { enabled: boolean; ready: boolean; providers?: { openai: boolean; gemini: boolean; claude?: boolean } };
  speech: { enabled: boolean; ready: boolean; model?: string; providers?: { kokoro: boolean; inworld: boolean } };
}
const NO_CAPABILITY: Capability = { ai: { enabled: false, ready: false }, speech: { enabled: false, ready: false } };
const expressionOptions: Array<[PodcastEmotion, string, string]> = [
  ["attention", "Attenzione", "Attention"], ["curiosity", "Curiosità", "Curiosity"],
  ["doubt", "Dubbio", "Doubt"], ["agreement", "Accordo", "Agreement"],
  ["amusement", "Ironia", "Amusement"], ["empathy", "Empatia", "Empathy"],
  ["disagreement", "Disaccordo", "Disagreement"], ["surprise", "Sorpresa", "Surprise"],
];

function voiceFor(language: string, sex: Participant["sex"], provider: "kokoro" | "inworld") {
  return PODCAST_VOICES.find((voice) => voice.provider === provider && voice.language === language && voice.gender === sex)?.id;
}

function rehearsalInput(initialTheme?: StudioThemeId, initialLayout: StudioScenarioId = "studio", initialCast: StudioCast = "original", initialGuest: StudioGuestMode = "auto", initialTopic: VideoTopicSettings = {}): TalkInput {
  const input = defaultPodcast(false);
  const language = "it";
  return {
    ...input,
    title: "Prova a due voci",
    topic: "L’AI nel lavoro: aiuto o delega eccessiva?",
    centralQuestion: "Quando l’AI ci aiuta a lavorare meglio e quando sostituisce il nostro giudizio?",
    editorialInstructions: "Una breve conversazione fra esattamente due conduttori AI. Alterna i loro interventi, sviluppa un esempio concreto e un disaccordo sincero, poi chiudi con una sintesi utile. Nessun ospite e nessuna terza voce. Interventi concisi: al massimo otto turni e due minuti di parlato stimato.",
    participants: input.participants.slice(0, 2).map((person) => ({
      ...person,
      goals: "Costruire sul contributo dell’altro conduttore, portare esempi concreti e rendere più chiara la domanda centrale.",
      voiceId: voiceFor(language, person.sex, "kokoro"),
    })),
    settings: { ...input.settings, studioTheme: initialTheme ?? input.settings.studioTheme, studioLayout: initialLayout, studioCast: initialCast, studioGuest: initialGuest, ...initialTopic, voiceProvider: "kokoro", pace: "fast", allowInterruptions: true, maxTurns: 8, targetDurationMinutes: 2 },
  };
}

export function PodcastRehearsal({ initialTheme, initialLayout = "studio", initialCast = "original", initialGuest = "auto", initialTopic = {} }: { initialTheme?: StudioThemeId; initialLayout?: StudioScenarioId; initialCast?: StudioCast; initialGuest?: StudioGuestMode; initialTopic?: VideoTopicSettings }) {
  const copy = usePodcastCopy();
  const [input, setInput] = useState<TalkInput>(() => rehearsalInput(initialTheme, initialLayout, initialCast, initialGuest, initialTopic));
  const [talk, setTalk] = useState<TalkResponse | null>(null);
  const [run, setRun] = useState<TalkRunResponse | null>(null);
  const [speech, setSpeech] = useState<TalkRunMessageResponse | null>(null);
  const [lastSpeech, setLastSpeech] = useState<TalkRunMessageResponse | null>(null);
  const [phase, setPhase] = useState<RehearsalPhase>("idle");
  const [active, setActive] = useState(false);
  const [capability, setCapability] = useState<Capability>(NO_CAPABILITY);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [phaseSeconds, setPhaseSeconds] = useState(0);
  const [viseme, setViseme] = useState("rest");
  const [audioLevel, setAudioLevel] = useState(0);
  const [speechProgress, setSpeechProgress] = useState<SpeechPlaybackProgress>();
  const [voices, setVoices] = useState<RehearsalVoice[]>([]);
  const [direction, setDirection] = useState<PodcastDirection>({ ...DEFAULT_DIRECTION, layout: initialLayout });
  const controllerRef = useRef<AbortController | null>(null);
  const prepareRef = useRef<AbortController | null>(null);
  const readinessRef = useRef<AbortController | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mountedRef = useRef(true);
  const phaseStartedRef = useRef(0);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const lastPlayedSequenceRef = useRef(0);
  const speechSequenceRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    readinessRef.current = controller;
    podcastRequest<Capability>("/api/podcast/config", { signal: controller.signal })
      .then(setCapability).catch((cause) => { if (!controller.signal.aborted) setError(readableError(cause)); })
      .finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort(); prepareRef.current?.abort();
      readinessRef.current?.abort();
      void audioContextRef.current?.close().catch(() => undefined);
    };
  }, []);
  useEffect(() => {
    phaseStartedRef.current = performance.now();
    if (!active) return;
    const timer = window.setInterval(() => setPhaseSeconds(Math.floor((performance.now() - phaseStartedRef.current) / 1000)), 250);
    return () => window.clearInterval(timer);
  }, [phase, active]);
  const messageCount = run?.messages.length ?? 0;
  useEffect(() => { const transcript = transcriptRef.current; if (transcript) transcript.scrollTop = transcript.scrollHeight; }, [messageCount]);

  const preparing = phase === "preparing";
  const locked = active || preparing;
  const aiReady = capability.ai.enabled && input.participants.every(person => {
    const provider = getLlmModel(person.modelOverride ?? input.settings.defaultModel).provider;
    return capability.ai.providers?.[provider] ?? (provider === "openai" && capability.ai.ready);
  });
  const voiceProvider = input.settings.voiceProvider ?? "inworld";
  const voiceReady = capability.speech.enabled && (capability.speech.providers?.[voiceProvider] ?? capability.speech.ready);
  const readyToStart = Boolean(talk && run && aiReady && voiceReady && !locked && phase !== "complete");
  const stageTalk = run?.talkSnapshot ?? talk ?? input;
  const performanceFrame = (speech ?? lastSpeech) && direction.automatic ? podcastPerformanceFrame((speech ?? lastSpeech)!, speechProgress) : undefined;
  const actingCue = performanceFrame ? { ...performanceFrame.cue, ...(!speech ? { phase: "settle" as const, progress: 1 } : {}) } : undefined;
  const emotionalDirection = resolvePodcastDirection(direction, stageTalk, speech ?? lastSpeech ?? undefined, actingCue);
  const effectiveDirection = { ...emotionalDirection, focus: phase === "speaking" && voices.length < 2 ? emotionalDirection.focus : "all" as const };

  function changeInput(next: TalkInput) {
    if (locked) return;
    setInput(next); setTalk(null); setRun(null); setSpeech(null); setLastSpeech(null); setSpeechProgress(undefined); setError(""); setPhase("idle"); lastPlayedSequenceRef.current = 0; speechSequenceRef.current = 0;
  }
  function changePerson(index: number, values: Partial<Participant>) {
    changeInput({ ...input, participants: input.participants.map((person, position) => position === index ? { ...person, ...values } : person) });
  }
  function changeLanguage(language: string) {
    const provider = language === "it" ? "kokoro" : "inworld";
    changeInput({ ...input, language, settings: { ...input.settings, voiceProvider: provider }, participants: input.participants.map((person) => ({ ...person, voiceId: voiceFor(language, person.sex, provider) })) });
  }
  function updatePhase(next: RehearsalPhase) {
    if (!mountedRef.current) return;
    setPhaseSeconds(0); setPhase(next);
  }
  async function refreshReadiness() {
    const controller = new AbortController(); readinessRef.current?.abort(); readinessRef.current = controller;
    setChecking(true); setError("");
    try { const result = await podcastRequest<Capability>("/api/podcast/config", { signal: controller.signal }); if (mountedRef.current && !controller.signal.aborted) setCapability(result); }
    catch (cause) { if (mountedRef.current && !controller.signal.aborted) setError(readableError(cause)); }
    finally { if (mountedRef.current && !controller.signal.aborted) setChecking(false); }
  }
  async function prepare() {
    if (prepareRef.current || controllerRef.current) return;
    const controller = new AbortController(); prepareRef.current = controller;
    setError(""); updatePhase("preparing");
    try {
      const preparedTalk = talk && phase !== "complete" ? talk : (await podcastRequest<{ talk: TalkResponse }>("/api/podcast/talks", { method: "POST", body: JSON.stringify(input), signal: controller.signal })).talk;
      if (mountedRef.current && !controller.signal.aborted) setTalk(preparedTalk);
      const session = await podcastRequest<{ run: TalkRunResponse }>(`/api/podcast/talks/${preparedTalk.id}/runs`, { method: "POST", signal: controller.signal });
      if (mountedRef.current && !controller.signal.aborted) { setRun(session.run); setSpeech(null); lastPlayedSequenceRef.current = 0; speechSequenceRef.current = 0; updatePhase("ready"); }
    } catch (cause) {
      if (mountedRef.current && !controller.signal.aborted) { setError(readableError(cause)); updatePhase("error"); }
    } finally { prepareRef.current = null; }
  }
  async function start() {
    if (!readyToStart || !run || controllerRef.current) return;
    const controller = new AbortController(); controllerRef.current = controller;
    setActive(true); setError(""); setSpeech(null); updatePhase("generating");
    try {
      if (!audioContextRef.current || audioContextRef.current.state === "closed") audioContextRef.current = new AudioContext({ latencyHint: "interactive" });
      await audioContextRef.current.resume(); controller.signal.throwIfAborted();
      const result = await runPodcastRehearsal({
        runId: run.id, maxTurns: 8, afterSequence: lastPlayedSequenceRef.current, signal: controller.signal, audioContext: audioContextRef.current,
        mixer: createSpeechAudioMixer(audioContextRef.current),
        onVoices: value => { if (mountedRef.current) { setVoices(value); const heard = value.at(-1); if (heard) setLastSpeech(heard.message); } },
        onHeard: sequence => { lastPlayedSequenceRef.current = Math.max(lastPlayedSequenceRef.current, sequence); },
        onRun: (updated) => { if (mountedRef.current) setRun(updated); },
        onSpeech: (message) => { if (mountedRef.current) { setSpeech(message); if (message) { setSpeechProgress(undefined); speechSequenceRef.current = message.sequence; } if (!message) { setViseme("rest"); setAudioLevel(0); } } },
        onProgress: (progress) => { if (mountedRef.current && !controller.signal.aborted) setSpeechProgress(progress); },
        onFrame: (shape, level) => { if (mountedRef.current && !controller.signal.aborted) { setViseme(shape); setAudioLevel(level); } },
        onPhase: (next) => { if (!controller.signal.aborted) updatePhase(next); },
      });
      if (mountedRef.current && !controller.signal.aborted) { setRun(result); updatePhase("complete"); }
    } catch (cause) {
      if (mountedRef.current) {
        if (controller.signal.aborted) updatePhase("stopped");
        else { setError(readableError(cause)); updatePhase("error"); }
      }
    } finally {
      controllerRef.current = null;
      if (mountedRef.current) { setActive(false); setSpeech(null); setVoices([]); setViseme("rest"); setAudioLevel(0); }
    }
  }
  function stop() {
    controllerRef.current?.abort();
    // Abort stops every scheduled source; keep the clock running for ended cleanup.
    setSpeech(null); setVoices([]); setViseme("rest"); setAudioLevel(0); updatePhase("stopped");
  }

  const phaseTitle: Record<RehearsalPhase, string> = {
    idle: copy("Prepariamo i due conduttori.", "Let’s prepare the two hosts."),
    preparing: copy("Salvataggio della prova…", "Saving the rehearsal…"),
    ready: copy("Prova preparata. La parola passa a te.", "Rehearsal ready. You can start it."),
    generating: copy("Attesa della risposta…", "Waiting for the response…"),
    buffering: copy("Preparazione della voce…", "Preparing the voice…"),
    speaking: voices.length > 1 ? copy("Botta e risposta · due voci in scena", "Quick exchange · two voices on air") : speech ? copy("Sta parlando", "Speaking:") + " " + speech.speakerName : copy("Voce in riproduzione", "Voice playback"),
    pause: copy("Pausa editoriale fra le due voci", "Editorial pause between the two voices"),
    complete: copy("Prova conclusa.", "Rehearsal complete."),
    stopped: copy("Prova fermata.", "Rehearsal stopped."),
    error: copy("La prova richiede una verifica.", "The rehearsal needs attention."),
  };
  const phaseHelp = phase === "generating" || phase === "buffering" ? copy("Questo è tempo tecnico di generazione o di avvio della voce; non è una pausa recitata.", "This is technical generation or voice startup time, not an editorial pause.")
    : phase === "pause" ? copy("Una breve pausa segue il ritmo del dialogo. La replica viene preparata mentre l'altro parla.", "A short pause follows the dialogue’s pace. The reply is prepared while the other host speaks.")
    : phase === "speaking" ? copy("Bocca e movimento seguono l’audio in riproduzione.", "Mouth and movement follow the audio being played.")
    : copy("Avvio e ripresa richiedono un tuo clic. Nessuna generazione parte al caricamento.", "Starting and resuming require your click. Loading the page does not generate anything.");

  return <div className={styles.workspace}>
    <Link className={styles.back} href="/podcast">← {copy("Tutti i podcast", "All podcasts")}</Link>
    <header className={styles.topline}>
      <div><div className={styles.eyebrow}>{copy("PRIMA, ASCOLTIAMOLI PARLARE", "FIRST, LET’S HEAR THEM TALK")}</div><h1 className={styles.heading}>{copy("Prova a due voci", "Two-voice rehearsal")}</h1><p className={styles.intro}>{copy("Due conduttori, un argomento concreto e il tempo per ascoltarsi. Prima verifichiamo voci, reazioni e ritmo; poi aggiungeremo l’ospite.", "Two hosts, one concrete topic, and time to listen to each other. First we check voices, reactions, and pacing; then we add a guest.")}</p></div>
      <Link className={styles.secondary} href={`/podcast/preview?${studioSelectionQuery({ ...input.settings, studioLayout: direction.layout })}`}>{copy("Anteprima grafica senza audio", "Silent visual preview")} ↗</Link>
    </header>
    {error && <div className={styles.error} role="alert">{error}</div>}
    <div className={rehearsal.layout}>
      <div className={rehearsal.main}>
        <div className={rehearsal.stageGroup}>
          <div className={rehearsal.stage} data-testid="rehearsal-stage">
            <PodcastStageView spokenTopic={(speech ?? lastSpeech)?.threadLabel} talk={stageTalk} direction={effectiveDirection} performance={actingCue} voices={voices} speakingIndex={phase === "speaking" ? speech?.participantIndex : undefined} audioLevel={audioLevel} viseme={viseme} />
          </div>
          <div className={rehearsal.stageBadge} data-testid="rehearsal-stage-label"><i className={`${rehearsal.badgeDot} ${phase === "speaking" ? rehearsal.speakingDot : ""}`} />{copy("PROVA · DUE AI", "REHEARSAL · TWO AI HOSTS")}</div>
        </div>
        <div className={rehearsal.status} data-testid="rehearsal-phase" data-phase={phase} role="status" aria-live="polite">
          <div><div className={rehearsal.statusLabel}>{(phase === "generating" || phase === "buffering") ? copy("ATTESA TECNICA", "TECHNICAL WAIT") : phase === "pause" ? copy("RITMO DEL DIALOGO", "DIALOGUE PACING") : copy("STATO DELLA PROVA", "REHEARSAL STATUS")}</div><div className={rehearsal.statusTitle}>{phaseTitle[phase]}</div><p className={rehearsal.statusHelp}>{phaseHelp}</p></div>
          {active && phase !== "pause" && <div className={rehearsal.statusClock} aria-hidden="true">{phaseSeconds}s</div>}
        </div>
        <div className={rehearsal.caption} data-testid="rehearsal-caption">
          {voices.length > 1 ? voices.map(voice => <div key={voice.message.sequence}><div className={rehearsal.captionName}>{voice.message.speakerName}</div><p className={rehearsal.captionText}>{podcastPerformanceFrame(voice.message, voice.progress)?.sentence.text ?? voice.message.content}</p></div>) : phase === "speaking" && speech ? <><div className={rehearsal.captionName}>{speech.speakerName}</div><p className={rehearsal.captionText}>{performanceFrame?.sentence.text ?? speech.content}</p></> : <p className={rehearsal.captionEmpty}>{copy("Qui comparirà il testo dell’intervento che stai ascoltando. La trascrizione completa rimane sotto.", "The turn you are listening to will appear here. The full transcript stays below.")}</p>}
        </div>
        {speech && performanceFrame && <PodcastMoodReadout message={speech} frame={performanceFrame} />}
        <section className={rehearsal.panel}>
          <h2>{copy("La prova, parola per parola", "The rehearsal, word for word")}</h2><p className={rehearsal.panelIntro}>{copy("Solo gli interventi effettivamente generati, nell’ordine della conversazione.", "Only the turns actually generated, in conversation order.")}</p>
          <div className={rehearsal.transcript} ref={transcriptRef} data-testid="rehearsal-transcript" aria-live="polite" aria-relevant="additions">
            {run?.messages.length ? run.messages.map((message) => <article className={`${rehearsal.turn} ${phase === "speaking" && speech?.sequence === message.sequence ? rehearsal.turnSpeaking : ""}`} key={message.sequence}><div className={rehearsal.turnHeader}>{message.speakerName}<small>AI · {message.sequence}</small></div><PodcastPerformanceText message={message} /></article>) : <p className={rehearsal.transcriptEmpty}>{copy("La preparazione salva la configurazione e crea una sessione vuota. Gli interventi arriveranno dopo Avvia prova.", "Preparation saves the configuration and creates an empty session. Turns appear after you press Start rehearsal.")}</p>}
          </div>
        </section>
        <fieldset className={rehearsal.fieldset} disabled={locked}>
          <section className={rehearsal.panel}>
            <h2>{copy("Un tema e due personalità", "One topic, two personalities")}</h2><p className={rehearsal.panelIntro}>{copy("La stessa domanda, due modi diversi di affrontarla. Puoi preparare una nuova prova dopo aver modificato queste scelte.", "The same question, two different ways to explore it. Prepare a new rehearsal after changing these choices.")}</p>
            <Field label={copy("Argomento della prova", "Rehearsal topic")}><input className={styles.input} maxLength={2000} required value={input.topic} onChange={(event) => changeInput({ ...input, topic: event.target.value })} /></Field>
            <Field label={copy("Lingua delle voci", "Voice language")}><select className={styles.input} value={input.language} onChange={event => changeLanguage(event.target.value)}><option value="it">Italiano</option><option value="en">English</option></select></Field>
            <Field label={copy("Ritmo della conversazione", "Conversation pace")}><select className={styles.input} data-testid="rehearsal-pace" value={input.settings.allowInterruptions ? "lively" : input.settings.pace === "deep" ? "reflective" : "natural"} onChange={event => changeInput({ ...input, settings: { ...input.settings, pace: event.target.value === "lively" ? "fast" : event.target.value === "reflective" ? "deep" : "balanced", allowInterruptions: event.target.value === "lively" } })}><option value="natural">{copy("Naturale · repliche rapide", "Natural · quick replies")}</option><option value="lively">{copy("Vivace · anche brevi sovrapposizioni", "Lively · brief overlaps too")}</option><option value="reflective">{copy("Riflessivo · più spazio alle pause", "Thoughtful · more room for pauses")}</option></select></Field>
            <PodcastVisualSettings talk={{ ...input, settings: { ...input.settings, studioLayout: direction.layout } }} direction={direction} disabled={locked} onChange={settings => { setDirection(current => ({ ...current, layout: normalizeStudioScenario(settings.studioLayout) })); changeInput({ ...input, settings }); }} />
            <Field label={copy("Servizio delle voci", "Voice service")}><select className={styles.input} data-testid="rehearsal-voice-provider" value={voiceProvider} onChange={(event) => { const provider = event.target.value as "kokoro" | "inworld"; changeInput({ ...input, settings: { ...input.settings, voiceProvider: provider }, participants: input.participants.map((person) => ({ ...person, voiceId: voiceFor(input.language, person.sex, provider) })) }); }}><option value="kokoro" disabled={input.language !== "it"}>{copy("Kokoro locale · Nicola e Sara", "Local Kokoro · Nicola and Sara")}</option><option value="inworld">Inworld</option></select></Field>
            <div className={rehearsal.people}>
              {input.participants.map((person, index) => <div className={rehearsal.person} data-testid={`personality-card-${index}`} key={index}>
                <div className={rehearsal.personHeader}><span className={rehearsal.initial}>{person.name.slice(0, 1)}</span><div><strong>{copy("Conduttore", "Host")} {index + 1}</strong><small>{copy("PERSONALITÀ AI", "AI PERSONALITY")}</small></div></div>
                <Field label={copy("Nome", "Name")}><input className={styles.input} required maxLength={80} value={person.name} onChange={(event) => changePerson(index, { name: event.target.value })} /></Field>
                <Field label={copy("Voce", "Voice")}><select className={styles.input} data-testid={`rehearsal-voice-${index}`} value={person.voiceId || ""} onChange={(event) => changePerson(index, { voiceId: event.target.value })}>{PODCAST_VOICES.filter((voice) => voice.provider === voiceProvider && voice.language === input.language && voice.gender === person.sex).map((voice) => <option key={voice.id} value={voice.id}>{voice.name}</option>)}</select></Field>
                <div className={rehearsal.voiceCaption}><i />{voiceProvider === "kokoro" ? "Kokoro" : "Inworld"} · {copy("catalogo condiviso Conclavia", "Conclavia shared catalog")}</div>
                <PodcastPersonalityFields person={person} index={index} language={input.language} voiceProvider={input.settings.voiceProvider} defaultModel={input.settings.defaultModel} onChange={values => changePerson(index, values)} />
              </div>)}
            </div>
          </section>
        </fieldset>
      </div>
      <aside className={rehearsal.sidebar}>
        <section className={rehearsal.panel}>
          <h2>{copy("Una prova breve, completa.", "A short, complete rehearsal.")}</h2><p className={rehearsal.panelIntro}>{copy("Prima salviamo la preparazione. Poi, con un tuo clic, i due AI conversano a turno e ascoltiamo ogni voce fino alla fine.", "First we save the setup. Then, with your click, the two AI hosts take turns and we hear each voice through to the end.")}</p>
          <div className={rehearsal.readiness}><div className={rehearsal.readinessRow}><span>{copy("Generazione AI", "AI generation")}</span><b className={aiReady ? rehearsal.ready : rehearsal.unavailable}>{checking ? "…" : aiReady ? copy("Pronta", "Ready") : copy("Non attiva", "Not active")}</b></div><div className={rehearsal.readinessRow}><span>{copy("Sintesi vocale", "Speech synthesis")}</span><b className={voiceReady ? rehearsal.ready : rehearsal.unavailable}>{checking ? "…" : voiceReady ? copy("Pronta", "Ready") : copy("Non attiva", "Not active")}</b></div></div>
          <div className={rehearsal.controls}>
            <button className={styles.secondary} data-testid="rehearsal-prepare" onClick={() => void prepare()} disabled={locked || Boolean(talk && run && phase !== "complete") || !input.topic.trim() || input.participants.some((person) => !person.name.trim() || !person.role.trim() || (person.perspectiveMode === "custom" && !person.perspectivePrompt.trim()))}>{preparing ? copy("Preparazione…", "Preparing…") : phase === "complete" ? copy("Prepara nuova prova", "Prepare new rehearsal") : talk && run ? copy("Prova preparata", "Rehearsal prepared") : copy("Prepara prova", "Prepare rehearsal")}</button>
            <button className={styles.primary} data-testid="rehearsal-start" onClick={() => void start()} disabled={!readyToStart}>{phase === "stopped" ? copy("Riprendi prova", "Resume rehearsal") : copy("Avvia prova", "Start rehearsal")} ▷</button>
            <button className={styles.danger} data-testid="rehearsal-stop" onClick={stop} disabled={!active}>{copy("Ferma prova", "Stop rehearsal")} ■</button>
          </div>
          <div className={rehearsal.progress}><i style={{ width: `${Math.min(100, (run?.participantTurnCount ?? 0) / 8 * 100)}%` }} /></div><div className={rehearsal.stats}><span><strong>{run?.participantTurnCount ?? 0}/8</strong> {copy("interventi", "turns")}</span><span><strong>{Math.round(run?.estimatedAirtimeSeconds ?? 0)}/120</strong> s</span></div>
          <p className={rehearsal.limit}>{copy("Massimo 8 interventi e 2 minuti di parlato stimato. La replica si prepara durante l'ascolto; le pause seguono il dialogo. Il ritmo Vivace permette brevi sovrapposizioni tra i due AI.", "Up to 8 turns and 2 minutes of estimated speech. Replies prepare during listening and pauses follow the dialogue. Lively pace permits brief overlaps between the two AI hosts.")}</p>
          {!aiReady || !voiceReady ? <p className={rehearsal.editNote}>{copy("La grafica e la preparazione sono disponibili. Per avviare entrambe le voci servono generazione AI e sintesi vocale attive sul server.", "Visuals and preparation are available. Starting both voices requires AI generation and speech synthesis to be active on the server.")}</p> : <p className={rehearsal.editNote}>{voiceProvider === "kokoro" ? copy("Avvia usa il modello AI configurato e le voci Kokoro locali, senza credito TTS. Prepara non genera risposte e non produce audio.", "Start uses the configured AI model and local Kokoro voices, with no TTS credit. Prepare does not generate responses or audio.") : copy("Avvia usa i servizi AI e Inworld configurati e ne consuma il credito. Prepara non genera risposte e non produce audio.", "Start uses the configured AI and Inworld services and consumes their credit. Prepare does not generate responses or audio.")}</p>}
          <button className={styles.linkButton} style={{ marginTop: 12 }} disabled={locked || checking} onClick={() => void refreshReadiness()}>{copy("Verifica servizi", "Check services")} ↻</button>
          {talk && <p style={{ marginTop: 14 }}><Link className={styles.linkButton} href={`/podcast/${talk.id}/studio`}>{copy("Apri nella regia completa", "Open full control room")} ↗</Link></p>}
        </section>
        <fieldset className={rehearsal.fieldset} disabled={locked}>
          <section className={rehearsal.panel}>
            <h2>{copy("Le reazioni dei conduttori", "The hosts’ reactions")}</h2><label className={styles.switch}><input type="checkbox" checked={direction.automatic} onChange={(event) => setDirection({ ...direction, automatic: event.target.checked })} />{copy("Segui il mood di ogni frase", "Follow each sentence’s mood")}</label>
            {!direction.automatic && <div className={rehearsal.expressionRow}>{input.participants.map((person, index) => <Field label={person.name} key={index}><select className={styles.input} value={index === 0 ? direction.emotion : direction.emotion2} onChange={(event) => setDirection({ ...direction, ...(index === 0 ? { emotion: event.target.value as PodcastEmotion } : { emotion2: event.target.value as PodcastEmotion }) })}>{expressionOptions.map(([emotion, it, en]) => <option key={emotion} value={emotion}>{copy(it, en)}</option>)}</select></Field>)}</div>}
            <p className={rehearsal.manualNote}>{copy("Espressioni distinte, ascolto e sguardo verso chi parla. Le reazioni sono scelte dalla regia, non dedotte dalle emozioni di una persona reale.", "Different expressions, listening, and gaze toward the speaker. Reactions are chosen by direction, not inferred from a real person’s emotions.")}</p>
          </section>
        </fieldset>
      </aside>
    </div>
  </div>;
}
