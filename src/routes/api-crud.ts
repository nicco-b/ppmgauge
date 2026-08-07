// Generic owner-scoped CRUD over the FIELDS whitelist, backing /api/:res (+ the
// /api/drops alias over user_drops). Recipes get a richer lister (favorite
// annotations + the community pool); beans re-resolve their ref_* links on write.
// Mounted by the /api router in index.ts; the FIELDS/SHAREABLE membership gate
// lives there (knownRes middleware) so these helpers assume a known resource.
import type { Env } from "../types";
import { uid, nowISO } from "../db";
import { json, readBody } from "../lib/http";
import { FIELDS, SHAREABLE } from "../lib/resources";
import { resolveBeanLinks } from "../lib/graph";

// Recipes carry favorite annotations the generic lister doesn't: `fav` (does THIS user star it),
// `fav_count` (popularity → ranking signal), and `dn` (owner display name → attribution).
//   ?favorites=1 → recipes this user starred (own or community), most-recently-starred first
//   ?shared=1[&limit=N] → community pool, ranked by saves then recency (the "top" list)
//   (default) → this user's own recipes, newest first
// Fetch annotated recipe rows for a list. `kind`:
//   "mine"      → this user's own recipes, newest first
//   "favorites" → recipes this user starred (own or community), most-recently-starred
//   "pool"      → community pool, ranked by saves then recency (cap via `lim`)
// Each row carries `fav` (does THIS user star it), `fav_count`, and `dn` (owner name).
// Shared by listRecipes (JSON) + the htmx recipe partials (HTML).
export async function recipeRows(
  env: Env, owner: string, kind: "mine" | "favorites" | "pool", lim = 200,
): Promise<any[]> {
  const favCount = "(SELECT COUNT(*) FROM user_favorites fc WHERE fc.kind='recipe' AND fc.ref_id=r.id)";
  const isFav = "EXISTS(SELECT 1 FROM user_favorites fx WHERE fx.owner=?1 AND fx.kind='recipe' AND fx.ref_id=r.id)";
  if (kind === "favorites") {
    const { results } = await env.DB.prepare(
      `SELECT r.*, u.display_name dn, ${favCount} fav_count, 1 fav
       FROM user_favorites uf JOIN recipes r ON r.id=uf.ref_id JOIN users u ON u.id=r.owner
       WHERE uf.owner=?1 AND uf.kind='recipe' ORDER BY uf.created_at DESC LIMIT 200`).bind(owner).all();
    return (results || []) as any[];
  }
  if (kind === "pool") {
    const { results } = await env.DB.prepare(
      `SELECT r.*, u.display_name dn, ${favCount} fav_count, ${isFav} fav
       FROM recipes r JOIN users u ON u.id=r.owner
       WHERE r.shared=1 ORDER BY fav_count DESC, r.updated_at DESC LIMIT ?2`).bind(owner, lim).all();
    return (results || []) as any[];
  }
  const { results } = await env.DB.prepare(
    `SELECT r.*, ${favCount} fav_count, ${isFav} fav
     FROM recipes r WHERE r.owner=?1 ORDER BY r.rowid DESC LIMIT 500`).bind(owner).all();
  return (results || []) as any[];
}

async function listRecipes(env: Env, owner: string, url: URL): Promise<Response> {
  if (url.searchParams.get("favorites") === "1") return json(await recipeRows(env, owner, "favorites"));
  if (url.searchParams.get("shared") === "1") {
    const lim = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "200") || 200));
    return json(await recipeRows(env, owner, "pool", lim));
  }
  return json(await recipeRows(env, owner, "mine"));
}

export async function listRows(env: Env, res: string, owner: string, url: URL): Promise<Response> {
  if (res === "recipes") return listRecipes(env, owner, url);
  if (url.searchParams.get("shared") === "1" && SHAREABLE.has(res)) {
    const { results } = await env.DB
      .prepare(`SELECT * FROM ${res} WHERE shared=1 ORDER BY rowid DESC LIMIT 200`).all();
    return json(results);
  }
  const order = res === "brews" ? "brewed_at" : "rowid";
  const { results } = await env.DB
    .prepare(`SELECT * FROM ${res} WHERE owner=? ORDER BY ${order} DESC LIMIT 500`).bind(owner).all();
  return json(results);
}

export async function getOne(env: Env, res: string, owner: string, id: string): Promise<Response> {
  const row = await env.DB.prepare(`SELECT * FROM ${res} WHERE id=? AND owner=?`).bind(id, owner).first();
  return row ? json(row) : json({ error: "not found" }, 404);
}

function buildInsert(res: string, owner: string, body: Record<string, any>) {
  const cols = ["id", "owner"];
  const vals: any[] = [uid(), owner];
  for (const k of FIELDS[res]) {
    if (k in body && body[k] !== undefined) { cols.push(k); vals.push(body[k]); }
  }
  const now = nowISO();
  if (res === "recipes" || res === "calibrations" || res === "user_drops") { cols.push("created_at", "updated_at"); vals.push(now, now); }
  else if (res === "brews") { if (!cols.includes("brewed_at")) { cols.push("brewed_at"); vals.push(now); } }
  else { cols.push("created_at"); vals.push(now); }
  return { cols, vals, id: vals[0] as string };
}

export async function createRow(req: Request, env: Env, res: string, owner: string): Promise<Response> {
  const body = await readBody(req); // JSON (app fetch) or form-encoded (htmx)
  const { cols, vals, id } = buildInsert(res, owner, body);
  const ph = cols.map(() => "?").join(",");
  await env.DB.prepare(`INSERT INTO ${res} (${cols.join(",")}) VALUES (${ph})`).bind(...vals).run();
  if (res === "beans") { try { const b: any = await env.DB.prepare("SELECT * FROM beans WHERE id=?").bind(id).first(); if (b) await resolveBeanLinks(env, b); } catch {} }
  return getOne(env, res, owner, id);
}

export async function updateRow(req: Request, env: Env, res: string, owner: string, id: string): Promise<Response> {
  const body = await readBody(req); // JSON (app fetch) or form-encoded (htmx)
  const sets: string[] = [];
  const vals: any[] = [];
  for (const k of FIELDS[res]) {
    if (k in body && body[k] !== undefined) { sets.push(`${k}=?`); vals.push(body[k]); }
  }
  if (res === "recipes" || res === "calibrations" || res === "user_drops") { sets.push("updated_at=?"); vals.push(nowISO()); }
  if (!sets.length) return json({ error: "nothing to update" }, 400);
  vals.push(id, owner);
  await env.DB.prepare(`UPDATE ${res} SET ${sets.join(",")} WHERE id=? AND owner=?`).bind(...vals).run();
  // Re-resolve ref_* links only when a field that feeds them changed (skip the
  // frequent suggestion/context-only PUTs).
  if (res === "beans" && ["region", "varietal", "process", "producer", "roaster"].some((k) => k in body)) {
    try { const b: any = await env.DB.prepare("SELECT * FROM beans WHERE id=? AND owner=?").bind(id, owner).first(); if (b) await resolveBeanLinks(env, b); } catch {}
  }
  return getOne(env, res, owner, id);
}

export async function deleteRow(env: Env, res: string, owner: string, id: string): Promise<Response> {
  await env.DB.prepare(`DELETE FROM ${res} WHERE id=? AND owner=?`).bind(id, owner).run();
  return json({ ok: true });
}

export async function adoptRow(env: Env, res: string, owner: string, id: string): Promise<Response> {
  if (!SHAREABLE.has(res)) return json({ error: "not adoptable" }, 400);
  const src: any = await env.DB.prepare(`SELECT * FROM ${res} WHERE id=? AND shared=1`).bind(id).first();
  if (!src) return json({ error: "not found or not shared" }, 404);
  const body: Record<string, any> = {};
  for (const k of FIELDS[res]) if (k in src) body[k] = src[k];
  body.shared = 0; // an adopted copy is private to the adopter
  const { cols, vals, id: newId } = buildInsert(res, owner, body);
  const ph = cols.map(() => "?").join(",");
  await env.DB.prepare(`INSERT INTO ${res} (${cols.join(",")}) VALUES (${ph})`).bind(...vals).run();
  return getOne(env, res, owner, newId);
}
