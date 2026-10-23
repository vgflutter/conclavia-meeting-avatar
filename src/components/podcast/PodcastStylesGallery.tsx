"use client";

import type { VideoTopicSettings } from "@/lib/podcast/video-topic";

import Link from "next/link";
import { useState } from "react";
import { getStudioTheme, STUDIO_THEMES, studioSelectionQuery, type StudioCast, type StudioGuestMode, type StudioThemeId } from "@/lib/podcast/studio-themes";
import { getStudioStyleGuide, type StudioFormat } from "@/lib/podcast/studio-formats";
import { PodcastFormatPicker } from "./PodcastFormatPicker";
import { getStudioScenario, normalizeStudioScenario, type StudioScenarioId } from "@/lib/podcast/studio-scenarios";
import { PODCAST_MOOD_OPTIONS } from "@/lib/podcast/mood-demo";
import { defaultPodcast } from "./podcast-defaults";
import { DEFAULT_DIRECTION, PodcastStageView, type PodcastDirection, type PodcastEmotion, type PodcastShot } from "./PodcastStageView";
import { PodcastVisualSettings } from "./PodcastVisualSettings";
import { PodcastMoodRehearsalLab, usePodcastMoodRehearsal } from "./PodcastMoodRehearsalLab";
import { Field, usePodcastCopy } from "./PodcastUi";
import styles from "./Podcast.module.css";
import design from "./PodcastStyles.module.css";

export function PodcastStylesGallery({ initialTheme, initialScenario = "studio", initialCast = "original", initialGuest = "auto", initialTopic = {} }: { initialTheme: StudioThemeId; initialScenario?: StudioScenarioId; initialCast?: StudioCast; initialGuest?: StudioGuestMode; initialTopic?: VideoTopicSettings }) {
  const copy = usePodcastCopy();
  const [topicSettings, setTopicSettings] = useState<VideoTopicSettings>(initialTopic);
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
    participants: base.participants.slice(0, 2), settings: { ...base.settings, studioTheme: theme, studioLayout: direction.layout, studioCast: cast, studioGuest: guest, ...topicSettings } };
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
      <div><div className={styles.eyebrow}>{copy("L’IDENTITÀ VISIVA DEL PODCAST", "THE PODCAST’S VISUAL IDENTITY")}</div><h1 className={styles.heading}>{copy("L’aspetto del tuo podcast.", "Your podcast’s appearance.")}</h1><p className={styles.intro}>{copy("Scegli stile, personaggi e composizione guardando subito il risultato. Puoi provare anche lo spazio per un ospite.", "Choose style, characters, and composition while watching the result. You can also try a guest space.")}</p></div>
    </header>
    <div className={design.counts}><span className={design.count}><strong>{STUDIO_THEMES.length}</strong>{copy("stili grafici", "visual styles")}</span><span className={design.count}><strong>3</strong>{copy("coppie di personaggi", "character pairs")}</span><span className={design.count}><strong>4</strong>{copy("composizioni", "compositions")}</span></div>
    <details className={design.presets} data-testid="podcast-presets"><summary>{copy("Vuoi partire da una proposta?", "Want a starting suggestion?")}</summary><p className={design.description}>{copy("Ogni proposta imposta insieme stile, personaggi e composizione. Puoi poi cambiare le tre scelte qui sotto.", "Each suggestion sets style, characters, and composition together. You can then adjust the three choices below.")}</p><PodcastFormatPicker settings={talk.settings} onChange={applyFormat} /></details>
    <section id="podcast-live-comparison" className={design.comparison}>
      <div className={design.stageColumn}>
        <div className={design.stage} data-testid="style-gallery-stage"><PodcastStageView talk={talk} direction={effectiveDirection} performance={manual ? undefined : { speakerIndex: demo.sentence.speakerIndex, mood: demo.sentence.mood, intensity: demo.sentence.intensity, listenerMood: demo.sentence.listenerMood, listenerIntensity: demo.sentence.listenerIntensity, phase: demo.phase, progress: demo.progress, cueId: demo.cueId }} /></div>
        <div className={design.stageLabel} data-testid="style-gallery-label">{copy(selected.label.it, selected.label.en)} · {copy(scenario.label.it, scenario.label.en)}</div>
        <div className={design.guestReserved} data-testid="style-gallery-guest"><span className={design.guestSeatIcon} aria-hidden="true" /><div><strong>{guest === "reserve" ? copy("Spazio video per l’ospite attivo.", "Guest video space enabled.") : copy("La scena è dedicata ai due avatar.", "The scene is dedicated to the two avatars.")}</strong><span>{guest === "reserve" ? copy("Qui vedi il segnaposto della diretta. Nessun accesso a videocamera o microfono.", "This is the live video placeholder. No camera or microphone access.") : copy("Puoi aggiungere lo spazio dell’ospite quando ti serve. Le reazioni restano coordinate fra i conduttori.", "Add a guest space when needed. The hosts’ reactions stay coordinated.")}</span></div></div>
      </div>
      <div className={design.controlColumn}>
      <aside className={design.panel} data-testid="style-gallery-quick-controls">
        <h2>{copy("Aspetto e argomento in video", "Appearance and on-screen topic")}</h2>
        <PodcastVisualSettings talk={talk} expanded galleryLink={false} direction={direction} onChange={settings => { setTopicSettings({ videoTopicMode: settings.videoTopicMode, videoTopicText: settings.videoTopicText }); setTheme(settings.studioTheme); setCast(settings.studioCast ?? "original"); setGuest(settings.studioGuest ?? "auto"); setDirection(current => ({ ...current, layout: normalizeStudioScenario(settings.studioLayout), focus: settings.studioLayout !== current.layout || settings.studioGuest !== guest ? "all" : current.focus })); }} />
      </aside>
      <PodcastMoodRehearsalLab demo={demo} hostNames={talk.participants.slice(0, 2).map(person => person.name)} manual={manual} onActivate={() => setManual(false)} />
      <aside className={design.panel}>
        <h2>{copy(scenario.label.it, scenario.label.en)}</h2><p className={design.description}>{copy(scenario.description.it, scenario.description.en)}</p>
        <div className={design.controls}>
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
