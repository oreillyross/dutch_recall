import { buildInsightSystem, insightUser } from "./insight-prompt";
import type { LanguageConfig } from "./types";

export const de: LanguageConfig = {
  code: "de",
  name: "German",
  endonym: "Deutsch",
  themeColor: "#b8860b",
  palette: {
    ink: "#ffffff",
    soft: "#faf1d8",
    dark: { color: "#e0b43a", ink: "#1c1604", soft: "#2b2410" },
  },
  caseSensitiveKeys: true,
  ui: {
    frontTag: "Deutsch",
    backTagNative: "Erklärung",
    hintNative: "Versuch es zu erklären, dann tippe zum Umdrehen",
    grammarHeading: "Grammatik",
    nativeRadioLabel: "German description (Klasse 5/6)",
    placeholderWords: ["gemütlich", "sich auskennen", "der Feierabend", "das Mädchen", "ich verstehe nur Bahnhof"],
    manifestShortName: "Langcards DE",
  },
  prompts: {
    insightSystem: buildInsightSystem({
      name: "German",
      posRule:
        'part of speech; nouns include the article and gender, e.g. "noun · der", "noun · die", "noun · das"; use "idiom" or "phrase" for those.',
      formsRule:
        "noun plural (and genitive singular if irregular); verb infinitive, 3rd-person present if it has a stem change, Präteritum, Partizip II with its auxiliary (hat/ist) (mark separable and reflexive verbs); adjective comparative and superlative (with umlaut if any).",
      trickySounds: "ch, ö, ü, ei/ie, sp/st, ß, final devoicing",
      registerNote: ", du vs Sie",
    }),
    descriptionSystem: [
      "Du bist Lehrerin oder Lehrer in Klasse 5/6 einer Schule in Deutschland (Kinder von 10 bis 12 Jahren).",
      "Erkläre das deutsche Wort oder den Ausdruck so, wie du es einem Kind im Unterricht erklären würdest.",
      "Regeln:",
      "- Schreibe nur auf Deutsch. Kein Englisch, keine Übersetzung.",
      "- Benutze kurze Sätze und einfache, bekannte Wörter. Vermeide schwierige Wörter; wenn du doch eins brauchst, erkläre es sofort.",
      "- Sag, was das Wort bedeutet. Wenn es hilft, nimm einen Vergleich oder ein Beispiel aus dem Alltag eines Kindes (Schule, Zuhause, Sport, Freunde).",
      "- Bei einem Ausdruck erkläre, was er wirklich bedeutet und was man wörtlich damit meinen würde.",
      "- Benutze das Wort nicht, um sich selbst zu erklären.",
      "- Die Erklärung hat 2 bis 4 kurze Sätze, als zusammenhängender Text ohne Aufzählungszeichen, Überschriften oder Anrede.",
      "- Der Ton darf freundlich sein, aber nicht kindisch.",
      "- Fülle auch `grammar` aus: für jedes wichtige Wort des Wortes oder Ausdrucks (höchstens 5, Artikel und kleine Bindewörter weglassen) eine Zeile.",
      "  - word: das Wort so, wie es in der Eingabe steht.",
      "  - kind: die Wortart auf Deutsch: „Nomen“, „Verb“, „Adjektiv“, „Adverb“, „Präposition“ usw.",
      "  - details: bei einem Nomen „der“, „die“ oder „das“ und wenn nötig die Mehrzahl; bei einem Verb die Zeitform (Präsens, Präteritum, Perfekt, Partizip II), die Grundform und ob es trennbar ist; bei einem Adjektiv die Steigerungsstufe oder die Form; sonst ein leerer Text.",
      "  - Schreibe auch hier nur Deutsch, kurz und in einfacher Sprache.",
    ].join("\n"),
    insightUser: insightUser("German"),
    descriptionUser: (entry) => `Erkläre dieses Wort oder diesen Ausdruck für ein Kind in Klasse 5/6: "${entry}"`,
  },
};
