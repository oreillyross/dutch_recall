import { de } from "./de";
import { fr } from "./fr";
import { it } from "./it";
import { nl } from "./nl";
import type { LanguageCode, LanguageConfig } from "./types";

export type { LanguageCode, LanguageConfig };

export const CONFIGS: Record<LanguageCode, LanguageConfig> = { nl, de, fr, it };

export const LANGUAGE_CODES = Object.keys(CONFIGS) as LanguageCode[];

export const isLanguageCode = (v: unknown): v is LanguageCode => typeof v === "string" && Object.hasOwn(CONFIGS, v);

export function resolveLanguage(code: string | undefined): LanguageConfig {
  const key = code || "nl";
  if (!Object.hasOwn(CONFIGS, key)) {
    throw new Error(`Unknown NEXT_PUBLIC_LANG "${key}". Use one of: ${Object.keys(CONFIGS).join(", ")}`);
  }
  return CONFIGS[key as LanguageCode];
}

/** The language the app opens in on a fresh browser. The learner can switch in Settings. */
export const LANG = resolveLanguage(process.env.NEXT_PUBLIC_LANG);

/** Accent-colour CSS for a language (light, then the dark-mode tint of the same hue). */
export function themeCss(l: LanguageConfig): string {
  const p = l.palette;
  return `:root{--accent:${l.themeColor};--accent-ink:${p.ink};--accent-soft:${p.soft}}@media (prefers-color-scheme:dark){:root{--accent:${p.dark.color};--accent-ink:${p.dark.ink};--accent-soft:${p.dark.soft}}}`;
}
