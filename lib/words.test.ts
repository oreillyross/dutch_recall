import { describe, expect, it } from "vitest";
import { entryKey, normalizeEntry, parseWords } from "./words";

describe("parseWords", () => {
  it("trims, collapses whitespace, drops blanks and dedupes case-insensitively", () => {
    expect(parseWords("  Fiets \n\n de   fiets\nfiets\nFIETS", false)).toEqual(["Fiets", "de fiets"]);
  });

  it("keeps Essen and essen apart when case sensitive", () => {
    expect(parseWords("Essen\nessen\nEssen", true)).toEqual(["Essen", "essen"]);
    expect(parseWords("Essen\nessen", false)).toEqual(["Essen"]);
  });

  it("normalises to NFC", () => {
    const decomposed = "Müde"; // u + combining diaeresis
    expect(parseWords(decomposed, false)).toEqual(["Müde"]);
    expect(parseWords(`Müde\n${decomposed}`, false)).toHaveLength(1);
  });

  it("turns typographic apostrophes into ASCII", () => {
    expect(parseWords("l’eau\nl'eau", false)).toEqual(["l'eau"]);
    expect(normalizeEntry("s’en sortir")).toBe("s'en sortir");
  });
});

describe("entryKey", () => {
  it("lowercases for Dutch/French/Italian so existing Dutch keys are unchanged", () => {
    expect(entryKey("Het Is Niet", false)).toBe("het is niet");
  });
  it("is exact for German", () => {
    expect(entryKey("Essen", true)).toBe("Essen");
    expect(entryKey("Essen", true)).not.toBe(entryKey("essen", true));
  });
});
