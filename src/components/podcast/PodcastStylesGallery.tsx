"use client";

import Link from "next/link";
import { useState } from "react";
import { getStudioTheme, STUDIO_THEMES, getStudioCastOptions, studioSelectionQuery, type StudioCast, type StudioGuestMode, type StudioThemeId } from "@/lib/podcast/studio-themes";
import { STUDIO_FORMATS, STUDIO_STYLE_FAMILIES, getStudioStyleGuide, matchesStudioFormat, type StudioFormat } from "@/lib/podcast/studio-formats";
import { PodcastFormatPicker } from "./PodcastFormatPicker";
import { getStudioScenario, STUDIO_SCENARIOS, type StudioScenarioId } from "@/lib/podcast/studio-scenarios";
import { PODCAST_MOOD_OPTIONS } from "@/lib/podcast/mood-demo";
import { defaultPodcast } from "./podcast-defaults";
import { DEFAULT_DIRECTION, PodcastStageView, type PodcastDirection, type PodcastEmotion, type PodcastShot } from "./PodcastStageView";
import { PodcastCastPicker } from "./PodcastCastPicker";
import { PodcastStylePicker } from "./PodcastStylePicker";
import { PodcastScenarioPicker } from "./PodcastScenarioPicker";
import { PodcastMoodRehearsalLab, usePodcastMoodRehearsal } from "./PodcastMoodRehearsalLab";
import { Field, usePodcastCopy } from "./PodcastUi";
import styles from "./Podcast.module.css";
import design from "./PodcastStyles.module.css";

export function PodcastStylesGallery({ initialTheme, initialScenario = "studio", initialCast = "original", initialGuest = "auto" }: { initialTheme: StudioThemeId; initialScenario?: StudioScenarioId; initialCast?: StudioCast; initialGuest?: StudioGuestMode }) {
  const copy = usePodcastCopy();
  const [cast, setCast] = useState(initialCast);
  const [guest, setGuest] = useState(initialGuest);
  const [theme, setTheme] = useState(initialTheme);
  const [direction, setDirection] = useState<PodcastDirection>({ ...DEFAULT_DIRECTION, layout: initialScenario, automatic: false });
  const [manual, setManual] = useState(false);
  const demo = usePodcastMoodRehearsal();
  const selected = getStudioTheme(theme);
  const scenario = getStudioScenario(direction.layout);
  const base = defaultPodcast(copy("it", "en") === "en");
  const talk = { ...base, title: copy("Voci a confronto", "Voices in conversation"), topic: copy("Idee, domande e punti di vista", "Ideas, questions, and perspectives"),
    participants: base.participants.slice(0, 2), settings: { ...base.settings, studioTheme: theme, studioLayout: direction.layout, studioCast: cast, studioGuest: guest } };
  const thumbnailDirection = { ...DEFAULT_DIRECTION, layout: direction.layout, focus: "all" as const, automatic: false };
  const effectiveDirection = manual ? direction : { ...direction,
    emotion: demo.sentence.speakerIndex === 0 ? demo.sentence.mood : demo.sentence.listenerMood,
    intensity: demo.sentence.speakerIndex === 0 ? demo.sentence.intensity : demo.sentence.listenerIntensity,
    emotion2: demo.sentence.speakerIndex === 1 ? demo.sentence.mood : demo.sentence.listenerMood,
    intensity2: demo.sentence.speakerIndex === 1 ? demo.sentence.intensity : demo.sentence.listenerIntensity };
  function applyFormat(format: StudioFormat) {
    const choice = format.selection;
    setTheme(choice.studioTheme); setCast(choice.studioCast); setGuest(choice.studioGuest);
    setDirection(current => ({ ...current, layout: choice.studioLayout, focus: "all" }));
  }
  function changeExpression(index: number, expression: PodcastEmotion) {
    demo.pause(); setManual(true);
    setDirection({ ...effectiveDirection, ...(index === 0 ? { emotion: expression } : { emotion2: expression }) });
  }
  function changeIntensity(index: number, intensity: number) {
    demo.pause(); setManual(true);
    setDirection({ ...effectiveDirection, ...(index === 0 ? { intensity } : { intensity2: intensity }) });
  }
  return <div className={styles.workspace}>
    <Link className={styles.back} href="/podcast">← {copy("Tutti i podcast", "All podcasts")}</Link>
    <header className={styles.topline}>
      <div><div className={styles.eyebrow}>{copy("L’IDENTITÀ VISIVA DEL PODCAST", "THE PODCAST’S VISUAL IDENTITY")}</div><h1 className={styles.heading}>{copy("Stili, scenari e carattere.", "Styles, scenes, and character.")}</h1><p className={styles.intro}>{copy("Scegli una direzione grafica completa, cambia i volti dei conduttori e disponili in scena. Puoi confrontare i due avatar da soli o aggiungere uno spazio per l’ospite, con le stesse emozioni e animazioni.", "Choose a complete art direction, change the hosts’ faces, and arrange the scene. Compare the two avatars alone or add a guest space, with the same emotions and animation.")}</p></div>
    </header>
    <div className={design.counts}><span className={design.count}><strong>{STUDIO_THEMES.length}</strong>{copy("direzioni grafiche animate", "animated art directions")}</span><span className={design.count}><strong>{STUDIO_STYLE_FAMILIES.length}</strong>{copy("famiglie visive", "visual families")}</span><span className={design.count}><strong>3</strong>{copy("duo di avatar", "avatar duos")}</span><span className={design.count}><strong>4</strong>{copy("disposizioni", "compositions")}</span><span className={design.count}><strong>8</strong>{copy("mood da esplorare", "moods to explore")}</span></div>
    <p className={design.description}>{copy("Le tre proposte iniziali sono qui, tra gli stili selezionabili. Ogni direzione abbina il proprio tratto a un ambiente; i volti e la disposizione si scelgono a parte.", "The three initial proposals are now selectable styles. Each direction pairs its artwork with an environment; faces and composition are chosen separately.")}</p>
    <PodcastFormatPicker settings={talk.settings} onChange={applyFormat} />
    <div className={design.compareNavigation}><a className={styles.secondary} data-testid="style-compare-live" href="#podcast-live-comparison">{copy("Vai al confronto animato", "Go to the animated comparison")} ↓</a><span>{copy("Puoi cambiare tutte le scelte anche accanto alla scena.", "Every choice can also be changed beside the stage.")}</span></div>
    <PodcastStylePicker value={theme} onChange={setTheme} talk={talk} direction={thumbnailDirection} legend={copy("1. Scegli tratto e ambiente", "1. Choose artwork and environment")} />
    <PodcastCastPicker talk={talk} direction={thumbnailDirection} onChange={setCast} />
    <label className={design.guestToggle}><input type="checkbox" data-testid="style-gallery-guest-toggle" checked={guest === "reserve"} onChange={event => { setGuest(event.target.checked ? "reserve" : "auto"); setDirection({ ...direction, focus: "all" }); }} /><span><strong>{copy("Aggiungi uno spazio per l’ospite reale", "Add a space for a real guest")}</strong><small>{copy("Facoltativo: la scena si ricompone per due avatar oppure per due avatar e un video in diretta.", "Optional: the scene adjusts for two avatars, or two avatars and a live video.")}</small></span></label>
    <PodcastScenarioPicker value={scenario.id} onChange={layout => setDirection({ ...direction, layout, focus: "all" })} talk={talk} direction={thumbnailDirection} />
    <section id="podcast-live-comparison" className={design.comparison}>
      <div className={design.stageColumn}>
        <div className={design.stage} data-testid="style-gallery-stage"><div className={design.stageLabel}>{copy(selected.label.it, selected.label.en)} · {copy(scenario.label.it, scenario.label.en)}</div><PodcastStageView talk={talk} direction={effectiveDirection} performance={manual ? undefined : { speakerIndex: demo.sentence.speakerIndex, mood: demo.sentence.mood, intensity: demo.sentence.intensity, listenerMood: demo.sentence.listenerMood, listenerIntensity: demo.sentence.listenerIntensity, phase: demo.phase, progress: demo.progress, cueId: demo.cueId }} /></div>
        <div className={design.guestReserved} data-testid="style-gallery-guest"><span className={design.guestSeatIcon} aria-hidden="true" /><div><strong>{guest === "reserve" ? copy("Spazio video per l’ospite attivo.", "Guest video space enabled.") : copy("La scena è dedicata ai due avatar.", "The scene is dedicated to the two avatars.")}</strong><span>{guest === "reserve" ? copy("Qui vedi il segnaposto della diretta. Nessun accesso a videocamera o microfono.", "This is the live video placeholder. No camera or microphone access.") : copy("Puoi aggiungere lo spazio dell’ospite quando ti serve. Le reazioni restano coordinate fra i conduttori.", "Add a guest space when needed. The hosts’ reactions stay coordinated.")}</span></div></div>
      </div>
      <div className={design.controlColumn}>
      <aside className={design.panel} data-testid="style-gallery-quick-controls">
        <h2>{copy("Confronta dal vivo", "Compare live")}</h2><p className={design.description}>{copy("Cambia tratto, volti e presenza dell’ospite tenendo la scena davanti a te.", "Change artwork, faces, and guest presence while keeping the stage in view.")}</p>
        <div className={design.controls}>
          <Field label={copy("Tipo di puntata", "Kind of episode")}><select className={styles.input} data-testid="style-gallery-format" value={STUDIO_FORMATS.find(format => matchesStudioFormat(talk.settings, format))?.id ?? "custom"} onChange={event => { const format = STUDIO_FORMATS.find(item => item.id === event.target.value); if (format) applyFormat(format); }}><option value="custom">{copy("Composizione personalizzata", "Custom composition")}</option>{STUDIO_FORMATS.map(format => <option key={format.id} value={format.id}>{copy(format.label.it, format.label.en)}</option>)}</select></Field>
          <Field label={copy("Tratto e ambiente", "Artwork and environment")}><select className={styles.input} data-testid="style-gallery-theme" value={theme} onChange={event => setTheme(event.target.value as StudioThemeId)}>{STUDIO_THEMES.map(item => <option key={item.id} value={item.id}>{copy(item.label.it, item.label.en)}</option>)}</select></Field>
          <Field label={copy("Volti dei conduttori", "Hosts’ faces")}><select className={styles.input} data-testid="style-gallery-cast" value={cast} onChange={event => setCast(event.target.value as StudioCast)}>{getStudioCastOptions(theme).map(item => <option key={item.id} value={item.id}>{copy(item.label.it, item.label.en)}</option>)}</select></Field>
          <Field label={copy("Spazio per l’ospite", "Guest space")}><select className={styles.input} data-testid="style-gallery-guest-mode" value={guest === "reserve" ? "reserve" : "auto"} onChange={event => { setGuest(event.target.value as StudioGuestMode); setDirection({ ...direction, focus: "all" }); }}><option value="auto">{copy("Solo i due avatar", "Two avatars only")}</option><option value="reserve">{copy("Due avatar e spazio video ospite", "Two avatars and a guest video space")}</option></select></Field>
        </div>
      </aside>
      <PodcastMoodRehearsalLab demo={demo} hostNames={talk.participants.slice(0, 2).map(person => person.name)} manual={manual} onActivate={() => setManual(false)} />
      <aside className={design.panel}>
        <h2>{copy(scenario.label.it, scenario.label.en)}</h2><p className={design.description}>{copy(scenario.description.it, scenario.description.en)}</p>
        <div className={design.controls}>
          <Field label={copy("Regia della scena", "Scene composition")}><select className={styles.input} data-testid="style-gallery-layout" value={direction.layout} onChange={(event) => setDirection({ ...direction, layout: event.target.value as PodcastDirection["layout"] })}>{STUDIO_SCENARIOS.map(item => <option key={item.id} value={item.id}>{copy(item.label.it, item.label.en)}</option>)}</select></Field>
          <Field label={copy("Inquadratura", "Camera shot")}><select className={styles.input} data-testid="style-gallery-focus" value={direction.focus} onChange={(event) => setDirection({ ...direction, focus: event.target.value as PodcastShot })}><option value="all">{copy("Tutti", "All")}</option><option value="host-1">{talk.participants[0].name}</option><option value="host-2">{talk.participants[1].name}</option>{guest === "reserve" && <option value="guest">{copy("Ospite", "Guest")}</option>}</select></Field>
        </div>
        <div className={design.divider} />
        <h3 className={design.controlHeading}>{copy("Prova le espressioni a mano", "Try the expressions by hand")}</h3>
        <p className={design.description}>{copy("Ogni conduttore ha un’emozione e un’intensità proprie. Modifica un controllo per fermare la sequenza e osservare una reazione.", "Each host has their own emotion and intensity. Adjust a control to pause the sequence and explore a reaction.")}</p>
        <div className={design.controls}>{talk.participants.slice(0, 2).map((person, index) => <div className={design.hostControls} key={index}><Field label={`${copy("Espressione", "Expression")} · ${person.name}`}><select className={styles.input} data-testid={`style-gallery-expression-${index}`} value={index === 0 ? effectiveDirection.emotion : effectiveDirection.emotion2} onChange={event => changeExpression(index, event.target.value as PodcastEmotion)}>{PODCAST_MOOD_OPTIONS.map(item => <option value={item.id} key={item.id}>{copy(item.label.it, item.label.en)}</option>)}</select></Field><label className={design.intensity}><span>{copy("Intensità", "Intensity")} · {person.name}<output>{Math.round((index === 0 ? effectiveDirection.intensity : effectiveDirection.intensity2 ?? effectiveDirection.intensity) * 100)}%</output></span><input data-testid={`style-gallery-intensity-${index}`} type="range" min={0} max={100} step={1} value={Math.round((index === 0 ? effectiveDirection.intensity : effectiveDirection.intensity2 ?? effectiveDirection.intensity) * 100)} onChange={event => changeIntensity(index, Number(event.target.value) / 100)} /></label></div>)}</div>
        <div className={design.divider} /><h3 className={design.controlHeading}>{copy(selected.label.it, selected.label.en)}</h3><p className={design.description}>{copy(selected.description.it, selected.description.en)}</p>
      </aside>
      </div>
    </section>
    <section className={design.designSummary}>
      <p className={design.familySummary}><strong>{copy(getStudioStyleGuide(theme).family.label.it, getStudioStyleGuide(theme).family.label.en)}</strong> · {copy("Da provare per", "Try it for")}: {getStudioStyleGuide(theme).formats.map(format => copy(format.label.it, format.label.en)).join(" · ")}</p>
      <div className={design.selectedDetails}><div><strong>{copy("Il disegno dei volti", "Face design")}</strong><p>{copy(selected.character.it, selected.character.en)}</p></div><div><strong>{copy("Tratto e volume", "Linework & volume")}</strong><p>{copy(selected.treatment.it, selected.treatment.en)}</p></div></div>
      <div className={design.actions}><Link className={styles.primary} data-testid="style-use-rehearsal" href={`/podcast/rehearsal?${studioSelectionQuery(talk.settings)}`}>{copy("Usa nella prova a due", "Use in two-host rehearsal")} →</Link><Link className={styles.secondary} data-testid="style-use-new" href={`/podcast/new?${studioSelectionQuery(talk.settings)}`}>{copy("Usa in nuova puntata", "Use in a new episode")} ↗</Link></div>
      <p className={design.note}>{copy("L’anteprima anima sguardi e reazioni senza audio. Stile, volti, disposizione e spazio ospite si salvano quando prepari una prova o salvi una puntata. Puoi cambiare inquadratura durante la regia.", "The preview animates gaze and reactions without audio. Artwork, faces, composition, and guest space are saved when you prepare a rehearsal or save an episode. Camera shots can change during direction.")}</p>
    </section>

  </div>;
}
