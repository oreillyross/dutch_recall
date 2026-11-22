/** UI language. It also decides how cards are explained ("en" = English back, "native" = target-language back). */
export type UiLang = "en" | "native";

/** Every user-visible string in the app. A language cannot compile with a missing key. */
export interface Messages {
  /** BCP 47 tag, used for <html lang> and date formatting */
  locale: string;
  /** Name of the language being learned, in this UI language ("Dutch" / "Nederlands") */
  targetLanguage: string;
  deckName: string; // "Dutch cards" / "Nederlandse kaartjes"

  tabs: { aria: string; cards: string; words: string; usage: string };

  cards: {
    progress: (n: number, total: number) => string;
    flipAria: string;
    hint: string;
    backTag: string;
    prev: string;
    next: string;
    flip: string;
    flipBack: string;
    keys: string;
    emptyTitle: string;
    emptyBody: string;
    openWords: string;
    loading: string;
    retry: string;
    loadFailed: string;
    // English-style back
    alsoLabel: string;
    inUse: string;
    goodToKnow: string;
    related: string;
    // Dutch-style back
    grammar: string;
  };

  words: {
    title: string;
    help: string;
    savedAria: string;
    removeAria: (w: string) => string;
    placeholderFirst: string;
    placeholderMore: string;
    count: (n: number) => string;
    clearNew: string;
    save: string;
    confirmRemove: (w: string) => string;
    cancel: string;
    remove: string;
  };

  settings: {
    title: string;
    accessCode: string;
    accessPlaceholder: string;
    unlocked: string;
    lock: string;
    unlock: string;
    language: string;
    languageHelp: string;
    optionEn: string;
    optionNative: string;
    shuffle: string;
    save: string;
    saved: string;
  };

  usage: {
    version: string;
    published: string;
    unknown: string;
    help: string;
    calls: string;
    inputTokens: string;
    outputTokens: string;
    estCost: (partial: boolean) => string;
    failed: (n: number) => string;
    model: string;
    callsShort: string;
    in: string;
    out: string;
    cost: string;
    since: (date: string) => string;
    reset: string;
  };

  pwa: {
    installTitle: string;
    installAria: string;
    installBody: string;
    iosBody: string;
    install: string;
    dismiss: string;
  };
}
