// Reference catalog (drops/salts/gear) + gear-favorite toggling.
//   GET  /api/catalog    — public; user_drops + favorites merged in when signed in
//   POST /api/favorites  — toggle a brewer/filter/grinder/recipe favorite
import type { Env } from "../types";
import type { User } from "../auth";
import { nowISO } from "../db";
import { json, readBody } from "../lib/http";

// Drops catalog + salt glossary. Public (the calculator runs signed-out); when a
// session is present, the caller's own user_drops are merged in under brand "you".
// buildCatalogData returns the plain object so it can be both served (/api/catalog)
// and inlined into the /water page (window.__CATALOG__) to skip the boot fetch.
// includeGear=false skips the brewer/filter/grinder tables (~480 rows). Those only
// fill fixed-height <select> pickers (no layout shift), so the inline /water catalog
// omits them to stay tiny (~2KB) and lets the island fetch them async; /api/catalog
// includes them.
export async function buildCatalogData(
  env: Env, user: User | null, includeGear = true,
): Promise<Record<string, any>> {
  const [salts, brands, drops, brewers, filters, grinders] = await Promise.all([
    env.DB.prepare("SELECT * FROM ref_salts ORDER BY contributes, key").all(),
    env.DB.prepare("SELECT * FROM ref_drop_brands ORDER BY rowid").all(),
    env.DB.prepare("SELECT * FROM ref_drops ORDER BY brand_id, sort").all(),
    includeGear ? env.DB.prepare("SELECT * FROM ref_brewers ORDER BY brand, sort").all() : Promise.resolve({ results: [] }),
    includeGear ? env.DB.prepare("SELECT * FROM ref_filters ORDER BY brand, sort").all() : Promise.resolve({ results: [] }),
    includeGear ? env.DB.prepare("SELECT * FROM ref_grinders ORDER BY brand, sort").all() : Promise.resolve({ results: [] }),
  ]);
  // Parse the JSON columns server-side so the client gets clean objects.
  const parse = (s: any, fb: any) => { try { return s == null ? fb : JSON.parse(s); } catch { return fb; } };
  const dropRows = (drops.results || []).map((d: any) => ({
    ...d, ingredients: parse(d.ingredients, []), comp: parse(d.comp, null), dose_json: parse(d.dose_json, null),
  }));

  let mine: any[] = [];
  let favorites: any[] = [];
  if (user) {
    const ud = await env.DB.prepare("SELECT * FROM user_drops WHERE owner=? ORDER BY rowid").bind(user.id).all();
    mine = (ud.results || []).map((d: any) => ({
      id: d.id, brand_id: "you", name: d.name, note: d.note, color: d.color,
      comp: parse(d.comp, null), dose_model: d.dose_model, dose_json: parse(d.dose_json, null),
      provenance: "custom", shared: d.shared, sort: 0,
    }));
    const fv = await env.DB.prepare("SELECT kind, ref_id FROM user_favorites WHERE owner=?").bind(user.id).all();
    favorites = (fv.results || []) as any[];
  }

  return { salts: salts.results || [], brands: brands.results || [], drops: dropRows, userDrops: mine, favorites, brewers: brewers.results || [], filters: filters.results || [], grinders: grinders.results || [] };
}

export async function runCatalog(env: Env, user: User | null): Promise<Response> {
  return json(await buildCatalogData(env, user));
}

// POST /api/favorites { kind: 'brewer'|'filter'|'grinder'|'recipe', ref_id } — toggle a favorite.
export async function toggleFavorite(req: Request, env: Env, owner: string): Promise<Response> {
  const body = await readBody(req); // JSON (app fetch) or form-encoded (htmx)
  const kind = String(body.kind || ""), ref_id = String(body.ref_id || "");
  if (!["brewer", "filter", "grinder", "recipe"].includes(kind) || !ref_id) return json({ error: "bad params" }, 400);
  const existing = await env.DB.prepare("SELECT 1 FROM user_favorites WHERE owner=? AND kind=? AND ref_id=?").bind(owner, kind, ref_id).first();
  if (existing) {
    await env.DB.prepare("DELETE FROM user_favorites WHERE owner=? AND kind=? AND ref_id=?").bind(owner, kind, ref_id).run();
    return json({ favorited: false });
  }
  await env.DB.prepare("INSERT INTO user_favorites (owner,kind,ref_id,created_at) VALUES (?,?,?,?)").bind(owner, kind, ref_id, nowISO()).run();
  return json({ favorited: true });
}
