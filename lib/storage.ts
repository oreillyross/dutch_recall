// Best-effort localStorage helpers. Client-only: call from effects/handlers.
import { LANG, isLanguageCode, type LanguageCode } from "@/lib/languages";
import { migrateDescriptionCache, migrateInsightCache } from "@/lib/migrate";
import type { BackMode } from "@/lib/schema";

/** Storage keys for one language. The prefix keeps every existing Dutch key ("nl.*") unchanged. */
export const keysFor = (code: LanguageCode) =>
  ({
    raw: `${code}.raw`,
    shuffle: `${code}.shuffle`,
    deck: `${code}.deck`,
    index: `${code}.index`,
    insights: `${code}.insights`,
    descriptions: `${code}.descriptions`,
    backLang: `${code}.backLang`,
    usage: `${code}.usage`,
    /** Legacy: the access code used to be stored here in plain text. Removed on load. */
    access: `${code}.access`,
  }) as const;
export type Keys = ReturnType<typeof keysFor>;

const LANG_KEY = "app.lang";
/** The language last picked in Settings, else the deployment default. */
export function readLang(): LanguageCode {
  const v = getItem<unknown>(LANG_KEY, null);
  return isLanguageCode(v) ? v : LANG.code;
}
export const saveLang = (code: LanguageCode) => setItem(LANG_KEY, code);

/** Persisted card-back mode. Older versions stored "nl" for the native-language back. */
export function readBackMode(keys: Keys): BackMode {
  const v = getItem<string>(keys.backLang, "en");
  return v === "native" || v === "nl" ? "native" : "en";
}

/** Rewrite caches saved with the old Dutch-specific field names (nl, uitleg, grammatica, woord, soort). */
export function migrateCaches(keys: Keys): void {
  const jobs = [
    [keys.insights, migrateInsightCache],
    [keys.descriptions, migrateDescriptionCache],
  ] as const;
  for (const [key, migrate] of jobs) {
    const cache = getItem<unknown>(key, null);
    if (typeof cache !== "object" || cache === null || Array.isArray(cache)) continue;
    const { value, changed } = migrate(cache as Record<string, unknown>);
    if (changed) setItem(key, value);
  }
}

export function getItem<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

export function removeItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function setItem(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable or full: the app still works in-memory
  }
}
