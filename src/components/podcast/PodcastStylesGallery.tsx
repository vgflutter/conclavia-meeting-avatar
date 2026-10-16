"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { getStudioTheme, type StudioThemeId } from "@/lib/podcast/studio-themes";
import { getStudioScenario, STUDIO_SCENARIOS, type StudioScenarioId } from "@/lib/podcast/studio-scenarios";
import { PODCAST_MOOD_OPTIONS } from "@/lib/podcast/mood-demo";
import { defaultPodcast } from "./podcast-defaults";
import { DEFAULT_DIRECTION, PodcastStageView, type PodcastDirection, type PodcastEmotion, type PodcastShot } from "./PodcastStageView";
import { PodcastStylePicker } from "./PodcastStylePicker";
import { PodcastScenarioPicker } from "./PodcastScenarioPicker";
import { PodcastMoodRehearsalLab, usePodcastMoodRehearsal } from "./PodcastMoodRehearsalLab";
import { Field, usePodcastCopy } from "./PodcastUi";
import styles from "./Podcast.module.css";
import design from "./PodcastStyles.module.css";

const archivedDesigns = [
  { src: "/podcast/design-assets/original-editorial.webp", label: { it: "Fumetto realistico", en: "Realistic comic" }, description: { it: "La prima esplorazione con proporzioni adulte e uno studio notturno illustrato.", en: "The first exploration with adult proportions and an illustrated night studio." } },
  { src: "/podcast/design-assets/original-anime.webp", label: { it: "Anime serale", en: "Evening anime" }, description: { it: "La proposta iniziale ispirata all’animazione giapponese e al disegno a campiture.", en: "The original proposal inspired by Japanese animation and block-color drawing." } },
  { src: "/podcast/design-assets/original-comedy.webp", label: { it: "Commedia animata", en: "Animated comedy" }, description: { it: "Lo studio iniziale con forme morbide e una caricatura più accentuata.", en: "The initial studio with soft shapes and more pronounced caricature." } },
] as const;
export function PodcastStylesGallery({ initialTheme, initialScenario = "studio" }: { initialTheme: StudioThemeId; initialScenario?: StudioScenarioId }) {
  const copy = usePodcastCopy();
  const [theme, setTheme] = useState(initialTheme);
  const [direction, setDirection] = useState<PodcastDirection>({ ...DEFAULT_DIRECTION, layout: initialScenario, automatic: false });
  const [manual, setManual] = useState(false);
  const demo = usePodcastMoodRehearsal();
  const selected = getStudioTheme(theme);
  const scenario = getStudioScenario(direction.layout);
  const base = defaultPodcast(copy("it", "en") === "en");
  const talk = { ...base, title: copy("Voci a confronto", "Voices in conversation"), topic: copy("Idee, domande e punti di vista", "Ideas, questions, and perspectives"),
    settings: { ...base.settings, studioTheme: theme } };
  const thumbnailDirection = { ...DEFAULT_DIRECTION, layout: direction.layout, focus: "all" as const, automatic: false };
  const effectiveDirection = manual ? direction : { ...direction,
    emotion: demo.sentence.speakerIndex === 0 ? demo.sentence.mood : demo.sentence.listenerMood,
    intensity: demo.sentence.speakerIndex === 0 ? demo.sentence.intensity : demo.sentence.listenerIntensity,
    emotion2: demo.sentence.speakerIndex === 1 ? demo.sentence.mood : demo.sentence.listenerMood,
    intensity2: demo.sentence.speakerIndex === 1 ? demo.sentence.intensity : demo.sentence.listenerIntensity };
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
      <div><div className={styles.eyebrow}>{copy("L’IDENTITÀ VISIVA DEL PODCAST", "THE PODCAST’S VISUAL IDENTITY")}</div><h1 className={styles.heading}>{copy("Stili, scenari e carattere.", "Styles, scenes, and character.")}</h1><p className={styles.intro}>{copy("Due AI, una persona reale, uno spazio per incontrarsi. Scegli il disegno e la disposizione dello studio, poi guarda come le emozioni cambiano la conversazione.", "Two AIs, one real person, a place to meet. Choose the artwork and studio arrangement, then see how emotion changes the conversation.")}</p></div>
    </header>
    <div className={design.counts}><span className={design.count}><strong>4</strong>{copy("stili grafici", "visual styles")}</span><span className={design.count}><strong>4</strong>{copy("scenari", "scenes")}</span><span className={design.count}><strong>16</strong>{copy("combinazioni", "combinations")}</span><span className={design.count}><strong>8</strong>{copy("mood da esplorare", "moods to explore")}</span></div>
    <PodcastStylePicker value={theme} onChange={setTheme} talk={talk} direction={thumbnailDirection} legend={copy("1. Scegli il disegno dei conduttori", "1. Choose the hosts’ artwork")} />
    <PodcastScenarioPicker value={scenario.id} onChange={layout => setDirection({ ...direction, layout, focus: "all" })} talk={talk} direction={thumbnailDirection} />
    <section className={design.comparison}>
      <div className={design.stageColumn}>
        <div className={design.stage} data-testid="style-gallery-stage"><div className={design.stageLabel}>{copy(selected.label.it, selected.label.en)} · {copy(scenario.label.it, scenario.label.en)}</div><PodcastStageView talk={talk} direction={effectiveDirection} performance={manual ? undefined : { speakerIndex: demo.sentence.speakerIndex, mood: demo.sentence.mood, intensity: demo.sentence.intensity, listenerMood: demo.sentence.listenerMood, listenerIntensity: demo.sentence.listenerIntensity, phase: demo.phase, progress: demo.progress, cueId: demo.cueId }} /></div>
        <div className={design.guestReserved} data-testid="style-gallery-guest"><span className={design.guestSeatIcon} aria-hidden="true" /><div><strong>{copy("Il posto dell’ospite c’è sempre.", "There is always a seat for the guest.")}</strong><span>{copy("Il riquadro ospiterà il video della persona in diretta. Qui è un segnaposto: videocamera e microfono restano spenti.", "The panel will hold the person’s live video. It is a placeholder here: camera and microphone stay off.")}</span></div></div>
      </div>
      <div className={design.controlColumn}>
      <PodcastMoodRehearsalLab demo={demo} hostNames={talk.participants.slice(0, 2).map(person => person.name)} manual={manual} onActivate={() => setManual(false)} />
      <aside className={design.panel}>
        <h2>{copy(scenario.label.it, scenario.label.en)}</h2><p className={design.description}>{copy(scenario.description.it, scenario.description.en)}</p>
        <div className={design.controls}>
          <Field label={copy("Regia della scena", "Scene composition")}><select className={styles.input} data-testid="style-gallery-layout" value={direction.layout} onChange={(event) => setDirection({ ...direction, layout: event.target.value as PodcastDirection["layout"] })}>{STUDIO_SCENARIOS.map(item => <option key={item.id} value={item.id}>{copy(item.label.it, item.label.en)}</option>)}</select></Field>
          <Field label={copy("Inquadratura", "Camera shot")}><select className={styles.input} data-testid="style-gallery-focus" value={direction.focus} onChange={(event) => setDirection({ ...direction, focus: event.target.value as PodcastShot })}><option value="all">{copy("Tutti", "All")}</option><option value="host-1">{talk.participants[0].name}</option><option value="host-2">{talk.participants[1].name}</option><option value="guest">{copy("Ospite", "Guest")}</option></select></Field>
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
      <div className={design.selectedDetails}><div><strong>{copy("Il disegno dei volti", "Face design")}</strong><p>{copy(selected.character.it, selected.character.en)}</p></div><div><strong>{copy("Tratto e volume", "Linework & volume")}</strong><p>{copy(selected.treatment.it, selected.treatment.en)}</p></div></div>
      <div className={design.actions}><Link className={styles.primary} data-testid="style-use-rehearsal" href={`/podcast/rehearsal?style=${theme}&scenario=${scenario.id}`}>{copy("Usa nella prova a due", "Use in two-host rehearsal")} →</Link><Link className={styles.secondary} data-testid="style-use-new" href={`/podcast/new?style=${theme}&scenario=${scenario.id}`}>{copy("Usa in nuova puntata", "Use in a new episode")} ↗</Link></div>
      <p className={design.note}>{copy("L’anteprima anima sguardi e reazioni senza audio. Stile e scenario si salvano quando prepari una prova o salvi una puntata. Puoi cambiare inquadratura durante la regia.", "The preview animates gaze and reactions without audio. Artwork and scene are saved when you prepare a rehearsal or save an episode. Camera shots can change during direction.")}</p>
    </section>
    <details className={design.archive} data-testid="style-gallery-originals">
      <summary>{copy("Rivedi le tre proposte iniziali", "Revisit the three initial proposals")}</summary>
      <p className={design.archiveIntro}>{copy("Archivio di esplorazione, in sola consultazione: Fumetto realistico, Anime serale e Commedia animata. Da queste prove siamo passati ai quattro stili qui sopra, rivedendo proporzioni, nasi ed espressività.", "A read-only exploration archive: Realistic comic, Evening anime, and Animated comedy. These tests led to the four styles above, with revised proportions, noses, and expressions.")}</p>
      <div className={design.archiveCards}>{archivedDesigns.map((proposal) => <figure className={design.archiveCard} key={proposal.src}><Image src={proposal.src} alt={copy(proposal.label.it, proposal.label.en) + " · " + copy("proposta iniziale archiviata", "archived initial proposal")} width={1920} height={1080} unoptimized /><figcaption><span className={design.archiveTag}>{copy("ARCHIVIO · PROPOSTA INIZIALE", "ARCHIVE · INITIAL PROPOSAL")}</span><strong>{copy(proposal.label.it, proposal.label.en)}</strong><p>{copy(proposal.description.it, proposal.description.en)}</p></figcaption></figure>)}</div>
    </details>
  </div>;
}
