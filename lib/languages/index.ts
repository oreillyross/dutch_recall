import { de } from "./de";
import { fr } from "./fr";
import { it } from "./it";
import { nl } from "./nl";
import type { LanguageCode, LanguageConfig } from "./types";

export type { LanguageCode, LanguageConfig };

export const CONFIGS: Record<LanguageCode, LanguageConfig> = { nl, de, fr, it };

export function resolveLanguage(code: string | undefined): LanguageConfig {
  const key = code || "nl";
  if (!Object.hasOwn(CONFIGS, key)) {
    throw new Error(`Unknown NEXT_PUBLIC_LANG "${key}". Use one of: ${Object.keys(CONFIGS).join(", ")}`);
  }
  return CONFIGS[key as LanguageCode];
}

/** The language this deployment teaches. Chosen at build time, never from a request. */
export const LANG = resolveLanguage(process.env.NEXT_PUBLIC_LANG);
