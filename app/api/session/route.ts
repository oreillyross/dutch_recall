import { z } from "zod";
import {
  SESSION_MAX_AGE_S,
  accessAllowed,
  accessRequired,
  clientIp,
  codeMatches,
  rateLimit,
  sessionCookie,
  sessionToken,
} from "@/lib/guard";

export const runtime = "nodejs";

const json = (body: unknown, status = 200, headers?: Record<string, string>) =>
  Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });

/** Is a code required, and does this browser already hold a valid session? */
export async function GET(req: Request) {
  return json({ required: accessRequired(), unlocked: accessAllowed(req) });
}

/** Exchange the access code for an HttpOnly session cookie. */
export async function POST(req: Request) {
  const wait = rateLimit(clientIp(req));
  if (wait !== null) return json({ error: "Too many attempts. Wait a moment, then try again." }, 429, { "retry-after": String(wait) });
  if (!accessRequired()) return json({ required: false, unlocked: true });

  let parsed;
  try {
    parsed = z.object({ code: z.string().max(200) }).safeParse(await req.json());
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!parsed.success) return json({ error: "code is required" }, 400);
  if (!codeMatches(parsed.data.code)) return json({ error: "That access code was not accepted." }, 401);
  return json({ required: true, unlocked: true }, 200, {
    "set-cookie": sessionCookie(sessionToken(), SESSION_MAX_AGE_S),
  });
}

/** Lock: clear the session cookie. */
export async function DELETE() {
  return json({ required: accessRequired(), unlocked: false }, 200, { "set-cookie": sessionCookie("", 0) });
}
