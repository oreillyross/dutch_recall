import "server-only";
import { timingSafeEqual } from "node:crypto";

const WINDOW_MS = 60_000;
const DEFAULT_LIMIT = 30;

// In-memory, per server instance. Serverless instances don't share memory,
// so this is best-effort protection against runaway spend, not a hard guarantee.
const hits = new Map<string, number[]>();
let lastSweep = 0;

function limit(): number {
  const n = Number(process.env.RATE_LIMIT_PER_MIN);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_LIMIT;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("x-real-ip") || "unknown";
}

/** Sliding window. Returns seconds to wait when over the limit, else null. */
export function rateLimit(ip: string, now = Date.now()): number | null {
  if (now - lastSweep > WINDOW_MS) {
    lastSweep = now;
    for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  }
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit()) {
    hits.set(ip, recent);
    return Math.max(1, Math.ceil((recent[0] + WINDOW_MS - now) / 1000));
  }
  recent.push(now);
  hits.set(ip, recent);
  return null;
}

/** True when no ACCESS_CODE is configured, or the request header matches it. */
export function accessAllowed(req: Request): boolean {
  const expected = process.env.ACCESS_CODE;
  if (!expected) return true;
  const given = req.headers.get("x-access-code") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Test helper. */
export function _resetRateLimit() {
  hits.clear();
  lastSweep = 0;
}
