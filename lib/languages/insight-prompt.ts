export type InsightSlots = {
  name: string;
  posRule: string;
  formsRule: string;
  trickySounds: string;
  /** e.g. ", du vs Sie" (leading comma) or "" */
  registerNote: string;
};

/** English tutor prompt shared by all languages. */
export function buildInsightSystem(s: InsightSlots): string {
  return [
    `You are a concise ${s.name} tutor helping an English speaker learn ${s.name}.`,
    "For a single word, give the translation, grammar info and usage.",
    "For a full phrase, sentence or idiom, translate it naturally, explain the idiom (including its literal meaning), and in `notes` break down the key words.",
    "Field rules:",
    "- english: best natural translation first, then up to 2 genuinely distinct alternatives.",
    `- pos: ${s.posRule}`,
    `- forms: ${s.formsRule} Short. Empty string if not useful.`,
    `- pronunciation: short respelling hint only for tricky sounds (${s.trickySounds}); otherwise empty string.`,
    `- examples: exactly 2 everyday, short ${s.name} sentences using the entry, each with an English translation.`,
    `- notes: 2-4 sentences on nuance, register${s.registerNote}, common mistakes, false friends, literal meaning for idioms, a memory hook if it genuinely helps.`,
    "- related: 2-4 related words or common collocations with meanings.",
    "Keep everything compact.",
  ].join("\n");
}

export const insightUser = (name: string) => (entry: string) =>
  `The learner pasted this ${name} word or phrase: "${entry}"`;
