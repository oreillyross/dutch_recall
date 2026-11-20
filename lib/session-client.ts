export type SessionState = { required: boolean; unlocked: boolean };

async function call(method: "GET" | "POST" | "DELETE", code?: string): Promise<SessionState> {
  let res: Response;
  try {
    res = await fetch("/api/session", {
      method,
      credentials: "same-origin",
      ...(code !== undefined ? { headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) } : {}),
    });
  } catch {
    throw new Error("Network error. Check your connection and try again.");
  }
  const body = (await res.json().catch(() => null)) as (Partial<SessionState> & { error?: string }) | null;
  if (!res.ok) throw new Error(body?.error || "Could not reach the server. Try again.");
  return { required: !!body?.required, unlocked: !!body?.unlocked };
}

export const getSession = () => call("GET");
/** Exchange the typed code for an HttpOnly cookie. The code itself is never stored in the browser. */
export const unlock = (code: string) => call("POST", code);
export const lock = () => call("DELETE");
