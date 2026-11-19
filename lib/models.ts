export type Provider = "anthropic" | "openai";

/**
 * Default (cheapest small) model per provider.
 * anthropic: verified against current Anthropic docs.
 * openai: NOT verified against OpenAI's docs (their docs host was unreachable when this was
 *   written). "gpt-5.4-nano" is the newest nano-tier id known to the installed @ai-sdk/openai.
 *   Confirm it (and its price below), or override at runtime with LLM_MODEL.
 */
export const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: "claude-haiku-5-5",
  openai: "gpt-5.4-nano",
};

/**
 * USD per 1M tokens, used for cost *estimates* only.
 * Anthropic rows are from Anthropic's pricing (prompts up to 100K tokens).
 * OpenAI rows come from third-party price trackers: verify before relying on them.
 */
export const PRICING_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "gpt-5.4-nano": { input: 0.2, output: 1.25 },
  "gpt-5-nano": { input: 0.05, output: 0.4 },
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },
};

export function estimateCostUSD(model: string, inputTokens: number, outputTokens: number): number | null {
  const p = PRICING_PER_MTOK[model];
  if (!p) return null;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

/** gpt-5* are reasoning models: they reject non-default temperature and spend output tokens on thinking. */
export const isOpenAIReasoningModel = (id: string) => /^(gpt-5|o\d)/.test(id);

/** Lowest reasoning effort the model accepts: gpt-5 / gpt-5-mini / gpt-5-nano use "minimal"; later gpt-5.x use "none". */
export const openAIReasoningEffort = (id: string): "minimal" | "none" | undefined =>
  !isOpenAIReasoningModel(id) ? undefined : /^gpt-5(-|$)/.test(id) ? "minimal" : "none";
