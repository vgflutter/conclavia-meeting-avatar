/** Scene styling is rendered by the canonical avatar kit, never a provider. */
export const STUDIO_THEME_IDS = ["clean-line", "soft-editorial", "animated-series", "anime"] as const;
export type StudioThemeId = (typeof STUDIO_THEME_IDS)[number];
export const DEFAULT_STUDIO_THEME: StudioThemeId = "clean-line";
export const STUDIO_THEMES = [
  {
    id: "clean-line", visualStyle: "clean",
    label: { it: "Linea pulita", en: "Clean line" },
    description: { it: "Contorni sottili, volti morbidi e colori crema e salvia. Uno studio luminoso e raccolto.", en: "Fine outlines, soft faces, and cream and sage tones. A bright, intimate studio." },
    character: { it: "Proporzioni equilibrate e nasi discreti, con espressioni leggibili.", en: "Balanced proportions and subtle noses, with readable expressions." },
    treatment: { it: "Campiture piatte e ombre leggere.", en: "Flat color areas and light shadows." },
    colors: ["#efe9d8", "#5b7766", "#d68154"],
  },
  {
    id: "soft-editorial", visualStyle: "soft",
    label: { it: "Volume morbido", en: "Soft volume" },
    description: { it: "Volumi sfumati, contorni quasi assenti e toni lavanda e rosa. Un’atmosfera più soffusa.", en: "Shaded volumes, almost no outlines, and lavender and rose tones. A softer atmosphere." },
    character: { it: "Visi arrotondati e modellati dalla luce, con un tratto poco marcato.", en: "Rounded faces shaped by light, with restrained linework." },
    treatment: { it: "Sfumature sui volti e sulle giacche.", en: "Gradients across faces and jackets." },
    colors: ["#b9afcf", "#4f6282", "#db9a8d"],
  },
  {
    id: "animated-series", visualStyle: "comic",
    label: { it: "Serie animata", en: "Animated series" },
    description: { it: "Contorni più netti, ombre a campitura e contrasti rame e viola. Lo studio diventa serale.", en: "Bolder outlines, block shadows, and copper and purple contrast. The studio becomes an evening set." },
    character: { it: "Visi più geometrici e gesti evidenti, con un carattere da fumetto.", en: "More geometric faces and clear gestures, with a comic character." },
    treatment: { it: "Linee marcate e ombre definite.", en: "Strong linework and defined shadows." },
    colors: ["#5d3f57", "#3f6c69", "#ed9b65"],
  },
  {
    id: "anime", visualStyle: "anime",
    label: { it: "Anime luminoso", en: "Daylight anime" },
    description: { it: "Visi più affusolati, occhi delineati e ombre essenziali. Colori chiari e una luce delicata.", en: "More tapered faces, outlined eyes, and restrained shadows. Pale colors and gentle light." },
    character: { it: "Mento più sottile e sguardo definito, con proporzioni adulte.", en: "A slimmer chin and defined gaze, with adult proportions." },
    treatment: { it: "Tratto fine e ombreggiatura a pochi livelli.", en: "Fine linework and a small number of shading levels." },
    colors: ["#e9e5dd", "#71928b", "#dc9a7c"],
  },
] as const satisfies ReadonlyArray<{ id: StudioThemeId; visualStyle: string; label: { it: string; en: string }; description: { it: string; en: string }; character: { it: string; en: string }; treatment: { it: string; en: string }; colors: readonly string[] }>;
export function getStudioTheme(value: unknown) { return STUDIO_THEMES.find((theme) => theme.id === value) ?? STUDIO_THEMES[0]; }
export function isStudioThemeId(value: unknown): value is StudioThemeId {
  return STUDIO_THEME_IDS.some((id) => id === value);
}
export function normalizeStudioTheme(value: unknown): StudioThemeId {
  return isStudioThemeId(value) ? value : DEFAULT_STUDIO_THEME;
}
