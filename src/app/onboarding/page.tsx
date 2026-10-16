import Link from "next/link";
import type { Metadata } from "next";
import { getRequestLocale } from "@/i18n/server";
import styles from "@/components/Workspace.module.css";

export const metadata: Metadata = { title: "Onboarding" };
export default async function OnboardingPage() {
  const it = (await getRequestLocale()) === "it";
  return <div className={styles.workspace}>
    <Link href="/" className={styles.back}>← {it ? "Tutte le aree" : "All areas"}</Link>
    <header className={styles.intro}><p className={styles.eyebrow}>{it ? "AREA ONBOARDING" : "ONBOARDING AREA"}</p><h1>{it ? "Un’accoglienza che ti somiglia." : "A welcome that feels like you."}</h1><p>{it ? "Avatar, contesto del sito e percorsi guidati si configurano nello Studio Onboarding." : "Configure avatars, site context, and guided flows in the Onboarding Studio."}</p></header>
    <section className={styles.onboarding}>
      <div><p className={styles.eyebrow}>ONBOARDING STUDIO</p><h2>{it ? "Progetta il primo incontro." : "Design the first encounter."}</h2><p>{it ? "Prepara l’avatar che accoglie le persone, le informazioni che deve conoscere e le domande da affrontare insieme. Ogni sito ha il proprio contesto e i propri percorsi." : "Prepare the avatar that welcomes people, the information it needs, and the questions to work through together. Each site has its own context and flows."}</p><a href="/onboarding/studio" target="_blank" rel="noopener noreferrer" className={styles.launch}>{it ? "Apri lo Studio Onboarding" : "Open Onboarding Studio"}<span aria-hidden="true">↗</span></a></div>
      <div className={styles.features}>
        <div><h3>{it ? "Avatar e voce" : "Avatar & voice"}</h3><p>{it ? "Aspetto, personalità e voci dell’avatar che accompagna il percorso." : "Appearance, personality, and voices for the avatar guiding the flow."}</p></div>
        <div><h3>{it ? "Contesto e percorsi" : "Context & flows"}</h3><p>{it ? "Informazioni del servizio, questionari e obiettivi dell’onboarding." : "Service information, questionnaires, and onboarding objectives."}</p></div>
        <div><h3>{it ? "Anteprima e integrazione" : "Preview & integration"}</h3><p>{it ? "Prova i percorsi e prepara il collegamento con il tuo sito." : "Try your flows and prepare the connection to your website."}</p></div>
      </div>
    </section>
  </div>;
}
