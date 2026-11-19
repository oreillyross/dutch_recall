import { insightSchema, type Insight } from "./schema";
import type { Usage } from "./usage";

export class InsightError extends Error {}

export async function fetchInsight(entry: string): Promise<{ insight: Insight; usage: Usage | null }> {
  let res: Response;
  try {
    res = await fetch("/api/insight", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entry }),
    });
  } catch {
    throw new InsightError("Network error. Check your connection and try again.");
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (body as { error?: string } | null)?.error;
    throw new InsightError(msg || "Could not load the insight. Try again.");
  }
  const parsed = insightSchema.safeParse(body);
  if (!parsed.success) throw new InsightError("The server returned an unexpected response.");
  let usage: Usage | null = null;
  try {
    usage = JSON.parse(res.headers.get("x-llm-usage") ?? "null");
  } catch {
    usage = null;
  }
  return { insight: parsed.data, usage };
}
