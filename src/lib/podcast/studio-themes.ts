/** Scene styling is rendered by the canonical avatar kit, never a provider. */
export const STUDIO_THEME_IDS = ["clean-line", "soft-editorial", "animated-series", "anime", "original-editorial", "original-anime", "original-comedy", "noir-editorial", "paper-theatre", "digital-neon"] as const;
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
  {
    id: "original-editorial", visualStyle: "editorial",
    label: { it: "Fumetto realistico", en: "Realistic comic" },
    description: { it: "La proposta iniziale torna animata: proporzioni adulte, legno e luci da studio notturno.", en: "The initial proposal, now animated: adult proportions, wood, and nighttime studio lights." },
    character: { it: "Volti illustrati adulti, lineamenti modellati e gesti misurati.", en: "Adult illustrated faces, modeled features, and measured gestures." },
    treatment: { it: "Disegno editoriale, ombre morbide e dettagli materici.", en: "Editorial illustration, soft shadows, and textured detail." },
    colors: ["#183737", "#b79366", "#c99376"],
  },
  {
    id: "original-anime", visualStyle: "anime-night",
    label: { it: "Anime serale", en: "Evening anime" },
    description: { it: "La proposta iniziale anime: skyline notturno, luci blu e volti da serie animata adulta.", en: "The initial anime proposal: a night skyline, blue lights, and faces from an adult animated series." },
    character: { it: "Occhi espressivi, silhouette affusolate e reazioni a campiture nette.", en: "Expressive eyes, tapered silhouettes, and reactions in clear color blocks." },
    treatment: { it: "Cel shading e contrasti notturni.", en: "Cel shading and nighttime contrast." },
    colors: ["#152940", "#7778a2", "#daae80"],
  },
  {
    id: "original-comedy", visualStyle: "comedy",
    label: { it: "Commedia animata", en: "Animated comedy" },
    description: { it: "La proposta iniziale più giocosa: un salotto caldo, forme rotonde e caricature vivaci.", en: "The playful initial proposal: a warm lounge, rounded shapes, and lively caricatures." },
    character: { it: "Testa e mani più generose, lineamenti morbidi e una recitazione simpatica.", en: "Larger heads and hands, soft features, and playful acting." },
    treatment: { it: "Volumi rotondi, colori caldi e contorni morbidi.", en: "Rounded volumes, warm colors, and soft outlines." },
    colors: ["#e7d3b7", "#557567", "#bd815b"],
  },
  {
    id: "noir-editorial", visualStyle: "noir",
    label: { it: "Noir d’inchiesta", en: "Investigative noir" },
    description: { it: "Bianco e nero, volti scolpiti nell’inchiostro e tagli di luce da veneziana. Uno studio da reportage.", en: "Black and white, faces sculpted in ink, and light through blinds. A reportage studio." },
    character: { it: "Silhouette adulte sfaccettate, sopracciglia e sguardi a forte contrasto.", en: "Faceted adult silhouettes, high-contrast eyebrows and gaze." },
    treatment: { it: "Graphic novel monocromatica, pieni neri e luce netta.", en: "Monochrome graphic novel, solid blacks and hard light." },
    colors: ["#16181c", "#93969b", "#f3f1e9"],
  },
  {
    id: "paper-theatre", visualStyle: "paper",
    label: { it: "Teatro di carta", en: "Paper theatre" },
    description: { it: "Un collage animato di carte sovrapposte, volti ritagliati e scenografie costruite per raccontare e spiegare.", en: "An animated collage of layered paper, cutout faces, and sets built for stories and explanations." },
    character: { it: "Testa, capelli e braccia come sagome di carta, con occhi e bocche molto leggibili.", en: "Heads, hair, and arms as paper cutouts, with clearly readable eyes and mouths." },
    treatment: { it: "Collage a strati, ombre di carta e forme colorate.", en: "Layered collage, paper shadows, and colorful shapes." },
    colors: ["#f4ead6", "#4b9b8e", "#e9a15e"],
  },
  {
    id: "digital-neon", visualStyle: "digital",
    label: { it: "Frequenza digitale", en: "Digital frequency" },
    description: { it: "Due personalità AI non umane: volti-display e gusci luminosi dentro un laboratorio broadcast futuristico.", en: "Two non-human AI personalities: display faces and luminous shells in a futuristic broadcast laboratory." },
    character: { it: "Cupole, visori e antenne cambiano con il cast; le emozioni passano da occhi, bocca e postura.", en: "Domes, visors, and antennas vary with the cast; eyes, mouths, and posture convey emotion." },
    treatment: { it: "Gusci geometrici, vetro scuro e accenti ciano e ultravioletto.", en: "Geometric shells, dark glass, and cyan and ultraviolet accents." },
    colors: ["#101529", "#55d7d2", "#b79bff"],
  },
] as const satisfies ReadonlyArray<{ id: StudioThemeId; visualStyle: string; label: { it: string; en: string }; description: { it: string; en: string }; character: { it: string; en: string }; treatment: { it: string; en: string }; colors: readonly string[] }>;
export function getStudioTheme(value: unknown) { return STUDIO_THEMES.find((theme) => theme.id === value) ?? STUDIO_THEMES[0]; }
export function isStudioThemeId(value: unknown): value is StudioThemeId {
  return STUDIO_THEME_IDS.some((id) => id === value);
}
export function normalizeStudioTheme(value: unknown): StudioThemeId {
  return isStudioThemeId(value) ? value : DEFAULT_STUDIO_THEME;
}

/** Cast changes the drawn identities; voices and participant personalities remain editorial choices. */
export const STUDIO_CAST_IDS = ["original", "contemporary", "expressive"] as const;
export type StudioCast = typeof STUDIO_CAST_IDS[number];
export const STUDIO_CASTS = [
  { id: "original", label: { it: "Il duo originale", en: "The original duo" }, description: { it: "Il conduttore calvo e la co-conduttrice dai capelli scuri.", en: "The bald host and the dark-haired co-host." } },
  { id: "contemporary", label: { it: "Duo contemporaneo", en: "Contemporary duo" }, description: { it: "Nuove capigliature, lineamenti e silhouette più contemporanee.", en: "New hairstyles, facial features, and contemporary silhouettes." } },
  { id: "expressive", label: { it: "Duo di carattere", en: "Character duo" }, description: { it: "Altri volti e proporzioni, con un’identità più marcata.", en: "Different faces and proportions, with a stronger visual identity." } },
] as const;
export function getStudioCastOptions(theme: StudioThemeId) {
  return theme === "digital-neon" ? [
    { id: "original" as const, label: { it: "Cupole luminose", en: "Luminous domes" }, description: { it: "Due facce-display dentro gusci arrotondati di vetro scuro.", en: "Two display faces inside rounded dark-glass shells." } },
    { id: "contemporary" as const, label: { it: "Visori geometrici", en: "Geometric visors" }, description: { it: "Scocche squadrate, visori e spalle costruite per il laboratorio.", en: "Angular shells, visors, and shoulders built for the laboratory." } },
    { id: "expressive" as const, label: { it: "Gusci asimmetrici", en: "Asymmetric shells" }, description: { it: "Antenne e sagome asimmetriche per due personalità artificiali.", en: "Antennas and asymmetric silhouettes for two artificial personalities." } },
  ] : STUDIO_CASTS;
}
export const STUDIO_GUEST_MODES = ["auto", "reserve", "hidden"] as const;
export type StudioGuestMode = typeof STUDIO_GUEST_MODES[number];
export function isStudioCast(value: unknown): value is StudioCast { return STUDIO_CAST_IDS.some(id => id === value); }
export function normalizeStudioCast(value: unknown): StudioCast { return isStudioCast(value) ? value : "original"; }
export function isStudioGuest(value: unknown): value is StudioGuestMode { return STUDIO_GUEST_MODES.some(id => id === value); }
export function normalizeStudioGuest(value: unknown): StudioGuestMode { return isStudioGuest(value) ? value : "auto"; }
export function studioSelectionQuery(settings: { studioTheme?: unknown; studioLayout?: unknown; studioCast?: unknown; studioGuest?: unknown }) {
  const layout = ["studio", "speaker", "table", "lounge"].includes(String(settings.studioLayout)) ? String(settings.studioLayout) : "studio";
  return `style=${normalizeStudioTheme(settings.studioTheme)}&scenario=${layout}&cast=${normalizeStudioCast(settings.studioCast)}&guest=${normalizeStudioGuest(settings.studioGuest)}`;
}
