// Admin-gated graph endpoints (mounted under /api in index.ts, behind
// requireAdmin). Bulk ingestion + the staging review queue + firsthand producer
// stories — the write side of the enrichment graph. Handlers only; the route
// registration and the admin gate live with the /api router in index.ts.
import type { Env } from "../types";
import { nowISO } from "../db";
import { json } from "../lib/http";
import { GRAPH, ingestBatch, upsertEntity, type Prov } from "../lib/graph";

function safeJson(s: any): any { try { return JSON.parse(s); } catch { return {}; } }

// POST /api/producer/:id/story — admin authors a firsthand story (+ optional facts).
// A manual authoritative edit, so we UPDATE directly rather than route through
// upsertEntity (whose equal-rank merge would refuse to re-edit an existing firsthand
// row). Marking source/confidence='firsthand' makes the ingestion gate protect it from
// lower-confidence CQI overwrites, and a non-empty story flips the producer indexable.
export async function saveProducerStory(req: Request, env: Env, id: string): Promise<Response> {
  const exists: any = await env.DB.prepare("SELECT id FROM ref_producers WHERE id=?").bind(id).first();
  if (!exists) return json({ error: "not found" }, 404);
  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const s = (x: any) => (typeof x === "string" ? x.trim() : x == null ? "" : String(x).trim());
  const numOrNull = (x: any) => { const v = parseFloat(x); return isFinite(v) ? v : null; };
  const intOrNull = (x: any) => { const v = parseInt(x, 10); return isFinite(v) ? v : null; };
  const story = s(body.story);
  const sets: string[] = ["story=?"]; const vals: any[] = [story || null];
  // Facts only overwrite when the admin actually supplied a value (don't wipe CQI data).
  const facts: [string, any][] = [["owner", s(body.owner)], ["founded", s(body.founded)], ["website", s(body.website)],
    ["hectares", numOrNull(body.hectares)], ["altitude_min_m", intOrNull(body.altitude_min_m)], ["altitude_max_m", intOrNull(body.altitude_max_m)]];
  for (const [c, v] of facts) if (v != null && v !== "") { sets.push(`${c}=?`); vals.push(v); }
  if (story) {
    sets.push("confidence=?", "source=?"); vals.push("firsthand", "firsthand");
    const su = s(body.source_url); if (su) { sets.push("source_url=?"); vals.push(su); }
  }
  sets.push("updated_at=?"); vals.push(nowISO());
  vals.push(id);
  await env.DB.prepare(`UPDATE ref_producers SET ${sets.join(",")} WHERE id=?`).bind(...vals).run();
  return json({ ok: true, id, story });
}

// POST /api/ingest  { type, source, source_url?, confidence?, stage?, records:[...] }
export async function runIngest(req: Request, env: Env): Promise<Response> {
  let b: any; try { b = await req.json(); } catch { return json({ error: "bad body" }, 400); }
  const type = String(b.type || "");
  if (!(type in GRAPH)) return json({ error: `unknown type — use one of ${Object.keys(GRAPH).join(", ")}` }, 400);
  if (!Array.isArray(b.records) || !b.records.length) return json({ error: "records[] required" }, 400);
  if (b.records.length > 2000) return json({ error: "max 2000 records per call" }, 400);
  if (!b.source) return json({ error: "source required (where did this data come from)" }, 400);
  const prov: Prov = { source: String(b.source), source_url: b.source_url ? String(b.source_url) : null, confidence: String(b.confidence || "low") };
  const summary = await ingestBatch(env, type, b.records, prov, { stage: !!b.stage });
  return json({ ok: true, ...summary });
}

// GET /api/staging?status=pending&type=producer
export async function listStaging(env: Env, url: URL): Promise<Response> {
  const status = url.searchParams.get("status") || "pending";
  const type = url.searchParams.get("type");
  const rows = type
    ? await env.DB.prepare(`SELECT * FROM staging_entities WHERE status=? AND entity_type=? ORDER BY created_at DESC LIMIT 500`).bind(status, type).all()
    : await env.DB.prepare(`SELECT * FROM staging_entities WHERE status=? ORDER BY created_at DESC LIMIT 500`).bind(status).all();
  return json({ ok: true, rows: (rows.results || []).map((r: any) => ({ ...r, payload: safeJson(r.payload) })) });
}

export async function promoteStaging(env: Env, sid: string): Promise<Response> {
  const row: any = await env.DB.prepare(`SELECT * FROM staging_entities WHERE id=?`).bind(sid).first();
  if (!row) return json({ error: "not found" }, 404);
  if (row.status !== "pending") return json({ error: `already ${row.status}` }, 409);
  const r = await upsertEntity(env, row.entity_type, safeJson(row.payload), { source: row.source, source_url: row.source_url, confidence: row.confidence });
  await env.DB.prepare(`UPDATE staging_entities SET status='promoted', reviewed_at=?, match_id=? WHERE id=?`).bind(nowISO(), r.id, sid).run();
  return json({ ok: true, ...r });
}

export async function rejectStaging(env: Env, sid: string): Promise<Response> {
  const row: any = await env.DB.prepare(`SELECT id,status FROM staging_entities WHERE id=?`).bind(sid).first();
  if (!row) return json({ error: "not found" }, 404);
  await env.DB.prepare(`UPDATE staging_entities SET status='rejected', reviewed_at=? WHERE id=?`).bind(nowISO(), sid).run();
  return json({ ok: true, id: sid, status: "rejected" });
}
