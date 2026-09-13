"use client";

import Link from "next/link";

import { BusinessAvatar } from "@/components/BusinessAvatar";
import { AvatarAppearanceSelect, AvatarSaveControls, useAvatarWorkspace } from "@/components/AvatarWorkspace";
import { useTranslations } from "@/i18n/I18nProvider";
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
      <section className="relative h-64 overflow-hidden rounded-2xl bg-[#09100d] sm:h-auto sm:aspect-[4/5] sm:max-h-[36rem] lg:sticky lg:top-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(79,170,126,0.28),transparent_42%)]" />
        <div className="absolute inset-x-[8%] bottom-0 top-4">
          <BusinessAvatar appearance={appearance} ariaLabel={isItalian ? "Avatar del collega digitale in abito business" : "Business-style digital colleague avatar"} />
        </div>
        <div className="absolute inset-x-0 top-0 flex items-center justify-between border-b border-white/10 px-5 py-4 text-[11px] font-bold uppercase tracking-[0.17em] text-white/45">
          <span>{isItalian ? "Anteprima avatar" : "Avatar preview"}</span>
          <span className="text-[#bde88d]">{isItalian ? "Stile professionale" : "Professional style"}</span>
        </div>
        <div className="absolute bottom-5 left-5 border-l-4 border-[#bde88d] bg-black/65 px-4 py-3 backdrop-blur">
          <strong className="block text-sm uppercase tracking-[0.14em] text-[#bde88d]">{displayName || "Conclavia"}</strong>
          <span className="mt-1 block text-sm text-white/80">{role || (isItalian ? "Collega digitale" : "Digital colleague")}</span>
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
          {isItalian ? "Prova queste modifiche prima di salvarle: " : "Try these changes before saving: "}
          <Link href="/avatar/test" className="font-semibold text-[#295c43] underline">{isItalian ? "Prova avatar" : "Test avatar"}</Link>.
        </p>
      </fieldset>
    </form>
  );
}
