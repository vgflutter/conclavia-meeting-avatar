import type { PodcastLayout } from "@conclavia/avatar-kit/types/podcast";

/** Composition is independent of illustration style; each layout adapts to an optional guest. */
export const STUDIO_SCENARIOS = [
  {
    id: "studio",
    label: { it: "Studio condiviso", en: "Shared studio" },
    description: { it: "I conduttori condividono il tavolo; l’eventuale ospite entra al centro. La conversazione resta uno spazio comune.", en: "The hosts share a table; an optional guest joins at the center. A shared space for the conversation." },
    guest: { it: "Tavolo condiviso, ospite opzionale", en: "Shared table, optional guest" },
  },
  {
    id: "speaker",
    label: { it: "Finestre del dialogo", en: "Conversation windows" },
    description: { it: "Finestre distinte per i conduttori e l’eventuale ospite. Chi parla ha più spazio, mentre le reazioni restano visibili.", en: "Separate windows for the hosts and optional guest. The speaker gets more space while listening reactions remain visible." },
    guest: { it: "Ritratti e reazioni in vista", en: "Portraits and reactions in view" },
  },
  {
    id: "table",
    label: { it: "Il tavolo del confronto", en: "The discussion table" },
    description: { it: "Due avatar raccolti al tavolo, con uno schermo laterale quando serve l’ospite. Un confronto più diretto.", en: "Two avatars together at the table, with a side screen when a guest joins. A more direct exchange." },
    guest: { it: "Confronto al tavolo, video opzionale", en: "Table discussion, optional video" },
  },
  {
    id: "lounge",
    label: { it: "Salotto delle idee", en: "The ideas lounge" },
    description: { it: "Un ambiente più rilassato, con sedute e distanze diverse. Lo spazio video dell’ospite si aggiunge quando serve.", en: "A more relaxed setting, with different seats and spacing. The guest’s video space is added when needed." },
    guest: { it: "Sedute rilassate, ospite opzionale", en: "Relaxed seating, optional guest" },
  },
] as const satisfies ReadonlyArray<{ id: PodcastLayout; label: { it: string; en: string }; description: { it: string; en: string }; guest: { it: string; en: string } }>;

export type StudioScenarioId = typeof STUDIO_SCENARIOS[number]["id"];
export function getStudioScenario(value: unknown) { return STUDIO_SCENARIOS.find(scenario => scenario.id === value) ?? STUDIO_SCENARIOS[0]; }
export function normalizeStudioScenario(value: unknown): StudioScenarioId { return getStudioScenario(value).id; }
