import { z } from "zod";
import { accessAllowed, clientIp, rateLimit } from "@/lib/guard";
import { ConfigError, UpstreamError, generateDescription, generateInsight } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 30;

// `back` picks the card-back mode. `lang: "nl"` is the legacy spelling of `back: "native"`, accepted so an
// already-installed PWA with an old client keeps working. The language being taught comes from server config only.
const bodySchema = z
  .object({
    entry: z.string().trim().min(1).max(200),
    back: z.enum(["en", "native"]).optional(),
    lang: z.enum(["en", "nl"]).optional(),
  })
  .transform(({ entry, back, lang }) => ({ entry, back: back ?? (lang === "nl" ? "native" : "en") }));

const json = (body: unknown, status: number, headers?: Record<string, string>) =>
  Response.json(body, { status, headers });

export async function POST(req: Request) {
  // Rate limit first so wrong-code guessing is throttled too.
  const wait = rateLimit(clientIp(req));
  if (wait !== null) {
    return json({ error: "Too many requests. Wait a moment, then try again." }, 429, { "retry-after": String(wait) });
  }
  if (!accessAllowed(req)) return json({ error: "Access code missing or incorrect." }, 401);

  let parsed;
  try {
    parsed = bodySchema.safeParse(await req.json());
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!parsed.success) return json({ error: "entry must be 1-200 characters" }, 400);

  try {
    const { insight, usage } = await (parsed.data.back === "native" ? generateDescription : generateInsight)(parsed.data.entry);
    console.log("insight usage", JSON.stringify(usage));
    return json(insight, 200, { "x-llm-usage": JSON.stringify(usage) });
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error("config error:", err.message);
      return json({ error: "The server is not configured for insights. Check its environment variables." }, 500);
    }
    if (err instanceof UpstreamError) {
      return json(
        { error: err.status === 429 ? "The model is rate limited. Try again shortly." : "Could not generate an insight. Try again." },
        err.status,
      );
    }
    console.error("unexpected error", (err as Error)?.name);
    return json({ error: "Unexpected server error" }, 502);
  }
}
