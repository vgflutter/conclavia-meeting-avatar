"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TalkResponse } from "@/types/podcast";
import type { TalkRunResponse } from "@/types/podcast-run";
import { STUDIO_THEMES, type StudioThemeId } from "@/lib/podcast/studio-themes";
import { playStreamingSpeech } from "@/lib/streaming-voice-player";
import { PodcastStageView, DEFAULT_DIRECTION, resolvePodcastDirection, type PodcastDirection, type PodcastEmotion, type PodcastShot } from "./PodcastStageView";
import { defaultPodcast } from "./podcast-defaults";
import { Field, PodcastTabs, podcastRequest, readableError, usePodcastCopy } from "./PodcastUi";
import styles from "./Podcast.module.css";
import { PodcastStylePicker } from "./PodcastStylePicker";
import design from "./PodcastStyles.module.css";

interface Capability { ai: { enabled: boolean; ready: boolean; providers?: { openai: boolean; gemini: boolean } }; speech: { enabled: boolean; ready: boolean; model?: string; providers?: { inworld: boolean; kokoro: boolean } } }
const NO_CAPABILITY: Capability = { ai: { enabled: false, ready: false }, speech: { enabled: false, ready: false } };
const emotions: Array<[PodcastEmotion, string, string]> = [["attention", "Attenzione", "Attention"], ["curiosity", "Curiosità", "Curiosity"], ["doubt", "Dubbio", "Doubt"], ["agreement", "Accordo", "Agreement"], ["amusement", "Ironia", "Amusement"], ["empathy", "Empatia", "Empathy"], ["disagreement", "Disaccordo", "Disagreement"], ["surprise", "Sorpresa", "Surprise"]];
const phaseLabels: Record<string, [string, string]> = { positions: ["Punti di vista", "Positions"], conflict: ["Confronto", "Debate"], examination: ["Approfondimento", "Examination"], synthesis: ["Sintesi", "Synthesis"], conclusion: ["Conclusione", "Conclusion"] };


export function PodcastStudio({ id, preview = false, initialTheme }: { id: string; preview?: boolean; initialTheme?: StudioThemeId }) {
  const copy = usePodcastCopy();
  const [talk, setTalk] = useState<TalkResponse | null>(() => { if (!preview) return null; const initial = defaultPodcast(copy("it", "en") === "en"); return { ...initial, settings: { ...initial.settings, studioTheme: initialTheme ?? initial.settings.studioTheme }, id: "preview", createdAt: "", updatedAt: "" }; });
  const [run, setRun] = useState<TalkRunResponse | null>(null);
  const [runs, setRuns] = useState<TalkRunResponse[]>([]);
  const [capability, setCapability] = useState<Capability>(NO_CAPABILITY);
  const [loading, setLoading] = useState(!preview);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [humanText, setHumanText] = useState("");
  const [direction, setDirection] = useState<PodcastDirection>(DEFAULT_DIRECTION);
  const [guestStream, setGuestStream] = useState<MediaStream | null>(null);
  const [cameraPending, setCameraPending] = useState(false);
  const [programOnly, setProgramOnly] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | undefined>();
  const [audioLevel, setAudioLevel] = useState(0);
  const [viseme, setViseme] = useState("rest");
  const [demoIndex, setDemoIndex] = useState(-1);
  const [demoPlaying, setDemoPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState("");
  const [recordingExtension, setRecordingExtension] = useState("webm");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const recordTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const onCanvasReady = useCallback((canvas: HTMLCanvasElement | null) => { canvasRef.current = canvas; }, []);
  const speechAbort = useRef<AbortController | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const cameraRef = useRef<MediaStream | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const runId = run?.id;
  const messageCount = run?.messages.length ?? 0;

  useEffect(() => {
    if (preview) return;
    let active = true;
    Promise.all([podcastRequest<{ talk: TalkResponse }>(`/api/podcast/talks/${id}`), podcastRequest<{ runs: TalkRunResponse[]; run: TalkRunResponse | null }>(`/api/podcast/talks/${id}/runs`), podcastRequest<Capability>("/api/podcast/config").catch(() => NO_CAPABILITY)])
      .then(([project, history, services]) => { if (active) { setTalk(project.talk); setRuns(history.runs); setRun(history.run); setCapability(services); } }).catch((cause) => { if (active) setError(readableError(cause)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, preview]);
  useEffect(() => {
    if (preview || !runId) return;
    const controller = new AbortController();
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") podcastRequest<{ run: TalkRunResponse }>(`/api/podcast/runs/${runId}`, { signal: controller.signal }).then((data) => setRun(data.run)).catch(() => undefined); }, 5000);
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [runId, preview]);
  useEffect(() => {
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(`conclavia-podcast-${id}`); broadcastRef.current = channel;
    return () => { channel?.close(); broadcastRef.current = null; };
  }, [id]);
  useEffect(() => {
    const payload = { direction, runId: runId ?? null };
    broadcastRef.current?.postMessage(payload);
    try { localStorage.setItem(`conclavia-podcast-direction-${id}`, JSON.stringify(payload)); } catch { /* Private browsing may disable storage. */ }
  }, [direction, id, runId]);
  useEffect(() => () => { speechAbort.current?.abort(); cameraRef.current?.getTracks().forEach((track) => track.stop()); void audioContext.current?.close().catch(() => undefined); }, []);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; if (recorderRef.current?.state === "recording") recorderRef.current.stop(); recordStreamRef.current?.getTracks().forEach((track) => track.stop()); if (recordTimerRef.current !== null) window.clearTimeout(recordTimerRef.current); }; }, []);
  useEffect(() => () => { if (recordingUrl) URL.revokeObjectURL(recordingUrl); }, [recordingUrl]);
  useEffect(() => { if (!programOnly) return; const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setProgramOnly(false); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [programOnly]);
  useEffect(() => { if (!demoPlaying) return; const timer = window.setInterval(() => setDemoIndex((current) => { if (current >= 4) { setDemoPlaying(false); return current; } return current + 1; }), 4500); return () => window.clearInterval(timer); }, [demoPlaying]);
  useEffect(() => { const transcript = transcriptRef.current; if (transcript) transcript.scrollTop = transcript.scrollHeight; }, [messageCount, demoIndex]);

  const demoTexts = [copy("Benvenuti a Due punti di vista. Oggi partiamo da una domanda: che cosa vale la pena affidare all’AI?", "Welcome to Two Points of View. Today’s question: what is worth delegating to AI?"), copy("Dipende da quanto comprendiamo il lavoro che stiamo delegando. All’ospite chiederei un esempio concreto.", "It depends on how well we understand the work we delegate. I’d ask our guest for a concrete example."), copy("Nel mio lavoro mi aiuta a preparare una prima bozza. Ma la scelta finale e il rapporto con le persone rimangono miei.", "In my work, it helps me prepare a first draft. But the final decision and relationships remain mine."), copy("Quindi il valore non sta solo nel tempo risparmiato. Sta anche nel poter dedicare più attenzione alle persone?", "So the value is not only time saved. Is it also being able to pay more attention to people?"), copy("Mi interessa quel confine: come ci accorgiamo quando stiamo delegando anche il nostro giudizio?", "I’m interested in that boundary: how do we notice when we’re delegating our own judgment too?")];
  const demoSpeakers = [0, 1, 2, 0, 1];
  const latestMessage = run?.messages.at(-1);
  const latestAI = run?.messages.findLast((message) => message.origin === "ai");
  const viewTalk = run?.talkSnapshot ?? talk;
  const hasHuman = viewTalk?.participants.some((person) => person.kind === "human");
  const effectiveDirection: PodcastDirection = preview && direction.automatic ? { ...direction,
    focus: demoIndex >= 0 ? demoSpeakers[demoIndex] === 2 ? "guest" : demoSpeakers[demoIndex] === 0 ? "host-1" : "host-2" : "all",
    emotion: demoIndex >= 0 ? ["attention", "curiosity", "empathy", "agreement", "doubt"][demoIndex] as PodcastEmotion : "attention",
    emotion2: demoIndex >= 0 ? ["curiosity", "attention", "curiosity", "amusement", "attention"][demoIndex] as PodcastEmotion : "curiosity" }
    : viewTalk ? resolvePodcastDirection(direction, viewTalk, latestMessage) : direction;
  const provider = viewTalk?.settings.defaultModel.startsWith("gemini") ? "gemini" : "openai";
  const aiReady = capability.ai.enabled && (capability.ai.providers ? capability.ai.providers[provider] : capability.ai.ready);
  const voiceProvider = viewTalk?.settings.voiceProvider ?? "inworld";
  const speechReady = capability.speech.enabled && (capability.speech.providers?.[voiceProvider] ?? capability.speech.ready);
  const canAdvance = Boolean(run && !["generating", "waiting_for_human", "completed", "failed"].includes(run.status) && aiReady && !pending && !playing);

  async function runAction(endpoint: string, body?: unknown) {
    setPending(true); setError("");
    try { const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" }); const result = await response.json(); if (result.run) { setRun(result.run); setRuns((current) => [result.run, ...current.filter((entry) => entry.id !== result.run.id)]); } if (!response.ok) throw new Error(result.error || copy("Operazione non riuscita", "Operation failed")); if (endpoint.endsWith("human-turn")) setHumanText(""); }
    catch (cause) { setError(readableError(cause)); } finally { setPending(false); }
  }
  async function toggleCamera() {
    if (cameraRef.current) { cameraRef.current.getTracks().forEach((track) => track.stop()); cameraRef.current = null; setGuestStream(null); return; }
    setCameraPending(true); setError("");
    try { if (!navigator.mediaDevices?.getUserMedia) throw new Error(copy("La videocamera richiede HTTPS o localhost e un browser compatibile.", "Camera access requires HTTPS or localhost and a compatible browser.")); const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, audio: false }); cameraRef.current = stream; setGuestStream(stream); }
    catch (cause) { setError(readableError(cause)); } finally { setCameraPending(false); }
  }
  async function speakLatest() {
    if (speechAbort.current) { speechAbort.current.abort(); return; }
    if (!latestAI || !run || !speechReady) return;
    const controller = new AbortController(); speechAbort.current = controller;
    setError(""); setPlaying(true);
    try {
      if (!audioContext.current || audioContext.current.state === "closed") audioContext.current = new AudioContext({ sampleRate: 48000, latencyHint: "interactive" });
      await audioContext.current.resume(); controller.signal.throwIfAborted(); setSpeakingIndex(latestAI.participantIndex);
      await playStreamingSpeech({ endpoint: `/api/podcast/runs/${run.id}/speech`, payload: { sequence: latestAI.sequence }, signal: controller.signal, audioContext: audioContext.current,
        onFrame: (shape, level) => { setViseme(shape); setAudioLevel(level); }, onStart: () => undefined });
    } catch (cause) { if (!(cause instanceof DOMException && cause.name === "AbortError")) setError(readableError(cause)); }
    finally { setPlaying(false); setSpeakingIndex(undefined); setAudioLevel(0); setViseme("rest"); speechAbort.current = null; }
  }
  function updateDirection(values: Partial<PodcastDirection>) { setDirection((current) => ({ ...current, ...values })); }
  function useDemo() { if (demoPlaying) setDemoPlaying(false); else { if (demoIndex >= 4) setDemoIndex(-1); setDemoPlaying(true); } }
  function downloadTranscript() { if (!run || !viewTalk) return; const text = `# ${viewTalk.title}\n\n${viewTalk.topic}\n\n` + run.messages.map((message) => `${message.speakerName}\n${message.content}`).join("\n\n"); const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `podcast-${id}-transcript.txt`; anchor.click(); URL.revokeObjectURL(url); }
  function toggleRecording() {
    if (recorderRef.current?.state === "recording") { recorderRef.current.stop(); return; }
    setError("");
    try {
      const canvas = canvasRef.current;
      if (!canvas?.captureStream || typeof MediaRecorder === "undefined") throw new Error(copy("Questo browser non supporta la registrazione del canvas. Puoi acquisire Vista programma con la tua regia esterna.", "This browser does not support canvas recording. Capture Program view with your external production tools."));
      const mime = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm"].find((candidate) => MediaRecorder.isTypeSupported(candidate));
      if (!mime) throw new Error(copy("Nessun formato video di registrazione compatibile in questo browser.", "No compatible video recording format is available in this browser."));
      const stream = canvas.captureStream(30); recordStreamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 }); recorderRef.current = recorder;
      const chunks: Blob[] = []; let byteCount = 0;
      recorder.ondataavailable = (event) => { if (event.data.size) { chunks.push(event.data); byteCount += event.data.size; if (byteCount >= 50_000_000 && recorder.state === "recording") recorder.stop(); } };
      recorder.onstop = () => { stream.getTracks().forEach((track) => track.stop()); recordStreamRef.current = null; if (recordTimerRef.current !== null) window.clearTimeout(recordTimerRef.current); recordTimerRef.current = null; if (mountedRef.current) { setRecording(false); if (chunks.length) { setRecordingExtension(mime.startsWith("video/mp4") ? "mp4" : "webm"); setRecordingUrl(URL.createObjectURL(new Blob(chunks, { type: mime }))); } } };
      recorder.onerror = () => { stream.getTracks().forEach((track) => track.stop()); if (mountedRef.current) { setRecording(false); setError(copy("La registrazione è stata interrotta dal browser.", "The browser interrupted recording.")); } };
      recorder.start(1000); setRecording(true);
      recordTimerRef.current = window.setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 60_000);
    } catch (cause) { recordStreamRef.current?.getTracks().forEach((track) => track.stop()); recordStreamRef.current = null; setRecording(false); setError(readableError(cause)); }
  }

  if (loading) return <div className={styles.workspace}><div className={styles.loading}>{copy("Preparazione dello studio…", "Preparing the studio…")}</div></div>;
  if (!talk || !viewTalk) return <div className={styles.workspace}><Link className={styles.back} href="/podcast">← Podcast</Link><div className={styles.error} role="alert">{error || copy("Puntata non disponibile.", "Episode unavailable.")}</div><Link className={styles.primary} href="/podcast/preview">{copy("Esplora lo studio dimostrativo", "Explore the demo studio")} →</Link></div>;
  const caption = preview ? demoIndex >= 0 ? demoTexts[demoIndex] : "" : latestMessage?.content || "";
  const stage = <PodcastStageView talk={viewTalk} direction={effectiveDirection} guestStream={guestStream} speakingIndex={speakingIndex} audioLevel={audioLevel} viseme={viseme} onCanvasReady={onCanvasReady} />;
  if (programOnly) return <div className={styles.output}><button className={styles.outputExit} onClick={() => setProgramOnly(false)}>← {copy("Torna alla regia", "Back to control room")} · Esc</button><div className={styles.outputStage}>{stage}{preview && <div className={styles.outputBadge}>{copy("ANTEPRIMA GRAFICA · TESTI DIMOSTRATIVI", "VISUAL PREVIEW · SAMPLE SCRIPT")}</div>}{direction.captions && caption && <div className={styles.outputCaption}>{caption.length > 260 ? caption.slice(0, 260).trimEnd() + "…" : caption}</div>}</div></div>;

  return <div className={styles.workspace}>
    <Link className={styles.back} href="/podcast">← {copy("Tutti i podcast", "All podcasts")}</Link>
    <header className={styles.topline}><div><div className={styles.eyebrow}>{preview ? copy("STUDIO DIMOSTRATIVO", "DEMO STUDIO") : copy("LA REGIA", "THE CONTROL ROOM")}</div><h1 className={styles.heading}>{talk.title}</h1><p className={styles.intro}>{talk.centralQuestion || talk.topic}</p></div><div className={styles.actions}>{preview ? <Link className={styles.secondary} href="/podcast/new">{copy("Prepara la tua puntata", "Prepare your episode")}</Link> : <Link className={styles.secondary} href={`/podcast/${id}`}>{copy("Modifica puntata", "Edit episode")}</Link>}<button className={styles.primary} disabled={recording} onClick={() => setProgramOnly(true)}>{copy("Vista programma", "Program view")} ↗</button></div></header>
    {!preview && <PodcastTabs id={id} active="studio" />}
    {preview && <div className={styles.notice}>{copy("Anteprima locale senza chiamate AI, sintesi vocale o salvataggi. La sequenza usa testi dimostrativi; puoi provare stili, emozioni, inquadrature e la tua videocamera.", "Local preview with no AI calls, speech synthesis, or saves. The sequence uses a sample script; try styles, emotions, camera shots, and your camera.")}</div>}
    {error && <div className={styles.error} role="alert">{error}</div>}
    {!preview && run?.talkSnapshot && talk.updatedAt !== run.talkSnapshot.updatedAt && <div className={styles.notice}>{copy("Questa sessione usa la configurazione salvata al suo avvio. Per applicare le modifiche alla puntata, concludi la sessione e creane una nuova.", "This session uses the configuration saved when it started. End this session and create a new one to apply episode changes.")}</div>}
    <div className={styles.studioLayout}><div><div className={styles.stageContainer} data-testid="podcast-stage"><div className={styles.stageStatus}><i className={styles.dot} />{preview ? copy("ANTEPRIMA", "PREVIEW") : playing ? copy("RIPRODUZIONE VOCE", "VOICE PLAYBACK") : copy("STUDIO", "STUDIO")}</div>{stage}</div>
      <div className={styles.stageToolbar}><div className={styles.shotGroup}>{([ ["all", copy("Tutti", "All")], ["guest", copy("Ospite", "Guest")], ["host-1", viewTalk.participants.filter((p) => p.kind === "ai")[0]?.name || "AI 1"], ["host-2", viewTalk.participants.filter((p) => p.kind === "ai")[1]?.name || "AI 2"] ] as Array<[PodcastShot, string]>).filter(([shot]) => shot !== "guest" || hasHuman).map(([shot, label]) => <button key={shot} className={`${styles.shot} ${effectiveDirection.focus === shot ? styles.activeShot : ""}`} aria-pressed={effectiveDirection.focus === shot} onClick={() => updateDirection({ focus: shot, automatic: false })}>{label}</button>)}</div><label className={styles.switch} style={{ margin: 0 }}><input type="checkbox" checked={direction.automatic} onChange={(event) => updateDirection({ automatic: event.target.checked })} />{copy("Regia automatica", "Automatic direction")}</label></div>
      {preview && <div className={styles.actions} style={{ marginBottom: 18 }}><button className={styles.primary} onClick={useDemo}>{demoPlaying ? copy("Pausa sequenza", "Pause sequence") : copy("Prova la sequenza", "Play sample sequence")}</button><button className={styles.secondary} onClick={() => { setDemoPlaying(false); setDemoIndex(-1); }}>{copy("Ricomincia", "Reset")}</button><span className={styles.statusText}>{copy("Sequenza visiva silenziosa · 23 secondi", "Silent visual sequence · 23 seconds")}</span></div>}
      <section className={styles.panel}><div className={styles.sectionHeading} style={{ margin: "0 0 18px" }}><h2>{copy("La conversazione", "The conversation")}</h2>{run && <button className={styles.linkButton} onClick={downloadTranscript}>{copy("Esporta testo", "Export text")} ↓</button>}</div><div className={styles.transcript} ref={transcriptRef} aria-live="polite" aria-relevant="additions text">
        {preview ? demoIndex >= 0 ? demoTexts.slice(0, demoIndex + 1).map((text, index) => <article className={`${styles.message} ${demoSpeakers[index] === 2 ? styles.messageHuman : ""}`} key={index}><div className={styles.messageName}>{viewTalk.participants[demoSpeakers[index]]?.name}<small>{copy("TESTO DIMOSTRATIVO", "SAMPLE SCRIPT")}</small></div><p>{text}</p></article>) : <p className={styles.messageEmpty}>{copy("Avvia la sequenza o esplora liberamente la regia. I testi sono esempi preparati, non risposte AI.", "Play the sequence or explore the controls. The script is a prepared example, not AI-generated responses.")}</p> : run?.messages.length ? run.messages.map((message) => <article className={`${styles.message} ${message.origin === "human" ? styles.messageHuman : ""}`} key={message.sequence}><div className={styles.messageName}>{message.speakerName}<small>{message.origin === "human" ? copy("OSPITE · TESTO", "GUEST · TEXT") : "AI"} · {message.sequence}</small></div><p>{message.content}</p></article>) : <p className={styles.messageEmpty}>{copy("Qui compariranno gli interventi della sessione. Crea una sessione, poi genera un intervento alla volta.", "Session turns will appear here. Create a session, then generate one turn at a time.")}</p>}
      </div></section>
      <div className={styles.studioBottom}><section className={styles.panel}><h2>{copy("Lo spazio dell’ospite", "The guest’s space")}</h2><p className={styles.panelIntro}>{copy("La videocamera entra nello schermo dello studio. Per questa prova il video viene dal dispositivo su cui è aperta la regia.", "The camera appears on the studio screen. In this version, video comes from the device running the control room.")}</p>{hasHuman ? <><button className={guestStream ? styles.secondary : styles.primary} onClick={() => void toggleCamera()} disabled={cameraPending}>{cameraPending ? copy("Apertura videocamera…", "Opening camera…") : guestStream ? copy("Spegni videocamera locale", "Turn off local camera") : copy("Prova videocamera locale", "Try local camera")}</button><p className={styles.cameraNotice} style={{ marginTop: 12 }}>{copy("Nessun microfono viene attivato. Il collegamento remoto e la trascrizione vocale dell’ospite non sono ancora integrati.", "The microphone stays off. Remote guest connection and guest speech transcription are not integrated yet.")}</p></> : <p className={styles.detailsBlock}>{copy("Aggiungi un ospite nella configurazione della puntata per utilizzare questo spazio.", "Add a guest to the episode configuration to use this space.")}</p>}</section>
      <section className={styles.panel}><h2>{copy("L’uscita del programma", "Program output")}</h2><p className={styles.panelIntro}>{copy("Vista programma mostra solo la scena, la videocamera e i sottotitoli in questa finestra, pronta da acquisire con la tua regia esterna.", "Program view shows only the scene, camera, and captions in this window, ready to capture with your external production tools.")}</p><button className={styles.secondary} disabled={recording} onClick={() => setProgramOnly(true)}>{copy("Apri vista programma", "Open program view")} ↗</button><div className={styles.divider} /><div className={styles.actions}><button data-testid="podcast-record" className={recording ? styles.danger : styles.secondary} onClick={toggleRecording}>{recording ? "■ " + copy("Ferma registrazione", "Stop recording") : "● " + copy("Registra prova grafica", "Record visual test")}</button>{recordingUrl && !recording && <a data-testid="podcast-record-download" className={styles.linkButton} href={recordingUrl} download={`conclavia-podcast-graphic-test.${recordingExtension}`}>{copy("Scarica video", "Download video")} ↓</a>}</div><p className={styles.cameraNotice} style={{ marginTop: 10 }}>{recording ? copy("Registrazione della scena in corso. Arresto automatico dopo 60 secondi o 50 MB.", "Recording the scene. Stops automatically after 60 seconds or 50 MB.") : copy("Clip locale senza audio, massimo 60 secondi. Include la videocamera locale nella scena; esclude sottotitoli e controlli. Nessun microfono o servizio esterno viene attivato.", "Local silent clip, up to 60 seconds. Includes the local camera in the scene; excludes captions and controls. No microphone or external service is activated.")}</p>{!preview && <p className={styles.cameraNotice} style={{ marginTop: 12 }}><Link className={styles.linkButton} href={`/podcast/${id}/broadcast`} target="_blank" rel="noopener noreferrer">{copy("Apri anche l’uscita separata", "Open separate output")} ↗</Link><br />{copy("L’uscita separata segue regia e testo; videocamera e audio restano nella finestra corrente.", "Separate output follows direction and text; camera and audio stay in this window.")}</p>}</section></div>
    </div><aside className={styles.studioSidebar}>
      <section className={styles.panel}><div className={styles.miniHeading}>{preview ? copy("PROVA GRAFICA", "VISUAL TEST") : copy("SESSIONE", "SESSION")}</div>{preview ? <><Field label={copy("Stile dei personaggi", "Character style")}><select data-testid="podcast-theme" className={styles.input} value={talk.settings.studioTheme} onChange={(event) => setTalk({ ...talk, settings: { ...talk.settings, studioTheme: event.target.value as TalkResponse["settings"]["studioTheme"] } })}>{STUDIO_THEMES.map((theme) => <option value={theme.id} key={theme.id}>{copy(theme.label.it, theme.label.en)}</option>)}</select></Field><div className={design.settingsPicker}><PodcastStylePicker compact talk={talk} value={talk.settings.studioTheme} legend={copy("Anteprime degli stili", "Style previews")} onChange={(theme) => setTalk({ ...talk, settings: { ...talk.settings, studioTheme: theme } })} /><Link className={design.embedLink} href={`/podcast/styles?style=${talk.settings.studioTheme}`}>{copy("Confronta stili e scenari", "Compare styles and scenes")} ↗</Link></div><p className={styles.cameraNotice}>{copy("Le espressioni sono controllate dalla regia. Il riconoscimento automatico delle emozioni dell’ospite non è attivo.", "Expressions are controlled by direction. Automatic recognition of guest emotions is not active.")}</p></> : <>
        {!run ? <p className={styles.detailsBlock}>{copy("Crea una sessione con una copia della configurazione. Nessuna risposta AI viene generata alla creazione.", "Create a session with a snapshot of the configuration. Creating a session does not generate AI responses.")}</p> : <><div className={styles.statRow}><span>{copy("Stato", "Status")}</span><strong>{run.status === "waiting_for_human" ? copy("Parola all’ospite", "Guest’s turn") : run.status === "completed" ? copy("Conclusa", "Completed") : run.status === "generating" ? copy("Generazione…", "Generating…") : run.status === "failed" ? copy("Da verificare", "Needs attention") : copy("Pronta", "Ready")}</strong></div><div className={styles.statRow}><span>{copy("Interventi", "Turns")}</span><strong>{run.participantTurnCount} / {run.maxTurns}</strong></div><div className={styles.progress}><i style={{ width: `${Math.min(100, run.participantTurnCount / run.maxTurns * 100)}%` }} /></div><div className={styles.statRow}><span>{copy("Durata stimata", "Estimated airtime")}</span><strong>{Math.floor(run.estimatedAirtimeSeconds / 60)}:{String(Math.round(run.estimatedAirtimeSeconds % 60)).padStart(2, "0")}</strong></div></>}
        <div className={styles.runControls}>{!run || run.status === "completed" || run.status === "failed" ? <button data-testid="podcast-new-run" className={styles.primary} onClick={() => void runAction(`/api/podcast/talks/${id}/runs`)} disabled={pending || talk.status !== "ready"}>{pending ? copy("Preparazione…", "Preparing…") : run ? copy("Nuova sessione", "New session") : copy("Crea sessione", "Create session")}</button> : <button data-testid="podcast-next-turn" className={styles.primary} disabled={!canAdvance} onClick={() => void runAction(`/api/podcast/runs/${run.id}/next`)}>{pending ? copy("Generazione…", "Generating…") : copy("Genera prossimo intervento", "Generate next turn")}</button>}
          <button data-testid="podcast-voice-play" className={styles.secondary} disabled={!latestAI || pending || !speechReady} onClick={() => void speakLatest()}>{playing ? "■ " + copy("Ferma voce", "Stop voice") : "▷ " + copy("Ascolta ultimo intervento AI", "Play latest AI turn")}</button>{run && !["completed", "failed"].includes(run.status) && <button className={styles.quiet} disabled={pending || playing || run.status === "generating"} onClick={() => void runAction(`/api/podcast/runs/${run.id}/stop`)}>{copy("Concludi sessione", "End session")}</button>}</div>
        {talk.status !== "ready" && <div className={styles.notice}>{copy("Imposta la puntata come Pronta per creare una sessione.", "Set the episode to Ready before creating a session.")}</div>}
        {!aiReady && <div className={styles.notice}>{copy("Generazione AI non attiva per questo modello. La preparazione e l’anteprima grafica sono disponibili.", "AI generation is not active for this model. Preparation and visual preview remain available.")}</div>}
        <p className={styles.cameraNotice} style={{ marginTop: 12 }}>{copy("Genera usa il servizio AI configurato; Ascolta usa la voce selezionata per questa puntata. La generazione AI richiede il servizio configurato; Kokoro sintetizza la voce localmente, Inworld usa il proprio credito. Nessun avvio automatico.", "Generate uses the configured AI service; Play uses the voice selected for this episode. AI generation uses the configured service; Kokoro synthesizes speech locally, while Inworld uses service credit. Neither starts automatically.")}</p>
        {runs.length > 1 && <><div className={styles.divider} /><Field label={copy("Sessioni salvate", "Saved sessions")}><select className={styles.input} disabled={pending || playing} value={run?.id || ""} onChange={(event) => { const selected = runs.find((entry) => entry.id === event.target.value); if (selected) setRun(selected); }}>{runs.map((entry, index) => <option value={entry.id} key={entry.id}>{copy("Sessione", "Session")} {runs.length - index} · {entry.messages.length} {copy("interventi", "turns")}</option>)}</select></Field></>}
      </>}</section>
      {!preview && hasHuman && <section className={styles.panel}><div className={styles.miniHeading}>{copy("INTERVENTO UMANO", "HUMAN CONTRIBUTION")}</div><p className={styles.cameraNotice}>{run?.status === "waiting_for_human" ? copy("La regia ha dato la parola a", "The floor is open for") + " " + (run.activeTurn?.speakerName || copy("l’ospite", "the guest")) + "." : copy("Il campo si attiva quando la regia dà la parola all’ospite.", "This field becomes active when direction gives the guest the floor.")}</p><form onSubmit={(event) => { event.preventDefault(); if (run) void runAction(`/api/podcast/runs/${run.id}/human-turn`, { content: humanText }); }}><textarea data-testid="podcast-human-input" className={`${styles.input} ${styles.textarea}`} style={{ margin: "12px 0" }} aria-label={copy("Contributo dell’ospite", "Guest contribution")} maxLength={8000} rows={4} disabled={run?.status !== "waiting_for_human" || pending} value={humanText} onChange={(event) => setHumanText(event.target.value)} placeholder={copy("Scrivi la risposta dell’ospite…", "Write the guest’s response…")} /><button data-testid="podcast-human-submit" className={`${styles.primary} ${styles.fullWidth}`} type="submit" disabled={run?.status !== "waiting_for_human" || pending || !humanText.trim()}>{copy("Inserisci nella conversazione", "Add to conversation")} →</button></form></section>}
      <section className={styles.panel}><div className={styles.miniHeading}>{copy("INQUADRATURA", "COMPOSITION")}</div><Field label={copy("Scena", "Scene")}><select data-testid="podcast-layout" className={styles.input} value={direction.layout} onChange={(event) => updateDirection({ layout: event.target.value as PodcastDirection["layout"] })}><option value="studio">{copy("Studio condiviso", "Shared studio")}</option><option value="speaker">{copy("Regia televisiva", "TV direction")}</option><option value="table">{copy("Ospite al tavolo", "Guest at the table")}</option></select></Field><label className={styles.switch}><input type="checkbox" checked={direction.captions} onChange={(event) => updateDirection({ captions: event.target.checked })} />{copy("Testo nella vista programma", "Text in program view")}</label></section>
      <section className={styles.panel}><div className={styles.miniHeading}>{copy("ESPRESSIONI IN ASCOLTO", "LISTENING EXPRESSIONS")}</div>{viewTalk.participants.filter((person) => person.kind === "ai").slice(0, 2).map((person, index) => <div key={index} style={{ marginBottom: 15 }}><Field label={person.name}><select data-testid={`podcast-expression-${index}`} className={styles.input} value={index === 0 ? effectiveDirection.emotion : effectiveDirection.emotion2 || "attention"} onChange={(event) => updateDirection(index === 0 ? { emotion: event.target.value as PodcastEmotion, automatic: false } : { emotion2: event.target.value as PodcastEmotion, automatic: false })}>{emotions.map(([emotion, it, en]) => <option value={emotion} key={emotion}>{copy(it, en)}</option>)}</select></Field><label className={styles.rangeRow}><span>{copy("Intensità", "Intensity")}<b>{Math.round((index === 0 ? direction.intensity : direction.intensity2 ?? 0.55) * 100)}%</b></span><input data-testid={`podcast-intensity-${index}`} type="range" min={0} max={100} value={(index === 0 ? direction.intensity : direction.intensity2 ?? 0.55) * 100} onChange={(event) => updateDirection(index === 0 ? { intensity: Number(event.target.value) / 100 } : { intensity2: Number(event.target.value) / 100 })} /></label></div>)}<p className={styles.cameraNotice}>{copy("La regia automatica associa l’espressione all’intento dell’intervento. È una scelta editoriale, non una lettura emotiva della persona.", "Automatic direction maps expression to the turn’s intent. This is an editorial choice, not emotion recognition of the person.")}</p></section>
    </aside></div>
    {run?.discussionState && <section className={styles.panel} style={{ marginTop: 22 }}><div className={styles.eyebrow}>{copy("IL FILO DEL DISCORSO", "THE DISCUSSION THREAD")}</div><h2 style={{ marginTop: 8 }}>{copy(...(phaseLabels[run.discussionState.arcPhase] || phaseLabels.positions))}</h2><div className={styles.phase}>{Object.keys(phaseLabels).map((phase, index) => <span key={phase} className={index <= Object.keys(phaseLabels).indexOf(run.discussionState.arcPhase) ? styles.phaseActive : ""} />)}</div><div className={styles.row}><div className={styles.detailsBlock}><strong>{copy("Obiettivo della fase", "Phase objective")}</strong><p>{run.discussionState.phaseObjective || "—"}</p><strong>{copy("Punto da approfondire", "Current focus")}</strong><p>{run.discussionState.currentFocus || run.discussionState.centralQuestion}</p></div><div className={styles.detailsBlock}><strong>{copy("Domande ancora aperte", "Open questions")}</strong><ul className={styles.summaryList}>{run.discussionState.openQuestions.map((question, index) => <li key={index}>{question}</li>)}</ul>{run.discussionState.conclusion && <><strong>{copy("Conclusione", "Conclusion")}</strong><p>{run.discussionState.conclusion.answer}</p></>}</div></div></section>}
  </div>;
}
