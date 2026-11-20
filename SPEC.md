# Dutch Flashcards — Spec (Next.js on Vercel)

## Goal
Port the single-file reference implementation (`dutch-flashcards.html`, in this repo's root or `/reference`) to a self-hosted Next.js app deployable on Vercel. Same UX and features. The only structural change: the "insight" call goes to an LLM through a **server-side API route** using an Anthropic or OpenAI key from env vars, defaulting to the cheapest model.

Read `dutch-flashcards.html` first. Match its behaviour and look (Fraunces + Inter, warm light/dark theme, 3D flip card, dark back face). Reuse its CSS where practical.

## Non-goals (v1)
- No accounts, no database, no spaced repetition, no audio/TTS, no PWA.
- No multi-user sync. Word list lives in the browser's `localStorage`.
- No streaming of insight responses.

## Stack (my calls, change if there's a good reason)
- Next.js App Router, TypeScript strict, pnpm, Tailwind optional (plain CSS modules or the reference CSS is fine).
- Vercel AI SDK (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`) for provider switching + structured output with a Zod schema. Check current docs for the right structured-output call (`generateObject` vs `generateText` with output schema) before coding.
  - in the settings include a monitoring of token usage and where possible the estimated cost so user can track what this costs, like an observability layer.
- Zod for the insight schema and request validation.

## Features (parity with the reference)
1. **Two tabs: Cards and Settings.** Starts on Settings if the deck is empty.
2. **Settings:** textarea, one Dutch word/phrase per line. Trim, collapse whitespace, drop blanks, dedupe case-insensitively. Live word count. "Shuffle order" checkbox (default on). "Clear" and "Save & refresh cards" buttons. Save rebuilds the deck, resets index to 0, switches to Cards. Add a tab for usage so it shows and collects the telemetry data on the token usage and llm calls each tim updating to show what this costs.
   
4. **Cards:** progress (`3 / 40` + bar), front shows the Dutch word (smaller font for long phrases), tap/Enter/Space flips, Prev/Next buttons, ← → keys, Space flips (ignored while typing in the textarea).
5. **Flip → insight:** on first flip of a card, call `/api/insight`. Show spinner, then the English translation (+ up to 2 alternatives), chips (part of speech with de/het, forms, pronunciation hint), 2 example sentences with translations, "Good to know" notes, 2-4 related words/collocations. Error state with "Try again". Flipping back does not refetch.
6. **Caching:** insights cached per lowercase word in `localStorage` (`nl.insights`); a stale in-flight response must not render on a different card (request id guard, as in the reference). Token usage can also be cached, it just needs to show current usage, being ephemeral is ok, NO database
7. **Persistence:** `nl.raw`, `nl.shuffle`, `nl.deck`, `nl.index`, `nl.insights` in `localStorage`, all access wrapped in try/catch (SSR-safe: read in `useEffect`/client component only).
8. Respect `prefers-color-scheme` and `prefers-reduced-motion`. Keep a11y from the reference (roles, aria-selected, focus rings, aria-live on the back).

## API
`POST /api/insight`
- Body: `{ "entry": string }` — validate with Zod: trimmed, 1-200 chars.
- Auth: if `ACCESS_CODE` env is set, `/api/insight` requires a valid `nl_session` cookie, else 401. The Settings tab has an "Access code" field that POSTs to `/api/session`, which sets an `HttpOnly; Secure; SameSite=Strict` cookie holding an HMAC of the code (never the code itself); nothing is stored in `localStorage`. A Lock button clears it. HSTS is sent on every response. (Without this, anyone with the URL can spend your key.)
- Response 200: the insight object below. Errors: `{ "error": string }` with 400/401/429/502 as appropriate. Never leak the key or raw provider errors.
- Server-only. Keys must never reach the client bundle.

### Insight schema (Zod)
```ts
{
  english: string[];          // [best translation, ...up to 2 distinct alternatives]
  pos: string;                // e.g. "noun · de", "verb", "idiom"
  forms: string;              // plural/diminutive, verb principal parts (mark separable), comparative; "" if n/a
  pronunciation: string;      // only for tricky sounds (ui, g, ij, eu); "" otherwise
  examples: { nl: string; en: string }[];   // exactly 2, short, everyday
  notes: string;              // 2-4 sentences: nuance, register, false friends, literal meaning of idioms, memory hook
  related: { nl: string; en: string }[];    // 2-4 items
}
```

### Prompt
Port `buildPrompt()` from the reference into a system + user message pair. Keep the instructions: concise Dutch tutor for an English speaker; for full phrases/idioms translate naturally, explain the idiom, break down key words in `notes`. Use structured output against the schema; if the SDK path fails to parse, retry once, then return 502.

## Provider config (env vars)
```
LLM_PROVIDER=anthropic        # anthropic | openai  (default: anthropic)
LLM_MODEL=                    # optional override
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
ACCESS_CODE=                  # optional but recommended on a public URL
```
- Default models = cheapest current small model per provider. Anthropic default: `claude-haiku-5-5`. OpenAI default: look up the current cheapest/nano-tier model id in OpenAI's docs at build time and set it as a constant in one `models.ts` file. Do not guess ids from memory; verify both against current docs.
- Fail fast with a clear error if the selected provider's key is missing.
- Keep `temperature` low (~0.3) and `maxOutputTokens` around 800.
- Provide `.env.example`. Do not commit real keys.

## Cost / abuse guardrails (small, v1-appropriate)
- Input length cap (above) and `maxOutputTokens` cap.
- Simple in-memory rate limit per IP (e.g. 30 req/min) is enough; note in the README that serverless instances don't share memory, so it is best-effort. Don't add Redis for this.

## Project layout (suggested)
```
app/
  page.tsx                 # client component: tabs, deck, flashcard UI
  api/insight/route.ts     # POST handler
lib/
  llm.ts                   # provider selection + generate insight
  models.ts                # default model ids
  schema.ts                # Zod schemas
  storage.ts               # safe localStorage helpers
```

## Acceptance criteria
- `pnpm dev` works with only an `ANTHROPIC_API_KEY` set; switching `LLM_PROVIDER=openai` + `OPENAI_API_KEY` works with no code changes.
- Pasting 5 words, saving, flipping each shows a well-formed back; refresh the page and the deck, position and cached insights are still there.
- A phrase like "het is niet mijn pakkie-an" returns an idiom explanation, not a word-by-word gloss only.
- With `ACCESS_CODE` set, requests without the right code get 401 and the UI shows a clear message pointing to Settings.
- Missing key / provider error → UI shows the error state with retry; no stack traces or keys in responses.
- `pnpm build` and `pnpm lint` pass; deploys to Vercel with env vars set in the dashboard.
- README: env vars, how to switch provider/model, deploy steps.

## Build order (smallest slices)
1. Scaffold Next.js + port UI with a stubbed insight (fixed JSON), localStorage persistence.
2. `/api/insight` with Anthropic default, Zod validation, error handling.
3. OpenAI provider switch + `models.ts`.
4. Access code + rate limit.
5. README + Vercel deploy notes.
