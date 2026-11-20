import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

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

export const SESSION_COOKIE = "nl_session";
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30;

const safeEqual = (x: string, y: string) => {
  const a = Buffer.from(x);
  const b = Buffer.from(y);
  return a.length === b.length && timingSafeEqual(a, b);
};

/** True when ACCESS_CODE is set, i.e. the API is protected. */
export const accessRequired = () => !!process.env.ACCESS_CODE;

/** Constant-time check of a typed access code. */
export function codeMatches(given: string): boolean {
  const expected = process.env.ACCESS_CODE;
  return !!expected && safeEqual(given, expected);
}

/**
 * Cookie value proving the code was entered. It is an HMAC keyed by the code, so the cookie never contains
 * the code itself, and changing ACCESS_CODE invalidates every existing session.
 */
export function sessionToken(): string {
  return createHmac("sha256", process.env.ACCESS_CODE ?? "").update("dutch-recall-session-v1").digest("hex");
}

function readCookie(req: Request, name: string): string {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return "";
}

/** Set-Cookie header value. HttpOnly keeps it from scripts; Secure (production) keeps it off plain HTTP. */
export function sessionCookie(value: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Strict${secure}`;
}

/** True when no ACCESS_CODE is configured, or the request carries a valid session cookie. */
export function accessAllowed(req: Request): boolean {
  if (!accessRequired()) return true;
  return safeEqual(readCookie(req, SESSION_COOKIE), sessionToken());
}

/** Test helper. */
export function _resetRateLimit() {
  hits.clear();
  lastSweep = 0;
}
