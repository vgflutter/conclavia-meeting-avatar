import Link from "next/link";
import { getRequestLocale } from "@/i18n/server";
import { WorkspaceAreaIllustration } from "@/components/WorkspaceAreaIllustration";
import styles from "@/components/Workspace.module.css";

export default async function HomePage() {
  const it = (await getRequestLocale()) === "it";
  const areas = [
    { id: "meeting", name: it ? "Meeting" : "Meetings", href: "/meetings", number: "01", title: it ? "Un collega nelle tue riunioni." : "A colleague in your meetings.", description: it ? "Prepara l’assistente, segui le riunioni e ritrova ciò che conta dopo ogni incontro." : "Prepare your assistant, follow meetings, and find what matters after each conversation.", tools: it ? ["Riunioni", "Memoria", "Contesto", "Avatar"] : ["Meetings", "Memory", "Context", "Avatar"], action: it ? "Apri i meeting" : "Open meetings" },
    { id: "podcast", name: it ? "Podcast" : "Podcasts", href: "/podcast", number: "02", title: it ? "Dai voce a punti di vista diversi." : "Give different viewpoints a voice.", description: it ? "Definisci i conduttori, scegli lo stile e cura la conversazione, con due AI e un eventuale ospite." : "Define your hosts, choose a style, and direct a conversation with two AI hosts and an optional guest.", tools: it ? ["Puntate", "Prova a due", "Stili e mood", "Regia"] : ["Episodes", "Rehearsal", "Styles & moods", "Direction"], action: it ? "Apri i podcast" : "Open podcasts" },
    { id: "onboarding", name: "Onboarding", href: "/onboarding", number: "03", title: it ? "Un primo incontro guidato." : "A guided first encounter.", description: it ? "Prepara avatar, contesto e percorsi per accompagnare le persone nel tuo servizio." : "Prepare avatars, context, and guided flows to welcome people into your service.", tools: it ? ["Avatar", "Contesto del sito", "Percorsi", "Integrazione"] : ["Avatar", "Site context", "Flows", "Integration"], action: it ? "Apri l’onboarding" : "Open onboarding" },
  ];
  return <div className={styles.workspace}>
    <header className={styles.intro}><p className={styles.eyebrow}>{it ? "IL TUO SPAZIO CONCLAVIA" : "YOUR CONCLAVIA WORKSPACE"}</p><h1>{it ? "Da dove iniziamo?" : "Where shall we begin?"}</h1><p>{it ? "Tre aree, ciascuna con i propri strumenti e il proprio contesto." : "Three areas, each with its own tools and context."}</p></header>
    <div className={styles.cards}>{areas.map(area => <Link href={area.href} key={area.id} className={styles.card} data-area={area.id} data-testid={`workspace-area-${area.id}`}>
      <div className={styles.cardHeading}><span>{area.name}</span><small>{area.number}</small></div>
      <div className={styles.illustration}><WorkspaceAreaIllustration area={area.id} /></div>
      <h2>{area.title}</h2><p>{area.description}</p><div className={styles.tags}>{area.tools.map(tool => <span key={tool}>{tool}</span>)}</div><div className={styles.cardAction}>{area.action}<span aria-hidden="true">↗</span></div>
    </Link>)}</div>
  </div>;
}
