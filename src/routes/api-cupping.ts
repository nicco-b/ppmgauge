// Cupping (SCA tasting form).
//   POST /api/cupping        — save a scored tasting (+ wheel notes)
//   DELETE /api/cupping/:id   — remove one
//   POST /api/flavors/resolve — map bag/tasting prose onto ref_flavors ids
// CUP_ATTRS is also consumed by the bean-page renderer in index.ts (it renders the
// cupping form); it stays exported here until the bean page becomes a route module.
import type { Env } from "../types";
import { uid, nowISO } from "../db";
import { json } from "../lib/http";
import { resolveFlavorText } from "../lib/flavors";

// [key, label, default]. Uniformity/Clean cup/Sweetness default to 10 (full marks
// unless a defect is noted), matching how the SCA form is scored.
export const CUP_ATTRS: [string, string, number][] = [
  ["fragrance", "Fragrance / Aroma", 7.5], ["flavor", "Flavor", 7.5], ["aftertaste", "Aftertaste", 7.5],
  ["acidity", "Acidity", 7.5], ["body", "Body", 7.5], ["balance", "Balance", 7.5],
  ["uniformity", "Uniformity", 10], ["clean_cup", "Clean cup", 10], ["sweetness", "Sweetness", 10],
  ["overall", "Overall", 7.5],
];

export async function saveCupping(req: Request, env: Env, owner: string): Promise<Response> {
  let b: any; try { b = await req.json(); } catch { return json({ error: "bad body" }, 400); }
  const beanId = String(b.bean_id || "");
  const bean = await env.DB.prepare("SELECT id FROM beans WHERE id=? AND owner=?").bind(beanId, owner).first();
  if (!bean) return json({ error: "bean not found" }, 404);
  const clamp = (x: any, d: number) => { const n = parseFloat(x); return isNaN(n) ? d : Math.max(0, Math.min(10, n)); };
  const sc: Record<string, number> = {};
  for (const [k, , def] of CUP_ATTRS) sc[k] = clamp(b[k], def);
  const defects = Math.max(0, parseInt(b.defects) || 0);
  const total = Math.round((CUP_ATTRS.reduce((a, [k]) => a + sc[k], 0) - defects) * 100) / 100;
  const id = uid(); const now = nowISO();
  await env.DB.prepare(
    `INSERT INTO user_cuppings (id,owner,bean_id,cupped_at,fragrance,flavor,aftertaste,acidity,body,balance,uniformity,clean_cup,sweetness,overall,defects,total_score,notes,shared) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, owner, beanId, now, sc.fragrance, sc.flavor, sc.aftertaste, sc.acidity, sc.body, sc.balance, sc.uniformity, sc.clean_cup, sc.sweetness, sc.overall, defects, total, String(b.notes || ""), b.shared ? 1 : 0).run();
  const flavors: string[] = Array.isArray(b.flavors) ? b.flavors.slice(0, 40).map((x: any) => String(x)) : [];
  if (flavors.length) {
    try { await env.DB.batch(flavors.map((fid) => env.DB.prepare("INSERT OR IGNORE INTO user_cupping_flavors (cupping_id,flavor_id) VALUES (?,?)").bind(id, fid))); } catch {}
  }
  return json({ ok: true, id, total_score: total });
}

export async function deleteCupping(env: Env, owner: string, id: string): Promise<Response> {
  const c = await env.DB.prepare("SELECT id FROM user_cuppings WHERE id=? AND owner=?").bind(id, owner).first();
  if (!c) return json({ error: "not found" }, 404);
  await env.DB.prepare("DELETE FROM user_cupping_flavors WHERE cupping_id=?").bind(id).run();
  await env.DB.prepare("DELETE FROM user_cuppings WHERE id=? AND owner=?").bind(id, owner).run();
  return json({ ok: true });
}

export async function resolveFlavorsEndpoint(req: Request, env: Env): Promise<Response> {
  let b: any; try { b = await req.json(); } catch { return json({ error: "bad body" }, 400); }
  return json({ flavors: await resolveFlavorText(env, String(b.text || "")) });
}
