import type { PodcastLayout } from "@conclavia/avatar-kit/types/podcast";

/** Composition is independent of illustration style; every set reserves a real guest seat. */
export const STUDIO_SCENARIOS = [
  {
    id: "studio",
    label: { it: "Studio condiviso", en: "Shared studio" },
    description: { it: "I conduttori ai lati, l’ospite al centro dello studio. La conversazione resta uno spazio comune.", en: "Hosts on either side, the guest at the heart of the studio. A shared space for the conversation." },
    guest: { it: "Ospite al centro", en: "Guest at the center" },
  },
  {
    id: "speaker",
    label: { it: "Tre punti di vista", en: "Three points of view" },
    description: { it: "Tre finestre per seguire ospite e conduttori. Chi parla ha più spazio, mentre le reazioni restano visibili.", en: "Three windows for the guest and hosts. The speaker gets more space while listening reactions remain visible." },
    guest: { it: "Tre presenze alla pari", en: "Three equal presences" },
  },
  {
    id: "table",
    label: { it: "Il tavolo del confronto", en: "The discussion table" },
    description: { it: "Due avatar raccolti da un lato e l’ospite su un grande schermo dall’altro. Un confronto più diretto.", en: "Two avatars together on one side and the guest on a large screen opposite. A more direct exchange." },
    guest: { it: "Ospite di fronte ai conduttori", en: "Guest facing the hosts" },
  },
  {
    id: "lounge",
    label: { it: "Salotto delle idee", en: "The ideas lounge" },
    description: { it: "Un ambiente più rilassato, con sedute e distanze diverse. L’ospite entra nella conversazione come terza presenza.", en: "A more relaxed setting, with different seats and spacing. The guest joins the conversation as a third presence." },
    guest: { it: "Un posto nel salotto", en: "A seat in the lounge" },
  },
] as const satisfies ReadonlyArray<{ id: PodcastLayout; label: { it: string; en: string }; description: { it: string; en: string }; guest: { it: string; en: string } }>;

export type StudioScenarioId = typeof STUDIO_SCENARIOS[number]["id"];
export function getStudioScenario(value: unknown) { return STUDIO_SCENARIOS.find(scenario => scenario.id === value) ?? STUDIO_SCENARIOS[0]; }
export function normalizeStudioScenario(value: unknown): StudioScenarioId { return getStudioScenario(value).id; }
