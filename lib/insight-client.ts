import { descriptionSchema, insightSchema, type BackMode, type Description, type Insight } from "./schema";
import type { z } from "zod";
import type { LanguageCode } from "./languages";
import type { Usage } from "./usage";

export class InsightError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

export const fetchInsight = (entry: string, target: LanguageCode) => request(entry, target, "en", insightSchema);

export const fetchDescription = (entry: string, target: LanguageCode) => request(entry, target, "native", descriptionSchema);

export type { Description, Insight };

async function request<T>(
  entry: string,
  target: LanguageCode,
  back: BackMode,
  schema: z.ZodType<T>,
): Promise<{ insight: T; usage: Usage | null }> {
  let res: Response;
  try {
    res = await fetch("/api/insight", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin", // sends the HttpOnly session cookie
      body: JSON.stringify({ entry, target, back }),
    });
  } catch {
    throw new InsightError("Network error. Check your connection and try again.");
  }
  const body: unknown = await res.json().catch(() => null);
  if (res.status === 401) {
    throw new InsightError("This site needs an access code. Unlock it in Settings.", 401);
  }
  if (!res.ok) {
    const msg = (body as { error?: string } | null)?.error;
    throw new InsightError(msg || "Could not load the insight. Try again.", res.status);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new InsightError("The server returned an unexpected response.");
  let usage: Usage | null = null;
  try {
    usage = JSON.parse(res.headers.get("x-llm-usage") ?? "null");
  } catch {
    usage = null;
  }
  return { insight: parsed.data, usage };
}
