"use client";

import { useId } from "react";
import type { TalkInput } from "@/types/podcast";
import { STUDIO_CASTS, normalizeStudioCast, type StudioCast } from "@/lib/podcast/studio-themes";
import { PodcastThumbnail } from "./PodcastThumbnail";
import type { PodcastDirection } from "./PodcastStageView";
import { usePodcastCopy } from "./PodcastUi";
import design from "./PodcastStyles.module.css";

export function PodcastCastPicker({ talk, direction, onChange }: {
  talk: Pick<TalkInput, "title" | "topic" | "participants" | "settings">;
  direction: PodcastDirection;
  onChange: (cast: StudioCast) => void;
}) {
  const copy = usePodcastCopy();
  const group = useId();
  const selected = normalizeStudioCast(talk.settings.studioCast);
  const signature = JSON.stringify([talk.settings.studioTheme, talk.settings.studioGuest, direction.layout, talk.participants.map(person => [person.name, person.kind, person.sex])]);
  return <fieldset className={`${design.picker} ${design.castPicker}`} data-testid="podcast-cast-picker">
    <legend className={design.legend}>{copy("2. Scegli i volti dei conduttori", "2. Choose the hosts’ faces")}</legend>
    <div className={design.cards}>{STUDIO_CASTS.map(cast => <label key={cast.id} className={`${design.card} ${selected === cast.id ? design.selected : ""}`}>
      <input className={design.radio} type="radio" data-testid={`podcast-cast-option-${cast.id}`} name={group} value={cast.id} checked={selected === cast.id} onChange={() => onChange(cast.id)} aria-label={copy(cast.label.it, cast.label.en)} />
      <span className={design.thumbnail}><PodcastThumbnail key={`${cast.id}-${signature}`} talk={{ ...talk, settings: { ...talk.settings, studioCast: cast.id } }} direction={direction} /></span>
      <span className={design.cardText}><strong className={design.cardTitle}>{copy(cast.label.it, cast.label.en)}</strong><span className={design.cardDescription}>{copy(cast.description.it, cast.description.en)}</span></span>
    </label>)}</div>
  </fieldset>;
}
