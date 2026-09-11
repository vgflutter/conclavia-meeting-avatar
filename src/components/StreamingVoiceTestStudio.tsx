"use client";

import { useEffect, useRef, useState } from "react";
import { BusinessAvatar, type AvatarGesture, type AvatarMood } from "@/components/BusinessAvatar";
import type { Locale } from "@/i18n/locale";
import type { AvatarViseme } from "@/lib/avatar-visemes";
import type { InworldModel } from "@/lib/meeting-tts-config";
import { playStreamingSpeech, type StreamingVoiceMetrics } from "@/lib/streaming-voice-player";
import type { AssistantProfileResponse } from "@/types/assistant-profile";
import { AVATAR_VOICES, isAvatarVoice } from "@/lib/avatar-voice-catalog";

export function StreamingVoiceTestStudio({ profile, locale, model: initialModel, configured, voices }: {
  profile: AssistantProfileResponse; locale: Locale; model: InworldModel; configured: boolean;
  voices: { it: string; en: string };
}) {
  const it = locale === "it";
  const [text, setText] = useState(it ? `Ciao, sono ${profile.displayName}. Ti sento, dimmi pure.` : `Hello, I'm ${profile.displayName}. I can hear you. Go ahead.`);
  const [language, setLanguage] = useState<"it" | "en">(it ? "it" : "en");
  const [candidates, setCandidates] = useState(voices);
  const [savedVoices, setSavedVoices] = useState(voices);
  const [speakingRate, setSpeakingRate] = useState(profile.voice.speakingRate);
  const [savedRate, setSavedRate] = useState(profile.voice.speakingRate);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [model, setModel] = useState(initialModel);
  const [state, setState] = useState<"ready" | "preparing" | "speaking" | "error">("ready");
  const [frame, setFrame] = useState<{ viseme: AvatarViseme; level: number }>({ viseme: "rest", level: 0 });
  const [firstAudioMs, setFirstAudioMs] = useState<number>();
  const [metrics, setMetrics] = useState<StreamingVoiceMetrics>();
  const [mood, setMood] = useState<AvatarMood>("friendly");
  const [gesture, setGesture] = useState<AvatarGesture>("rest");
  const controller = useRef<AbortController | undefined>(undefined);
  const busy = state === "preparing" || state === "speaking";
  const changed = candidates[language] !== savedVoices[language] || speakingRate !== savedRate;
  useEffect(() => () => controller.current?.abort(), []);

  async function listen() {
    if (controller.current) return;
    const run = new AbortController();
    controller.current = run;
    setFirstAudioMs(undefined);
    setMetrics(undefined);
    setState("preparing");
    try {
      const result = await playStreamingSpeech({ endpoint: "/api/avatar/speech", payload: { text, language, model, speakingRate,
        ...(isAvatarVoice(candidates[language], language) ? { voiceId: candidates[language] } : {}) }, signal: run.signal,
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

  async function saveVoice() {
    if (saving || busy) return;
    setSaving(true);
    setSaveState("idle");
    try {
      const response = await fetch("/api/avatar/voices", { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, ...(isAvatarVoice(candidates[language], language) ? { voiceId: candidates[language] } : {}), speakingRate }), signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error();
      const result = await response.json() as { selected: { it: string; en: string }; speakingRate: number };
      setSavedVoices(result.selected);
      setSavedRate(result.speakingRate);
      setSaveState("saved");
    } catch { setSaveState("error"); }
    finally { setSaving(false); }
  }

  return (
    <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]" data-streaming-voice-state={state}>
      <div className="card min-w-0 overflow-hidden lg:sticky lg:top-6">
        <div className="bg-[#09100d] p-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/60">{it ? "Anteprima dal vivo" : "Live preview"}</p>
        <div className="mx-auto aspect-square max-h-[280px] sm:max-h-[440px]">
          <BusinessAvatar appearance={profile.appearance} viseme={frame.viseme} voiceLevel={frame.level} mood={mood} gesture={gesture}
            ariaLabel={it ? "Avatar del collega digitale" : "Digital colleague avatar"} />
        </div>
        <p className="text-center font-semibold">{profile.displayName}</p>
        </div>
        <div className="space-y-4 p-5">
          <h2 className="font-semibold">{it ? "Movimenti ed espressioni" : "Movement & expressions"}</h2>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="button-secondary" aria-pressed={gesture === "hand_raise"} onClick={() => setGesture(gesture === "rest" ? "hand_raise" : "rest")}>{it ? "Alza / abbassa la mano" : "Raise / lower hand"}</button>
            <button type="button" className="button-secondary" onClick={() => {
              const moods: AvatarMood[] = ["friendly", "focused", "confident", "neutral"];
              setMood(moods[(moods.indexOf(mood) + 1) % moods.length]);
            }}>{it ? "Cambia espressione" : "Change expression"}</button>
          </div>
          <p className="text-sm text-slate-500">{it ? "Il labiale segue la voce durante l’ascolto. Questi gesti sono solo una prova, non comandi per Teams." : "The mouth follows speech during playback. These gestures are a preview, not commands sent to Teams."}</p>
          <p role="status" className={state === "error" ? "text-red-700" : "text-sm text-slate-600"}>
            {state === "error" ? it ? "La voce non è disponibile. Controlla il collegamento del servizio e riprova." : "Voice unavailable. Check the service connection and try again."
              : state === "preparing" ? it ? "Preparo la risposta…" : "Preparing response…"
              : state === "speaking" ? it ? "Sta parlando" : "Speaking" : it ? "Pronto per la prova" : "Ready to test"}
          </p>
        </div>
      </div>
      <div className="card min-w-0 space-y-5 p-5 sm:p-6">
        <h2 className="text-xl font-semibold">{it ? `Scegli la voce di ${profile.displayName}` : `Choose ${profile.displayName}’s voice`}</h2>
        <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600" data-testid="saved-voices">{it ? "Voci salvate" : "Saved voices"}: Italiano — {savedVoices.it}; English — {savedVoices.en}. {it ? "Velocità" : "Speaking rate"}: {savedRate.toFixed(2)}×.</p>
        <p className="text-sm text-slate-600">{it
          ? "Scegli lingua e voce, regola la velocità e ascolta. Ogni ascolto utilizza il credito Inworld."
          : "Choose a language and voice, adjust the rate and listen. Each playback uses Inworld credit."}</p>
        {!configured && <p className="text-sm text-amber-800">{it
          ? "La nuova voce non è ancora configurata. Completa il collegamento Inworld sul server prima della prova."
          : "The new voice is not configured yet. Complete the Inworld connection on the server before testing."}</p>}
        <div className="grid gap-4 sm:grid-cols-[0.7fr_1.3fr]">
        <div>
          <label className="label" htmlFor="stream-language">{it ? "Lingua" : "Language"}</label>
          <select className="input" id="stream-language" value={language} disabled={busy || saving} onChange={(event) => {
            const next = event.target.value as "it" | "en";
            setLanguage(next); setSaveState("idle");
            setText(next === "it" ? `Ciao, sono ${profile.displayName}. Ti sento, dimmi pure.` : `Hello, I'm ${profile.displayName}. I can hear you. Go ahead.`);
          }}>
            <option value="it">Italiano</option><option value="en">English</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="stream-voice">{it ? "Voce da provare" : "Voice to preview"}</label>
          <select id="stream-voice" className="input" value={candidates[language]} disabled={busy || saving} onChange={(event) => {
            setCandidates((current) => ({ ...current, [language]: event.target.value })); setSaveState("idle");
          }}>
            {!isAvatarVoice(candidates[language], language) && <option value={candidates[language]}>{candidates[language]} ({it ? "configurata sul server" : "server configured"})</option>}
            {AVATAR_VOICES.filter((voice) => voice.language === language).map((voice) => <option key={voice.id} value={voice.id}>
              {voice.name} · {voice.accent === "IT" ? "Italiano" : voice.accent === "UK" ? "English (UK)" : "English (US)"}
            </option>)}
          </select>
        </div>
        </div>
        <div>
          <div className="flex items-center justify-between gap-3">
            <label className="label" htmlFor="speaking-rate">{it ? "Velocità della voce" : "Speaking rate"}</label>
            <output htmlFor="speaking-rate" className="text-sm font-semibold tabular-nums">{speakingRate.toFixed(2)}×</output>
          </div>
          <input id="speaking-rate" type="range" min="0.8" max="1.1" step="0.01" value={speakingRate} disabled={busy || saving}
            onChange={(event) => { setSpeakingRate(Number(event.target.value)); setSaveState("idle"); }} className="w-full accent-[#295c43]" />
          <p className="mt-1 text-xs leading-5 text-slate-500">{it ? "Da 0,80× a 1,10× · Vale per entrambe le lingue. Cambia il ritmo del parlato, non il tempo di attesa della risposta." : "0.80× to 1.10× · Applies to both languages. Changes speaking pace, not response latency."}</p>
        </div>
        <div>
          <label className="label" htmlFor="stream-text">{it ? "Frase da provare" : "Test phrase"}</label>
          <textarea className="input min-h-32" id="stream-text" maxLength={1000} value={text} disabled={busy} onChange={(event) => setText(event.target.value)} />
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="button-primary" disabled={saving || (!busy && !text.trim())} onClick={busy ? stop : () => void listen()}>
            {busy ? it ? "Ferma la voce" : "Stop voice" : it ? "Ascolta la voce" : "Listen to voice"}
          </button>
          <button type="button" className="button-secondary disabled:cursor-not-allowed disabled:opacity-50" disabled={busy || saving || !changed} onClick={() => void saveVoice()}>
            {saving ? it ? "Salvataggio…" : "Saving…" : it ? "Salva voce e velocità" : "Save voice & rate"}
          </button>
          {changed && <button type="button" className="text-sm font-semibold text-slate-600 underline" disabled={busy || saving} onClick={() => {
            setCandidates((current) => ({ ...current, [language]: savedVoices[language] })); setSpeakingRate(savedRate); setSaveState("idle");
          }}>{it ? "Annulla modifiche" : "Discard changes"}</button>}
        </div>
        <p role="status" className={saveState === "error" ? "text-red-700 text-sm" : "text-sm text-slate-600"}>
          {saveState === "error" ? it ? "Salvataggio non riuscito. La voce precedente è ancora selezionata: riprova." : "Could not save. The previous voice remains selected: please retry."
            : saveState === "saved" ? it ? "Voce e velocità salvate per le prossime risposte. Non serve riavviare il meeting." : "Voice and rate saved for subsequent responses. No meeting restart needed."
            : changed ? it ? "Modifiche non salvate: ascoltale prima di confermare." : "Unsaved changes: listen before confirming."
            : it ? "Impostazioni salvate in uso." : "Using saved settings."}
        </p>
        <p className="text-xs leading-5 text-slate-500">{it ? "Salvi la voce della lingua selezionata e la velocità comune a entrambe. Nome, aspetto, voce dell’altra lingua e modello del meeting non cambiano." : "Saves this language’s voice and the rate shared by both languages. The name, appearance, other language’s voice and meeting model stay unchanged."}</p>
        {firstAudioMs !== undefined && <p data-testid="stream-first-audio" className="text-sm text-slate-600">
          {it ? "Avvio audio nel browser" : "Browser audio start"}: {(firstAudioMs / 1000).toFixed(2)} s.
          {it ? " Non misura il ritardo del meeting Teams." : " This does not measure Teams meeting latency."}
        </p>}
        <details className="border-t border-slate-200 pt-4" data-testid="voice-advanced">
          <summary className="cursor-pointer text-sm font-semibold text-slate-600">{it ? "Avanzate · modello e diagnostica" : "Advanced · model & diagnostics"}</summary>
          <div className="mt-4 space-y-4">
          <div>
            <label className="label" htmlFor="stream-model">{it ? "Modello da confrontare" : "Model to compare"}</label>
            <select className="input" id="stream-model" value={model} disabled={busy || saving} onChange={(event) => setModel(event.target.value as InworldModel)}>
              <option value="inworld-tts-2-flash">Inworld Flash</option>
              <option value="inworld-tts-2">Inworld TTS-2</option>
            </select>
            <p className="mt-2 text-sm text-slate-500">{it ? "Solo per questa prova: non viene salvato con voce e velocità." : "Preview only: not saved with the voice and rate."}</p>
          </div>
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
