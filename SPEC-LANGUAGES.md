# Multi-language Flashcards: German, French, Italian — Spec

## Goal
Clone what the Dutch app (**Nederlands kaartjes**) does today for **German (de), French (fr) and Italian (it)**, behaving
exactly like the Dutch version. Same UX, same features, same cost/abuse guardrails. Only the language-specific content
changes: prompts, grammar vocabulary, UI labels, placeholder words and theme.

Dutch stays the reference. Nothing a Dutch user sees or has stored may change (see "Dutch must not regress").

This spec describes the Dutch app as it is on `main` (after PRs #9 and #10), then says what varies per language.

## Decision: one codebase, one deployment per language
- **One repo, one language config per language** (`lib/languages/{nl,de,fr,it}.ts`), selected by a build-time env var
  `NEXT_PUBLIC_LANG` (default `nl`).
- **Each language is its own Vercel project** from the same repo, with its own env vars (`NEXT_PUBLIC_LANG=de`, keys,
  `ACCESS_CODE`). Each is its own origin, so `localStorage`, the session cookie, the PWA install and the usage totals are
  isolated per language for free, and each gets its own home-screen icon.
- The target language comes from the **server's env, never from the request body**, so a client can't pick one.
- Rejected for v1: a single app with a language switcher (`/de`, `/fr` routes). It needs shared-origin storage
  namespacing and a combined usage view. Storage keys are prefixed by language code (below), so this migration stays
  easy later if wanted.

## Non-goals (same as Dutch v1)
No accounts, database, spaced repetition, audio/TTS, sync, or streaming. The learner is an **English speaker**; the UI
chrome stays in English in every deployment. No new provider or model changes.

---

## 1. What the Dutch app does today (the behaviour to replicate)

### UI (`app/flashcards.tsx`)
Three tabs: **Cards**, **Settings**, **Usage**. Starts on Settings if the deck is empty.

**Settings**
- "Your Dutch words" box takes **new words only**, one word or phrase per line.
- **Saved words** are read-only **pills** above it. Each pill has an `×`; clicking it opens a confirm dialog
  ("Remove *word*? Its flashcard will be deleted."). Confirming removes the word and its card immediately.
- "Save & refresh cards" merges the draft into the saved list (trim, collapse whitespace, drop blanks, dedupe
  case-insensitively), clears the box, rebuilds the deck (shuffled if "Shuffle order" is on), resets to card 1 and
  switches to Cards. "Clear new" only clears the unsaved draft. Live word count includes the draft.
- Optional **Access code** field (only if the server has `ACCESS_CODE`): Unlock / Lock.
- **Card back** radio: *English description* or *Dutch description (groep 7/8)*. Persisted.

**Cards**
- Progress (`3 / 40` + bar). Front: the word (smaller for long phrases), tag "Nederlands", hint text.
  Tap / Enter / Space flips; Prev / Next buttons; ← → keys (ignored while typing).
- On first flip the back loads from `/api/insight` (spinner, error state with **Try again**, **Open Settings** on 401).
  Flipping back never refetches. A request-id guard stops a stale response rendering on another card.
- **English back** (insight): best translation, "also:" alternatives, chips (POS with article, forms, 🔊 pronunciation),
  "In use" (2 examples with translations), "Good to know" (notes), "Related" (2–4 pairs).
- **Dutch back** (description): teacher's explanation (`uitleg`, 2–4 sentences, all Dutch), then a **Grammatica**
  section: one line per key word (max 5) with the word, its word class and details (de/het, tense, form), all in Dutch.

**Usage tab**: calls, input/output tokens, estimated cost, per-model table, errors, Reset. Totals live in `localStorage`.

### API
- `POST /api/insight` body `{ entry: string (1–200, trimmed), lang: "en" | "nl" }`.
  Here `lang` means the **card-back language** (`nl` = Dutch explanation), not the language being learned. Returns the
  insight or the Dutch description; usage and estimated cost in the `x-llm-usage` response header.
- Rate limit per IP (best-effort, in memory), optional access code via HttpOnly HMAC cookie `nl_session`
  (`/api/session` GET/POST/DELETE), HSTS, 400/401/429/500/502 error shapes. All unchanged by this work.

### LLM
- Vercel AI SDK `generateText` + `Output.object({ schema })`, provider `anthropic` (default `claude-haiku-5-5`) or
  `openai`, one retry on invalid structured output, thinking disabled/minimal.
- Two calls: **insight** (English system prompt, 800 max output tokens) and **description** (native-language teacher
  prompt, 700 max output tokens).

### Storage (all `localStorage`, via `lib/storage.ts`, wrapped in try/catch)
`nl.raw` (saved words, newline-joined), `nl.shuffle`, `nl.deck`, `nl.index`, `nl.insights`, `nl.descriptions`,
`nl.backLang`, `nl.usage`. Insight and description caches are keyed by the **lowercased word**.

---

## 2. Language config

Everything language-specific lives in one typed object. A language cannot compile with a missing field.

```ts
// lib/languages/types.ts
export type LanguageConfig = {
  code: "nl" | "de" | "fr" | "it";          // also the storage-key prefix and the html lang of word text
  name: string;                              // English: "German"
  endonym: string;                           // "Deutsch"
  themeColor: string;                        // accent; see table below
  caseSensitiveKeys: boolean;                // dedupe + cache key; true only for German
  ui: {
    headerTitle: [string, string];           // ["Deutsch", "Karteikarten"] -> "Deutsch <span>Karteikarten</span>"
    frontTag: string;                        // "Deutsch"
    backTagNative: string;                   // "Erklärung" (Dutch: "Uitleg")
    hintNative: string;                      // shown on the front in native-description mode
    grammarHeading: string;                  // "Grammatik" (Dutch: "Grammatica")
    nativeRadioLabel: string;                // "German description (Klasse 5/6)"
    placeholderWords: string[];              // 5 example entries for the empty textarea
    manifestShortName: string;
  };
  prompts: {
    insightSystem: string;                   // English tutor prompt, built from the template in section 4
    descriptionSystem: string;               // native-language teacher prompt (section 5)
    insightUser: (entry: string) => string;
    descriptionUser: (entry: string) => string;
  };
};
```

Dutch becomes `lib/languages/nl.ts` with its **current strings verbatim**. `lib/languages/index.ts` exports
`LANG = CONFIGS[process.env.NEXT_PUBLIC_LANG ?? "nl"]` and throws at build time on an unknown code.

### Per-language values

| | nl (today) | de | fr | it |
| --- | --- | --- | --- | --- |
| `name` / `endonym` | Dutch / Nederlands | German / Deutsch | French / Français | Italian / Italiano |
| header | Nederlands *kaartjes* | Deutsch *Karteikarten* | Français *cartes* | Italiano *carte* |
| `backTagNative` | Uitleg | Erklärung | Explication | Spiegazione |
| `grammarHeading` | Grammatica | Grammatik | Grammaire | Grammatica |
| teacher persona | groep 7/8 | Klasse 5/6 | CM2 / 6e | quinta elementare / prima media |
| `nativeRadioLabel` | Dutch description (groep 7/8) | German description (Klasse 5/6) | French description (CM2/6e) | Italian description (quinta/prima media) |
| `hintNative` | Probeer het uit te leggen, tik dan om te draaien | Versuch es zu erklären, dann tippe zum Umdrehen | Essaie de l'expliquer, puis touche pour retourner | Prova a spiegarlo, poi tocca per girare |
| `themeColor` | `#e8590c` (orange) | `#b8860b` (gold) | `#1d4ed8` (blue) | `#15803d` (green) |
| `caseSensitiveKeys` | false | **true** | false | false |

All four target the same learner age (10–12). The grade label is only the local flavour. Wording and colours are
easy to change in the config. `themeColor` feeds `--accent` / the manifest / `viewport.themeColor`. Dark-mode
`--accent` should be a lighter tint of the same hue.

Placeholder words (`placeholderWords`):
- **de**: `gemütlich`, `sich auskennen`, `der Feierabend`, `das Mädchen`, `ich verstehe nur Bahnhof`
- **fr**: `dépaysement`, `s'en sortir`, `la fourchette`, `avoir le cafard`, `c'est la fin des haricots`
- **it**: `meno male`, `cavarsela`, `la forchetta`, `in bocca al lupo`, `avere le mani in pasta`

---

## 3. Schema (language-neutral)

The Dutch schemas leak Dutch into field names (`examples[].nl`, `uitleg`, `grammatica`). Rename to neutral names so
all languages share one schema. The model's structured output uses these names.

```ts
insightSchema = {
  english: string[];                          // [best translation, ...up to 2 alternatives]   (unchanged)
  pos: string;                                // unchanged
  forms: string;                              // unchanged
  pronunciation: string;                      // unchanged
  examples: { text: string; en: string }[];   // exactly 2.   was { nl, en }
  notes: string;                              // unchanged
  related: { text: string; en: string }[];    // 2-4.         was { nl, en }
}

descriptionSchema = {
  explanation: string;                        // was uitleg
  grammar: { word: string; kind: string; details: string }[];   // 1-5. was grammatica {woord, soort, details}
}
```

**Migration (required, Dutch must not regress):** existing Dutch caches in `nl.insights` / `nl.descriptions` use the
old names. On hydrate, map old to new in one `migrateCaches()` step in `lib/storage.ts` (`nl`→`text`, `uitleg`→
`explanation`, `grammatica`→`grammar`, `woord`→`word`, `soort`→`kind`) and write back. Descriptions cached before
`grammar` existed simply have no grammar section until retried (current behaviour).

## 4. Insight prompt (English tutor), built from a template

```
You are a concise {name} tutor helping an English speaker learn {name}.
For a single word, give the translation, grammar info and usage.
For a full phrase, sentence or idiom, translate it naturally, explain the idiom (including its literal meaning),
and in `notes` break down the key words.
Field rules:
- english: best natural translation first, then up to 2 genuinely distinct alternatives.
- pos: {posRule}
- forms: {formsRule} Short. Empty string if not useful.
- pronunciation: short respelling hint only for tricky sounds ({trickySounds}); otherwise empty string.
- examples: exactly 2 everyday, short {name} sentences using the entry, each with an English translation.
- notes: 2-4 sentences on nuance, register{registerNote}, common mistakes, false friends, literal meaning for idioms,
  a memory hook if it genuinely helps.
- related: 2-4 related words or common collocations with meanings.
Keep everything compact.
```

User message: `The learner pasted this {name} word or phrase: "{entry}"`. Max output tokens: 800.

| Slot | nl (verbatim today) | de | fr | it |
| --- | --- | --- | --- | --- |
| `posRule` | part of speech; nouns include the article, e.g. "noun · de" or "noun · het"; "idiom"/"phrase" for those | part of speech; nouns include the article and gender, e.g. "noun · der", "noun · die", "noun · das"; "idiom"/"phrase" for those | part of speech; nouns include gender and article, e.g. "noun · masc. (le)", "noun · fem. (la)"; "idiom"/"phrase" for those | part of speech; nouns include gender and article, e.g. "noun · masc. (il)", "noun · fem. (la)" (note lo/l'/gli where needed); "idiom"/"phrase" for those |
| `formsRule` | noun plural and diminutive; verb infinitive, past singular and past participle (mark separable verbs); adjective comparative | noun plural (and genitive singular if irregular); verb infinitive, 3rd-person present if it has a stem change, Präteritum, Partizip II with its auxiliary (hat/ist) (mark separable and reflexive verbs); adjective comparative and superlative (with umlaut if any) | noun plural if irregular and the feminine form if one exists; verb infinitive, group, passé composé with auxiliary (avoir/être) (mark pronominal verbs); adjective feminine and plural forms | noun plural (flag irregular plurals) and gender-changing forms; verb infinitive, presente, passato prossimo with auxiliary (avere/essere) (mark irregular and reflexive verbs); adjective -o/-a/-i/-e forms |
| `trickySounds` | ui, g, ij, eu | ch, ö, ü, ei/ie, sp/st, ß, final devoicing | nasal vowels, silent letters, liaison, r, u vs ou, -ill- | double consonants, gli, gn, sc, c/g before e/i, stress |
| `registerNote` | *(none today)* | `, du vs Sie` | `, tu vs vous` | `, tu vs Lei` |

## 5. Native-language teacher prompt (explanation + grammar)

Written in the target language, like the Dutch one. Same eight rules, same 2–4 sentence explanation, then the
grammar rule. User message wraps the entry (Dutch today: `Leg dit woord of deze uitdrukking uit voor een kind van
groep 7/8: "{entry}"`). Max output tokens: 700.

The Dutch prompt is the source of truth and stays verbatim in `nl.ts`. New languages:

**German (`de`)**
```
Du bist Lehrerin oder Lehrer in Klasse 5/6 einer Schule in Deutschland (Kinder von 10 bis 12 Jahren).
Erkläre das deutsche Wort oder den Ausdruck so, wie du es einem Kind im Unterricht erklären würdest.
Regeln:
- Schreibe nur auf Deutsch. Kein Englisch, keine Übersetzung.
- Benutze kurze Sätze und einfache, bekannte Wörter. Vermeide schwierige Wörter; wenn du doch eins brauchst, erkläre es sofort.
- Sag, was das Wort bedeutet. Wenn es hilft, nimm einen Vergleich oder ein Beispiel aus dem Alltag eines Kindes (Schule, Zuhause, Sport, Freunde).
- Bei einem Ausdruck erkläre, was er wirklich bedeutet und was man wörtlich damit meinen würde.
- Benutze das Wort nicht, um sich selbst zu erklären.
- Die Erklärung hat 2 bis 4 kurze Sätze, als zusammenhängender Text ohne Aufzählungszeichen, Überschriften oder Anrede.
- Der Ton darf freundlich sein, aber nicht kindisch.
- Fülle auch `grammar` aus: für jedes wichtige Wort des Wortes oder Ausdrucks (höchstens 5, Artikel und kleine Bindewörter weglassen) eine Zeile.
  - word: das Wort so, wie es in der Eingabe steht.
  - kind: die Wortart auf Deutsch: „Nomen“, „Verb“, „Adjektiv“, „Adverb“, „Präposition“ usw.
  - details: bei einem Nomen „der“, „die“ oder „das“ und wenn nötig die Mehrzahl; bei einem Verb die Zeitform (Präsens, Präteritum, Perfekt, Partizip II), die Grundform und ob es trennbar ist; bei einem Adjektiv die Steigerungsstufe oder die Form; sonst ein leerer Text.
  - Schreibe auch hier nur Deutsch, kurz und in einfacher Sprache.
```

**French (`fr`)**
```
Tu es maître ou maîtresse d'école en CM2 ou en 6e (des enfants de 10 à 12 ans).
Explique le mot ou l'expression en français comme tu le ferais à un enfant en classe.
Règles :
- Écris uniquement en français. Pas d'anglais, pas de traduction.
- Utilise des phrases courtes et des mots simples et connus. Évite les mots difficiles ; si tu en utilises un, explique-le tout de suite.
- Dis ce que le mot veut dire. Quand cela aide, utilise une comparaison ou un exemple de la vie d'un enfant (école, maison, sport, amis).
- Pour une expression, explique ce qu'elle veut vraiment dire, et ce que l'on voudrait dire en la prenant au pied de la lettre.
- N'utilise pas le mot pour s'expliquer lui-même.
- L'explication fait de 2 à 4 phrases courtes, en un seul texte, sans puces, sans titre et sans formule d'introduction.
- Le ton peut être amical, mais pas enfantin.
- Remplis aussi `grammar` : une ligne pour chaque mot important (5 au maximum, sans les articles ni les petits mots de liaison).
  - word : le mot tel qu'il apparaît dans l'entrée.
  - kind : la classe du mot en français : « nom », « verbe », « adjectif », « adverbe », « préposition », etc.
  - details : pour un nom, « masculin » ou « féminin » (le, la, l') et le pluriel s'il est particulier ; pour un verbe, le temps (présent, imparfait, passé composé, futur…), l'infinitif, le groupe et l'auxiliaire ; pour un adjectif, l'accord (féminin, pluriel) ou le degré ; sinon un texte vide.
  - Écris aussi ici uniquement en français, court et en langage simple.
```

**Italian (`it`)**
```
Sei un maestro o una maestra di quinta elementare o di prima media (bambini da 10 a 12 anni).
Spiega la parola o l'espressione italiana come la spiegheresti a un bambino in classe.
Regole:
- Scrivi solo in italiano. Niente inglese, niente traduzione.
- Usa frasi brevi e parole semplici e conosciute. Evita le parole difficili; se ne usi una, spiegala subito.
- Di' che cosa significa la parola. Quando aiuta, usa un paragone o un esempio della vita di un bambino (scuola, casa, sport, amici).
- Per un'espressione, spiega che cosa vuol dire davvero e che cosa vorrebbe dire presa alla lettera.
- Non usare la parola per spiegare se stessa.
- La spiegazione è di 2-4 frasi brevi, in un unico testo, senza elenchi puntati, titoli o saluti.
- Il tono può essere cordiale, ma non infantile.
- Compila anche `grammar`: una riga per ogni parola importante (al massimo 5, senza articoli e piccole parole di collegamento).
  - word: la parola come appare nell'input.
  - kind: la categoria grammaticale in italiano: «nome», «verbo», «aggettivo», «avverbio», «preposizione», ecc.
  - details: per un nome «maschile» o «femminile», l'articolo (il, lo, la, l') e il plurale se è particolare; per un verbo il tempo (presente, imperfetto, passato prossimo, futuro…), l'infinito, la coniugazione (-are, -ere, -ire) e l'ausiliare (essere o avere); per un aggettivo l'accordo o il grado; altrimenti un testo vuoto.
  - Scrivi anche qui solo in italiano, breve e con parole semplici.
```

## 6. Language-specific behaviour that is not just text

1. **German case sensitivity.** German nouns are capitalised and some differ from verbs/adjectives only by case
   (`Essen`/`essen`, `Leben`/`leben`, `Arm`/`arm`). With `caseSensitiveKeys: true`, `parseWords` dedupes and the
   insight/description caches key on the **exact** entry. Other languages keep lowercase keys. Changing this must not
   alter Dutch keys.
2. **Unicode.** `parseWords` and cache keys normalise to **NFC** first (ü, é, è, à composed vs decomposed from
   different keyboards and paste sources), and typographic apostrophes `’ ‘` become `'` (so `l’eau` = `l'eau`,
   `s’en sortir` = `s'en sortir`). Applies to all languages including Dutch (harmless there).
3. **`lang` attribute.** Words in the DOM (front word, back title, pills, example sentences, grammar words) carry
   `lang={LANG.code}`, for screen readers and correct hyphenation. `<html lang="en">` stays (UI is English).
4. **Card-back selector.** Today's API field `lang: "en" | "nl"` means card-back language. Rename it to
   `back: "en" | "native"` (client state `backLang` → `backMode`, same persisted values mapped `nl`→`native`). The
   server accepts the legacy `lang: "nl"` as `native` for one release so an already-installed PWA with an old client
   keeps working (the service worker caches the shell, not `/api/*`).
5. **Fonts.** Fraunces and Inter already cover ä ö ü ß é è ê ç à ì ò ù. No change.

## 7. Everything that must be parameterised (grep checklist)

Replace hard-coded Dutch with `LANG.*`. Find them with `rg -i "dutch|nederlands|uitleg|grammatica|kaartjes|groep"`:
- `app/flashcards.tsx`: header, front tag, hint strings, back tag, Grammatica heading, radio label, textarea
  placeholder, "Your Dutch words" label, empty-state copy ("Paste some Dutch words…"), `EnglishBody` (`x.nl`→`x.text`,
  `r.nl`→`r.text`).
- `app/layout.tsx`, `app/manifest.ts`: title, description, application name, apple title, short name, `themeColor`.
- `app/globals.css`: `--accent` and its dark variant from `LANG.themeColor`.
- `lib/schema.ts`, `lib/llm.ts`, `lib/insight-client.ts`, `app/api/insight/route.ts`: neutral schemas, config-driven
  prompts, `back` field.
- `lib/storage.ts`: `KEYS` built from `LANG.code`, plus `migrateCaches()` for `nl`.
- `lib/guard.ts`: cookie name `nl_session` and the HMAC label stay as they are for Dutch. Other deployments may reuse the
  names (separate origins), so no change needed. Don't rename (it would sign every Dutch user out).
- `public/sw.js` cache name and `app/pwa.tsx` `nl_install_dismissed`: harmless per origin; leave.
- `README.md`: language section, per-language deploy steps.

## 8. Deployment

Per language, in Vercel:
1. New project from the same repo, framework preset Next.js, no overrides.
2. Env: `NEXT_PUBLIC_LANG=de|fr|it` (**build-time**, so redeploy after changing), the provider key, optional
   `ACCESS_CODE`, optional `LLM_MODEL`. The Dutch project needs nothing new (default `nl`).
3. Each language shows its own cost on its own Usage tab (per origin). Use separate provider keys or budgets per project
   if you want separate spend caps.

Icons: v1 reuses the Dutch icon set. Home-screen icons then look identical across languages, but the app
short name distinguishes them. **v1.1:** per-language recoloured icons (script that renders the existing icon
with `themeColor`).

## 9. Build order (smallest slices, ship each)

1. **Refactor Dutch behind the config, zero behaviour change.** Add `LanguageConfig` + `nl.ts` with today's strings
   verbatim, neutral schema names, `back` rename (legacy `lang` accepted), `migrateCaches()`, NFC/apostrophe
   normalisation, `lang` attributes. *Done when:* Dutch looks and behaves identically, existing `nl.*` caches still
   render, and a test asserts the generated Dutch prompts equal today's prompt strings.
2. **German.** `de.ts`, `caseSensitiveKeys`, theme. Deploy as a second Vercel project. Run the golden list below.
3. **French.** `fr.ts`. Golden list.
4. **Italian.** `it.ts`. Golden list.
5. README (config reference, "add a language" steps, per-language deploy) and v1.1 icons.

Add a tiny test runner (Vitest) only for pure logic: `parseWords` (NFC, apostrophes, case rules per language), config
completeness (every language fills every field), `migrateCaches`, and the Dutch-prompt snapshot. No UI tests.

## 10. Acceptance criteria

- `NEXT_PUBLIC_LANG` unset → the app is the Dutch app, unchanged; existing Dutch users keep their words, deck
  position and caches (including old-format ones). `pnpm lint`, `pnpm build` and the unit tests pass.
- With `NEXT_PUBLIC_LANG=de|fr|it` every string a user sees about the target language (header, front tag, hints,
  placeholder, radio label, back tag, grammar heading, prompts) is that language's, with no Dutch left. Grep checklist
  (section 7) returns no `nl`-only strings outside `nl.ts` and the `nl` migration.
- Settings pills, delete dialog, Save/Clear, Usage tab, access code, rate limit, caching and offline shell behave exactly as in
  Dutch.
- Insight (English back) and description (native back) validate against the shared schemas; Grammar has 1–5 rows,
  all in the target language; no English in the native description.
- German: `Essen` and `essen` can be saved as two separate cards with separate cached results.
- Language-correctness spot checks (manual, once per language; the model is the source of grammar truth, so this is
  the real test). Each must come out right on the English back **and** the grammar section of the native back:

  | | Entries to check |
  | --- | --- |
  | de | `das Mädchen` (neuter despite -chen), `der See` vs `die See`, `aufstehen` (separable, ist aufgestanden), `ich verstehe nur Bahnhof` (idiom, not a word-by-word gloss) |
  | fr | `le problème` (masculine despite -e), `la main`, `se souvenir` (pronominal, être), `avoir le cafard` (idiom) |
  | it | `il problema` (masculine despite -a), `la mano` (feminine despite -o, irregular plural `le mani`), `andare` (essere), `in bocca al lupo` (idiom) |

## 11. Open questions (defaults chosen, change if you disagree)

- Header words (`Karteikarten`, `cartes`, `carte`) and teacher grade labels are my picks; trivial to change in config.
- One Vercel project per language (chosen) vs one multi-language app. See the decision above.
- Should German show the genitive singular for strong nouns? Default: only if irregular, to keep `forms` short.
