"use client";

import Link from "next/link";

import { BusinessAvatar } from "@/components/BusinessAvatar";
import { AvatarAppearanceSelect, AvatarSaveControls, useAvatarWorkspace } from "@/components/AvatarWorkspace";
import { useTranslations } from "@/i18n/I18nProvider";
import { avatarVisualStyleLabel } from "@/lib/avatar-visual-style";
import type {
  AssistantAttitude,
  AssistantResponseStyle,
} from "@/types/assistant-profile";

export function AvatarSettingsForm() {
  const { locale } = useTranslations();
  const isItalian = locale === "it";
  const { draft, update, saving, save } = useAvatarWorkspace();
  const { displayName, appearance, role, responseStyle, attitude } = draft;

  return (
    <form onSubmit={event => { event.preventDefault(); void save(); }} className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <section className="relative h-64 overflow-hidden rounded-2xl bg-[#f2efe6] sm:h-auto sm:aspect-[4/5] sm:max-h-[36rem] lg:sticky lg:top-24" data-avatar-stage={draft.visualStyle}>
        <div className="absolute inset-x-[8%] bottom-0 top-4">
          <BusinessAvatar appearance={appearance} visualStyle={draft.visualStyle} welcomeLanguage={locale} ariaLabel={isItalian ? "Avatar del collega digitale" : "Digital colleague avatar"} />
        </div>
        <div className="absolute inset-x-0 top-0 flex items-center justify-between border-b border-[#d3dfd5] px-5 py-4 text-[11px] font-bold uppercase tracking-[0.17em] text-[#526a60]">
          <span>{isItalian ? "Anteprima avatar" : "Avatar preview"}</span>
          <span className="text-[#295c43]">{avatarVisualStyleLabel(draft.visualStyle, isItalian)}</span>
        </div>
        <div className={`absolute left-5 max-w-[calc(100%-2.5rem)] rounded-r-xl border-l-4 border-[#578473] bg-white/95 px-4 py-3 ${draft.visualStyle === 'photoreal_host' ? 'bottom-16' : 'bottom-5'}`}>
          <strong className="block truncate text-sm font-semibold text-[#295c43]">{displayName || "Conclavia"}</strong>
          <span className="mt-1 block truncate text-sm text-[#526a60]">{role || (isItalian ? "Collega digitale" : "Digital colleague")}</span>
        </div>
      </section>

      <fieldset disabled={saving} className="min-w-0 space-y-6">
        <section className="card p-5 sm:p-7">
          <h2 className="text-xl font-semibold">{isItalian ? "Identità" : "Identity"}</h2>
          <div className="mt-5">
            <AvatarAppearanceSelect locale={locale} />
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="avatar-name">{isItalian ? "Nome e parola di richiamo" : "Name and call phrase"}</label>
              <input id="avatar-name" className="input" value={displayName} onChange={(event) => update({ displayName: event.target.value })} maxLength={80} required />
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {isItalian
                  ? "Apparirà con questo nome e risponderà quando lo pronunci nel meeting."
                  : "It appears with this name and responds when you say it in the meeting."}
              </p>
            </div>
            <div>
              <label className="label" htmlFor="avatar-role">{isItalian ? "Ruolo mostrato" : "Displayed role"}</label>
              <input id="avatar-role" className="input" value={role} onChange={(event) => update({ role: event.target.value })} maxLength={120} required />
            </div>
          </div>
        </section>

        <section className="card p-5 sm:p-7">
          <h2 className="text-xl font-semibold">
            {isItalian ? "Comportamento" : "Behaviour"}
          </h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="response-style">
                {isItalian ? "Stile delle risposte" : "Response style"}
              </label>
              <select
                id="response-style"
                className="input"
                value={responseStyle}
                onChange={(event) =>
                  update({ responseStyle: event.target.value as AssistantResponseStyle })
                }
              >
                <option value="concise">{isItalian ? "Sintetico" : "Concise"}</option>
                <option value="balanced">{isItalian ? "Equilibrato" : "Balanced"}</option>
                <option value="detailed">{isItalian ? "Approfondito" : "Detailed"}</option>
              </select>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {isItalian
                  ? responseStyle === "concise"
                    ? "Va subito al punto con risposte brevi."
                    : responseStyle === "detailed"
                      ? "Aggiunge più contesto quando è utile."
                      : "Risposte brevi ma complete."
                  : responseStyle === "concise"
                    ? "Gets straight to the point with short answers."
                    : responseStyle === "detailed"
                      ? "Adds more context when useful."
                      : "Keeps answers brief but complete."}
              </p>
            </div>
            <div>
              <label className="label" htmlFor="assistant-attitude">
                {isItalian ? "Atteggiamento" : "Attitude"}
              </label>
              <select
                id="assistant-attitude"
                className="input"
                value={attitude}
                onChange={(event) =>
                  update({ attitude: event.target.value as AssistantAttitude })
                }
              >
                <option value="discreet">{isItalian ? "Discreto" : "Discreet"}</option>
                <option value="collaborative">{isItalian ? "Collaborativo" : "Collaborative"}</option>
                <option value="proactive">{isItalian ? "Propositivo" : "Proactive"}</option>
              </select>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {isItalian
                  ? attitude === "discreet"
                    ? "Interviene soltanto quando è davvero utile."
                    : attitude === "proactive"
                      ? "Suggerisce con misura domande e prossimi passi."
                      : "Partecipa con naturalezza senza prendere il controllo."
                  : attitude === "discreet"
                    ? "Contributes only when it is genuinely useful."
                    : attitude === "proactive"
                      ? "Suggests questions and next steps with restraint."
                      : "Contributes naturally without taking over."}
              </p>
            </div>
          </div>
        </section>

        <AvatarSaveControls locale={locale} />
        <p className="text-right text-sm text-slate-500">
          {isItalian ? "Ascolta la voce e guarda l’avatar in movimento: " : "Listen to the voice and see the avatar in motion: "}
          <Link href="/avatar/test" className="font-semibold text-[#295c43] underline">{isItalian ? "Voce e movimenti" : "Voice & movement"}</Link>.
        </p>
      </fieldset>
    </form>
  );
}
