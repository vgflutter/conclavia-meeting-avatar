/** Provider-neutral model selectors. Actual model names stay on the server. */
export const LLM_MODELS = [
  { id: "openai-default", provider: "openai", label: "OpenAI configurato" },
  { id: "gemini-default", provider: "gemini", label: "Gemini configurato" },
] as const;
export type LlmModel = (typeof LLM_MODELS)[number];
export type LlmModelId = LlmModel["id"];
export type LlmProvider = LlmModel["provider"];
export const DEFAULT_LLM_MODEL: LlmModelId = "openai-default";
export const LLM_MODEL_IDS = LLM_MODELS.map((model) => model.id);
export function isLlmModelId(value: unknown): value is LlmModelId {
  return LLM_MODEL_IDS.some((id) => id === value);
}
export function getLlmModel(id: LlmModelId): LlmModel {
  return LLM_MODELS.find((model) => model.id === id) ?? LLM_MODELS[0];
}
