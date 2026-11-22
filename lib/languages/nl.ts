import { buildInsightSystem, insightUser } from "./insight-prompt";
import type { LanguageConfig } from "./types";

export const nl: LanguageConfig = {
  code: "nl",
  name: "Dutch",
  endonym: "Nederlands",
  themeColor: "#e8590c",
  palette: {
    ink: "#ffffff",
    soft: "#fdeee3",
    dark: { color: "#ff7a2f", ink: "#1a1208", soft: "#2c1f15" },
  },
  caseSensitiveKeys: false,
  ui: {
    frontTag: "Nederlands",
    backTagNative: "Uitleg",
    hintNative: "Probeer het uit te leggen, tik dan om te draaien",
    grammarHeading: "Grammatica",
    nativeRadioLabel: "Dutch (groep 7/8 descriptions)",
    placeholderWords: ["gezellig", "aan de slag gaan", "uitzoeken", "de fiets", "het is niet mijn pakkie-an"],
    manifestShortName: "Langcards",
  },
  prompts: {
    insightSystem: buildInsightSystem({
      name: "Dutch",
      posRule: 'part of speech; nouns include the article, e.g. "noun · de" or "noun · het"; use "idiom" or "phrase" for those.',
      formsRule:
        "noun plural and diminutive; verb infinitive, past singular and past participle (mark separable verbs); adjective comparative.",
      trickySounds: "ui, g, ij, eu",
      registerNote: "",
    }),
    descriptionSystem: [
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
      "- Vul ook `grammatica` in: voor elk belangrijk woord van het woord of de uitdrukking (maximaal 5, sla lidwoorden en voegwoordjes over) één regel.",
      "  - woord: het woord zoals het in de invoer staat.",
      '  - soort: de woordsoort in het Nederlands: "zelfstandig naamwoord", "werkwoord", "bijvoeglijk naamwoord", "bijwoord", "voorzetsel", enzovoort.',
      '  - details: bij een zelfstandig naamwoord "de-woord" of "het-woord" en eventueel het meervoud; bij een werkwoord de tijd (tegenwoordige tijd, verleden tijd, voltooid deelwoord) en de hele werkwoordsvorm; bij een bijvoeglijk naamwoord de trap of vorm; anders een leeg tekstje.',
      "  - Schrijf ook hier alleen Nederlands, kort en in kindertaal.",
    ].join("\n"),
    insightUser: insightUser("Dutch"),
    descriptionUser: (entry) => `Leg dit woord of deze uitdrukking uit voor een kind van groep 7/8: "${entry}"`,
  },
};
