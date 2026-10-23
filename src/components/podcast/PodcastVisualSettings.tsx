"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { normalizeVideoTopicMode, VIDEO_TOPIC_MAX_LENGTH } from "@/lib/podcast/video-topic";
import type { TalkInput } from "@/types/podcast";
import { getStudioTheme, studioSelectionQuery, type StudioThemeId } from "@/lib/podcast/studio-themes";
import { normalizeStudioScenario, STUDIO_SCENARIOS } from "@/lib/podcast/studio-scenarios";
import { PodcastStylePicker } from "./PodcastStylePicker";
import { PodcastThumbnail } from "./PodcastThumbnail";
import { PodcastVisualOptions } from "./PodcastVisualOptions";
import { DEFAULT_DIRECTION, type PodcastDirection } from "./PodcastStageView";
import { Field, usePodcastCopy } from "./PodcastUi";
import styles from "./Podcast.module.css";
import visual from "./PodcastVisualSettings.module.css";

/** One control per visual choice, shared by preview, editor, rehearsal and gallery. */
export function PodcastVisualSettings({ talk, onChange, direction = DEFAULT_DIRECTION, disabled = false, expanded = false, galleryLink = true }: {
  talk: Pick<TalkInput, "title" | "topic" | "participants" | "settings">;
  onChange: (settings: TalkInput["settings"]) => void;
  direction?: PodcastDirection;
  disabled?: boolean;
  expanded?: boolean;
  galleryLink?: boolean;
}) {
  const copy = usePodcastCopy();
  const [open, setOpen] = useState(expanded);
  const summary = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const selected = getStudioTheme(talk.settings.studioTheme);
  const previewDirection = { ...direction, layout: normalizeStudioScenario(talk.settings.studioLayout), focus: "all" as const };
  const thumbnailKey = JSON.stringify([selected.id, talk.title, talk.topic, talk.settings.videoTopicMode, talk.settings.videoTopicText, talk.settings.studioCast, talk.settings.studioGuest, previewDirection.layout, talk.participants.map(person => [person.name, person.kind, person.sex])]);
  function chooseStyle(theme: StudioThemeId) {
    if (theme !== selected.id) onChange({ ...talk.settings, studioTheme: theme });
    if (!expanded) { setOpen(false); summary.current?.focus(); }
  }
  return <fieldset disabled={disabled} className={visual.settings} data-testid="podcast-visual-settings">
    <div className={visual.step}>
      <div className={visual.stepTitle}>{copy("1. Stile grafico", "1. Visual style")}</div>
      <p className={visual.help}>{copy("Il tratto del disegno e l’ambiente della puntata.", "The drawing treatment and the episode’s setting.")}</p>
      <div className={visual.chooser}>
        <button type="button" ref={summary} data-testid="podcast-style-chooser" data-style={selected.id} aria-expanded={open} aria-controls={listId} onClick={() => setOpen(current => !current)}>
          <span className={visual.thumbnail}><PodcastThumbnail key={thumbnailKey} talk={talk} direction={previewDirection} /></span>
          <span className={visual.choiceName}><strong>{copy(selected.label.it, selected.label.en)}</strong><span>{open ? copy("Chiudi gli stili", "Close styles") : copy("Cambia stile", "Change style")}</span></span>
          <span className={visual.chevron} aria-hidden="true">⌄</span>
        </button>
        <div className={visual.choices} id={listId} hidden={!open}><PodcastStylePicker compact talk={talk} direction={previewDirection} value={selected.id} onChange={chooseStyle} disabled={disabled} legend={copy("Scegli uno dei 10 stili", "Choose one of 10 styles")} /></div>
      </div>
      {galleryLink && <Link className={visual.galleryLink} href={`/podcast/styles?${studioSelectionQuery(talk.settings)}`}>{copy("Esplora la galleria animata", "Explore the animated gallery")} ↗</Link>}
    </div>
    <PodcastVisualOptions settings={talk.settings} onChange={onChange} disabled={disabled}>
      <Field label={copy("3. Composizione", "3. Composition")} help={copy("La disposizione dei partecipanti nella scena.", "How participants are arranged in the scene.")}><select className={styles.input} data-testid="podcast-layout" value={previewDirection.layout} onChange={event => onChange({ ...talk.settings, studioLayout: normalizeStudioScenario(event.target.value) })}>{STUDIO_SCENARIOS.map(scenario => <option key={scenario.id} value={scenario.id}>{copy(scenario.label.it, scenario.label.en)}</option>)}</select></Field>
    </PodcastVisualOptions>
    <div className={visual.topic}>
      <Field label={copy("Argomento in video", "On-screen topic")} help={copy("Una frase breve, leggibile anche nei reel. Compare nel video registrato.", "A short headline, readable in reels too. Included in the recorded video.")}>
        <select className={styles.input} data-testid="podcast-topic-mode" value={normalizeVideoTopicMode(talk.settings.videoTopicMode)} onChange={event => onChange({ ...talk.settings, videoTopicMode: normalizeVideoTopicMode(event.target.value), ...(event.target.value === "custom" && !talk.settings.videoTopicText ? { videoTopicText: talk.topic.slice(0, VIDEO_TOPIC_MAX_LENGTH) } : {}) })}>
          <option value="episode">{copy("Automatico · argomento della puntata", "Automatic · episode topic")}</option>
          <option value="conversation">{copy("Dinamico · segui la conversazione", "Dynamic · follow the conversation")}</option>
          <option value="custom">{copy("Scrivi un titolo breve", "Write a short headline")}</option>
          <option value="hidden">{copy("Nascosto", "Hidden")}</option>
        </select>
      </Field>
      {talk.settings.videoTopicMode === "custom" && <Field label={copy("Titolo breve", "Short headline")} help={`${talk.settings.videoTopicText?.length ?? 0}/${VIDEO_TOPIC_MAX_LENGTH}`}><input className={styles.input} data-testid="podcast-topic-text" maxLength={VIDEO_TOPIC_MAX_LENGTH} value={talk.settings.videoTopicText ?? ""} placeholder={copy("L’AI ci aiuta o decide per noi?", "Does AI help us or decide for us?")} onChange={event => onChange({ ...talk.settings, videoTopicText: event.target.value })} /></Field>}
      {talk.settings.videoTopicMode === "conversation" && <p className={visual.help}>{copy("Segue il tema dell’intervento in riproduzione, con una dissolvenza. Fino ad allora mostra l’argomento della puntata.", "Follows the topic of the turn being played, with a fade. Until then, shows the episode topic.")}</p>}
    </div>
  </fieldset>;
}
