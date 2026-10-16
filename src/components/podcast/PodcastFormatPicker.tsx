"use client";

import { STUDIO_FORMATS, matchesStudioFormat, type StudioFormat } from "@/lib/podcast/studio-formats";
import type { TalkInput } from "@/types/podcast";
import { usePodcastCopy } from "./PodcastUi";
import design from "./PodcastStyles.module.css";

export function PodcastFormatPicker({ settings, onChange }: { settings: TalkInput["settings"]; onChange: (format: StudioFormat) => void }) {
  const copy = usePodcastCopy();
  return <fieldset className={design.formatPicker} data-testid="podcast-format-picker">
    <legend className={design.legend}>{copy("Parti dal tipo di puntata", "Start with the kind of episode")}</legend>
    <p className={design.description}>{copy("Otto abbinamenti iniziali di ambiente, volti e disposizione. Provali, poi modifica ogni scelta liberamente.", "Eight starting combinations of environment, faces, and composition. Try one, then customize every choice freely.")}</p>
    <div className={design.formatCards}>{STUDIO_FORMATS.map(format => <button type="button" key={format.id} className={design.formatCard} aria-pressed={matchesStudioFormat(settings, format)} data-testid={`podcast-format-${format.id}`} onClick={() => onChange(format)}><strong>{copy(format.label.it, format.label.en)}</strong><span>{copy(format.description.it, format.description.en)}</span></button>)}</div>
  </fieldset>;
}
