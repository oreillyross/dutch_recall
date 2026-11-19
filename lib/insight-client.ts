import type { Insight } from "./schema";

/**
 * Slice 1: stubbed insight (fixed JSON after a short delay).
 * Slice 2 replaces the body with a POST to /api/insight.
 */
export async function fetchInsight(entry: string): Promise<Insight> {
  await new Promise((r) => setTimeout(r, 600));
  return {
    english: ["(stub) sample translation", "alternative meaning"],
    pos: "noun · de",
    forms: "plural: voorbeelden · diminutive: voorbeeldje",
    pronunciation: "ui = ow-ish",
    examples: [
      { nl: `Dit is een voorbeeld met "${entry}".`, en: `This is an example with "${entry}".` },
      { nl: "Kun je nog een voorbeeld geven?", en: "Can you give another example?" },
    ],
    notes:
      "This is placeholder content from the stubbed insight. Real translations arrive once the /api/insight route is wired up.",
    related: [
      { nl: "het woord", en: "the word" },
      { nl: "de zin", en: "the sentence" },
    ],
  };
}
