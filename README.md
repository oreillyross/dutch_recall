# Langcards

Paste Dutch words and phrases, flip the cards, and get an LLM-written explanation of each one: English
translation, grammar, pronunciation hints, examples, notes and related words. Next.js (App Router) on
Vercel, with the model call made server-side so your API key never reaches the browser.

- **No accounts, no database.** The word list, deck position and cached insights live in the browser's `localStorage`.
- **Insights are cached per word**, so each card costs one LLM call, once.
- **Usage tab** shows calls, tokens and estimated cost for this browser.

## Run locally

```bash
pnpm install
cp .env.example .env.local   # then add ANTHROPIC_API_KEY
pnpm dev
```

Open http://localhost:3000, paste a few words in **Settings**, save, and flip a card.

```bash
pnpm lint
pnpm build
```

## Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `LLM_PROVIDER` | no | `anthropic` | `anthropic` or `openai` |
| `LLM_MODEL` | no | per provider (below) | Override the model id |
| `ANTHROPIC_API_KEY` | if provider is `anthropic` | none | Anthropic key |
| `OPENAI_API_KEY` | if provider is `openai` | none | OpenAI key |
| `ACCESS_CODE` | no, recommended on a public URL | unset (open) | Shared secret, exchanged once for a session cookie |
| `RATE_LIMIT_PER_MIN` | no | `30` | Max requests per IP per minute |

Only the selected provider's key is needed. A missing key makes the card show a generic "server is not
configured" error (the specific reason is in the server log, never in the response).

## Switching provider or model

No code changes: set env vars and restart (or redeploy).

```bash
# OpenAI instead of Anthropic
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...

# A different model on the current provider
LLM_MODEL=claude-sonnet-5-5
```

Defaults live in `lib/models.ts`, checked against each provider's docs on 2026-11-19:

| Provider | Default model | Price per 1M tokens (in / out) |
| --- | --- | --- |
| Anthropic | `claude-haiku-5-5` | $0.10 / $0.50 |
| OpenAI | `gpt-6-luna` | $0.10 / $0.50 |

Model ids and prices change. When you change the default (or set `LLM_MODEL` to a model that isn't in the
`PRICING_PER_MTOK` table in `lib/models.ts`), update that table too, otherwise the Usage tab reports cost as
"partial" for that model.

Notes on model parameters:

- Claude Haiku 5.5 and OpenAI reasoning models (`gpt-5` and later) reject a non-default `temperature`, so none
  is sent for them. A `temperature` of 0.3 is only sent for non-reasoning OpenAI models.
- Thinking is turned off (Anthropic) or set to the lowest effort (OpenAI) so the 800-token output cap goes to
  the answer instead of to reasoning.

## Protecting a public deployment

Anyone with the URL can otherwise spend your API key. Two guardrails are built in:

- **Access code.** Set `ACCESS_CODE` and `/api/insight` returns 401 without a valid session. Each user types the
  code once under **Settings > Access code**; the server checks it (constant-time) and replies with an
  `HttpOnly; SameSite=Strict; Secure` cookie holding an HMAC of the code, not the code. The code is never stored in
  the browser and page scripts cannot read the cookie. Sessions last 30 days; **Lock** clears it, and changing
  `ACCESS_CODE` invalidates every session. Use a long random value. HTTPS is what protects the code in transit
  (Vercel enforces it, and the app sends an HSTS header); over plain `http://` the code travels in cleartext.
- **Rate limit.** In-memory, per IP, 30 requests a minute by default, 429 with `retry-after` beyond that.
  Failed access-code attempts count, so guessing is throttled.

Limits of the rate limit, stated plainly:

- **It is best-effort.** Serverless instances don't share memory, so each instance counts separately and an
  instance restart resets it. There is no Redis on purpose. Treat it as protection against a runaway client,
  not a hard cap.
- **It trusts `x-forwarded-for`.** On Vercel the platform sets that header. Behind a proxy that doesn't, a
  client could spoof it to dodge the limit. The access code is the real guard.
- Independently, input is capped at 200 characters and output at 800 tokens per request.

For a hard spending cap, also set a budget or usage limit in your Anthropic or OpenAI account.

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, **Add New > Project** and import the repo. The Next.js preset needs no overrides
   (install: `pnpm install`, build: `pnpm build`).
3. Under **Settings > Environment Variables**, add the provider key (`ANTHROPIC_API_KEY` or
   `OPENAI_API_KEY` with `LLM_PROVIDER=openai`) and, recommended, `ACCESS_CODE`. Add these for Production
   (and Preview if you use it). Never commit real keys: `.env` and `.env.local` are git-ignored; `.env.example` is the only env file meant to be committed.
4. Deploy. After changing an env var, redeploy so it takes effect.
5. Open the site, unlock with the access code in **Settings**, paste some words and flip a card.

The API route runs on the Node.js runtime with a 30-second limit (`maxDuration`), which is enough for a
single small-model call.

## How it works

```
app/page.tsx, app/flashcards.tsx   client UI: tabs, deck, flip card, settings, usage
app/api/insight/route.ts           POST /api/insight: rate limit, session check, validation, LLM call
app/api/session/route.ts           GET/POST/DELETE: check, unlock (set cookie), lock
lib/llm.ts                         provider selection and structured-output call (Vercel AI SDK)
lib/models.ts                      default models, price table, reasoning-model helpers
lib/schema.ts                      Zod insight schema (shared by server and client)
lib/guard.ts                       access code, session cookie and rate limit
lib/storage.ts                     safe localStorage helpers
reference/dutch-flashcards.html    original single-file prototype
```

`POST /api/insight` takes `{ "entry": string }` (trimmed, 1-200 characters) and returns the insight object.
Errors are `{ "error": string }` with 400, 401, 429, 500 or 502. Token usage and an estimated cost for the
call come back in an `x-llm-usage` response header, which the Usage tab accumulates in `localStorage`.

If the model's output doesn't match the schema, the call is retried once, then returns 502.

## Limitations

- Word lists and caches are per browser and per device. Clearing site data clears them.
- No spaced repetition, audio or sync (out of scope for v1).
- Cost figures are estimates from list prices, not your invoice.
