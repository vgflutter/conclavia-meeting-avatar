import type { StudioCast, StudioGuestMode, StudioThemeId } from "./studio-themes";
import type { StudioScenarioId } from "./studio-scenarios";

type Copy = { it: string; en: string };
export const STUDIO_STYLE_FAMILIES = [
  { id: "illustration", label: { it: "Illustrazione adulta", en: "Adult illustration" } },
  { id: "anime", label: { it: "Anime", en: "Anime" } },
  { id: "comedy", label: { it: "Caricatura", en: "Caricature" } },
  { id: "noir", label: { it: "Graphic novel noir", en: "Noir graphic novel" } },
  { id: "paper", label: { it: "Collage di carta", en: "Paper collage" } },
  { id: "digital", label: { it: "AI non umane", en: "Non-human AI" } },
] as const;
export type StudioStyleFamily = typeof STUDIO_STYLE_FAMILIES[number]["id"];
type VisualSelection = { studioTheme: StudioThemeId; studioCast: StudioCast; studioLayout: StudioScenarioId; studioGuest: StudioGuestMode };
export const STUDIO_FORMATS = [
  { id: "interview", label: { it: "Intervista", en: "Interview" }, description: { it: "Ritratti chiari e spazio per il volto dell’ospite.", en: "Clear portraits and space for the guest’s face." }, selection: { studioTheme: "clean-line", studioCast: "contemporary", studioLayout: "speaker", studioGuest: "reserve" } },
  { id: "debate", label: { it: "Dibattito", en: "Debate" }, description: { it: "Due punti di vista adulti, riuniti attorno al tavolo.", en: "Two adult points of view gathered around the table." }, selection: { studioTheme: "original-editorial", studioCast: "original", studioLayout: "table", studioGuest: "auto" } },
  { id: "explain", label: { it: "Divulgazione", en: "Explainers" }, description: { it: "Sagome di carta e forme leggibili per spiegare idee.", en: "Paper cutouts and readable shapes for explaining ideas." }, selection: { studioTheme: "paper-theatre", studioCast: "expressive", studioLayout: "studio", studioGuest: "auto" } },
  { id: "investigation", label: { it: "Inchiesta", en: "Investigation" }, description: { it: "Luce da reportage, bianco e nero e primi piani.", en: "Reportage lighting, black and white, and close-ups." }, selection: { studioTheme: "noir-editorial", studioCast: "contemporary", studioLayout: "speaker", studioGuest: "auto" } },
  { id: "tech", label: { it: "Tecnologia e gaming", en: "Technology & gaming" }, description: { it: "Due AI dichiaratamente artificiali in uno studio digitale.", en: "Two visibly artificial AI hosts in a digital studio." }, selection: { studioTheme: "digital-neon", studioCast: "original", studioLayout: "speaker", studioGuest: "auto" } },
  { id: "entertainment", label: { it: "Intrattenimento", en: "Entertainment" }, description: { it: "Caricature e un salotto caldo per una conversazione vivace.", en: "Caricatures and a warm lounge for a lively conversation." }, selection: { studioTheme: "original-comedy", studioCast: "expressive", studioLayout: "lounge", studioGuest: "auto" } },
  { id: "culture", label: { it: "Cultura e storie", en: "Culture & stories" }, description: { it: "Atmosfera anime serale per racconti e conversazioni.", en: "An evening anime atmosphere for stories and conversation." }, selection: { studioTheme: "original-anime", studioCast: "expressive", studioLayout: "lounge", studioGuest: "auto" } },
  { id: "wellbeing", label: { it: "Ascolto e benessere", en: "Listening & wellbeing" }, description: { it: "Luce morbida, toni calmi e posto per una persona reale.", en: "Soft light, calm tones, and a place for a real person." }, selection: { studioTheme: "soft-editorial", studioCast: "contemporary", studioLayout: "lounge", studioGuest: "reserve" } },
] as const satisfies ReadonlyArray<{ id: string; label: Copy; description: Copy; selection: VisualSelection }>;
export type StudioFormatId = typeof STUDIO_FORMATS[number]["id"];
export type StudioFormat = typeof STUDIO_FORMATS[number];

export const STUDIO_STYLE_GUIDES: Record<StudioThemeId, { family: StudioStyleFamily; suitedTo: readonly StudioFormatId[] }> = {
  "clean-line": { family: "illustration", suitedTo: ["interview", "explain"] },
  "soft-editorial": { family: "illustration", suitedTo: ["wellbeing", "interview"] },
  "animated-series": { family: "illustration", suitedTo: ["debate", "entertainment"] },
  anime: { family: "anime", suitedTo: ["culture", "explain"] },
  "original-editorial": { family: "illustration", suitedTo: ["debate", "investigation"] },
  "original-anime": { family: "anime", suitedTo: ["culture", "entertainment"] },
  "original-comedy": { family: "comedy", suitedTo: ["entertainment", "culture"] },
  "noir-editorial": { family: "noir", suitedTo: ["investigation", "debate"] },
  "paper-theatre": { family: "paper", suitedTo: ["explain", "culture"] },
  "digital-neon": { family: "digital", suitedTo: ["tech", "explain"] },
};
export function getStudioStyleGuide(theme: StudioThemeId) {
  const guide = STUDIO_STYLE_GUIDES[theme];
  return { family: STUDIO_STYLE_FAMILIES.find(item => item.id === guide.family)!, formats: guide.suitedTo.map(id => STUDIO_FORMATS.find(item => item.id === id)!) };
}
export function matchesStudioFormat(settings: Partial<VisualSelection>, format: StudioFormat) {
  return (Object.keys(format.selection) as Array<keyof VisualSelection>).every(key => settings[key] === format.selection[key]);
}
