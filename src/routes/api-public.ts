// Public JSON twins of the shareable pages, for native clients (the iOS app reads
// these instead of opening the web UI). Same data the HTML pages show and the feed
// already links to — nothing more:
//   GET /api/bean/:id    — the bean passport for a SHARED bean (beans.shared=1),
//                          plus the shared brews/cuppings logged on it.
//   GET /api/recipe/:id  — a recipe with its computed chem model + gear, matching
//                          /recipe/:id (which serves any recipe by link).
// Reuses lib/passport + lib/catalog rather than re-querying, so a native client can
// never see a shape the web page doesn't. Display names only — NEVER an email.
import type { Env } from "../types";
import { json } from "../lib/http";
import { resolveBeanLinks } from "../lib/graph";
import { assemblePassport, passportJson } from "../lib/passport";
import { loadDropModel, loadGear, recipeModel, recipeGearJson } from "../lib/catalog";
import { CUP_ATTRS } from "./api-cupping";

const actor = (dn: any) => (dn && String(dn).trim()) || "a brewer";

// GET /api/bean/:id — public bean passport. The HTML /bean/:id is the OWNER's
// editable page; this is the read-only public face of the same bean, so it is
// gated on shared=1 (the flag the feed publishes on) and never on a session.
export async function publicBeanJson(env: Env, id: string): Promise<Response> {
  const bean: any = await env.DB.prepare(
    `SELECT b.*, u.display_name dn FROM beans b LEFT JOIN users u ON u.id=b.owner WHERE b.id=? AND b.shared=1`
  ).bind(id).first();
  if (!bean) return json({ error: "not found" }, 404);

  // Same backfill the HTML page does: a bean saved before the ref_* wiring resolves
  // its links on first view rather than showing an empty passport forever.
  let links: any = {
    region_id: bean.region_id, variety_id: bean.variety_id, process_id: bean.process_id,
    producer_id: bean.producer_id, roaster_id: bean.roaster_id,
  };
  if (!links.region_id && !links.variety_id && !links.process_id && !links.producer_id && !links.roaster_id) {
    try { links = await resolveBeanLinks(env, bean); } catch {}
  }
  let passport: any = { variety: null, process: null, region: null, producer: null };
  try { passport = passportJson(await assemblePassport(env, links)); } catch {}

  let roaster: any = null;
  if (links.roaster_id) {
    const r: any = await env.DB.prepare(`SELECT id,name,city,country_code,website FROM ref_roasters WHERE id=?`).bind(links.roaster_id).first();
    if (r) roaster = r;
  }

  const br = await env.DB.prepare(
    `SELECT id, brewed_at, tasting_note, score, grind, brew_time, water_ml, method, dose_g, yield_g, water_temp_c, extraction_pct
       FROM brews WHERE bean_id=? AND shared=1 ORDER BY brewed_at DESC LIMIT 30`).bind(id).all();
  const brews = ((br.results || []) as any[]).map((b) => ({
    id: b.id, ts: b.brewed_at, tasting_note: b.tasting_note || null, score: b.score ?? null,
    grind: b.grind || null, brew_time: b.brew_time || null, water_ml: b.water_ml ?? null,
    method: b.method || null, dose_g: b.dose_g ?? null, yield_g: b.yield_g ?? null,
    water_temp_c: b.water_temp_c ?? null, extraction_pct: b.extraction_pct ?? null,
  }));

  const cr = await env.DB.prepare(
    `SELECT * FROM user_cuppings WHERE bean_id=? AND shared=1 ORDER BY cupped_at DESC LIMIT 30`).bind(id).all();
  const cups = (cr.results || []) as any[];
  const notesByCup: Record<string, any[]> = {};
  if (cups.length) {
    const ids = cups.map((c) => c.id); const ph = ids.map(() => "?").join(",");
    const fr = await env.DB.prepare(
      `SELECT ucf.cupping_id cid, f.id, f.name, f.color FROM user_cupping_flavors ucf
         JOIN ref_flavors f ON f.id=ucf.flavor_id WHERE ucf.cupping_id IN (${ph})`).bind(...ids).all();
    for (const r of (fr.results || []) as any[]) (notesByCup[r.cid] = notesByCup[r.cid] || []).push({ id: r.id, name: r.name, color: r.color || null });
  }
  const cuppings = cups.map((c) => ({
    id: c.id, ts: c.cupped_at, total_score: c.total_score ?? null,
    defects: c.defects ?? 0, notes: c.notes || null,
    attrs: CUP_ATTRS.map(([k, label]: any) => ({ key: k, label, value: c[k] ?? null })),
    flavors: notesByCup[c.id] || [],
  }));

  return json({
    bean: {
      id: bean.id, name: bean.name, by: actor(bean.dn), created_at: bean.created_at,
      roaster: bean.roaster || null, origin: bean.origin || null, region: bean.region || null,
      producer: bean.producer || null, varietal: bean.varietal || null, process: bean.process || null,
      altitude: bean.altitude || null, harvest: bean.harvest || null,
      roast_date: bean.roast_date || null, tasting_notes: bean.tasting_notes || null,
      color: bean.color || null,
    },
    passport, roaster, brews, cuppings,
  });
}

// GET /api/recipe/:id — the recipe page's data. Mirrors recipePage's gate exactly:
// a recipe is fetched by id (a shared LINK works even when it isn't in the pool),
// and `shared` is reported so a client can say whether it's in the community pool.
export async function publicRecipeJson(env: Env, id: string): Promise<Response> {
  const rec: any = await env.DB.prepare(
    `SELECT r.*, u.display_name dn FROM recipes r LEFT JOIN users u ON u.id=r.owner WHERE r.id=?`).bind(id).first();
  if (!rec) return json({ error: "not found" }, 404);
  const M = await loadDropModel(env, [rec.owner]);
  const st = recipeModel(rec, M);
  const G = await loadGear(env);
  const favRow: any = await env.DB.prepare(
    `SELECT COUNT(*) n FROM user_favorites WHERE kind='recipe' AND ref_id=?`).bind(id).first();
  return json({
    recipe: {
      id: rec.id, name: rec.name, by: actor(rec.dn), shared: rec.shared ? 1 : 0,
      updated_at: rec.updated_at, favorites: favRow?.n || 0,
    },
    model: st,
    gear: recipeGearJson(st, G),
  });
}
