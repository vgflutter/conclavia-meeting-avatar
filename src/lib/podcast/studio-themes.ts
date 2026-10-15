/** Scene styling is rendered by the canonical avatar kit, never a provider. */
export const STUDIO_THEME_IDS = ["clean-line", "soft-editorial", "animated-series", "anime"] as const;
export type StudioThemeId = (typeof STUDIO_THEME_IDS)[number];
export const DEFAULT_STUDIO_THEME: StudioThemeId = "clean-line";
export function isStudioThemeId(value: unknown): value is StudioThemeId {
  return STUDIO_THEME_IDS.some((id) => id === value);
}
export function normalizeStudioTheme(value: unknown): StudioThemeId {
  return isStudioThemeId(value) ? value : DEFAULT_STUDIO_THEME;
}
