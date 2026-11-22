import { describe, expect, it } from "vitest";
import { migrateDescriptionCache, migrateInsightCache } from "./migrate";

describe("migrateInsightCache", () => {
  it("renames examples[].nl and related[].nl to text", () => {
    const old = {
      gezellig: {
        english: ["cosy"],
        pos: "adj",
        examples: [{ nl: "Het is gezellig.", en: "It is cosy." }],
        related: [{ nl: "gezelligheid", en: "cosiness" }],
      },
    };
    const { value, changed } = migrateInsightCache(old);
    expect(changed).toBe(true);
    expect(value.gezellig).toMatchObject({
      examples: [{ text: "Het is gezellig.", en: "It is cosy." }],
      related: [{ text: "gezelligheid", en: "cosiness" }],
      english: ["cosy"],
    });
  });

  it("leaves already-migrated caches alone", () => {
    const cur = { a: { examples: [{ text: "x", en: "y" }], related: [] } };
    expect(migrateInsightCache(cur).changed).toBe(false);
  });
});

describe("migrateDescriptionCache", () => {
  it("renames uitleg and grammatica rows", () => {
    const { value, changed } = migrateDescriptionCache({
      fiets: { uitleg: "Een voertuig.", grammatica: [{ woord: "fiets", soort: "zelfstandig naamwoord", details: "de-woord" }] },
    });
    expect(changed).toBe(true);
    expect(value.fiets).toEqual({
      explanation: "Een voertuig.",
      grammar: [{ word: "fiets", kind: "zelfstandig naamwoord", details: "de-woord" }],
    });
  });

  it("keeps descriptions cached before grammar existed (no grammar section)", () => {
    const { value } = migrateDescriptionCache({ fiets: { uitleg: "Een voertuig." } });
    expect(value.fiets).toEqual({ explanation: "Een voertuig." });
  });

  it("is idempotent", () => {
    const once = migrateDescriptionCache({ a: { uitleg: "u", grammatica: [{ woord: "w", soort: "s", details: "" }] } }).value;
    expect(migrateDescriptionCache(once).changed).toBe(false);
  });
});
