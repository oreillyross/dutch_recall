// Best-effort localStorage helpers. Client-only: call from effects/handlers.
export const KEYS = {
  raw: "nl.raw",
  shuffle: "nl.shuffle",
  deck: "nl.deck",
  index: "nl.index",
  insights: "nl.insights",
  descriptions: "nl.descriptions",
  backLang: "nl.backLang",
  usage: "nl.usage",
  /** Legacy: the access code used to be stored here in plain text. Removed on load. */
  access: "nl.access",
} as const;

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
