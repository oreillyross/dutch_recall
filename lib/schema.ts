import { z } from "zod";

export const insightSchema = z.object({
  /** [best translation, ...up to 2 distinct alternatives] */
  english: z.array(z.string()).min(1).max(3),
  /** e.g. "noun · de", "verb", "idiom" */
  pos: z.string(),
  /** plural/diminutive, verb principal parts, comparative; "" if n/a */
  forms: z.string(),
  /** only for tricky sounds; "" otherwise */
  pronunciation: z.string(),
  examples: z.array(z.object({ nl: z.string(), en: z.string() })).length(2),
  notes: z.string(),
  related: z.array(z.object({ nl: z.string(), en: z.string() })).min(2).max(4),
});

export type Insight = z.infer<typeof insightSchema>;

/** Dutch-only explanation, written for a groep 7/8 child. */
export const dutchDescriptionSchema = z.object({
  uitleg: z.string().min(1),
  /** Grammar placement, in Dutch: one entry per key word of the entry (max 5). */
  grammatica: z
    .array(
      z.object({
        /** the word as it appears in the entry */
        woord: z.string(),
        /** word class in Dutch, e.g. "zelfstandig naamwoord", "werkwoord", "bijvoeglijk naamwoord" */
        soort: z.string(),
        /** de-/het-woord, tijd (tegenwoordige/verleden tijd), vorm; "" if n/a */
        details: z.string(),
      }),
    )
    .min(1)
    .max(5),
});

export type DutchDescription = z.infer<typeof dutchDescriptionSchema>;
