"use client";

import type { TalkInput } from "@/types/podcast";
import type { ReactNode } from "react";
import { getStudioCastOptions, normalizeStudioCast, normalizeStudioGuest, type StudioCast, type StudioGuestMode } from "@/lib/podcast/studio-themes";
import { Field, usePodcastCopy } from "./PodcastUi";
import styles from "./Podcast.module.css";

export function PodcastVisualOptions({ settings, onChange, disabled = false, children }: {
  settings: TalkInput["settings"];
  onChange: (settings: TalkInput["settings"]) => void;
  disabled?: boolean;
  children?: ReactNode;
}) {
  const copy = usePodcastCopy();
  return <fieldset disabled={disabled} style={{ border: 0, padding: 0, minWidth: 0 }}>
    <Field label={copy("2. Personaggi", "2. Characters")} help={copy("L’aspetto dei due conduttori, disegnati nello stile scelto.", "The two hosts’ appearance, drawn in the selected style.")}><select className={styles.input} data-testid="podcast-cast" value={normalizeStudioCast(settings.studioCast)} onChange={event => onChange({ ...settings, studioCast: event.target.value as StudioCast })}>{getStudioCastOptions(settings.studioTheme).map(cast => <option key={cast.id} value={cast.id}>{copy(cast.label.it, cast.label.en)}</option>)}</select></Field>
    {children}
    <Field label={copy("Ospite in scena", "Guest on stage")} help={copy("Lo spazio si prepara qui; videocamera e avatar dell’ospite si scelgono nella pre-diretta.", "Prepare the space here; choose the guest’s camera or avatar in preflight.")}><select className={styles.input} data-testid="podcast-guest-mode" value={normalizeStudioGuest(settings.studioGuest)} onChange={event => onChange({ ...settings, studioGuest: event.target.value as StudioGuestMode })}><option value="auto">{copy("Quando previsto nella puntata", "When included in the episode")}</option><option value="reserve">{copy("Riserva uno spazio per l’ospite", "Reserve a guest space")}</option><option value="hidden">{copy("Solo i due avatar", "Two avatars only")}</option></select></Field>
  </fieldset>;
}
