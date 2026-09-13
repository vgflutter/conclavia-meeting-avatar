import type { Metadata } from "next";
import Link from "next/link";
import { AssistantContextEditor } from "@/components/AssistantContextEditor";
import { getGlobalAssistantContext } from "@/lib/assistant-context-store";
import { getRequestLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getRequestLocale()) === "it" ? "Contesto" : "Context" };
}

export default async function ContextPage() {
  const [locale, context] = await Promise.all([getRequestLocale(), getGlobalAssistantContext()]);
  const it = locale === "it";
  return <div className="container-page py-8 sm:py-10">
    <header className="mb-6">
      <h1 className="text-3xl font-bold tracking-tight">{it ? "Contesto dell’assistente" : "Assistant context"}</h1>
      <p className="mt-2 text-sm text-slate-600">{it ? "Quello che deve sapere prima di ascoltare un meeting." : "What it needs to know before listening to a meeting."}</p>
    </header>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="card min-w-0 p-5 sm:p-7"><AssistantContextEditor scope="global" initial={context} /></section>
      <aside className="space-y-5 text-sm leading-6 text-slate-600">
        <div><h2 className="font-semibold text-slate-900">{it ? "Tre livelli, senza duplicare" : "Three levels, no duplication"}</h2>
          <ol className="mt-2 list-inside list-decimal space-y-2">
            <li>{it ? "Generale: vale ovunque." : "General: applies everywhere."}</li>
            <li>{it ? "Serie: informazioni del progetto." : "Series: project background."}</li>
            <li>{it ? "Meeting: note per un appuntamento." : "Meeting: notes for one appointment."}</li>
          </ol>
          <p className="mt-3">{it ? "Il livello più specifico precisa quello generale. Puoi modificare le note dal dettaglio della serie o del meeting." : "The most specific level refines the general one. Edit notes from the series or meeting details."}</p>
          <Link href="/meetings" className="mt-2 inline-block font-medium text-[#295c43] hover:underline">{it ? "Apri i meeting →" : "Open meetings →"}</Link>
        </div>
        <div className="border-t border-slate-200 pt-4"><h2 className="font-semibold text-slate-900">{it ? "Contesto ≠ verbale" : "Context ≠ minutes"}</h2>
          <p className="mt-2">{it ? "Aiuta risposte, verifiche e riepiloghi. Non viene registrato come una decisione presa in riunione." : "Helps answers, checks and summaries. It is not recorded as a decision made in the meeting."}</p>
          <p className="mt-2">{it ? "Le modifiche salvate valgono dalla prossima elaborazione, anche a meeting avviato. Lo storico non viene riscritto." : "Saved changes apply from the next generation, including during a meeting. History is not rewritten."}</p>
        </div>
      </aside>
    </div>
  </div>;
}
