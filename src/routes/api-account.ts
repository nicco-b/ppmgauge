// Account endpoints — profile + per-resource counts, rename, and the
// delete-everything path. Mounted at /api/account (requireUser) in index.ts.
import type { Env } from "../types";
import { json, readBody } from "../lib/http";

export async function accountGet(env: Env, owner: string): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT u.email, u.display_name, u.created_at,
      (SELECT COUNT(*) FROM recipes WHERE owner=u.id) AS recipes,
      (SELECT COUNT(*) FROM beans WHERE owner=u.id) AS beans,
      (SELECT COUNT(*) FROM brews WHERE owner=u.id) AS brews,
      (SELECT COUNT(*) FROM calibrations WHERE owner=u.id) AS calibrations
     FROM users u WHERE u.id=?`).bind(owner).first<any>();
  if (!row) return json({ error: "not found" }, 404);
  return json({
    email: row.email, display_name: row.display_name, created_at: row.created_at,
    counts: { recipes: row.recipes, beans: row.beans, brews: row.brews, calibrations: row.calibrations },
  });
}

export async function accountUpdate(req: Request, env: Env, owner: string): Promise<Response> {
  const b = await readBody(req); // JSON (app fetch) or form-encoded (htmx)
  const name = String(b?.display_name ?? "").slice(0, 80);
  await env.DB.prepare("UPDATE users SET display_name=? WHERE id=?").bind(name || null, owner).run();
  return accountGet(env, owner);
}

export async function accountDelete(env: Env, owner: string): Promise<Response> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM brews WHERE owner=?").bind(owner),
    env.DB.prepare("DELETE FROM beans WHERE owner=?").bind(owner),
    env.DB.prepare("DELETE FROM recipes WHERE owner=?").bind(owner),
    env.DB.prepare("DELETE FROM calibrations WHERE owner=?").bind(owner),
    env.DB.prepare("DELETE FROM readings WHERE owner=?").bind(owner),
    env.DB.prepare("DELETE FROM users WHERE id=?").bind(owner),
  ]);
  // Clear the session cookie; the KV session is now inert (its user row is gone).
  return json({ ok: true }, 200, { "Set-Cookie": "wl_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0" });
}
