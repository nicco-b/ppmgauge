// Hono middleware for the session/auth layer.
//   sessionMiddleware — resolves the user ONCE per request and stashes it on
//     c.var.user (null when signed-out). Mounted on the /auth and /api groups so
//     handlers read c.var.user instead of calling getUser themselves.
//   requireUser  — 401 unless a session user is present.
//   requireAdmin — 403 unless the request is from an admin (session email OR the
//     INGEST_TOKEN bearer, so bulk loads can run from a script).
import type { MiddlewareHandler } from "hono";
import type { Env } from "../types";
import { getUser, type User } from "../auth";

// Shared Hono generic: bindings + the per-request `user` variable.
export type AppEnv = { Bindings: Env; Variables: { user: User | null } };

export function bearerToken(req: Request): string | null {
  const m = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

// Admins come from the ADMIN_EMAIL var (wrangler.jsonc): a comma-separated list of
// email addresses. If the var is unset, no session-based admin exists (the
// INGEST_TOKEN bearer path below still works).
export function adminEmails(env: Env): Set<string> {
  const list = String(env.ADMIN_EMAIL || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return new Set(list);
}
export function isAdmin(req: Request, env: Env, user: { email?: string } | null): boolean {
  if (env.INGEST_TOKEN && bearerToken(req) === env.INGEST_TOKEN) return true;
  const email = user?.email?.toLowerCase();
  return !!email && adminEmails(env).has(email);
}

export const sessionMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set("user", await getUser(c.req.raw, c.env));
  await next();
};

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.var.user) return c.json({ error: "unauthorized" }, 401);
  await next();
};

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!isAdmin(c.req.raw, c.env, c.var.user)) return c.json({ error: "forbidden" }, 403);
  await next();
};
