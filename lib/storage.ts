// Best-effort localStorage helpers. Client-only: call from effects/handlers.
import { LANG } from "@/lib/languages";
import { migrateDescriptionCache, migrateInsightCache } from "@/lib/migrate";
import type { BackMode } from "@/lib/schema";

const P = LANG.code; // storage-key prefix: "nl" keeps every existing Dutch key unchanged
export const KEYS = {
  raw: `${P}.raw`,
  shuffle: `${P}.shuffle`,
  deck: `${P}.deck`,
  index: `${P}.index`,
  insights: `${P}.insights`,
  descriptions: `${P}.descriptions`,
  backLang: `${P}.backLang`,
  usage: `${P}.usage`,
  /** Legacy: the access code used to be stored here in plain text. Removed on load. */
  access: `${P}.access`,
} as const;

/** Persisted card-back mode. Older versions stored "nl" for the native-language back. */
export function readBackMode(): BackMode {
  const v = getItem<string>(KEYS.backLang, "en");
  return v === "native" || v === "nl" ? "native" : "en";
}

/** Rewrite caches saved with the old Dutch-specific field names (nl, uitleg, grammatica, woord, soort). */
export function migrateCaches(): void {
  const jobs = [
    [KEYS.insights, migrateInsightCache],
    [KEYS.descriptions, migrateDescriptionCache],
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
