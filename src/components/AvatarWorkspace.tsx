"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { AssistantProfileResponse } from "@/types/assistant-profile";
import type { Locale } from "@/i18n/locale";
import { compatibleAvatarVoice } from "@/lib/avatar-voice-catalog";

function settings(profile: AssistantProfileResponse, voices: { it: string; en: string }) {
  return {
    displayName: profile.displayName, role: profile.role, appearance: profile.appearance,
    responseStyle: profile.personality.responseStyle, attitude: profile.personality.attitude,
    voiceStyle: profile.voice.style, speakingRate: profile.voice.speakingRate,
    voiceIt: profile.voice.inworldVoiceIdIt ?? voices.it,
    voiceEn: profile.voice.inworldVoiceIdEn ?? voices.en,
  };
}
type Settings = ReturnType<typeof settings>;
function compatibleSettings(value: Settings): Settings {
  return { ...value,
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
    if (patch.appearance && patch.appearance !== draft.appearance) {
      voiceChoices.current[draft.appearance] = { voiceIt: draft.voiceIt, voiceEn: draft.voiceEn };
      setDraft(compatibleSettings({ ...draft, ...patch, ...voiceChoices.current[patch.appearance] }));
    } else setDraft(current => compatibleSettings({ ...current, ...patch }));
    setStatus("idle");
  }

  async function save() {
    if (savingRef.current || !changed || !draft.displayName.trim() || !draft.role.trim()) return;
    savingRef.current = true;
    setSaving(true); setStatus("idle");
    try {
      const { voiceIt, voiceEn, speakingRate, ...identity } = draft;
      const response = await fetch("/api/avatar", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...identity,
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
    discard: () => { if (!savingRef.current) { setDraft(compatibleSettings(saved)); voiceChoices.current = {}; setStatus("idle"); } },
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
  return <div>
    <label className="label" htmlFor="avatar-appearance">{it ? "Aspetto dell’avatar" : "Avatar appearance"}</label>
    <select id="avatar-appearance" className="input" value={draft.appearance} disabled={disabled || saving}
      onChange={event => update({ appearance: event.target.value as Settings["appearance"] })}>
      <option value="business_clay">{it ? "Maschile · Business" : "Male · Business"}</option>
      <option value="business_clay_female">{it ? "Femminile · Business" : "Female · Business"}</option>
    </select>
    <p className="mt-2 text-xs leading-5 text-slate-500">{it
      ? "Le voci si adattano all’aspetto. Il nome non cambia."
      : "Voice choices match the appearance. The name stays unchanged."}</p>
  </div>;
}

export function AvatarSaveControls({ locale, disabled = false }: { locale: Locale; disabled?: boolean }) {
  const { draft, saved, changed, canDiscard, saving, status, save, discard } = useAvatarWorkspace();
  const it = locale === "it";
  const valid = Boolean(draft.displayName.trim() && draft.role.trim());
  const changes = [
    draft.appearance !== saved.appearance && (it ? "aspetto" : "appearance"),
    (draft.displayName !== saved.displayName || draft.role !== saved.role) && (it ? "identità" : "identity"),
    (draft.attitude !== saved.attitude || draft.responseStyle !== saved.responseStyle) && (it ? "comportamento" : "behaviour"),
    draft.voiceIt !== saved.voiceIt && (it ? "voce italiana" : "Italian voice"),
    draft.voiceEn !== saved.voiceEn && (it ? "voce inglese" : "English voice"),
    draft.speakingRate !== saved.speakingRate && (it ? "ritmo del parlato" : "speaking rate"),
  ].filter(Boolean);
  return <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4" data-testid="avatar-save-controls">
    <p role="status" className={`text-sm ${status === "error" ? "text-red-700" : "text-slate-700"}`}>
      {status === "error" ? it ? "Non è stato possibile confermare il salvataggio. Le modifiche in prova sono ancora qui: riprova." : "Could not save. Your preview changes are still here: please retry."
        : status === "saved" && !changed ? it ? "Avatar aggiornato." : "Avatar updated."
        : changed ? `${it ? "Modifiche non salvate" : "Unsaved changes"}: ${changes.join(", ")}.`
        : it ? "Stai usando la configurazione salvata." : "Using the saved configuration."}
    </p>
    {changed && !canDiscard && <p className="text-sm text-amber-800" data-testid="voice-compatibility-notice">{it
      ? "Le voci precedenti non corrispondono all’aspetto. La prova usa già quelle compatibili; salva per applicarle ai meeting."
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
