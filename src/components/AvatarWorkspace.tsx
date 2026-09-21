"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ASSISTANT_VISUAL_STYLES, type AssistantProfileResponse } from "@/types/assistant-profile";
import type { Locale } from "@/i18n/locale";
import { compatibleAvatarVoice } from "@/lib/avatar-voice-catalog";
import { avatarVisualStyleLabel } from "@/lib/avatar-visual-style";
import { avatarAppearanceForStyle, avatarAppearancesForStyle, avatarAppearanceGender } from '@conclavia/avatar-kit/lib/avatar-catalog';

function settings(profile: AssistantProfileResponse, voices: { it: string; en: string }) {
  return {
    displayName: profile.displayName, role: profile.role, appearance: profile.appearance,
    visualStyle: profile.visualStyle || "editorial",
    responseStyle: profile.personality.responseStyle, attitude: profile.personality.attitude,
    voiceStyle: profile.voice.style, speakingRate: profile.voice.speakingRate,
    voiceIt: profile.voice.inworldVoiceIdIt ?? voices.it,
    voiceEn: profile.voice.inworldVoiceIdEn ?? voices.en,
  };
}
type Settings = ReturnType<typeof settings>;
function compatibleSettings(value: Settings): Settings {
  return { ...value,
    appearance: avatarAppearanceForStyle(value.appearance, value.visualStyle),
    voiceIt: compatibleAvatarVoice(value.voiceIt, "it", value.appearance),
    voiceEn: compatibleAvatarVoice(value.voiceEn, "en", value.appearance),
  };
}
type Workspace = {
  draft: Settings; saved: Settings; changed: boolean; canDiscard: boolean; saving: boolean;
  status: "idle" | "saved" | "error"; update: (patch: Partial<Settings>) => void;
  save: () => Promise<void>; discard: () => void;
};
const Context = createContext<Workspace | null>(null);

// The nested layout keeps the same draft when moving between identity and testing.
// Nothing is written to the meeting profile until the user explicitly saves.
export function AvatarWorkspace({ profile, voices, children }: {
  profile: AssistantProfileResponse; voices: { it: string; en: string }; children: ReactNode;
}) {
  const [saved, setSaved] = useState(() => settings(profile, voices));
  const [draft, setDraft] = useState(() => compatibleSettings(saved));
  const voiceChoices = useRef<Partial<Record<Settings["appearance"], Pick<Settings, "voiceIt" | "voiceEn">>>>({});
  const appearanceChoices = useRef<Partial<Record<`${Settings["visualStyle"]}:${"male" | "female"}`, Settings["appearance"]>>>({});
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [status, setStatus] = useState<Workspace["status"]>("idle");
  const changed = JSON.stringify(draft) !== JSON.stringify(saved);
  const canDiscard = JSON.stringify(draft) !== JSON.stringify(compatibleSettings(saved));

  useEffect(() => {
    if (!changed) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changed]);

  function update(patch: Partial<Settings>) {
    if (savingRef.current) return;
    let next = { ...draft, ...patch };
    if (patch.visualStyle && patch.visualStyle !== draft.visualStyle) {
      const gender = avatarAppearanceGender(draft.appearance);
      appearanceChoices.current[`${draft.visualStyle}:${gender}`] = draft.appearance;
      next.appearance = avatarAppearanceForStyle(patch.appearance ?? appearanceChoices.current[`${patch.visualStyle}:${gender}`] ?? draft.appearance, patch.visualStyle);
    }
    if (next.appearance !== draft.appearance) {
      voiceChoices.current[draft.appearance] = { voiceIt: draft.voiceIt, voiceEn: draft.voiceEn };
      // A style change keeps both voice choices, including when it needs the
      // equivalent base identity. Explicit identity choices retain their voices.
      if (patch.appearance && !patch.visualStyle) next = { ...next, ...voiceChoices.current[next.appearance] };
    }
    setDraft(compatibleSettings(next));
    setStatus("idle");
  }

  async function save() {
    if (savingRef.current || !changed || !draft.displayName.trim() || !draft.role.trim()) return;
    savingRef.current = true;
    setSaving(true); setStatus("idle");
    try {
      const { voiceIt, voiceEn, speakingRate, visualStyle, ...identity } = draft;
      const response = await fetch("/api/avatar", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...identity,
          // An unchanged local style must not overwrite a choice saved elsewhere.
          ...(visualStyle !== saved.visualStyle ? { visualStyle } : {}),
          // Do not overwrite voice choices changed elsewhere when only editing identity.
          ...(speakingRate !== saved.speakingRate ? { speakingRate } : {}),
          ...(voiceIt !== saved.voiceIt ? { inworldVoiceIdIt: voiceIt } : {}),
          ...(voiceEn !== saved.voiceEn ? { inworldVoiceIdEn: voiceEn } : {}),
        }), signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error("Save failed");
      const result = await response.json() as { profile: AssistantProfileResponse };
      if (!result.profile) throw new Error("Missing saved profile");
      const next = settings(result.profile, voices);
      setSaved(next); setDraft(compatibleSettings(next)); setStatus("saved");
    } catch { setStatus("error"); }
    finally { savingRef.current = false; setSaving(false); }
  }

  return <Context.Provider value={{ draft, saved, changed, canDiscard, saving, status, update, save,
    discard: () => { if (!savingRef.current) { setDraft(compatibleSettings(saved)); voiceChoices.current = {}; appearanceChoices.current = {}; setStatus("idle"); } },
  }}>{children}</Context.Provider>;
}

export function useAvatarWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("AvatarWorkspace is required");
  return value;
}

export function AvatarAppearanceSelect({ locale, disabled = false }: { locale: Locale; disabled?: boolean }) {
  const { draft, update, saving } = useAvatarWorkspace();
  const it = locale === "it";
  return <div className="space-y-4">
    <div>
      <label className="label" htmlFor="avatar-visual-style">{it ? "Stile dell’avatar" : "Avatar style"}</label>
      <select id="avatar-visual-style" className="input" value={draft.visualStyle} disabled={disabled || saving}
        aria-describedby="avatar-style-help"
        onChange={event => update({ visualStyle: event.target.value as Settings["visualStyle"] })}>
        {ASSISTANT_VISUAL_STYLES.map(style => <option key={style} value={style}>{avatarVisualStyleLabel(style, it)}</option>)}
      </select>
      <p id="avatar-style-help" className="mt-2 text-xs leading-5 text-slate-500">{draft.visualStyle === "portrait_2_5d"
        ? it ? "Brevi movimenti della testa e assestamenti della spalla, separati da pause. Il labiale segue l’audio."
          : "Brief head adjustments and a shoulder settle, separated by pauses, with simplified audio-driven lip sync."
        : draft.visualStyle === "stylized_3d"
          ? it ? "Sguardi brevi, piccoli movimenti della testa e assestamenti della spalla. Il corpo resta stabile durante l’attesa."
            : "Brief glances, small head movements and shoulder adjustments. The body stays stable while waiting."
        : it ? "Sguardo e testa si muovono brevemente, poi si fermano. Braccio rilassato al fianco e labiale che segue l’audio."
          : "Brief eye and head movements, followed by pauses. Relaxed arm at the side and audio-driven lips."}</p>
    </div>
    <div>
    <label className="label" htmlFor="avatar-appearance">{it ? "Aspetto dell’avatar" : "Avatar appearance"}</label>
    <select id="avatar-appearance" className="input" value={draft.appearance} disabled={disabled || saving}
      onChange={event => update({ appearance: event.target.value as Settings["appearance"] })}>
      {avatarAppearancesForStyle(draft.visualStyle).map(avatar => <option key={avatar.id} value={avatar.id}>{avatar.labels[it ? 'it' : 'en']}</option>)}
    </select>
    <p className="mt-2 text-xs leading-5 text-slate-500">{it
      ? "Le voci si adattano all’aspetto. Il nome non cambia."
      : "Voice choices match the appearance. The name stays unchanged."}</p>
    {draft.visualStyle === "portrait_2_5d" && <p className="text-xs leading-5 text-slate-500">{it
      ? "La serie Studio aggiunge due identità fotografiche, disponibili in questo stile."
      : "The Studio series adds two photographic identities, available in this style."}</p>}
    </div>
  </div>;
}

export function AvatarSaveControls({ locale, disabled = false }: { locale: Locale; disabled?: boolean }) {
  const { draft, saved, changed, canDiscard, saving, status, save, discard } = useAvatarWorkspace();
  const it = locale === "it";
  const valid = Boolean(draft.displayName.trim() && draft.role.trim());
  const changes = [
    draft.visualStyle !== saved.visualStyle && (it ? "stile visivo" : "visual style"),
    draft.appearance !== saved.appearance && (it ? "aspetto" : "appearance"),
    (draft.displayName !== saved.displayName || draft.role !== saved.role) && (it ? "identità" : "identity"),
    (draft.attitude !== saved.attitude || draft.responseStyle !== saved.responseStyle) && (it ? "comportamento" : "behaviour"),
    draft.voiceIt !== saved.voiceIt && (it ? "voce italiana" : "Italian voice"),
    draft.voiceEn !== saved.voiceEn && (it ? "voce inglese" : "English voice"),
    draft.speakingRate !== saved.speakingRate && (it ? "ritmo del parlato" : "speaking rate"),
  ].filter(Boolean);
  return <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4" data-testid="avatar-save-controls">
    <p role="status" className={`text-sm ${status === "error" ? "text-red-700" : "text-slate-700"}`}>
      {status === "error" ? it ? "Non è stato possibile confermare il salvataggio. Le modifiche sono ancora disponibili: riprova." : "Could not save. Your changes are still here: please retry."
        : status === "saved" && !changed ? it ? "Avatar aggiornato." : "Avatar updated."
        : changed ? `${it ? "Modifiche non salvate" : "Unsaved changes"}: ${changes.join(", ")}.`
        : it ? "Stai usando la configurazione salvata." : "Using the saved configuration."}
    </p>
    {changed && !canDiscard && <p className="text-sm text-amber-800" data-testid="voice-compatibility-notice">{it
      ? "Le voci precedenti non corrispondono all’aspetto. L’anteprima usa già quelle compatibili; salva per applicarle ai meeting."
      : "The previous voices do not match the appearance. Preview uses compatible voices; save to apply them to meetings."}</p>}
    {!valid && <p className="text-sm text-amber-800">{it ? "Completa nome e ruolo nella scheda Identità prima di salvare." : "Complete the name and role in Identity before saving."}</p>}
    <div className="flex flex-wrap gap-3">
      <button type="button" className="button-primary disabled:opacity-50" disabled={disabled || saving || !changed || !valid} onClick={() => void save()}>
        {saving ? it ? "Salvataggio…" : "Saving…" : it ? "Salva avatar" : "Save avatar"}
      </button>
      {canDiscard && <button type="button" className="button-secondary" disabled={disabled || saving} onClick={discard}>{it ? "Annulla modifiche" : "Discard changes"}</button>}
    </div>
    <p className="text-xs leading-5 text-slate-500">{it
      ? "Applica entrambe le schede ai meeting solo quando salvi."
      : "Changes in both tabs apply to meetings only when saved."}</p>
  </div>;
}
