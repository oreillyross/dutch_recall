import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, Output, type LanguageModel } from "ai";
import { DEFAULT_MODELS, estimateCostUSD, type Provider } from "./models";
import { insightSchema, type Insight } from "./schema";

export class ConfigError extends Error {}
export class UpstreamError extends Error {
  constructor(
    message: string,
    public status: 429 | 502,
  ) {
    super(message);
  }
}

export type Usage = { model: string; inputTokens: number; outputTokens: number; costUSD: number | null };

const SYSTEM = [
  "You are a concise Dutch tutor helping an English speaker learn Dutch.",
  "For a single word, give the translation, grammar info and usage.",
  "For a full phrase, sentence or idiom, translate it naturally, explain the idiom (including its literal meaning), and in `notes` break down the key words.",
  "Field rules:",
  '- english: best natural translation first, then up to 2 genuinely distinct alternatives.',
  '- pos: part of speech; nouns include the article, e.g. "noun · de" or "noun · het"; use "idiom" or "phrase" for those.',
  "- forms: noun plural and diminutive; verb infinitive, past singular and past participle (mark separable verbs); adjective comparative. Short. Empty string if not useful.",
  "- pronunciation: short respelling hint only for tricky sounds (ui, g, ij, eu); otherwise empty string.",
  "- examples: exactly 2 everyday, short Dutch sentences using the entry, each with an English translation.",
  "- notes: 2-4 sentences on nuance, register, common mistakes, false friends, literal meaning for idioms, a memory hook if it genuinely helps.",
  "- related: 2-4 related words or common collocations with meanings.",
  "Keep everything compact.",
].join("\n");

function getProvider(): Provider {
  const p = (process.env.LLM_PROVIDER || "anthropic").toLowerCase();
  if (p !== "anthropic" && p !== "openai") throw new ConfigError(`Unsupported LLM_PROVIDER "${p}"`);
  return p;
}

function getModel(provider: Provider): { model: LanguageModel; id: string } {
  if (provider === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new ConfigError("ANTHROPIC_API_KEY is not set on the server");
    const id = process.env.LLM_MODEL || DEFAULT_MODELS.anthropic;
    return { model: createAnthropic({ apiKey })(id), id };
  }
  throw new ConfigError("The openai provider is not enabled yet");
}

export async function generateInsight(entry: string): Promise<{ insight: Insight; usage: Usage }> {
  const provider = getProvider();
  const { model, id } = getModel(provider);

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await generateText({
        model,
        system: SYSTEM,
        prompt: `The learner pasted this Dutch word or phrase: "${entry}"`,
        output: Output.object({ schema: insightSchema }),
        maxOutputTokens: 800,
        maxRetries: 1,
        // Claude Haiku 5.5 rejects non-default temperature, so none is sent.
        // Thinking is off so the 800-token cap goes to the answer, not reasoning.
        providerOptions: provider === "anthropic" ? { anthropic: { thinking: { type: "disabled" } } } : undefined,
      });
      const inputTokens = res.usage.inputTokens ?? 0;
      const outputTokens = res.usage.outputTokens ?? 0;
      return {
        insight: res.output,
        usage: { model: id, inputTokens, outputTokens, costUSD: estimateCostUSD(id, inputTokens, outputTokens) },
      };
    } catch (err) {
      lastErr = err;
      // Retry once only for unparseable/invalid structured output.
      const name = (err as { name?: string })?.name ?? "";
      if (!/NoOutputGenerated|NoObjectGenerated|JSONParse|TypeValidation/i.test(name)) break;
    }
  }
  const status = (lastErr as { statusCode?: number })?.statusCode;
  console.error("insight generation failed:", (lastErr as Error)?.name, status);
  throw new UpstreamError("The language model could not produce an insight", status === 429 ? 429 : 502);
}
