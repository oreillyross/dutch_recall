import { z } from "zod";

/** Language-neutral: every language shares these schemas. */
export const insightSchema = z.object({
  /** [best translation, ...up to 2 distinct alternatives] */
  english: z.array(z.string()).min(1).max(3),
  /** e.g. "noun · de", "verb", "idiom" */
  pos: z.string(),
  /** plural/diminutive, verb principal parts, comparative; "" if n/a */
  forms: z.string(),
  /** only for tricky sounds; "" otherwise */
  pronunciation: z.string(),
  examples: z.array(z.object({ text: z.string(), en: z.string() })).length(2),
  notes: z.string(),
  related: z.array(z.object({ text: z.string(), en: z.string() })).min(2).max(4),
});

export type Insight = z.infer<typeof insightSchema>;

/** Explanation written in the target language for a 10-12 year old, plus grammar placement in that language. */
export const descriptionSchema = z.object({
  explanation: z.string().min(1),
  /** One entry per key word of the entry (max 5), all in the target language. */
  grammar: z
    .array(
      z.object({
        /** the word as it appears in the entry */
        word: z.string().describe("the word as it appears in the entry"),
        /** word class, in the target language */
        kind: z.string().describe("word class, in the target language"),
        /** article/gender, tense, form; "" if n/a */
        details: z.string().describe("article/gender, tense or form, in the target language; empty if n/a"),
      }),
    )
    .min(1)
    .max(5),
});

export type Description = z.infer<typeof descriptionSchema>;

/** Card-back mode: "en" = English insight, "native" = explanation in the target language. */
export type BackMode = "en" | "native";
