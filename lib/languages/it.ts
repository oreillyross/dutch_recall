import { buildInsightSystem, insightUser } from "./insight-prompt";
import type { LanguageConfig } from "./types";

export const it: LanguageConfig = {
  code: "it",
  name: "Italian",
  endonym: "Italiano",
  themeColor: "#15803d",
  palette: {
    ink: "#ffffff",
    soft: "#def5e5",
    dark: { color: "#4cc27a", ink: "#06180d", soft: "#12281a" },
  },
  caseSensitiveKeys: false,
  ui: {
    frontTag: "Italiano",
    backTagNative: "Spiegazione",
    hintNative: "Prova a spiegarlo, poi tocca per girare",
    grammarHeading: "Grammatica",
    nativeRadioLabel: "Italian description (quinta/prima media)",
    placeholderWords: ["meno male", "cavarsela", "la forchetta", "in bocca al lupo", "avere le mani in pasta"],
    manifestShortName: "Langcards IT",
  },
  prompts: {
    insightSystem: buildInsightSystem({
      name: "Italian",
      posRule:
        'part of speech; nouns include gender and article, e.g. "noun · masc. (il)", "noun · fem. (la)" (note lo/l\'/gli where needed); use "idiom" or "phrase" for those.',
      formsRule:
        "noun plural (flag irregular plurals) and gender-changing forms; verb infinitive, presente, passato prossimo with auxiliary (avere/essere) (mark irregular and reflexive verbs); adjective -o/-a/-i/-e forms.",
      trickySounds: "double consonants, gli, gn, sc, c/g before e/i, stress",
      registerNote: ", tu vs Lei",
    }),
    descriptionSystem: [
      "Sei un maestro o una maestra di quinta elementare o di prima media (bambini da 10 a 12 anni).",
      "Spiega la parola o l'espressione italiana come la spiegheresti a un bambino in classe.",
      "Regole:",
      "- Scrivi solo in italiano. Niente inglese, niente traduzione.",
      "- Usa frasi brevi e parole semplici e conosciute. Evita le parole difficili; se ne usi una, spiegala subito.",
      "- Di' che cosa significa la parola. Quando aiuta, usa un paragone o un esempio della vita di un bambino (scuola, casa, sport, amici).",
      "- Per un'espressione, spiega che cosa vuol dire davvero e che cosa vorrebbe dire presa alla lettera.",
      "- Non usare la parola per spiegare se stessa.",
      "- La spiegazione è di 2-4 frasi brevi, in un unico testo, senza elenchi puntati, titoli o saluti.",
      "- Il tono può essere cordiale, ma non infantile.",
      "- Compila anche `grammar`: una riga per ogni parola importante (al massimo 5, senza articoli e piccole parole di collegamento).",
      "  - word: la parola come appare nell'input.",
      "  - kind: la categoria grammaticale in italiano: «nome», «verbo», «aggettivo», «avverbio», «preposizione», ecc.",
      "  - details: per un nome «maschile» o «femminile», l'articolo (il, lo, la, l') e il plurale se è particolare; per un verbo il tempo (presente, imperfetto, passato prossimo, futuro…), l'infinito, la coniugazione (-are, -ere, -ire) e l'ausiliare (essere o avere); per un aggettivo l'accordo o il grado; altrimenti un testo vuoto.",
      "  - Scrivi anche qui solo in italiano, breve e con parole semplici.",
    ].join("\n"),
    insightUser: insightUser("Italian"),
    descriptionUser: (entry) => `Spiega questa parola o questa espressione a un bambino di quinta elementare o di prima media: "${entry}"`,
  },
};
