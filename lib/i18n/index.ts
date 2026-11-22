import { LANG, type LanguageConfig } from "@/lib/languages";
import { buildEn } from "./en";
import { nl } from "./nl";
import type { Messages, UiLang } from "./types";

export type { Messages, UiLang };

/**
 * Dutch ships a full Dutch UI for its native mode. Other languages keep the English chrome (the learner is an
 * English speaker) and only localise what is about the target language.
 */
export function buildMessages(l: LanguageConfig): Record<UiLang, Messages> {
  const en = buildEn(l);
  const native: Messages =
    l.code === "nl"
      ? nl
      : {
          ...en,
          targetLanguage: l.ui.frontTag,
          cards: { ...en.cards, hint: l.ui.hintNative, backTag: l.ui.backTagNative, grammar: l.ui.grammarHeading },
        };
  return { en, native };
}

/** Messages for the default language (used by parts of the app that do not follow the switcher, e.g. the install banner). */
export const MESSAGES = buildMessages(LANG);

export const APP_NAME = "Langcards";
