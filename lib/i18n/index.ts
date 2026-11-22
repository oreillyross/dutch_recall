import { LANG } from "@/lib/languages";
import { buildEn } from "./en";
import { nl } from "./nl";
import type { Messages, UiLang } from "./types";

export type { Messages, UiLang };

const en = buildEn(LANG);

/**
 * Dutch ships a full Dutch UI for its native mode. Other languages keep the English chrome (the learner is an
 * English speaker) and only localise what is about the target language.
 */
const native: Messages =
  LANG.code === "nl"
    ? nl
    : {
        ...en,
        targetLanguage: LANG.ui.frontTag,
        cards: {
          ...en.cards,
          hint: LANG.ui.hintNative,
          backTag: LANG.ui.backTagNative,
          grammar: LANG.ui.grammarHeading,
        },
      };

export const MESSAGES: Record<UiLang, Messages> = { en, native };

export const APP_NAME = "Langcards";
