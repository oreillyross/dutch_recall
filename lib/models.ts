export type Provider = "anthropic" | "openai";

/** Default (cheapest) model per provider. Verified against current Anthropic docs. */
export const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: "claude-haiku-5-5",
  // slice 3: look up the current OpenAI nano-tier id in their docs and set it here.
  openai: "",
};

/** USD per 1M tokens (base rates, prompts up to 100K tokens). Used for cost *estimates* only. */
export const PRICING_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
};

export function estimateCostUSD(model: string, inputTokens: number, outputTokens: number): number | null {
  const p = PRICING_PER_MTOK[model];
  if (!p) return null;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}
