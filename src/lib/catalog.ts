// Recipe chem model — mirrors the client calculator so a stored recipe renders
// identical numbers server-side. Loads the drop/salt/brand + gear tables, folds
// legacy {T,J,L} keys onto Apax ids, and derives ions/GH/KH/dose. brewSection
// renders the "How it's brewed" gear + pour tables for the recipe page.
import type { Env } from "../types";
import { esc } from "./http";

const RECIPE_ION = { Ca: 40.08, Mg: 24.31, HCO3: 61.02 };

// Build the drop/salt/brand model from the catalog tables (mirror of the client's buildCatalog).
// `owners` (optional) = recipe authors whose custom drops should resolve. The brand catalog
// (ref_drops) has no user_drops, so without this a recipe's custom drops render as their raw
// id AND drop out of the chemistry. Pass the recipe's owner(s) so name + comp resolve server-side.
export async function loadDropModel(env: Env, owners?: string[]) {
  const [salts, drops, brands] = await Promise.all([
    env.DB.prepare("SELECT * FROM ref_salts").all(),
    env.DB.prepare("SELECT * FROM ref_drops").all(),
    env.DB.prepare("SELECT id, name FROM ref_drop_brands").all(),
  ]);
  const SALT: Record<string, { mm: number; Ca: number; Mg: number; HCO3: number }> = {};
  for (const s of (salts.results || []) as any[]) SALT[s.key] = { mm: s.mm, Ca: s.ca, Mg: s.mg, HCO3: s.hco3 };
  const DROP: Record<string, { name: string; color: string; comp: any }> = {};
  for (const d of (drops.results || []) as any[]) {
    let comp: any = null; try { comp = d.comp ? JSON.parse(d.comp) : null; } catch {}
    DROP[d.id] = { name: d.name, color: d.color || "#8a8f98", comp };
  }
  // Custom drops for the given recipe authors (distinct, deduped). Owner-scoped; ids never
  // collide with brand ids, so this only adds entries — never shadows a brand drop.
  const owns = [...new Set((owners || []).filter(Boolean))];
  if (owns.length) {
    const ph = owns.map(() => "?").join(",");
    const ud = await env.DB.prepare(`SELECT id, name, color, comp FROM user_drops WHERE owner IN (${ph})`).bind(...owns).all();
    for (const d of (ud.results || []) as any[]) {
      let comp: any = null; try { comp = d.comp ? JSON.parse(d.comp) : null; } catch {}
      DROP[d.id] = { name: d.name, color: d.color || "#8a8f98", comp };
    }
  }
  const BRAND: Record<string, string> = {};
  for (const b of (brands.results || []) as any[]) BRAND[b.id] = b.name;
  return { SALT, DROP, BRAND };
}
export type DropModel = Awaited<ReturnType<typeof loadDropModel>>;

// Brew-gear lookup (brewer/filter/grinder) keyed by id, for rendering a recipe's brew method.
export async function loadGear(env: Env) {
  const [bw, fl, gr] = await Promise.all([
    env.DB.prepare("SELECT * FROM ref_brewers").all(),
    env.DB.prepare("SELECT * FROM ref_filters").all(),
    env.DB.prepare("SELECT * FROM ref_grinders").all(),
  ]);
  const idx = (rows: any) => { const m: Record<string, any> = {}; for (const r of (rows.results || []) as any[]) m[r.id] = r; return m; };
  return { brewer: idx(bw), filter: idx(fl), grinder: idx(gr) };
}
export type GearModel = Awaited<ReturnType<typeof loadGear>>;

// Ion mg/L from a drop blend at a given dissolved load (mirror of client blendIons; salt model only).
// Starting-water ion baseline (mg/L) from a {type, gh, kh, hard} object. Mirrors the client.
function startIonsOf(start: any): { Ca: number; Mg: number; HCO3: number } {
  if (!start || start.type === "ro") return { Ca: 0, Mg: 0, HCO3: 0 };
  const gh = +start.gh || 0, kh = +start.kh || 0, HCO3 = kh / 0.8197, hard = start.hard || "ca";
  let Ca = 0, Mg = 0;
  if (hard === "mg") Mg = gh / 4.118; else if (hard === "both") { Ca = (gh / 2) / 2.497; Mg = (gh / 2) / 4.118; } else Ca = gh / 2.497;
  return { Ca, Mg, HCO3 };
}
function startTDSOf(start: any): number { return (!start || start.type === "ro") ? 0 : Math.round((+start.gh || 0) + (+start.kh || 0)); }

function recipeBlend(ratio: Record<string, number>, ppm: number, M: DropModel) {
  const ids = Object.keys(ratio); let sum = 0; for (const k of ids) sum += ratio[k] || 0;
  const out = { Ca: 0, Mg: 0, HCO3: 0 }; if (sum <= 0) return out;
  for (const id of ids) {
    const massC = ppm * ((ratio[id] || 0) / sum); if (massC <= 0) continue;
    const comp = M.DROP[id]?.comp; if (!comp) continue;
    let wsum = 0; for (const s in comp) wsum += comp[s] || 0; if (wsum <= 0) continue;
    for (const s in comp) {
      const sm = massC * ((comp[s] || 0) / wsum), S = M.SALT[s]; if (!S) continue;
      out.Ca += sm * S.Ca * RECIPE_ION.Ca / S.mm;
      out.Mg += sm * S.Mg * RECIPE_ION.Mg / S.mm;
      out.HCO3 += sm * S.HCO3 * RECIPE_ION.HCO3 / S.mm;
    }
  }
  return out;
}
// Per-drop grams + drops (mirror of client compute).
function recipeDose(ratio: Record<string, number>, gl: number, ml: number, dpg: number) {
  const ids = Object.keys(ratio); let sum = 0; for (const k of ids) sum += ratio[k] || 0;
  const vL = ml / 1000, s = sum > 0 ? gl / sum : 0;
  const g: Record<string, number> = {}, d: Record<string, number> = {}; let tot = 0, totd = 0;
  for (const k of ids) { const gv = (ratio[k] || 0) * s * vL, dr = gv * dpg; g[k] = gv; d[k] = dr; tot += gv; totd += dr; }
  return { g, d, tot, totd, ids };
}

// Full stats for a stored recipe — same shape/logic as the client setupStats.
export function recipeModel(rec: any, M: DropModel) {
  let r: any = {}; try { r = JSON.parse(rec.ratios) || {}; } catch {}
  const mode = rec.mode === "split" ? "split" : "single";
  const vol = r.vol || {}, tgt = r.tgt || {}, dpg = r.dpg || {}, pre = r.preset || {};
  const dd = rec.drops_per_g || 20;
  const fvol = (p: string, def: number) => (vol[p] != null ? +vol[p] : def);
  const ftgt = (p: string) => (tgt[p] != null ? +tgt[p] : (rec.target_gl || 3.5));
  const fdpg = (p: string) => (dpg[p] != null ? +dpg[p] : dd);
  // Strength is DERIVED from the ACTUAL dose (cs.tot), not the stored target — so an empty drop
  // set reads 0 ppm even on a legacy recipe whose stored target is stale. (For dosed recipes the
  // two are equal, since recipeDose scales to the target.) doseGl = real concentrate g/L.
  const doseGl = (c: ReturnType<typeof recipeDose>, vol: number) => c.tot / ((vol / 1000) || 1);
  const dosePpm = (c: ReturnType<typeof recipeDose>, vol: number) => Math.round(doseGl(c, vol) * 30);

  // Concentrate is mix-and-match per drop now, so recipes carry no single "kit"/brand — the
  // breakdown shows bare drop names. `kit` stays as an (empty) field for the page/OG template.
  let drops = 0, grams = 0, ions: { Ca: number; Mg: number; HCO3: number }, ppm: number, kit: string, style: string, volL: string, glL: string;
  let parts: ReturnType<typeof recipeDose>[] = [];
  if (mode === "split") {
    const ra = (r.a || {}), rb = (r.b || {});
    const av = fvol("a", 0), bv = fvol("b", 0), tv = (av + bv) || 1;
    const ca = recipeDose(ra, ftgt("a"), av, fdpg("a"));
    const cb = recipeDose(rb, ftgt("b"), bv, fdpg("b"));
    drops = ca.totd + cb.totd; grams = ca.tot + cb.tot; parts = [ca, cb];
    const pa = dosePpm(ca, av), pb = dosePpm(cb, bv);
    const ia = recipeBlend(ra, pa, M), ib = recipeBlend(rb, pb, M);
    ions = { Ca: (av * ia.Ca + bv * ib.Ca) / tv, Mg: (av * ia.Mg + bv * ib.Mg) / tv, HCO3: (av * ia.HCO3 + bv * ib.HCO3) / tv };
    ppm = Math.round((av * pa + bv * pb) / tv);
    kit = ""; style = "split A+B";
    volL = `${av + bv} mL`; glL = `${doseGl(ca, av).toFixed(1)}/${doseGl(cb, bv).toFixed(1)} g/L`;
  } else {
    const rs = (r.s || {});
    const svol = fvol("s", 500);
    const cs = recipeDose(rs, ftgt("s"), svol, fdpg("s"));
    drops = cs.totd; grams = cs.tot; parts = [cs];
    ppm = dosePpm(cs, svol); ions = recipeBlend(rs, ppm, M);
    kit = ""; style = pre.s || "Custom";
    volL = `${svol} mL`; glL = `${doseGl(cs, svol).toFixed(1)} g/L`;
  }
  // Starting water (source water before concentrate). RO/distilled adds 0, so existing recipes
  // (no `start`) are unchanged. Total water = drops + starting water; an empty drop set is just
  // starting water on its own (the old `noDrops` flag is gone — ignored on legacy recipes).
  const start = (r.start && typeof r.start === "object") ? r.start : null;
  const si = startIonsOf(start);
  ions = { Ca: ions.Ca + si.Ca, Mg: ions.Mg + si.Mg, HCO3: ions.HCO3 + si.HCO3 };
  ppm = ppm + startTDSOf(start);
  const acc: Record<string, { drops: number; grams: number }> = {}; const order: string[] = [];
  for (const c of parts) for (const id of c.ids) {
    if (!acc[id]) { acc[id] = { drops: 0, grams: 0 }; order.push(id); }
    acc[id].drops += c.d[id] || 0; acc[id].grams += c.g[id] || 0;
  }
  const breakdown = order
    .map((id) => ({ id, name: M.DROP[id]?.name || "Custom drop", color: M.DROP[id]?.color || "#8a8f98", drops: Math.round(acc[id].drops), grams: acc[id].grams }))
    .filter((x) => x.drops > 0 || x.grams > 0.005);
  // Per-stream breakdown so split recipes can show which drops go into Water A vs Water B.
  const sKeys = mode === "split" ? ["a", "b"] : ["s"];
  const sLabels = mode === "split" ? ["Water A", "Water B"] : ["Water"];
  const streams = parts.map((c, i) => {
    const k = sKeys[i];
    const sv = fvol(k, k === "s" ? 500 : 0);
    return {
      label: sLabels[i], kit: "", vol: sv, tgt: doseGl(c, sv), ppm: dosePpm(c, sv),
      drops: Math.round(c.totd), grams: c.tot,
      breakdown: c.ids
        .map((id) => ({ id, name: M.DROP[id]?.name || "Custom drop", color: M.DROP[id]?.color || "#8a8f98", drops: Math.round(c.d[id] || 0), grams: c.g[id] || 0 }))
        .filter((x) => x.drops > 0 || x.grams > 0.005),
    };
  });
  const mgca = ions.Ca > 0 ? (ions.Mg / 24.31) / (ions.Ca / 40.08) : null;
  return {
    mode, kit, style, vol: volL, gl: glL, ppm, drops: Math.round(drops), grams,
    GH: Math.round(ions.Ca * 2.497 + ions.Mg * 4.118), KH: Math.round(ions.HCO3 * 0.8197),
    Ca: Math.round(ions.Ca), Mg: Math.round(ions.Mg), HCO3: Math.round(ions.HCO3),
    mgca, dropsPerG: rec.drops_per_g || 20, breakdown, streams,
    start: start ? { type: String(start.type || "custom"), gh: Math.round(+start.gh || 0), kh: Math.round(+start.kh || 0) } : null,
    brew: (r.brew && typeof r.brew === "object") ? r.brew : null,
    pour: Array.isArray(r.pour) ? r.pour : null,
    temps: { s: r.tempS, a: r.tempA, b: r.tempB },
  };
}

// The recipe's gear resolved to names, as JSON (for /api/recipe/:id). Mirrors the
// lookups brewSection does for its "How it's brewed" table, so the native page and
// the web page name the same brewer/filter/grinder. Null when the recipe has no
// brew block — older recipes stay clean, exactly as brewSection returns "".
export function recipeGearJson(st: ReturnType<typeof recipeModel>, G: GearModel): any {
  const brew: any = st.brew;
  if (!brew) return null;
  const pick = (row: any, spec: string) => row ? {
    id: row.id, name: `${row.brand || ""} ${row.model || ""}`.trim(), spec: spec || null,
  } : null;
  const g = brew.grinder ? G.grinder[brew.grinder] : null;
  return {
    brewer: pick(brew.brewer ? G.brewer[brew.brewer] : null, (brew.brewer ? G.brewer[brew.brewer]?.filter_format : "") || ""),
    filter: pick(brew.filter ? G.filter[brew.filter] : null, (brew.filter ? (G.filter[brew.filter]?.material || G.filter[brew.filter]?.format) : "") || ""),
    grinder: pick(g, g ? [g.burr_mm ? `${g.burr_mm}mm` : "", g.burr_type ? `${g.burr_type} burr` : ""].filter(Boolean).join(" ") : ""),
    grind: brew.grind || null,
    dose_g: brew.dose_g != null && brew.dose_g !== "" ? +brew.dose_g : null,
    ratio: brew.ratio != null && brew.ratio !== "" ? +brew.ratio : null,
  };
}

// Render the "How it's brewed" section (gear + pour schedule) for a recipe page.
// Returns "" when the recipe carries no brew data, so older recipes stay clean.
export function brewSection(st: ReturnType<typeof recipeModel>, G: GearModel): string {
  const brew = st.brew, pour = st.pour;
  const hasGear = brew && (brew.brewer || brew.filter || brew.grinder || brew.grind || brew.dose_g || brew.ratio);
  const hasPour = pour && pour.length;
  if (!hasGear && !hasPour) return "";

  const gearRow = (label: string, row: any, icon: string, base?: string, spec?: string) => {
    if (!row) return "";
    const name = `${row.brand || ""} ${row.model || ""}`.trim();
    const nameHtml = base ? `<a href="${base}/${encodeURIComponent(row.id)}">${esc(name)}</a>` : esc(name);
    return `<tr><th class="left"><span class="cluster gap" style="align-items:center"><i data-icon="${esc(row.icon || icon)}"></i> ${esc(label)}</span></th>` +
      `<td>${nameHtml}${spec ? ` <span class="data">· ${esc(spec)}</span>` : ""}</td></tr>`;
  };
  const txtRow = (label: string, val: string, icon: string) =>
    val ? `<tr><th class="left"><span class="cluster gap" style="align-items:center"><i data-icon="${esc(icon)}"></i> ${esc(label)}</span></th><td>${esc(val)}</td></tr>` : "";

  let gearTbl = "";
  if (hasGear) {
    const b = brew.brewer ? G.brewer[brew.brewer] : null;
    const f = brew.filter ? G.filter[brew.filter] : null;
    const g = brew.grinder ? G.grinder[brew.grinder] : null;
    const water = (+brew.dose_g > 0 && +brew.ratio > 0) ? Math.round(+brew.dose_g * +brew.ratio) : 0;
    const recipeStr = (+brew.dose_g > 0 || +brew.ratio > 0)
      ? `${(+brew.dose_g || 0)} g${+brew.ratio ? ` · 1:${+brew.ratio}` : ""}${water ? ` → ${water} mL` : ""}` : "";
    gearTbl =
      `<table class="ledger" style="margin-top:var(--space-4)"><thead><tr><th colspan="2" class="left">How it’s brewed <span class="data">gear &amp; technique</span></th></tr></thead><tbody>` +
      gearRow("Brewer", b, "dripper", "/library/brewers", b?.filter_format) +
      gearRow("Filter", f, "filter-flat", "/library/filters", f?.material || f?.format) +
      gearRow("Grinder", g, "grinder", "/library/grinders", g ? [g.burr_mm ? `${g.burr_mm}mm` : "", g.burr_type ? `${g.burr_type} burr` : ""].filter(Boolean).join(" ") : "") +
      txtRow("Grind", brew.grind || "", "grinder") +
      txtRow("Dose · ratio", recipeStr, "scale") +
      `</tbody></table>`;
  }

  let pourTbl = "";
  if (hasPour) {
    const wMeta = (w: string) => w === "a" ? { name: "Water A", t: st.temps.a } : w === "b" ? { name: "Water B", t: st.temps.b } : { name: "", t: st.temps.s };
    const rows = (pour as any[]).map((s, i) => {
      const m = wMeta(s.w || "s");
      const temp = (s.temp != null && s.temp !== "") ? s.temp : (m.t != null ? m.t : "");
      const label = (i === 0 ? "Bloom" : `Pour ${i}`);
      const wTag = (m.name && s.w) ? ` <span class="tag sm">${esc(m.name)}</span>` : "";
      return `<tr><th class="left">${esc(label)}${wTag}</th>` +
        `<td>${s.t ? esc(s.t) : ""}</td>` +
        `<td class="numeric">${s.g ? esc(String(s.g)) + " g" : ""}</td>` +
        `<td class="numeric">${s.sec ? esc(String(s.sec)) + " s" : ""}</td>` +
        `<td class="numeric">${temp !== "" ? esc(String(temp)) + "°" : ""}</td>` +
        `<td>${s.agit ? esc(String(s.agit)) : ""}</td></tr>`;
    }).join("");
    pourTbl =
      `<table class="ledger" style="margin-top:var(--space-4)"><thead><tr><th colspan="6" class="left">Pour schedule <span class="data">step by step</span></th></tr>` +
      `<tr><th class="left">Step</th><th class="left">Note</th><th class="left">Pour</th><th class="left">Time</th><th class="left">Temp</th><th class="left">Agitation</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  return gearTbl + pourTbl;
}

// Recipe stat chips for the logbook list rows — the server mirror of the client
// statChipsHtml(setupStats(...)) (public/index.html ~2563). Reuses recipeModel for
// the chemistry; resolves gear names from the GearModel. Icons are emitted as
// <i data-icon="…"> placeholders (Press is client-only) and hydrated by the
// htmx:afterSwap handler in the SPA. Append breakdown line under the chips.
export function recipeChips(rec: any, M: DropModel, G: GearModel): string {
  const st = recipeModel(rec, M);
  const brew: any = st.brew;
  const bw: any = brew && brew.brewer ? G.brewer[brew.brewer] : null;
  const gr: any = brew && brew.grinder ? G.grinder[brew.grinder] : null;
  const brewer = bw ? `${bw.brand} ${bw.model}` : "";
  const brewerIcon = (bw && bw.icon) || "dripper";
  const grinder = gr ? `${gr.brand} ${gr.model}` : "";
  const grinderIcon = (gr && gr.icon) || "grinder";

  const icon = (n: string) => `<i data-icon="${esc(n)}"></i>`;
  const chip = (ic: string, val: string) =>
    `<span class="cluster" style="gap:5px;align-items:center;white-space:nowrap">${ic}<b>${val}</b></span>`;

  const bd = (st.breakdown || []) as any[];
  // The drop name is capped + ellipsised so a long custom name can never overflow the row.
  const breakdown = bd.length
    ? `<span class="cluster" style="gap:var(--space-3);flex-wrap:wrap;margin-top:4px;font-size:.85em;color:var(--text-2)">` +
      bd.map((x) => `<span style="white-space:nowrap;max-width:100%"><i class="cdot" style="--c:${esc(x.color)}"></i><span style="display:inline-block;max-width:12rem;overflow:hidden;text-overflow:ellipsis;vertical-align:bottom">${esc(x.name)}</span> <b>${x.drops}</b> dr</span>`).join("") +
      `</span>`
    : "";

  return (
    `<span class="cluster" style="gap:var(--space-3);flex-wrap:wrap;color:var(--text-2)">` +
    chip(icon("coffee-process"), esc(st.style)) +
    chip(icon("flask"), esc(st.vol)) +
    chip(icon("target"), esc(st.ppm + " ppm · " + st.gl)) +
    chip(icon("dropper"), st.drops + " drops") +
    chip(icon("gem"), "GH " + st.GH) +
    chip(icon("droplet-fizz"), "KH " + st.KH) +
    (brewer ? chip(icon(brewerIcon), esc(brewer)) : "") +
    (grinder ? chip(icon(grinderIcon), esc(grinder)) : "") +
    `</span>` + breakdown
  );
}
