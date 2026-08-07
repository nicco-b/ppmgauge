// Bean passport — assemble a bean's resolved ref_* links (variety/process/region/
// producer) into a graph, and render it as PRESS ledger tables. varietyFamily,
// fmtAlt and PP_MONTHS are shared geo/variety formatters used across the library
// reference pages too. Pure read; reference data is never edited here.
import type { Env } from "../types";
import { esc } from "./http";

export const PP_MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Bucket a variety's lineage into one of WCR's genetic families → (press icon, label).
// Varieties have no reliable per-cultivar look, but the ~4 families do read as icons.
export function varietyFamily(lineage: string): { icon: string; label: string } {
  const l = String(lineage || "").toLowerCase();
  if (/timor|catimor|sarchimor|robusta/.test(l)) return { icon: "variety-resistant", label: "Introgressed · rust-resistant" };
  if (/ethiopia|landrace/.test(l)) return { icon: "variety-landrace", label: "Ethiopian landrace" };
  if (/bourbon/.test(l)) return { icon: "variety-bourbon", label: "Bourbon family" };
  if (/typica/.test(l)) return { icon: "variety-typica", label: "Typica family" };
  return { icon: "coffee-bean", label: "Cultivar" };
}
export const fmtAlt = (a: any, b: any) => (a && b ? `${a}–${b} masl` : a ? `${a}+ masl` : b ? `up to ${b} masl` : "");
// Assemble the reference graph for a bean from its resolved *_id links.
export async function assemblePassport(env: Env, links: any): Promise<any> {
  const pp: any = {};
  if (links.variety_id) {
    const v: any = await env.DB.prepare(`SELECT * FROM ref_varieties WHERE id=?`).bind(links.variety_id).first();
    if (v) {
      const par = await env.DB.prepare(`SELECT vr.name FROM ref_variety_lineage l JOIN ref_varieties vr ON vr.id=l.parent_id WHERE l.child_id=?`).bind(links.variety_id).all();
      v.parents = (par.results || []).map((x: any) => x.name);
      pp.variety = v;
    }
  }
  if (links.process_id) pp.process = await env.DB.prepare(`SELECT * FROM ref_processes WHERE id=?`).bind(links.process_id).first();
  if (links.region_id) {
    const r: any = await env.DB.prepare(`SELECT * FROM ref_regions WHERE id=?`).bind(links.region_id).first();
    if (r) {
      const hw = await env.DB.prepare(`SELECT label,start_month,end_month FROM ref_harvest_windows WHERE country_code=? ORDER BY rowid`).bind(r.country_code).all();
      r.country = await env.DB.prepare(`SELECT name,hemisphere FROM ref_countries WHERE code=?`).bind(r.country_code).first();
      r.harvest = hw.results || [];
      pp.region = r;
    }
  }
  if (links.producer_id) pp.producer = await env.DB.prepare(`SELECT * FROM ref_producers WHERE id=?`).bind(links.producer_id).first();
  return pp;
}
// The same assembled passport as a stable JSON projection, for native clients
// (/api/bean/:id). Explicit field lists — a new ref_* column must be added here
// deliberately, so the public shape never widens by accident. Family label and
// altitude strings are shared with renderPassport so both readers agree.
export function passportJson(pp: any): any {
  const v = pp.variety, pr = pp.process, r = pp.region, p = pp.producer;
  return {
    variety: v ? {
      id: v.id, name: v.name, species: v.species || null, lineage: v.lineage || null,
      parents: v.parents || [], flavor_potential: v.flavor_potential || null,
      family: varietyFamily(v.lineage), altitude: fmtAlt(v.optimal_alt_min_m, v.optimal_alt_max_m),
    } : null,
    process: pr ? {
      id: pr.id, name: pr.name, category: pr.category || null,
      explainer: pr.explainer || null, flavor_effect: pr.flavor_effect || null,
    } : null,
    region: r ? {
      id: r.id, name: r.name,
      country: r.country ? { name: r.country.name, hemisphere: r.country.hemisphere || null } : null,
      altitude: fmtAlt(r.altitude_min_m, r.altitude_max_m),
      harvest: (r.harvest || []).map((h: any) => ({
        label: h.label || "",
        span: h.start_month && h.end_month ? `${PP_MONTHS[h.start_month]}–${PP_MONTHS[h.end_month]}` : "",
      })),
    } : null,
    producer: p ? {
      id: p.id, name: p.name, kind: p.kind || null, owner: p.owner || null,
      altitude: fmtAlt(p.altitude_min_m, p.altitude_max_m), story: p.story || null,
      confidence: p.confidence || null, source: p.source || null, source_url: p.source_url || null,
    } : null,
  };
}
// Render the passport as PRESS .ledger tables — only facets that resolved appear,
// so it stays dense without padding. Reference data is read-only (no inputs).
export function renderPassport(pp: any): string {
  const led = (title: string, tag: string, rows: string) =>
    `<table class="ledger" style="margin-top:var(--space-4)"><thead><tr><th colspan="2" class="left">${title}${tag ? ` <span class="data">${tag}</span>` : ""}</th></tr></thead><tbody>${rows}</tbody></table>`;
  const row = (h: string, d: string) => (d ? `<tr><th>${esc(h)}</th><td>${d}</td></tr>` : "");
  let out = "";
  const v = pp.variety;
  if (v) {
    const lineage = [v.lineage, v.parents && v.parents.length ? `parent: ${v.parents.map(esc).join(" × ")}` : ""].filter(Boolean).join(" · ");
    const fam = varietyFamily(v.lineage);
    out += led(`<i data-icon="${fam.icon}"></i> Variety`, "World Coffee Research",
      row("Variety", `<a href="/library/varieties/${encodeURIComponent(v.id)}">${esc(v.name)}</a>${v.species ? ` <span class="data">${esc(v.species)}</span>` : ""}`) +
      row("Family", `<span class="cluster gap" style="align-items:center"><i data-icon="${fam.icon}"></i> ${esc(fam.label)}</span>`) +
      row("Lineage", esc(lineage)) +
      row("Flavor", `<span class="data">${esc(v.flavor_potential || "")}</span>`) +
      row("Optimal", esc(fmtAlt(v.optimal_alt_min_m, v.optimal_alt_max_m))));
  }
  const pr = pp.process;
  if (pr) out += led("Process", "reference",
    row("Process", `<a href="/library/processes/${encodeURIComponent(pr.id)}">${esc(pr.name)}</a>${pr.category ? ` <span class="data">${esc(pr.category)}</span>` : ""}`) +
    row("What happens", `<span class="data">${esc(pr.explainer || "")}</span>`) +
    row("In the cup", esc(pr.flavor_effect || "")));
  const r = pp.region;
  if (r) {
    const harvest = (r.harvest || []).map((h: any) => {
      const span = h.start_month && h.end_month ? `${PP_MONTHS[h.start_month]}–${PP_MONTHS[h.end_month]}` : "";
      return [h.label, span].filter(Boolean).join(" ");
    }).filter(Boolean).join(" · ");
    out += led("Origin", "reference",
      row("Region", `<a href="/library/regions/${encodeURIComponent(r.id)}">${esc(r.name)}</a>${r.country ? `, ${esc(r.country.name)}` : ""}`) +
      row("Altitude", esc(fmtAlt(r.altitude_min_m, r.altitude_max_m))) +
      row("Harvest", esc(harvest)));
  }
  const p = pp.producer;
  if (p) {
    const conf = p.confidence && p.confidence !== "curated" ? `${esc(p.confidence)} confidence` : "verified";
    out += led("Producer", conf,
      row("Producer", `<a href="/library/producers/${encodeURIComponent(p.id)}">${esc(p.name)}</a>${p.kind ? ` <span class="data">${esc(p.kind)}</span>` : ""}`) +
      row("Owner", esc(p.owner || "")) +
      row("Altitude", esc(fmtAlt(p.altitude_min_m, p.altitude_max_m))) +
      row("Story", `<span class="data">${esc(p.story || "")}</span>`) +
      (p.source_url ? row("Source", `<a href="${esc(p.source_url)}" class="data" target="_blank" rel="noopener">${esc(p.source || "source")}</a>`) : ""));
  }
  if (!out) return "";
  return `<section class="section"><span class="eyebrow">bean passport</span>${out}</section>`;
}
