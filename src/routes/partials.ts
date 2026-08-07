// htmx list partials for the logbook (auth-gated). Each returns the same ledger
// fragment the app IIFE's render* functions build today, so the client can swap a
// hand-written JS list for `hx-get` + `hx-trigger="load, refresh"`. Built additively
// (these endpoints exist before the client is rewired), so they ship risk-free.
import type { Env } from "../types";
import type { User } from "../auth";
import { esc } from "../lib/http";
import { row, ledger, thumb, htmlFragment } from "../lib/ledger";
import { recipeRows } from "./api-crud";
import { loadDropModel, loadGear, recipeChips, type DropModel, type GearModel } from "../lib/catalog";

// GET /partials/brews — the logbook's brew history (newest first). Mirrors the
// client renderBrews(): recipe/bean *names* come from a server JOIN (the client
// read them from its RECIPES/BEANS caches), thumbnails from /api/photo.
export async function brewsPartial(env: Env, owner: string): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT br.*, r.name AS recipe_name, b.name AS bean_name
       FROM brews br
       LEFT JOIN recipes r ON r.id = br.recipe_id
       LEFT JOIN beans   b ON b.id = br.bean_id
      WHERE br.owner = ?
      ORDER BY br.brewed_at DESC`).bind(owner).all();
  const rows = (results || []) as any[];
  if (!rows.length) return htmlFragment('<p class="help">No brews logged yet.</p>');

  const body = rows.map((x) => {
    const bean = x.bean_id && x.bean_name ? x.bean_name : "—";
    const rec = x.recipe_id && x.recipe_name ? x.recipe_name : "current";
    const when = (x.brewed_at || "").slice(0, 10);
    const sub =
      "GH " + Math.round(x.gh || 0) + " · KH " + Math.round(x.kh || 0) +
      " · TDS " + Math.round(x.tds || 0) + " · " + esc(rec) + " · " + esc(bean) +
      (when ? " · " + when : "");
    const stars = "★".repeat(x.score || 0) + "☆".repeat(5 - (x.score || 0));
    const title =
      thumb(x.photo_key) +
      '<span class="numeric" style="color:var(--positive)">' + stars + "</span> " +
      esc(x.tasting_note || "(no note)");
    const acts =
      '<button class="button sm secondary" hx-delete="/api/brews/' + esc(x.id) +
      '" hx-confirm="Delete this brew?" hx-swap="none" title="delete">✕</button>';
    return row(title, sub, acts);
  }).join("");

  return htmlFragment(ledger(body));
}

// GET /partials/beans — the logbook bean list. Swaps the <tbody> #bnListBody, so
// returns bare <tr> rows (2 cols). Rows are `clickable` with data-bean → the
// server-rendered /bean/:id page (click is delegated client-side). Mirrors
// renderBeans(); loadBeans still fetches once to feed the BEANS cache + the
// brew-form bean <select>.
export async function beansPartial(env: Env, owner: string): Promise<Response> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM beans WHERE owner = ? ORDER BY rowid DESC").bind(owner).all();
  const rows = (results || []) as any[];
  if (!rows.length)
    return htmlFragment('<tr><th colspan="2" class="left"><span class="help">No beans yet — add one above.</span></th></tr>');

  const body = rows.map((x) => {
    const meta = [x.roaster, x.origin, x.process, x.varietal, x.roast_date].filter(Boolean).join(" · ");
    const bar = x.color ? ' style="border-left-color:' + esc(x.color) + '"' : "";
    return (
      '<tr class="clickable" data-bean="' + esc(x.id) + '">' +
      "<th" + bar + ">" + esc(x.name) + "</th>" +
      '<td class="data">' + esc(meta) + "</td></tr>"
    );
  }).join("");

  return htmlFragment(body);
}

// GET /partials/readings — calibration readings (measured GH/KH/TDS + the modeled
// T/J/L ppm). Swaps the <tbody> #readListBody, so this returns bare <tr> rows
// (no table wrapper). Mirrors the client renderReadings(); the #readCtx side-line
// (WaterLab.context()) stays a JS concern.
export async function readingsPartial(env: Env, owner: string): Promise<Response> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM readings WHERE owner = ? ORDER BY rowid DESC").bind(owner).all();
  const rows = (results || []) as any[];
  if (!rows.length)
    return htmlFragment(
      '<tr><td colspan="3" class="left" style="border-left:4px solid var(--rule)"><span class="help">No readings yet — record a measured GH/KH for a known water above.</span></td></tr>',
    );

  const body = rows.map((x) => {
    let m: any = { T: 0, J: 0, L: 0 };
    try { m = JSON.parse(x.ratios); } catch {}
    const meas: string[] = [];
    if (x.measured_gh != null) meas.push("GH " + x.measured_gh);
    if (x.measured_kh != null) meas.push("KH " + x.measured_kh);
    if (x.measured_tds != null) meas.push("TDS " + x.measured_tds);
    return row(
      esc(meas.join(" · ") || "(reading)"),
      "T" + Math.round(m.T || 0) + " · J" + Math.round(m.J || 0) + " · L" + Math.round(m.L || 0) + " ppm",
      '<button class="button sm secondary" hx-delete="/api/readings/' + esc(x.id) + '" hx-confirm="Delete this reading?" hx-swap="none" title="delete">✕</button>',
    );
  }).join("");

  return htmlFragment(body);
}

// ── Recipe lists (mine / favorites / pool) ───────────────────────────────────
// recRow mirrors the client recRow(): ★ toggle + recipe stat chips (icons hydrated
// client-side) + attribution + fav count + shared badge + owner/auth-dependent
// actions. Load/Open stay JS data-act buttons (they drive the calc island);
// star/share/delete/adopt are still JS for now (Phase 2 moves them to hx-*).
function recRow(x: any, user: User | null, M: DropModel, G: GearModel): string {
  const mine = !!(user && x.owner === user.id);
  const star =
    `<button class="button sm secondary" hx-post="/api/favorites" hx-vals='{"kind":"recipe","ref_id":"${esc(x.id)}"}' hx-swap="none" title="${x.fav ? "Unfavorite" : "Favorite"}" aria-pressed="${x.fav ? "true" : "false"}">${x.fav ? "★" : "☆"}</button>`;
  const sub =
    recipeChips(x, M, G) +
    (!mine && x.dn ? ` <span class="data">· by ${esc(x.dn)}</span>` : "") +
    (x.fav_count ? ` <span class="tag">★ ${x.fav_count}</span>` : "") +
    (mine && x.shared ? ` <span class="tag positive" style="padding:0 4px">shared</span>` : "");
  const acts =
    star +
    `<button class="button sm secondary" data-act="rload" data-id="${esc(x.id)}">Load</button>` +
    `<button class="button sm secondary" data-act="ropen" data-id="${esc(x.id)}">Open</button>` +
    (mine
      ? `<button class="button sm secondary" hx-put="/api/recipes/${esc(x.id)}" hx-vals='{"shared":${x.shared ? 0 : 1}}' hx-swap="none">${x.shared ? "Unshare" : "Share"}</button>` +
        `<button class="button sm secondary" hx-delete="/api/recipes/${esc(x.id)}" hx-confirm="Delete this recipe?" hx-swap="none" title="delete">✕</button>`
      : `<button class="button sm secondary" hx-post="/api/recipes/${esc(x.id)}/adopt" hx-swap="none">Adopt</button>`);
  return row(esc(x.name), sub, acts);
}

// cap to N rows; an htmx "view all" row re-fetches the list expanded (?expand=1).
function cappedBody(
  rows: any[], cap: number, expand: boolean, label: string, hxUrl: string, target: string,
  user: User | null, M: DropModel, G: GearModel,
): string {
  const shown = expand ? rows : rows.slice(0, cap);
  let html = shown.map((x) => recRow(x, user, M, G)).join("");
  if (!expand && rows.length > cap)
    html += `<tr><td colspan="3" class="left"><a href="#" hx-get="${hxUrl}" hx-target="${target}" hx-swap="innerHTML">${label.replace("{n}", String(rows.length))}</a></td></tr>`;
  return html;
}

// GET /partials/recipes[?expand=1] — the user's own recipes (#recList). Capped at 6.
export async function recipesMinePartial(env: Env, user: User, expand: boolean): Promise<Response> {
  const rows = await recipeRows(env, user.id, "mine");
  const M = await loadDropModel(env, rows.map((r) => r.owner)); // resolve custom drops by author
  const G = await loadGear(env);
  const body = rows.length
    ? cappedBody(rows, 6, expand, "View all {n} recipes →", "/partials/recipes?expand=1", "#recList", user, M, G)
    : '<tr><th colspan="3" class="left"><span class="help">No saved recipes yet — set up your water above, name it, and hit Save.</span></th></tr>';
  return htmlFragment(ledger(body, "My recipes"));
}

// GET /partials/recipes/favorites[?expand=1] — starred recipes (#favList). Empty →
// empty fragment (the Favorites group only appears once you've starred something).
export async function recipesFavPartial(env: Env, user: User, expand: boolean): Promise<Response> {
  const rows = await recipeRows(env, user.id, "favorites");
  if (!rows.length) return htmlFragment("");
  const M = await loadDropModel(env, rows.map((r) => r.owner));
  const G = await loadGear(env);
  const body = cappedBody(rows, 6, expand, "View all {n} favorites →", "/partials/recipes/favorites?expand=1", "#favList", user, M, G);
  return htmlFragment(ledger(body, "★ Favorites"));
}

// GET /partials/recipes/pool — top community recipes (#poolList). Capped to 6 in
// the query (no expand); a Refresh button re-fetches, a link to the full /recipes page.
export async function recipesPoolPartial(env: Env, user: User): Promise<Response> {
  const rows = await recipeRows(env, user.id, "pool", 6);
  const M = await loadDropModel(env, rows.map((r) => r.owner));
  const G = await loadGear(env);
  const body = rows.length
    ? rows.map((x) => recRow(x, user, M, G)).join("") +
      '<tr><td colspan="3" class="left"><a href="/recipes">Browse all community recipes →</a></td></tr>'
    : '<tr><th colspan="3" class="left"><span class="help">No community recipes yet. Share one of yours to seed the pool.</span></th></tr>';
  const title =
    '<span style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-3)">Top community recipes ' +
    '<button class="button sm secondary" type="button" hx-get="/partials/recipes/pool" hx-target="#poolList" hx-swap="innerHTML">Refresh</button></span>';
  return htmlFragment(ledger(body, title));
}
