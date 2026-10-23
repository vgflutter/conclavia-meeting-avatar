"use client";

import type { Participant, TalkSettings } from "@/types/podcast";
import { PERSONALITY_PROFILES, personalityProfile, selectedPersonalityProfile } from "@/lib/podcast/personality-presets";
import { getLlmModel, type LlmModelId } from "@/lib/podcast/llm-models";
import { Field, usePodcastCopy } from "./PodcastUi";
import styles from "./Podcast.module.css";
import character from "./PodcastPersonalityFields.module.css";

export function PodcastPersonalityFields({ person, index, language, voiceProvider, defaultModel = "openai-default", onChange }: {
  person: Participant; index: number; language: string; voiceProvider?: TalkSettings["voiceProvider"]; defaultModel?: LlmModelId; onChange: (values: Partial<Participant>) => void;
}) {
  const copy = usePodcastCopy();
  return <div className={character.fields}>
    <Field label={copy("Personalità", "Personality")} help={copy("Scegli un punto di partenza, poi adattalo come vuoi.", "Choose a starting point, then make it your own.")}>
      <select className={styles.input} data-testid={`personality-profile-${index}`} value={selectedPersonalityProfile(person)} onChange={event => {
        const profile = personalityProfile(event.target.value, language);
        if (profile) onChange(profile);
      }}>
        {PERSONALITY_PROFILES.map(profile => <option value={profile.id} key={profile.id}>{copy(profile.label[0], profile.label[1])}</option>)}
        <option value="custom" disabled>{copy("Personalizzata", "Custom")}</option>
      </select>
    </Field>
    <Field label={copy("Descrizione del carattere", "Personality description")}>
      <textarea className={`${styles.input} ${character.description}`} rows={3} maxLength={2000} value={person.personalityPrompt || ""} placeholder={copy("Come ascolta, reagisce e si relaziona con gli altri?", "How do they listen, react, and relate to others?")} onChange={event => onChange({ personalityPrompt: event.target.value })} />
    </Field>
    <Field label={copy("Punto di vista nella puntata", "Viewpoint for this episode")} help={copy("Facoltativo. Se lo lasci vuoto, si forma un'opinione durante il confronto.", "Optional. Leave it empty to let their opinion develop during the conversation.")}>
      <textarea className={`${styles.input} ${character.viewpoint}`} rows={2} maxLength={8000} value={person.perspectivePrompt} placeholder={copy("Una convinzione o un dubbio da cui partire…", "A belief or question to start from…")} onChange={event => onChange({ perspectivePrompt: event.target.value, perspectiveMode: event.target.value.trim() ? "custom" : "automatic" })} />
    </Field>
    <details className={`${styles.details} ${character.advanced}`} data-testid={`personality-advanced-${index}`}>
      <summary>{copy("Opzioni avanzate del personaggio", "Advanced character options")}</summary>
      <Field label={copy("AI del personaggio", "Character AI")} help={copy("Ogni intervento riceve il suo carattere, il contesto e ciò che gli altri hanno detto. Il servizio scelto deve essere configurato sul server.", "Each turn receives their character, context, and what the others have said. The selected service must be configured on the server.")}><select className={styles.input} data-testid={`personality-model-${index}`} value={person.modelOverride || ""} onChange={event => onChange({ modelOverride: event.target.value ? event.target.value as LlmModelId : undefined })}><option value="">{copy("Come la puntata", "Same as episode")} · {getLlmModel(defaultModel).provider === "claude" ? "Claude" : getLlmModel(defaultModel).provider === "gemini" ? "Gemini" : "ChatGPT / OpenAI"}</option><option value="openai-default">ChatGPT / OpenAI</option><option value="claude-default">Claude / Anthropic</option>{(person.modelOverride === "gemini-default" || defaultModel === "gemini-default") && <option value="gemini-default">Gemini</option>}</select></Field>
      <Field label={copy("Ruolo", "Role")}><input className={styles.input} required maxLength={200} value={person.role} onChange={event => onChange({ role: event.target.value })} /></Field>
      <Field label={copy("Modo di parlare", "Speaking style")}><textarea className={`${styles.input} ${character.description}`} rows={3} maxLength={8000} value={person.speakingStylePrompt || ""} onChange={event => onChange({ speakingStylePrompt: event.target.value })} /></Field>
      <Field label={copy("Cosa vuole ottenere", "What they want to achieve")}><textarea className={`${styles.input} ${character.viewpoint}`} rows={2} maxLength={8000} value={person.goals || ""} onChange={event => onChange({ goals: event.target.value })} /></Field>
      <Field label={copy("Punti su cui non cede", "Non-negotiables")}><textarea className={`${styles.input} ${character.viewpoint}`} rows={2} maxLength={8000} value={person.nonNegotiables || ""} onChange={event => onChange({ nonNegotiables: event.target.value })} /></Field>
      {([
        ["assertiveness", copy("Assertività", "Assertiveness")], ["patience", copy("Pazienza", "Patience")],
        ["interruptiveness", copy("Tendenza a interrompere", "Tendency to interrupt")], ["baselineTension", copy("Tensione di partenza", "Baseline tension")],
      ] as const).map(([key, label]) => <label className={styles.rangeRow} key={key}><span>{label}<b>{person[key]}%</b></span><input type="range" min={0} max={100} value={person[key]} onChange={event => onChange({ [key]: Number(event.target.value) })} /></label>)}
      {voiceProvider !== "kokoro" && <Field label={copy("Interpretazione vocale", "Voice delivery")}><select className={styles.input} value={person.voiceDelivery || "natural"} onChange={event => onChange({ voiceDelivery: event.target.value as Participant["voiceDelivery"] })}><option value="natural">{copy("Naturale", "Natural")}</option><option value="energetic">{copy("Vivace", "Energetic")}</option><option value="authoritative">{copy("Autorevole", "Authoritative")}</option></select></Field>}
    </details>
  </div>;
}
