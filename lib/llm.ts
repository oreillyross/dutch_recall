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
import { dutchDescriptionSchema, insightSchema, type DutchDescription, type Insight } from "./schema";

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

const SYSTEM_DUTCH = [
  "Je bent een juf of meester van groep 7/8 op de basisschool (kinderen van 10 tot 12 jaar).",
  "Leg het Nederlandse woord of de uitdrukking uit zoals je dat aan een kind in de klas zou doen.",
  "Regels:",
  "- Schrijf alleen in het Nederlands. Geen Engels, geen vertaling.",
  "- Gebruik korte zinnen en eenvoudige, bekende woorden. Vermijd moeilijke woorden; als je er toch een gebruikt, leg je die meteen uit.",
  "- Zeg wat het woord betekent. Gebruik waar het helpt een vergelijking of een voorbeeld uit het dagelijks leven van een kind (school, thuis, sport, vrienden).",
  "- Bij een uitdrukking leg je uit wat ze echt betekent, en wat je er letterlijk mee zou bedoelen.",
  "- Je mag het woord niet gebruiken om zichzelf uit te leggen.",
  "- Het is een uitleg van 2 tot 4 korte zinnen, aaneengesloten tekst zonder opsommingstekens, titels of aanhef.",
  "- Het mag vriendelijk klinken, maar niet kinderachtig.",
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

export async function generateInsight(entry: string): Promise<{ insight: Insight; usage: Usage }> {
  const { value, usage } = await run(
    SYSTEM,
    `The learner pasted this Dutch word or phrase: "${entry}"`,
    insightSchema,
    800,
  );
  return { insight: value, usage };
}

export async function generateDutchDescription(entry: string): Promise<{ insight: DutchDescription; usage: Usage }> {
  const { value, usage } = await run(
    SYSTEM_DUTCH,
    `Leg dit woord of deze uitdrukking uit voor een kind van groep 7/8: "${entry}"`,
    dutchDescriptionSchema,
    400,
  );
  return { insight: value, usage };
}
