"use client";

import type { TalkInput } from "@/types/podcast";
import { STUDIO_CASTS, normalizeStudioCast, normalizeStudioGuest, type StudioCast, type StudioGuestMode } from "@/lib/podcast/studio-themes";
import { Field, usePodcastCopy } from "./PodcastUi";
import styles from "./Podcast.module.css";

export function PodcastVisualOptions({ settings, onChange, disabled = false }: {
  settings: TalkInput["settings"];
  onChange: (settings: TalkInput["settings"]) => void;
  disabled?: boolean;
}) {
  const copy = usePodcastCopy();
  return <fieldset disabled={disabled} style={{ border: 0, padding: 0, minWidth: 0 }}>
    <Field label={copy("Volti dei conduttori", "Hosts’ faces")}><select className={styles.input} data-testid="podcast-cast" value={normalizeStudioCast(settings.studioCast)} onChange={event => onChange({ ...settings, studioCast: event.target.value as StudioCast })}>{STUDIO_CASTS.map(cast => <option key={cast.id} value={cast.id}>{copy(cast.label.it, cast.label.en)}</option>)}</select></Field>
    <Field label={copy("Spazio per l’ospite", "Guest space")}><select className={styles.input} data-testid="podcast-guest-mode" value={normalizeStudioGuest(settings.studioGuest)} onChange={event => onChange({ ...settings, studioGuest: event.target.value as StudioGuestMode })}><option value="auto">{copy("Solo se è previsto un partecipante umano", "Only when a human participant is invited")}</option><option value="reserve">{copy("Riserva sempre uno spazio video", "Always reserve a video space")}</option><option value="hidden">{copy("Scena con i soli avatar", "Avatars-only scene")}</option></select><small>{copy("La scelta cambia la composizione del video. La videocamera si accende soltanto dal controllo dedicato in regia.", "This changes the video composition. The camera starts only through its dedicated studio control.")}</small></Field>
  </fieldset>;
}
