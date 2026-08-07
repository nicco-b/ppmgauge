// Enrichment graph: resolve a bean's free-text into ref_* links, and the
// confidence-aware canonical upsert + staging gate that bulk ingestion flows
// through. Deterministic, no AI. Suggest-don't-overwrite: bean resolution only
// populates the *_id columns; the user's text fields are never changed.
import type { Env } from "../types";
import { uid, nowISO } from "../db";

export function normRef(s: any): string {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}
// Match normalized free-text against a ref table's name (+ optional aliases JSON).
// loose = also accept a substring match on name (for multi-word producer/roaster names).
async function matchRef(env: Env, table: string, text: string, opts: { aliases?: boolean; loose?: boolean } = {}): Promise<string | null> {
  const v = normRef(text);
  if (!v) return null;
  const aliasClause = opts.aliases ? ` OR lower(COALESCE(aliases,'')) LIKE '%"'||?1||'"%'` : "";
  let r: any = await env.DB.prepare(`SELECT id FROM ${table} WHERE lower(name)=?1${aliasClause} LIMIT 1`).bind(v).first();
  if (r) return r.id;
  if (opts.loose) {
    r = await env.DB.prepare(`SELECT id FROM ${table} WHERE lower(name) LIKE ?1 LIMIT 1`).bind("%" + v + "%").first();
    if (r) return r.id;
  }
  return null;
}
// Resolve all five links for a bean and persist them (recomputed each call, so
// stale links clear when the text changes). Returns the resolved id map.
export async function resolveBeanLinks(env: Env, bean: any): Promise<Record<string, string | null>> {
  const [region_id, variety_id, process_id, producer_id, roaster_id] = await Promise.all([
    matchRef(env, "ref_regions", bean.region, { aliases: true }),
    matchRef(env, "ref_varieties", bean.varietal, { aliases: true }),
    matchRef(env, "ref_processes", bean.process, { aliases: true }),
    matchRef(env, "ref_producers", bean.producer, { loose: true }),
    matchRef(env, "ref_roasters", bean.roaster, { loose: true }),
  ]);
  // Link to a reference coffee via the resolved producer (its best-scored lot) — this
  // is what gives calibration a published score/notes to compare a cupping against.
  let coffee_id: string | null = null;
  if (producer_id) {
    const c: any = await env.DB.prepare(`SELECT id FROM ref_coffees WHERE producer_id=? ORDER BY published_score DESC LIMIT 1`).bind(producer_id).first();
    coffee_id = c ? c.id : null;
  }
  await env.DB.prepare(`UPDATE beans SET region_id=?,variety_id=?,process_id=?,producer_id=?,roaster_id=?,coffee_id=? WHERE id=?`)
    .bind(region_id, variety_id, process_id, producer_id, roaster_id, coffee_id, bean.id).run();
  return { region_id, variety_id, process_id, producer_id, roaster_id, coffee_id };
}

// ════ Graph ingestion: confidence-aware canonical upsert + staging gate ════
// One place that knows how to merge an incoming record into ref_* without ever
// clobbering a more-trusted value. Bulk imports flow through as 'low'; user/roaster
// firsthand as 'firsthand'. Brand-new, low-trust entities can be parked in staging.
const CONF_RANK: Record<string, number> = { firsthand: 5, high: 4, medium: 3, low: 2, estimated: 1 };
function confRank(c: any): number { return CONF_RANK[String(c || "").toLowerCase()] ?? 0; }
function slugify(s: any): string {
  return normRef(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}
type GraphCfg = {
  table: string;
  fields: string[];                                   // mergeable data columns (no id / provenance / timestamps)
  createTs: string[];                                 // NOT-NULL timestamp cols to stamp on insert
  updateTs: string[];                                 // timestamp cols to bump on enrich
  provUrl: boolean;                                   // table has a source_url column
  resolve: (env: Env, p: any) => Promise<string | null>;  // find an existing canonical id (exact, to avoid false merges)
  slug: (p: any) => string;                           // deterministic id for a new row
};
export const GRAPH: Record<string, GraphCfg> = {
  producer: {
    table: "ref_producers",
    fields: ["name", "kind", "country_code", "region_id", "owner", "founded", "hectares", "altitude_min_m", "altitude_max_m", "lat", "lng", "story", "website"],
    createTs: ["fetched_at", "updated_at"], updateTs: ["updated_at"], provUrl: true,
    resolve: async (env, p) => {
      const n = normRef(p.name); if (!n) return null;
      const r: any = p.country_code
        ? await env.DB.prepare(`SELECT id FROM ref_producers WHERE lower(name)=? AND country_code=? LIMIT 1`).bind(n, p.country_code).first()
        : await env.DB.prepare(`SELECT id FROM ref_producers WHERE lower(name)=? LIMIT 1`).bind(n).first();
      return r ? r.id : null;
    },
    slug: (p) => slugify([p.name, p.country_code].filter(Boolean).join("-")),
  },
  roaster: {
    table: "ref_roasters",
    fields: ["name", "city", "country_code", "website"],
    createTs: ["updated_at"], updateTs: ["updated_at"], provUrl: false,
    resolve: async (env, p) => {
      const n = normRef(p.name); if (!n) return null;
      const r: any = await env.DB.prepare(`SELECT id FROM ref_roasters WHERE lower(name)=? LIMIT 1`).bind(n).first();
      return r ? r.id : null;
    },
    slug: (p) => slugify(p.name),
  },
  coffee: {
    table: "ref_coffees",
    fields: ["name", "roaster_id", "producer_id", "importer_id", "country_code", "region_id", "process_id", "crop_year", "lot_number", "roast_level", "published_score", "score_source", "price", "currency", "weight_g", "url"],
    createTs: ["ingested_at"], updateTs: [], provUrl: true,
    // A COE/importer listing URL is a stable unique key; otherwise rely on explicit id / slug.
    resolve: async (env, p) => {
      if (!p.source_url) return null;
      const r: any = await env.DB.prepare(`SELECT id FROM ref_coffees WHERE source_url=? LIMIT 1`).bind(p.source_url).first();
      return r ? r.id : null;
    },
    slug: (p) => slugify([p.name, p.crop_year].filter(Boolean).join("-")) || ("coffee-" + uid().slice(0, 8)),
  },
};
export type Prov = { source: string; source_url?: string | null; confidence: string; note?: string | null };
type UpsertResult = { id: string; action: "created" | "enriched" | "skipped"; changed: string[] };
// Find-or-create the canonical row, merging fields by trust: fill empties always,
// overwrite a populated field only when the incoming source is strictly more trusted.
// Confidence ratchets up, never down; provenance refreshes only when trust improves.
export async function upsertEntity(env: Env, type: string, payload: any, prov: Prov): Promise<UpsertResult> {
  const cfg = GRAPH[type]; if (!cfg) throw new Error("unknown entity type: " + type);
  const now = nowISO();
  let existing: any = null;
  const explicitId = payload.id && String(payload.id).trim();
  if (explicitId) existing = await env.DB.prepare(`SELECT * FROM ${cfg.table} WHERE id=?`).bind(explicitId).first();
  if (!existing) {
    const rid = await cfg.resolve(env, payload);
    if (rid) existing = await env.DB.prepare(`SELECT * FROM ${cfg.table} WHERE id=?`).bind(rid).first();
  }
  if (existing) {
    const rowRank = confRank(existing.confidence), inRank = confRank(prov.confidence);
    const sets: string[] = [], vals: any[] = [], changed: string[] = [];
    for (const f of cfg.fields) {
      const nv = payload[f];
      if (nv == null || nv === "") continue;
      const cv = existing[f];
      const empty = cv == null || cv === "";
      if ((empty || inRank > rowRank) && String(cv ?? "") !== String(nv)) { sets.push(`${f}=?`); vals.push(nv); changed.push(f); }
    }
    if (!changed.length) return { id: existing.id, action: "skipped", changed: [] };
    if (inRank > rowRank) {
      sets.push("confidence=?"); vals.push(prov.confidence);
      if (prov.source) { sets.push("source=?"); vals.push(prov.source); }
      if (cfg.provUrl && prov.source_url) { sets.push("source_url=?"); vals.push(prov.source_url); }
    }
    for (const t of cfg.updateTs) { sets.push(`${t}=?`); vals.push(now); }
    vals.push(existing.id);
    await env.DB.prepare(`UPDATE ${cfg.table} SET ${sets.join(",")} WHERE id=?`).bind(...vals).run();
    return { id: existing.id, action: "enriched", changed };
  }
  // create new
  const id = explicitId || cfg.slug(payload);
  const cols = ["id"], qs = ["?"], vals: any[] = [id], changed: string[] = [];
  for (const f of cfg.fields) {
    if (payload[f] == null || payload[f] === "") continue;
    cols.push(f); qs.push("?"); vals.push(payload[f]); changed.push(f);
  }
  cols.push("source"); qs.push("?"); vals.push(prov.source || "ingest");
  if (cfg.provUrl) { cols.push("source_url"); qs.push("?"); vals.push(prov.source_url || null); }
  cols.push("confidence"); qs.push("?"); vals.push(prov.confidence || "low");
  for (const t of cfg.createTs) { cols.push(t); qs.push("?"); vals.push(now); }
  await env.DB.prepare(`INSERT INTO ${cfg.table} (${cols.join(",")}) VALUES (${qs.join(",")})`).bind(...vals).run();
  return { id, action: "created", changed };
}
// Park a candidate for human review instead of writing it live.
async function stageEntity(env: Env, type: string, payload: any, prov: Prov, match?: { id: string | null; score: number }): Promise<string> {
  const sid = uid();
  await env.DB.prepare(
    `INSERT INTO staging_entities (id,entity_type,payload,match_id,match_score,status,source,source_url,confidence,note,created_at) VALUES (?,?,?,?,?,'pending',?,?,?,?,?)`
  ).bind(sid, type, JSON.stringify(payload), match?.id || null, match?.score || 0, prov.source || "ingest", prov.source_url || null, prov.confidence || "low", prov.note || null, nowISO()).run();
  return sid;
}
type IngestSummary = { type: string; created: number; enriched: number; skipped: number; staged: number; ids: string[]; errors: { rec: string; error: string }[] };
export async function ingestBatch(env: Env, type: string, records: any[], prov: Prov, opts?: { stage?: boolean }): Promise<IngestSummary> {
  const out: IngestSummary = { type, created: 0, enriched: 0, skipped: 0, staged: 0, ids: [], errors: [] };
  for (const rec of records) {
    try {
      if (opts?.stage) { out.ids.push(await stageEntity(env, type, rec, prov)); out.staged++; continue; }
      const r = await upsertEntity(env, type, rec, prov);
      out[r.action]++; out.ids.push(r.id);
    } catch (e: any) { out.errors.push({ rec: String(rec?.name || rec?.id || "?"), error: String(e?.message || e) }); }
  }
  return out;
}
