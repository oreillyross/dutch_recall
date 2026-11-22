import { buildInsightSystem, insightUser } from "./insight-prompt";
import type { LanguageConfig } from "./types";

export const fr: LanguageConfig = {
  code: "fr",
  name: "French",
  endonym: "Français",
  themeColor: "#1d4ed8",
  palette: {
    ink: "#ffffff",
    soft: "#e3eafc",
    dark: { color: "#6b93ff", ink: "#0a1226", soft: "#151d33" },
  },
  caseSensitiveKeys: false,
  ui: {
    frontTag: "Français",
    backTagNative: "Explication",
    hintNative: "Essaie de l'expliquer, puis touche pour retourner",
    grammarHeading: "Grammaire",
    nativeRadioLabel: "French description (CM2/6e)",
    placeholderWords: ["dépaysement", "s'en sortir", "la fourchette", "avoir le cafard", "c'est la fin des haricots"],
    manifestShortName: "Langcards FR",
  },
  prompts: {
    insightSystem: buildInsightSystem({
      name: "French",
      posRule:
        'part of speech; nouns include gender and article, e.g. "noun · masc. (le)", "noun · fem. (la)"; use "idiom" or "phrase" for those.',
      formsRule:
        "noun plural if irregular and the feminine form if one exists; verb infinitive, group, passé composé with auxiliary (avoir/être) (mark pronominal verbs); adjective feminine and plural forms.",
      trickySounds: "nasal vowels, silent letters, liaison, r, u vs ou, -ill-",
      registerNote: ", tu vs vous",
    }),
    descriptionSystem: [
      "Tu es maître ou maîtresse d'école en CM2 ou en 6e (des enfants de 10 à 12 ans).",
      "Explique le mot ou l'expression en français comme tu le ferais à un enfant en classe.",
      "Règles :",
      "- Écris uniquement en français. Pas d'anglais, pas de traduction.",
      "- Utilise des phrases courtes et des mots simples et connus. Évite les mots difficiles ; si tu en utilises un, explique-le tout de suite.",
      "- Dis ce que le mot veut dire. Quand cela aide, utilise une comparaison ou un exemple de la vie d'un enfant (école, maison, sport, amis).",
      "- Pour une expression, explique ce qu'elle veut vraiment dire, et ce que l'on voudrait dire en la prenant au pied de la lettre.",
      "- N'utilise pas le mot pour s'expliquer lui-même.",
      "- L'explication fait de 2 à 4 phrases courtes, en un seul texte, sans puces, sans titre et sans formule d'introduction.",
      "- Le ton peut être amical, mais pas enfantin.",
      "- Remplis aussi `grammar` : une ligne pour chaque mot important (5 au maximum, sans les articles ni les petits mots de liaison).",
      "  - word : le mot tel qu'il apparaît dans l'entrée.",
      "  - kind : la classe du mot en français : « nom », « verbe », « adjectif », « adverbe », « préposition », etc.",
      "  - details : pour un nom, « masculin » ou « féminin » (le, la, l') et le pluriel s'il est particulier ; pour un verbe, le temps (présent, imparfait, passé composé, futur…), l'infinitif, le groupe et l'auxiliaire ; pour un adjectif, l'accord (féminin, pluriel) ou le degré ; sinon un texte vide.",
      "  - Écris aussi ici uniquement en français, court et en langage simple.",
    ].join("\n"),
    insightUser: insightUser("French"),
    descriptionUser: (entry) => `Explique ce mot ou cette expression à un enfant de CM2 ou de 6e : "${entry}"`,
  },
};
