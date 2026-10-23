"use client";

import { useId } from "react";
import type { TalkInput } from "@/types/podcast";
import { STUDIO_THEMES, type StudioThemeId } from "@/lib/podcast/studio-themes";
import { getStudioStyleGuide } from "@/lib/podcast/studio-formats";
import { defaultPodcast } from "./podcast-defaults";
import { PodcastThumbnail } from "./PodcastThumbnail";
import { DEFAULT_DIRECTION, type PodcastDirection } from "./PodcastStageView";
import { usePodcastCopy } from "./PodcastUi";
import design from "./PodcastStyles.module.css";

export function PodcastStylePicker({ value, onChange, talk, direction = DEFAULT_DIRECTION, compact = false, disabled = false, legend }: {
  value: StudioThemeId;
  onChange: (theme: StudioThemeId) => void;
  talk?: Pick<TalkInput, "title" | "topic" | "participants" | "settings">;
  direction?: PodcastDirection;
  compact?: boolean;
  disabled?: boolean;
  legend?: string;
}) {
  const copy = usePodcastCopy();
  const name = useId();
  const previewTalk = talk ?? defaultPodcast();
  const signature = JSON.stringify([previewTalk.title, previewTalk.topic, previewTalk.settings.videoTopicMode, previewTalk.settings.videoTopicText, previewTalk.settings.studioCast, previewTalk.settings.studioGuest, previewTalk.participants.map((person) => [person.name, person.sex, person.kind]), direction]);
  return <fieldset disabled={disabled} className={`${design.picker} ${compact ? design.compact : ""} ${disabled ? design.disabled : ""}`} data-testid="podcast-style-picker">
    <legend className={design.legend}>{legend || copy("Scegli lo stile grafico", "Choose a visual style")}</legend>
    <div className={design.cards}>
      {STUDIO_THEMES.map((theme) => <label key={theme.id} className={`${design.card} ${value === theme.id ? design.selected : ""}`}>
        <input className={design.radio} data-testid={`podcast-style-option-${theme.id}`} type="radio" name={name} value={theme.id} checked={value === theme.id} onChange={() => onChange(theme.id)} onClick={() => { if (value === theme.id) onChange(theme.id); }} onKeyDown={event => { if (event.key === "Enter" || (event.key === " " && value === theme.id)) { event.preventDefault(); onChange(theme.id); } }} aria-label={copy(theme.label.it, theme.label.en)} />
        <span className={design.thumbnail}><PodcastThumbnail key={`${theme.id}-${signature}`} talk={{ ...previewTalk, settings: { ...previewTalk.settings, studioTheme: theme.id } }} direction={direction} /></span>
        <span className={design.cardText}>{theme.id.startsWith("original-") && <span className={design.cardIndex}>{copy("PROPOSTA INIZIALE · ORA ANIMATA", "INITIAL PROPOSAL · NOW ANIMATED")}</span>}<span className={design.familyLabel}>{copy(getStudioStyleGuide(theme.id).family.label.it, getStudioStyleGuide(theme.id).family.label.en)}</span><strong className={design.cardTitle}>{copy(theme.label.it, theme.label.en)}</strong><span className={design.cardDescription}>{copy(theme.description.it, theme.description.en)}</span><span className={design.formatTags}>{getStudioStyleGuide(theme.id).formats.map(format => <span key={format.id}>{copy(format.label.it, format.label.en)}</span>)}</span><span className={design.swatches} aria-hidden="true">{theme.colors.map((color) => <i key={color} style={{ backgroundColor: color }} />)}</span></span>
      </label>)}
    </div>
  </fieldset>;
}
