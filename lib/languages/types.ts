export type LanguageCode = "nl" | "de" | "fr" | "it";

export type Palette = {
  /** text/icon colour on top of the accent */
  ink: string;
  /** soft tint used for pills */
  soft: string;
  dark: { color: string; ink: string; soft: string };
};

/** Everything language-specific lives here. A language cannot compile with a missing field. */
export type LanguageConfig = {
  /** also the storage-key prefix and the `lang` of word text */
  code: LanguageCode;
  /** English name: "German" */
  name: string;
  /** "Deutsch" */
  endonym: string;
  /** accent colour: --accent, the manifest and viewport.themeColor */
  themeColor: string;
  palette: Palette;
  /** dedupe + cache key; true only for German */
  caseSensitiveKeys: boolean;
  ui: {
    /** front-of-card tag in native mode */
    frontTag: string;
    backTagNative: string;
    hintNative: string;
    grammarHeading: string;
    nativeRadioLabel: string;
    /** 5 example entries for the empty textarea */
    placeholderWords: string[];
    manifestShortName: string;
  };
  prompts: {
    insightSystem: string;
    descriptionSystem: string;
    insightUser: (entry: string) => string;
    descriptionUser: (entry: string) => string;
  };
};
