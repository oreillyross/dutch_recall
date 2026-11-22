import { en } from "./en";
import { nl } from "./nl";
import type { Messages, UiLang } from "./types";

export type { Messages, UiLang };

export const MESSAGES: Record<UiLang, Messages> = { en, nl };

export const APP_NAME = "Langcards";
