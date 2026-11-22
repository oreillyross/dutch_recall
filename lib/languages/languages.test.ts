import { describe, expect, it } from "vitest";
import golden from "../__fixtures__/nl-prompts.json";
import { CONFIGS, resolveLanguage } from "./index";

describe("Dutch prompts", () => {
  it("match the strings that shipped before the language refactor", () => {
    expect(CONFIGS.nl.prompts.insightSystem).toBe(golden.insightSystem);
    expect(CONFIGS.nl.prompts.descriptionSystem).toBe(golden.descriptionSystem);
    expect(CONFIGS.nl.prompts.insightUser("gezellig")).toBe('The learner pasted this Dutch word or phrase: "gezellig"');
    expect(CONFIGS.nl.prompts.descriptionUser("gezellig")).toBe(
      'Leg dit woord of deze uitdrukking uit voor een kind van groep 7/8: "gezellig"',
    );
  });
});

describe("language configs", () => {
  for (const [code, c] of Object.entries(CONFIGS)) {
    it(`${code} fills every field`, () => {
      expect(c.code).toBe(code);
      for (const v of [c.name, c.endonym, c.themeColor, ...Object.values(c.ui).flat(), c.prompts.insightSystem, c.prompts.descriptionSystem]) {
        expect(v).toBeTruthy();
      }
      expect(c.ui.placeholderWords).toHaveLength(5);
      expect(c.prompts.insightUser("x")).toContain(c.name);
      expect(c.prompts.descriptionUser("x")).toContain('"x"');
      expect(c.prompts.insightSystem).toContain(`concise ${c.name} tutor`);
    });
  }

  it("only German is case sensitive", () => {
    expect(Object.values(CONFIGS).filter((c) => c.caseSensitiveKeys).map((c) => c.code)).toEqual(["de"]);
  });

  it("defaults to Dutch and rejects unknown codes", () => {
    expect(resolveLanguage(undefined).code).toBe("nl");
    expect(() => resolveLanguage("xx")).toThrow(/Unknown NEXT_PUBLIC_LANG/);
    expect(() => resolveLanguage("constructor")).toThrow();
  });
});
