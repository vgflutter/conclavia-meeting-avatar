"use client";

import { useId } from "react";
import type { TalkInput } from "@/types/podcast";
import { STUDIO_SCENARIOS, type StudioScenarioId } from "@/lib/podcast/studio-scenarios";
import { PodcastThumbnail } from "./PodcastThumbnail";
import { DEFAULT_DIRECTION, type PodcastDirection } from "./PodcastStageView";
import { usePodcastCopy } from "./PodcastUi";
import design from "./PodcastStyles.module.css";

export function PodcastScenarioPicker({ value, onChange, talk, direction = DEFAULT_DIRECTION }: {
  value: StudioScenarioId;
  onChange: (scenario: StudioScenarioId) => void;
  talk: Pick<TalkInput, "title" | "topic" | "participants" | "settings">;
  direction?: PodcastDirection;
}) {
  const copy = usePodcastCopy();
  const group = useId();
  const signature = JSON.stringify([talk.title, talk.settings.studioTheme, talk.settings.studioCast, talk.settings.studioGuest, talk.participants.map(person => [person.name, person.kind, person.sex])]);
  return <fieldset className={`${design.picker} ${design.scenarioPicker}`} data-testid="podcast-scenario-picker">
    <legend className={design.legend}>{copy("3. Scegli la disposizione", "3. Choose the composition")}</legend>
    <div className={design.cards}>{STUDIO_SCENARIOS.map((scenario, index) => <label key={scenario.id} className={`${design.card} ${value === scenario.id ? design.selected : ""}`}>
      <input className={design.radio} data-testid={`podcast-scenario-option-${scenario.id}`} type="radio" name={group} value={scenario.id} checked={value === scenario.id} onChange={() => onChange(scenario.id)} aria-label={copy(scenario.label.it, scenario.label.en)} />
      <span className={design.thumbnail}><PodcastThumbnail key={`${scenario.id}-${signature}`} talk={talk} direction={{ ...direction, layout: scenario.id, focus: "all" }} /></span>
      <span className={design.cardText}><span className={design.cardIndex}>0{index + 1} / {copy("SCENARIO", "SCENE")}</span><strong className={design.cardTitle}>{copy(scenario.label.it, scenario.label.en)}</strong><span className={design.scenarioGuest}>{copy(scenario.guest.it, scenario.guest.en)}</span></span>
    </label>)}</div>
  </fieldset>;
}
