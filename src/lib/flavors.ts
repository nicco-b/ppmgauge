// Flavor-wheel rendering + resolution. flavorSwatch/flavorTree/flavorNoteDetail
// render the SCA·WCR wheel (titled PRESS ledgers, htmx note detail);
// resolveFlavorText maps free-text bag/tasting prose onto ref_flavors ids.
// Shared by the /library/flavors pages, the bean cupping section, and api-cupping.
import type { Env } from "../types";
import { esc } from "./http";
import { normRef } from "./graph";

export const flavorSwatch = (c: string, sz = 9) => `<i style="display:inline-block;width:${sz}px;height:${sz}px;border-radius:50%;background:${esc(c || "#999")};vertical-align:middle;margin-right:6px;border:1px solid #0003"></i>`;
// Shared flavor-hierarchy renderer (the "flavor wheel", as titled PRESS .ledger
// tables — one per category, families as rows, notes as tags). Explore-mode notes
// are htmx triggers (tap → load the note's coffees into #flavorDetail); select-mode
// notes are checkbox chips for tagging a tasting later. Colors come from ref_flavors.
export async function flavorTree(env: Env, opts: { mode?: "explore" | "select"; selected?: Set<string> } = {}): Promise<string> {
  const mode = opts.mode || "explore";
  const fl = await env.DB.prepare(`SELECT id,name,parent_id,tier,color FROM ref_flavors ORDER BY rowid`).all();
  const flavors: any[] = (fl.results || []) as any[];
  // How many library coffees carry each note — a hint of which notes are worth a tap.
  const cmap: Record<string, number> = {};
  if (mode === "explore") {
    const cf = await env.DB.prepare(`SELECT flavor_id fid, COUNT(*) n FROM ref_coffee_flavors GROUP BY flavor_id`).all();
    for (const r of (cf.results || []) as any[]) cmap[r.fid] = r.n;
  }
  const kids: Record<string, any[]> = {};
  for (const f of flavors) { const k = f.parent_id || ""; (kids[k] = kids[k] || []).push(f); }
  const note = (f: any): string => {
    if (mode === "select") {
      const on = opts.selected && opts.selected.has(f.id) ? " checked" : "";
      return `<label class="chip">${flavorSwatch(f.color)}<input type="checkbox" class="flavor-pick" value="${esc(f.id)}"${on} hidden>${esc(f.name)}</label>`;
    }
    const n = cmap[f.id] || 0;
    const badge = n ? ` <span class="data numeric" style="font-size:.8em">${n}</span>` : "";
    return `<span class="tag" role="button" tabindex="0" style="cursor:pointer" hx-get="/library/flavors/note/${esc(f.id)}" hx-target="#flavorDetail" hx-swap="innerHTML">${flavorSwatch(f.color)}${esc(f.name)}${badge}</span>`;
  };
  const wrap = mode === "select" ? "chip-list" : "cluster gap";
  const categoryLedger = (cat: any): string => {
    const fams = kids[cat.id] || [];
    const withKids = fams.filter((f) => (kids[f.id] || []).length);
    const leaves = fams.filter((f) => !(kids[f.id] || []).length);
    const famLabel = (fam: any) => mode === "select"
      ? esc(fam.name)
      : `<span role="button" tabindex="0" style="cursor:pointer" hx-get="/library/flavors/note/${esc(fam.id)}" hx-target="#flavorDetail" hx-swap="innerHTML">${esc(fam.name)}</span>`;
    let rows = withKids.map((fam) =>
      `<tr><th>${famLabel(fam)}</th><td><div class="${wrap}">${(kids[fam.id] || []).map(note).join("")}</div></td></tr>`
    ).join("");
    if (leaves.length) rows += `<tr><th class="data">More</th><td><div class="${wrap}">${leaves.map(note).join("")}</div></td></tr>`;
    return `<table class="ledger" style="margin-top:var(--space-4)"><thead><tr><th colspan="2" class="left">${flavorSwatch(cat.color, 11)}${esc(cat.name)}</th></tr></thead><tbody>${rows}</tbody></table>`;
  };
  return (kids[""] || []).map(categoryLedger).join("");
}
// htmx partial: the detail for one flavor note — its path + which library coffees show it.
export async function flavorNoteDetail(env: Env, id: string): Promise<string> {
  const f: any = await env.DB.prepare(`SELECT id,name,parent_id,color,aliases FROM ref_flavors WHERE id=?`).bind(id).first();
  if (!f) return `<table class="ledger"><tbody><tr><td class="data">Unknown note.</td></tr></tbody></table>`;
  let bagTerms: string[] = [];
  if (f.aliases) { try { bagTerms = JSON.parse(f.aliases); } catch {} }
  const path: string[] = [f.name];
  let pid = f.parent_id;
  for (let i = 0; i < 4 && pid; i++) {
    const p: any = await env.DB.prepare(`SELECT name,parent_id FROM ref_flavors WHERE id=?`).bind(pid).first();
    if (!p) break;
    path.unshift(p.name); pid = p.parent_id;
  }
  const cf = await env.DB.prepare(
    `SELECT c.name nm, c.published_score sc, co.name country FROM ref_coffee_flavors x JOIN ref_coffees c ON c.id=x.coffee_id LEFT JOIN ref_countries co ON co.code=c.country_code WHERE x.flavor_id=? ORDER BY c.published_score DESC`
  ).bind(id).all();
  const coffees = (cf.results || []) as any[];
  const coffeeRows = coffees.length
    ? coffees.map((c) => `<tr><th>${esc(c.nm)}</th><td>${esc(c.country || "")}${c.sc ? ` <span class="data numeric">${c.sc}</span>` : ""}</td></tr>`).join("")
    : `<tr><td colspan="2" class="data">No coffees in the library list this note yet — log a cupping to start tracking it.</td></tr>`;
  const bags = bagTerms.length
    ? `<p style="margin:0 0 var(--space-2)"><span class="data">On bags:</span> ${bagTerms.map((t) => `<span class="tag">${esc(t)}</span>`).join(" ")}</p>`
    : "";
  return `<div class="cluster gap" style="align-items:center;margin-bottom:var(--space-1)">${flavorSwatch(f.color, 13)}<strong>${esc(f.name)}</strong></div>` +
    `<p class="data" style="margin:0 0 var(--space-2)">${path.map(esc).join(" › ")}</p>` +
    bags +
    `<table class="ledger"><thead><tr><th colspan="2" class="left">Found in</th></tr></thead><tbody>${coffeeRows}</tbody></table>`;
}

// Free-text → flavor-wheel resolver. Maps messy bag/tasting prose onto ref_flavors
// ids using the wheel's names + bag-synonym aliases. Splits on punctuation/conjunctions,
// then per phrase: exact name/alias match, else longest contained term (≥4 chars).
export async function resolveFlavorText(env: Env, text: string): Promise<{ id: string; name: string }[]> {
  if (!normRef(text)) return [];
  const all = await env.DB.prepare("SELECT id,name,aliases FROM ref_flavors").all();
  const terms: { term: string; id: string; name: string }[] = [];
  for (const f of (all.results || []) as any[]) {
    terms.push({ term: normRef(f.name), id: f.id, name: f.name });
    if (f.aliases) { try { for (const a of JSON.parse(f.aliases)) terms.push({ term: normRef(a), id: f.id, name: f.name }); } catch {} }
  }
  terms.sort((a, b) => b.term.length - a.term.length); // greedy: prefer the longest match
  const phrases = normRef(text).split(/[,;/&·]| and | with | & | then /).map((s) => s.trim()).filter(Boolean);
  const found = new Map<string, string>();
  for (const ph of phrases) {
    let hit = terms.find((t) => t.term === ph);
    if (!hit) hit = terms.find((t) => t.term.length >= 4 && (ph.includes(t.term) || t.term.includes(ph)));
    if (hit) found.set(hit.id, hit.name);
  }
  return [...found].map(([id, name]) => ({ id, name }));
}
