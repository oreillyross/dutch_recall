export type Provider = "anthropic" | "openai";

/**
 * Default (cheapest current small) model per provider.
 * Both verified against the providers' own docs on 2026-11-19:
 *   anthropic: claude-haiku-5-5, $0.10 in / $0.50 out per 1M tokens.
 *   openai: gpt-6-luna ("most efficient" tier of the GPT-6 family), $0.10 / $0.50.
 *     Chat Completions + structured outputs supported; reasoning.effort "none" supported.
 *     Cheaper-but-older alternative: gpt-5-nano ($0.05 / $0.40). Override with LLM_MODEL.
 */
export const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: "claude-haiku-5-5",
  openai: "gpt-6-luna",
};

/**
 * USD per 1M tokens (standard processing, prompts up to 100K / 272K tokens), used for cost
 * *estimates* only. Taken from Anthropic's pricing and https://developers.openai.com/api/docs/pricing
 * on 2026-11-19. Models missing here are shown as "partial" cost in the Usage tab.
 */
export const PRICING_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "gpt-6-luna": { input: 0.1, output: 0.5 },
  "gpt-5.6-luna": { input: 0.2, output: 1.2 },
  "gpt-5.4-nano": { input: 0.2, output: 1.25 },
  "gpt-5.4-mini": { input: 0.75, output: 4.5 },
  "gpt-5-nano": { input: 0.05, output: 0.4 },
  "gpt-5-mini": { input: 0.25, output: 2 },
};

export function estimateCostUSD(model: string, inputTokens: number, outputTokens: number): number | null {
  const p = PRICING_PER_MTOK[model];
  if (!p) return null;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

/** gpt-5+ and o-series are reasoning models: they reject non-default temperature and spend output tokens on thinking. */
export const isOpenAIReasoningModel = (id: string) => /^(gpt-[5-9]|o\d)/.test(id);

/**
 * Lowest reasoning effort to request. "none" is confirmed in the docs for gpt-5.4-nano and gpt-6-luna.
 * "minimal" for the original gpt-5 family (gpt-5, -mini, -nano) comes from the SDK's accepted values and
 * is not stated on those models' doc pages: if one is overridden via LLM_MODEL and errors, check this.
 */
export const openAIReasoningEffort = (id: string): "minimal" | "none" | undefined =>
  !isOpenAIReasoningModel(id) ? undefined : /^gpt-5(-|$)/.test(id) ? "minimal" : "none";
