"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { getStudioTheme, type StudioThemeId } from "@/lib/podcast/studio-themes";
import { defaultParticipant, defaultPodcast } from "./podcast-defaults";
import { DEFAULT_DIRECTION, PodcastStageView, type PodcastDirection, type PodcastEmotion, type PodcastShot } from "./PodcastStageView";
import { PodcastStylePicker } from "./PodcastStylePicker";
import { Field, usePodcastCopy } from "./PodcastUi";
import styles from "./Podcast.module.css";
import design from "./PodcastStyles.module.css";

const archivedDesigns = [
  { src: "/podcast/design-assets/original-editorial.webp", label: { it: "Fumetto realistico", en: "Realistic comic" }, description: { it: "La prima esplorazione con proporzioni adulte e uno studio notturno illustrato.", en: "The first exploration with adult proportions and an illustrated night studio." } },
  { src: "/podcast/design-assets/original-anime.webp", label: { it: "Anime serale", en: "Evening anime" }, description: { it: "La proposta iniziale ispirata all’animazione giapponese e al disegno a campiture.", en: "The original proposal inspired by Japanese animation and block-color drawing." } },
  { src: "/podcast/design-assets/original-comedy.webp", label: { it: "Commedia animata", en: "Animated comedy" }, description: { it: "Lo studio iniziale con forme morbide e una caricatura più accentuata.", en: "The initial studio with soft shapes and more pronounced caricature." } },
] as const;
const expressions: Array<[PodcastEmotion, string, string]> = [
  ["attention", "Attenzione", "Attention"], ["curiosity", "Curiosità", "Curiosity"], ["doubt", "Dubbio", "Doubt"],
  ["agreement", "Accordo", "Agreement"], ["amusement", "Ironia", "Amusement"], ["empathy", "Empatia", "Empathy"],
  ["disagreement", "Disaccordo", "Disagreement"], ["surprise", "Sorpresa", "Surprise"],
];

export function PodcastStylesGallery({ initialTheme }: { initialTheme: StudioThemeId }) {
  const copy = usePodcastCopy();
  const [theme, setTheme] = useState(initialTheme);
  const [includeGuest, setIncludeGuest] = useState(false);
  const [direction, setDirection] = useState<PodcastDirection>({ ...DEFAULT_DIRECTION, automatic: false });
  const selected = getStudioTheme(theme);
  const base = defaultPodcast(copy("it", "en") === "en");
  const talk = { ...base, title: copy("Voci a confronto", "Voices in conversation"), topic: copy("Idee, domande e punti di vista", "Ideas, questions, and perspectives"),
    participants: includeGuest ? [...base.participants.slice(0, 2), { ...defaultParticipant(2), name: copy("Ospite", "Guest") }] : base.participants.slice(0, 2),
    settings: { ...base.settings, studioTheme: theme } };
  function changeGuest(checked: boolean) { setIncludeGuest(checked); if (!checked && direction.focus === "guest") setDirection({ ...direction, focus: "all" }); }
  return <div className={styles.workspace}>
    <Link className={styles.back} href="/podcast">← {copy("Tutti i podcast", "All podcasts")}</Link>
    <header className={styles.topline}>
      <div><div className={styles.eyebrow}>{copy("L’IDENTITÀ VISIVA DEL PODCAST", "THE PODCAST’S VISUAL IDENTITY")}</div><h1 className={styles.heading}>{copy("Stili e scenari", "Styles & scenes")}</h1><p className={styles.intro}>{copy("Quattro modi di disegnare gli stessi conduttori. Confronta volti, luce e ambiente, poi prova lo stile con le diverse inquadrature.", "Four ways to draw the same hosts. Compare faces, lighting, and setting, then try each style with different camera compositions.")}</p></div>
    </header>
    <div className={design.counts}><span className={design.count}><strong>4</strong>{copy("stili grafici", "visual styles")}</span><span className={design.count}><strong>3</strong>{copy("regie", "compositions")}</span><span className={design.count}><strong>12</strong>{copy("combinazioni di stile e regia", "style and composition combinations")}</span></div>
    <PodcastStylePicker value={theme} onChange={setTheme} talk={talk} direction={direction} legend={copy("I quattro stili disponibili", "The four available styles")} />
    <section className={design.comparison}>
      <div>
        <div className={design.stage} data-testid="style-gallery-stage"><div className={design.stageLabel}>{copy(selected.label.it, selected.label.en)} · {copy("ANTEPRIMA GRAFICA", "VISUAL PREVIEW")}</div><PodcastStageView talk={talk} direction={direction} /></div>
        <div className={design.selectedDetails}><div><strong>{copy("Il disegno dei volti", "Face design")}</strong><p>{copy(selected.character.it, selected.character.en)}</p></div><div><strong>{copy("Tratto e volume", "Linework & volume")}</strong><p>{copy(selected.treatment.it, selected.treatment.en)}</p></div></div>
        <div className={design.actions}><Link className={styles.primary} data-testid="style-use-rehearsal" href={`/podcast/rehearsal?style=${theme}`}>{copy("Usa nella prova a due", "Use in two-host rehearsal")} →</Link><Link className={styles.secondary} data-testid="style-use-new" href={`/podcast/new?style=${theme}`}>{copy("Usa in nuova puntata", "Use in a new episode")} ↗</Link></div>
        <p className={design.note}>{copy("L’anteprima anima sguardi e reazioni senza audio. La scelta viene salvata soltanto quando prepari una prova o salvi una puntata.", "The preview animates gaze and reactions without audio. Your choice is saved only when you prepare a rehearsal or save an episode.")}</p>
      </div>
      <aside className={design.panel}>
        <h2>{copy(selected.label.it, selected.label.en)}</h2><p className={design.description}>{copy(selected.description.it, selected.description.en)}</p>
        <div className={design.controls}>
          <Field label={copy("Regia della scena", "Scene composition")}><select className={styles.input} data-testid="style-gallery-layout" value={direction.layout} onChange={(event) => setDirection({ ...direction, layout: event.target.value as PodcastDirection["layout"] })}><option value="studio">{copy("Studio condiviso", "Shared studio")}</option><option value="speaker">{copy("Regia televisiva", "TV direction")}</option><option value="table">{copy("Ospite al tavolo", "Guest at the table")}</option></select></Field>
          <label className={styles.switch}><input type="checkbox" data-testid="style-gallery-guest" checked={includeGuest} onChange={(event) => changeGuest(event.target.checked)} /><span>{copy("Mostra lo spazio per l’ospite", "Show the guest’s space")}</span></label>
          <Field label={copy("Inquadratura", "Camera shot")}><select className={styles.input} data-testid="style-gallery-focus" value={direction.focus} onChange={(event) => setDirection({ ...direction, focus: event.target.value as PodcastShot })}><option value="all">{copy("Tutti", "All")}</option><option value="host-1">{talk.participants[0].name}</option><option value="host-2">{talk.participants[1].name}</option><option value="guest" disabled={!includeGuest}>{copy("Ospite", "Guest")}</option></select></Field>
        </div>
        {includeGuest && <p className={design.note}>{copy("Il riquadro dell’ospite è un segnaposto. Questa pagina non attiva videocamera o microfono.", "The guest panel is a placeholder. This page does not activate the camera or microphone.")}</p>}
        <div className={design.divider} />
        <div className={design.controls}>{talk.participants.slice(0, 2).map((person, index) => <Field label={`${copy("Espressione", "Expression")} · ${person.name}`} key={index}><select className={styles.input} data-testid={`style-gallery-expression-${index}`} value={index === 0 ? direction.emotion : direction.emotion2} onChange={(event) => setDirection({ ...direction, ...(index === 0 ? { emotion: event.target.value as PodcastEmotion } : { emotion2: event.target.value as PodcastEmotion }) })}>{expressions.map(([expression, it, en]) => <option value={expression} key={expression}>{copy(it, en)}</option>)}</select></Field>)}</div>
      </aside>
    </section>
    <details className={design.archive} data-testid="style-gallery-originals">
      <summary>{copy("Rivedi le tre proposte iniziali", "Revisit the three initial proposals")}</summary>
      <p className={design.archiveIntro}>{copy("Archivio di esplorazione, in sola consultazione: Fumetto realistico, Anime serale e Commedia animata. Da queste prove siamo passati ai quattro stili qui sopra, rivedendo proporzioni, nasi ed espressività.", "A read-only exploration archive: Realistic comic, Evening anime, and Animated comedy. These tests led to the four styles above, with revised proportions, noses, and expressions.")}</p>
      <div className={design.archiveCards}>{archivedDesigns.map((proposal) => <figure className={design.archiveCard} key={proposal.src}><Image src={proposal.src} alt={copy(proposal.label.it, proposal.label.en) + " · " + copy("proposta iniziale archiviata", "archived initial proposal")} width={1920} height={1080} unoptimized /><figcaption><span className={design.archiveTag}>{copy("ARCHIVIO · PROPOSTA INIZIALE", "ARCHIVE · INITIAL PROPOSAL")}</span><strong>{copy(proposal.label.it, proposal.label.en)}</strong><p>{copy(proposal.description.it, proposal.description.en)}</p></figcaption></figure>)}</div>
    </details>
  </div>;
}
