// POST /api/calibrate — solve the user's water calibration from their recorded
// readings and upsert it as "My calibration". Mounted (requireUser) in index.ts.
import type { Env } from "../types";
import { uid, nowISO } from "../db";
import { json } from "../lib/http";
import { solveCalibration, type Reading } from "../chem";
import { getOne } from "./api-crud";

export async function runCalibrate(env: Env, owner: string): Promise<Response> {
  const { results } = await env.DB.prepare("SELECT * FROM readings WHERE owner=?").bind(owner).all();
  const readings: Reading[] = (results || []).map((r: any) => {
    let m = { T: 0, J: 0, L: 0 };
    try { const p = JSON.parse(r.ratios); m = { T: +p.T || 0, J: +p.J || 0, L: +p.L || 0 }; } catch {}
    return { masses: m, gh: r.measured_gh, kh: r.measured_kh, tds: r.measured_tds };
  });
  if (!readings.length) return json({ error: "no readings yet — record a measured GH/KH first" }, 400);

  const sol = solveCalibration(readings);
  const comp = JSON.stringify(sol);
  const now = nowISO();
  // Upsert the user's auto calibration ("My calibration").
  const existing: any = await env.DB
    .prepare("SELECT id FROM calibrations WHERE owner=? AND name=?").bind(owner, "My calibration").first();
  if (existing) {
    await env.DB.prepare("UPDATE calibrations SET comp=?, reading_count=?, updated_at=? WHERE id=?")
      .bind(comp, sol.n, now, existing.id).run();
    return getOne(env, "calibrations", owner, existing.id);
  }
  const id = uid();
  await env.DB.prepare(
    "INSERT INTO calibrations (id,owner,name,comp,reading_count,shared,created_at,updated_at) VALUES (?,?,?,?,?,0,?,?)")
    .bind(id, owner, "My calibration", comp, sol.n, now, now).run();
  return getOne(env, "calibrations", owner, id);
}
