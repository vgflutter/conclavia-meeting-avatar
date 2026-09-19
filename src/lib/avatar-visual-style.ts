import { ASSISTANT_VISUAL_STYLES, type AssistantVisualStyle } from "@/types/assistant-profile";

export function isAvatarVisualStyle(value: unknown): value is AssistantVisualStyle {
  return typeof value === "string" && (ASSISTANT_VISUAL_STYLES as readonly string[]).includes(value);
}

export function avatarVisualStyleLabel(style: AssistantVisualStyle, italian: boolean) {
  if (style === "portrait_2_5d") return italian ? "Ritratto 2.5D" : "Portrait 2.5D";
  if (style === "stylized_3d") return italian ? "Personaggio 3D" : "3D character";
  return italian ? "Fumetto editoriale · 2D" : "Editorial comic · 2D";
}
