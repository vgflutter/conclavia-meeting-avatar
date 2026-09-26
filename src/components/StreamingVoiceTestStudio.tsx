"use client";

import { useEffect, useRef, useState } from "react";
import { BusinessAvatar, type AvatarGesture, type AvatarMood } from "@/components/BusinessAvatar";
import type { Locale } from "@/i18n/locale";
import type { AvatarViseme } from "@/lib/avatar-visemes";
import type { InworldModel } from "@/lib/meeting-tts-config";
import { playStreamingSpeech, type StreamingVoiceMetrics } from "@/lib/streaming-voice-player";
import { avatarVoiceName, voicesForAppearance, VOICE_PROVIDERS, DEFAULT_SPEAKING_RATE } from "@/lib/avatar-voice-catalog";
import { AvatarAppearanceSelect, AvatarSaveControls, useAvatarWorkspace } from "@/components/AvatarWorkspace";
import { AVATAR_PREVIEW_DURATION_MS, avatarPreviewFrame } from "@/lib/avatar-preview";

export function StreamingVoiceTestStudio({ locale, model: initialModel, configured }: {
  locale: Locale; model: InworldModel; configured: boolean;
}) {
  const it = locale === "it";
  const { draft, saved, update, saving } = useAvatarWorkspace();
  const [language, setLanguage] = useState<"it" | "en">(it ? "it" : "en");
  const [phrases, setPhrases] = useState<Partial<Record<"it" | "en", string>>>({});
  const text = phrases[language] ?? (language === "it" ? `Ciao, sono ${draft.displayName}. Ti sento, dimmi pure.` : `Hello, I'm ${draft.displayName}. I can hear you. Go ahead.`);
  const candidates = { it: draft.voiceIt, en: draft.voiceEn };
  const provider = VOICE_PROVIDERS.inworld;
  const availableVoices = voicesForAppearance(draft.appearance, language, provider.id);
  const selectedVoice = availableVoices.find(voice => voice.id === candidates[language]);
  const speakingRate = draft.speakingRate;
  const formatRate = (value: number) => `${value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}×`;
  const [model, setModel] = useState(initialModel);
  const [state, setState] = useState<"ready" | "preparing" | "speaking" | "error">("ready");
  const [frame, setFrame] = useState<{ viseme: AvatarViseme; level: number }>({ viseme: "rest", level: 0 });
  const [firstAudioMs, setFirstAudioMs] = useState<number>();
  const [metrics, setMetrics] = useState<StreamingVoiceMetrics>();
  const [mood, setMood] = useState<AvatarMood>("friendly");
  const [gesture, setGesture] = useState<AvatarGesture>("rest");
  const controller = useRef<AbortController | undefined>(undefined);
  const busy = state === "preparing" || state === "speaking";
  const [rehearsal, setRehearsal] = useState<number | null>(null);
  const rehearsing = rehearsal !== null && !busy;
  const previewFrame = rehearsing ? avatarPreviewFrame(rehearsal) : undefined;
  useEffect(() => () => controller.current?.abort(), []);

  useEffect(() => {
    if (!rehearsing) return;
    let animation = 0;
    let started: number | undefined;
    const tick = (now: number) => {
      started ??= now;
      const elapsed = now - started;
      if (elapsed >= AVATAR_PREVIEW_DURATION_MS) { setRehearsal(null); return; }
      setRehearsal(elapsed);
      animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
    // Pause the rehearsal completely when leaving the tab; no stale mouth
    // resumes later, and the renderer can stop drawing while hidden.
    const hide = () => { if (document.hidden) setRehearsal(null); };
    document.addEventListener("visibilitychange", hide);
    return () => { cancelAnimationFrame(animation); document.removeEventListener("visibilitychange", hide); };
  }, [rehearsing]);

  async function listen() {
    if (controller.current) return;
    setRehearsal(null);
    const run = new AbortController();
    controller.current = run;
    setFirstAudioMs(undefined);
    setMetrics(undefined);
    setState("preparing");
    try {
      const result = await playStreamingSpeech({ endpoint: "/api/avatar/speech", payload: { text, language, model, speakingRate, provider: provider.id,
        voiceId: candidates[language] }, signal: run.signal,
        onFrame: (viseme, level) => { if (!run.signal.aborted) setFrame({ viseme, level }); },
        onStart: (milliseconds) => { if (!run.signal.aborted) { setFirstAudioMs(milliseconds); setState("speaking"); } },
      });
      if (!run.signal.aborted) { setMetrics(result); setState("ready"); }
    } catch { if (!run.signal.aborted) setState("error"); }
    finally { if (controller.current === run) { controller.current = undefined; setFrame({ viseme: "rest", level: 0 }); } }
  }

  function stop() {
    controller.current?.abort();
    controller.current = undefined;
    setFrame({ viseme: "rest", level: 0 });
    setState("ready");
  }

  return (
    <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]" data-streaming-voice-state={state}>
      <div className="card min-w-0 overflow-hidden lg:sticky lg:top-24">
        <div className="bg-[#f2efe6] p-5 text-[#263f36]" data-avatar-stage={draft.visualStyle}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2" data-testid="portrait-rehearsal" data-state={rehearsing ? "playing" : "idle"}>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#526a60]">{it ? "Anteprima dal vivo" : "Live preview"}</p>
            <button type="button" className="button-secondary px-3 py-2 text-xs" disabled={busy} aria-pressed={rehearsing}
              aria-describedby="portrait-rehearsal-help"
              onClick={() => { setGesture("rest"); setRehearsal(rehearsing ? null : 0); }}>
              {rehearsing ? it ? "Ferma animazione" : "Stop animation" : it ? "Avvia animazione" : "Play animation"}
            </button>
          </div>
        <div className="mx-auto aspect-square max-h-[280px] sm:max-h-[440px]">
          <div className={`h-full w-full ${busy ? "max-lg:fixed max-lg:right-3 max-lg:top-28 max-lg:z-40 max-lg:h-36 max-lg:w-32 max-lg:rounded-xl max-lg:bg-[#f2efe6] max-lg:shadow-xl" : ""}`} data-testid="speech-preview">
          <BusinessAvatar language={locale} appearance={draft.appearance} visualStyle={draft.visualStyle} viseme={previewFrame?.viseme ?? frame.viseme} voiceLevel={previewFrame?.level ?? frame.level} mood={mood} gesture={previewFrame?.gesture ?? gesture}
            ariaLabel={it ? "Avatar del collega digitale" : "Digital colleague avatar"} />
          </div>
        </div>
        <p className="text-center font-semibold">{draft.displayName}</p>
        <>
          <p id="portrait-rehearsal-help" className="mt-2 text-center text-xs leading-5 text-[#526a60]">{it
            ? "Attesa, gesto e labiale · 9 secondi senza audio né consumo di crediti."
            : "Idle movement, gesture and lips · 9 seconds, no audio or voice credits."}</p>
          <progress className={`mt-2 block h-1 w-full accent-[#295c43] ${rehearsing ? "" : "invisible"}`}
            aria-hidden={!rehearsing} aria-label={it ? "Avanzamento animazione" : "Animation progress"}
            max={AVATAR_PREVIEW_DURATION_MS} value={rehearsal ?? 0} />
        </>
        </div>
        <div className="space-y-4 p-5">
          <h2 className="font-semibold">{it ? "Movimenti ed espressioni" : "Movement & expressions"}</h2>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="button-secondary" aria-pressed={(previewFrame?.gesture ?? gesture) === "hand_raise"} onClick={() => {
              setGesture((previewFrame?.gesture ?? gesture) === "rest" ? "hand_raise" : "rest");
              setRehearsal(null);
            }}>{it ? "Alza / abbassa la mano" : "Raise / lower hand"}</button>
            <button type="button" className="button-secondary" onClick={() => {
              const moods: AvatarMood[] = ["friendly", "focused", "confident", "neutral"];
              setMood(moods[(moods.indexOf(mood) + 1) % moods.length]);
            }}>{it ? "Cambia espressione" : "Change expression"}</button>
          </div>
          <p className="text-xs text-slate-500">{it
            ? "Il labiale segue l’audio e si ferma con la voce. Puoi alzare la mano anche mentre parla. Questi comandi controllano l’anteprima."
            : "Lips follow the audio and close when the voice stops. You can raise the hand while speaking. These controls affect the preview."}</p>
          <AvatarAppearanceSelect locale={locale} disabled={busy || rehearsing} />
          <p role="status" className={state === "error" ? "text-red-700" : "text-sm text-slate-600"}>
            {state === "error" ? it ? "La voce non è disponibile. Controlla il collegamento del servizio e riprova." : "Voice unavailable. Check the service connection and try again."
              : state === "preparing" ? it ? "Preparo la voce…" : "Preparing voice…"
              : state === "speaking" ? it ? "Sta parlando" : "Speaking" : it ? "Pronto" : "Ready"}
          </p>
        </div>
      </div>
      <div className="card min-w-0 space-y-5 p-5 sm:p-6">
        <h2 className="text-xl font-semibold">{it ? `Scegli la voce di ${draft.displayName}` : `Choose ${draft.displayName}’s voice`}</h2>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-sm" data-testid="voice-provider">
          <p className="font-semibold text-[#295c43]">{it ? "Fornitore della voce" : "Voice provider"}: {provider.name}</p>
        </div>
        <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600" data-testid="preview-voices">{it ? "Voci selezionate" : "Selected voices"}: Italiano — {avatarVoiceName(draft.voiceIt)}; English — {avatarVoiceName(draft.voiceEn)}.
          {speakingRate !== DEFAULT_SPEAKING_RATE && <> {it ? "Ritmo del parlato" : "Speaking rate"}: {formatRate(speakingRate)}.</>}
        </p>
        <p className="text-sm text-slate-600">{it
          ? "Ogni ascolto utilizza il credito Inworld."
          : "Each playback uses Inworld credit."}</p>
        {!configured && <p className="text-sm text-amber-800">{it
          ? "Il servizio vocale non è configurato. Collega Inworld per ascoltare la voce."
          : "The voice service is not configured. Connect Inworld to listen to the voice."}</p>}
        <div className="grid gap-4 sm:grid-cols-[0.7fr_1.3fr]">
        <div>
          <label className="label" htmlFor="stream-language">{it ? "Lingua" : "Language"}</label>
          <select className="input" id="stream-language" value={language} disabled={busy || saving} onChange={(event) => {
            const next = event.target.value as "it" | "en";
            setLanguage(next);
          }}>
            <option value="it">Italiano</option><option value="en">English</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="stream-voice">{it ? "Voce" : "Voice"}</label>
          <select id="stream-voice" className="input" value={candidates[language]} disabled={busy || saving} onChange={(event) => {
            update(language === "it" ? { voiceIt: event.target.value } : { voiceEn: event.target.value });
          }}>
            {(["system", "community"] as const).map(source => {
              const group = availableVoices.filter(voice => voice.source === source);
              return group.length > 0 && <optgroup key={source} label={`${provider.name} · ${source === "system" ? it ? "Sistema" : "System" : "Community"}`}>
                {group.map(voice => <option key={voice.id} value={voice.id}>
                  {voice.name} · {voice.gender === "male" ? it ? "Maschile" : "Male" : it ? "Femminile" : "Female"} · {voice.accent === "IT" ? "Italiano" : voice.accent === "UK" ? "English (UK)" : "English (US)"}
                </option>)}
              </optgroup>;
            })}
          </select>
        </div>
        </div>
        <p className="text-sm text-slate-600" data-testid="voice-origin">{selectedVoice?.source === "community"
          ? it ? "Inworld · Community. Qualità e disponibilità possono variare."
            : "Inworld · Community. Quality and availability may vary."
          : it ? "Inworld · Sistema" : "Inworld · System"}</p>
        <div>
          <label className="label" htmlFor="stream-text">{it ? "Testo da leggere" : "Text to read"}</label>
          <textarea className="input min-h-32" id="stream-text" maxLength={1000} value={text} disabled={busy || saving} onChange={(event) => setPhrases(current => ({ ...current, [language]: event.target.value }))} />
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="button-primary" disabled={saving || (!busy && !text.trim())} onClick={busy ? stop : () => void listen()}>
            {busy ? it ? "Ferma la voce" : "Stop voice" : it ? "Ascolta la voce" : "Listen to voice"}
          </button>
        </div>
        <AvatarSaveControls locale={locale} disabled={busy || rehearsing} />
        <details className="border-t border-slate-200 pt-4" data-testid="voice-advanced">
          <summary className="cursor-pointer text-sm font-semibold text-slate-600">{it ? "Regolazioni avanzate" : "Advanced settings"}</summary>
          <div className="mt-4 space-y-4">
          <p className="text-xs text-slate-500">{it
            ? "Tutte le voci sono erogate da Inworld. Sistema e Community indicano l’origine della voce, non provider diversi."
            : "All voices are served by Inworld. System and Community describe their origin, not different providers."}</p>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="label" htmlFor="speaking-rate">{it ? "Ritmo del parlato" : "Speaking rate"}</label>
              <output htmlFor="speaking-rate" className="text-sm font-semibold tabular-nums">{formatRate(speakingRate)}</output>
            </div>
            <input id="speaking-rate" type="range" min="0.8" max="1.1" step="0.01" value={speakingRate} disabled={busy || saving}
              aria-describedby="speaking-rate-help" aria-valuetext={formatRate(speakingRate)}
              onChange={(event) => update({ speakingRate: Number(event.target.value) })} className="w-full accent-[#295c43]" />
            <p id="speaking-rate-help" className="mt-1 text-xs leading-5 text-slate-500">{it
              ? "Da 0,80× a 1,10× · Vale per entrambe le lingue. Cambia il ritmo del parlato, non il tempo di attesa della risposta."
              : "0.80× to 1.10× · Applies to both languages. Changes speaking pace, not response latency."}</p>
            <button type="button" className="button-secondary mt-3 disabled:opacity-50" disabled={busy || saving || speakingRate === DEFAULT_SPEAKING_RATE}
              onClick={() => update({ speakingRate: DEFAULT_SPEAKING_RATE })}>
              {it ? "Ripristina" : "Reset"} · {formatRate(DEFAULT_SPEAKING_RATE)}
            </button>
          </div>
          <p className="text-sm text-slate-600" data-testid="saved-voices">{it ? "Voci salvate nei meeting" : "Saved meeting voices"} · {provider.name}: Italiano — {avatarVoiceName(saved.voiceIt)}; English — {avatarVoiceName(saved.voiceEn)}. {it ? "Ritmo del parlato" : "Speaking rate"}: {formatRate(saved.speakingRate)}.</p>
          <div>
            <label className="label" htmlFor="stream-model">{it ? "Modello da confrontare" : "Model to compare"}</label>
            <select className="input" id="stream-model" value={model} disabled={busy || saving} onChange={(event) => setModel(event.target.value as InworldModel)}>
              <option value="inworld-tts-2-flash">Inworld Flash</option>
              <option value="inworld-tts-2">Inworld TTS-2</option>
            </select>
            <p className="mt-2 text-sm text-slate-500">{it ? "Si applica a questo ascolto; non viene salvato con voce e ritmo del parlato." : "Applies to this playback; not saved with the voice and rate."}</p>
          </div>
        {firstAudioMs !== undefined && <p data-testid="stream-first-audio" className="text-sm text-slate-600">
          {it ? "Avvio audio nel browser" : "Browser audio start"}: {(firstAudioMs / 1000).toFixed(2)} s.
          {it ? " Non misura il ritardo del meeting Teams." : " This does not measure Teams meeting latency."}
        </p>}
          {metrics && <p data-testid="stream-playback-metrics" data-metrics={JSON.stringify(metrics)} className="text-sm text-slate-600">
          {it ? "Interruzioni del buffer" : "Buffer underruns"}: {metrics.underruns} ({Math.round(metrics.gapMs)} ms).
          {it ? " Massimo intervallo animazione" : " Maximum animation interval"}: {Math.round(metrics.maxAnimationGapMs)} ms.
          {it ? " Misure locali, non qualità audio/video ricevuta in Teams." : " Local measurements, not received Teams audio/video quality."}
        </p>}
          </div>
        </details>
      </div>
    </section>
  );
}
