import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { z } from "zod";
import { generateText, Output, type LanguageModel } from "ai";
import {
  DEFAULT_MODELS,
  estimateCostUSD,
  isOpenAIReasoningModel,
  openAIReasoningEffort,
  type Provider,
} from "./models";
import { LANG, type LanguageConfig } from "./languages";
import { descriptionSchema, insightSchema, type Description, type Insight } from "./schema";

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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new ConfigError("OPENAI_API_KEY is not set on the server");
  const id = process.env.LLM_MODEL || DEFAULT_MODELS.openai;
  return { model: createOpenAI({ apiKey }).chat(id), id };
}

async function run<T>(
  system: string,
  prompt: string,
  schema: z.ZodType<T>,
  maxOutputTokens: number,
): Promise<{ value: T; usage: Usage }> {
  const provider = getProvider();
  const { model, id } = getModel(provider);

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await generateText({
        model,
        system,
        prompt,
        output: Output.object({ schema }),
        maxOutputTokens,
        maxRetries: 1,
        // Claude Haiku 5.5 and OpenAI gpt-5* reasoning models reject non-default temperature,
        // so it is only sent for non-reasoning OpenAI models (e.g. gpt-4.1-nano).
        ...(provider === "openai" && !isOpenAIReasoningModel(id) ? { temperature: 0.3 } : {}),
        // Reasoning is minimised so the token cap goes to the answer, not to thinking.
        providerOptions:
          provider === "anthropic"
            ? { anthropic: { thinking: { type: "disabled" } } }
            : { openai: { reasoningEffort: openAIReasoningEffort(id) } },
      });
      const inputTokens = res.usage.inputTokens ?? 0;
      const outputTokens = res.usage.outputTokens ?? 0;
      return {
        value: res.output,
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

export async function generateInsight(entry: string, lang: LanguageConfig = LANG): Promise<{ insight: Insight; usage: Usage }> {
  const { value, usage } = await run(lang.prompts.insightSystem, lang.prompts.insightUser(entry), insightSchema, 800);
  return { insight: value, usage };
}

/** Explanation + grammar in the target language, for a 10-12 year old. */
export async function generateDescription(entry: string, lang: LanguageConfig = LANG): Promise<{ insight: Description; usage: Usage }> {
  const { value, usage } = await run(
    lang.prompts.descriptionSystem,
    lang.prompts.descriptionUser(entry),
    descriptionSchema,
    700,
  );
  return { insight: value, usage };
}
