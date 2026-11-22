import { LANG } from "@/lib/languages";

/** NFC-normalise (ü, é composed vs decomposed) and turn typographic apostrophes into `'`. */
export function normalizeEntry(s: string): string {
  return s.normalize("NFC").replace(/[‘’]/g, "'");
}

/** Cache/dedupe key: exact for case-sensitive languages (German), lowercase otherwise. */
export function entryKey(entry: string, caseSensitive: boolean = LANG.caseSensitiveKeys): string {
  const n = normalizeEntry(entry);
  return caseSensitive ? n : n.toLowerCase();
}

/** Normalise, trim, collapse whitespace, drop blanks, dedupe (case-insensitively unless the language is case-sensitive). */
export function parseWords(text: string, caseSensitive: boolean = LANG.caseSensitiveKeys): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const w = normalizeEntry(line).trim().replace(/\s+/g, " ");
    if (!w) continue;
    const key = entryKey(w, caseSensitive);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
  }
  return out;
}

export function shuffled<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
