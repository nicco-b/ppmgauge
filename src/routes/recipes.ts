// Public recipe pages: the community pool index (/recipes) and the shareable
// per-recipe page (/recipe/:id), both server-rendered + SEO'd. The recipe page
// renders the chem model from lib/catalog and links its OG card (lib/og).
import type { Env } from "../types";
import type { User } from "../auth";
import { esc } from "../lib/http";
import { seoShell, recipeShell, SITE } from "../lib/render";
import { loadDropModel, loadGear, recipeModel, brewSection } from "../lib/catalog";

export async function recipesIndex(req: Request, env: Env, url: URL, user: User | null): Promise<Response> {
  const sort = url.searchParams.get("sort") === "new" ? "new" : "top";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1") || 1);
  const per = 60, off = (page - 1) * per;
  const totalRow: any = await env.DB.prepare("SELECT COUNT(*) n FROM recipes WHERE shared=1").first();
  const total = totalRow?.n || 0; const pages = Math.max(1, Math.ceil(total / per));
  const order = sort === "new" ? "r.updated_at DESC" : "fav_count DESC, r.updated_at DESC";
  const favCount = "(SELECT COUNT(*) FROM user_favorites fc WHERE fc.kind='recipe' AND fc.ref_id=r.id)";
  const isFav = user ? "EXISTS(SELECT 1 FROM user_favorites fx WHERE fx.owner=? AND fx.kind='recipe' AND fx.ref_id=r.id)" : "0";
  const sql = `SELECT r.id, r.name, r.mode, r.target_gl, u.display_name dn, ${favCount} fav_count, ${isFav} fav
    FROM recipes r JOIN users u ON u.id=r.owner WHERE r.shared=1 ORDER BY ${order} LIMIT ? OFFSET ?`;
  const rows = (((await (user ? env.DB.prepare(sql).bind(user.id, per, off) : env.DB.prepare(sql).bind(per, off)).all()).results) || []) as any[];

  const byName = (x: any) => esc((x.dn && String(x.dn).trim()) || "a brewer");
  const star = (x: any) => user
    ? `<button class="recstar button sm secondary" data-id="${esc(x.id)}" aria-pressed="${x.fav ? "true" : "false"}" title="${x.fav ? "Unfavorite" : "Favorite"}">${x.fav ? "★" : "☆"} <b class="rc">${x.fav_count || 0}</b></button>`
    : `<span class="data" title="${x.fav_count || 0} saved">★ ${x.fav_count || 0}</span>`;
  const body = rows.length ? rows.map((x) =>
    `<tr><th class="left"><a href="/recipe/${esc(x.id)}">${esc(x.name)}</a></th>` +
    `<td>${byName(x)}</td>` +
    `<td class="numeric data">${esc(String(x.target_gl ?? ""))} g/L · ${esc(x.mode)}</td>` +
    `<td class="numeric">${star(x)}</td></tr>`).join("")
    : `<tr><td colspan="4" class="left"><span class="help">No community recipes yet — share one from your logbook to seed the pool.</span></td></tr>`;

  const sortTab = (key: string, label: string) => key === sort ? `<b>${label}</b>` : `<a href="/recipes?sort=${key}">${label}</a>`;
  const pager = `<nav class="pager" style="margin-top:var(--space-4)">` +
    (page > 1 ? `<a class="prev" href="/recipes?sort=${sort}&page=${page - 1}">Previous</a>` : `<span class="prev muted">Previous</span>`) +
    `<span class="data">Page ${page} / ${pages} · ${total} recipes</span>` +
    (page < pages ? `<a class="next" href="/recipes?sort=${sort}&page=${page + 1}">Next</a>` : `<span class="next muted">Next</span>`) +
    `</nav>`;

  const inner =
    `<section class="section">` +
    `<table class="ledger"><caption>Community recipes <span class="data" style="font-weight:400">— brew-water recipes shared by ppmgauge members · ${sortTab("top", "Top")} · ${sortTab("new", "Newest")}</span></caption>` +
    `<thead><tr><th class="left">Recipe</th><th class="left">By</th><th class="left">Water</th><th class="numeric">Saves</th></tr></thead><tbody>${body}</tbody></table>` +
    pager +
    (user ? "" : `<p class="data" style="margin-top:var(--space-3)">Sign in on <a href="/">ppmgauge</a> to save favorites and share your own.</p>`) +
    `</section>` +
    (user ? `<script>(function(){var t=document.querySelector('.ledger');if(!t)return;t.addEventListener('click',function(e){var b=e.target.closest('.recstar');if(!b)return;e.preventDefault();fetch('/api/favorites',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'recipe',ref_id:b.getAttribute('data-id')})}).then(function(r){return r.json();}).then(function(d){if(!d||d.error)return;var on=!!d.favorited;b.setAttribute('aria-pressed',on?'true':'false');b.title=on?'Unfavorite':'Favorite';var c=b.querySelector('.rc');var n=parseInt((c&&c.textContent)||'0',10)||0;n=on?n+1:Math.max(0,n-1);if(c)c.textContent=n;b.firstChild.textContent=(on?'\\u2605':'\\u2606')+' ';});});})();</script>` : "");

  return seoShell({
    title: "Community brew-water recipes — ppmgauge",
    desc: `${total} brew-water recipes shared by ppmgauge members — TONIK/JAMM/LYLAC dosing, ranked by saves.`,
    canonical: `${SITE}/recipes${sort === "new" ? "?sort=new" : ""}`, index: true, user,
    crumbs: `<a href="/">ppmgauge</a><span aria-current="page">Community recipes</span>`,
  }, inner);
}

export async function recipePage(req: Request, env: Env, id: string): Promise<Response> {
  const rec: any = await env.DB.prepare(
    "SELECT r.*, u.display_name dn FROM recipes r LEFT JOIN users u ON u.id=r.owner WHERE r.id=?").bind(id).first();
  if (!rec) return recipeShell({ title: "Recipe not found", status: 404 },
    `<section class="section"><div class="signal" style="border-color:var(--negative)">This recipe doesn’t exist or has been removed.</div>` +
    `<p style="margin-top:var(--space-3)"><a class="button sm" href="/">Open ppmgauge →</a></p></section>`);
  const M = await loadDropModel(env, [rec.owner]); // resolve the author's custom drops (name + chemistry)
  const st = recipeModel(rec, M);
  const G = await loadGear(env);

  const stat = (label: string, val: string, hint?: string) =>
    `<div style="flex:1;min-width:96px"><div class="data" style="font-size:.7rem;text-transform:uppercase;letter-spacing:.06em">${label}</div>` +
    `<div class="numeric" style="font-size:1.4rem;font-weight:600;line-height:1.15">${val}</div>` +
    (hint ? `<div class="data" style="font-size:.72rem">${hint}</div>` : "") + `</div>`;
  const bd = st.breakdown.map((x) =>
    `<tr><th class="left" style="border-left-color:${esc(x.color)};word-break:break-word">` +
    `<i style="display:inline-block;width:11px;height:11px;border-radius:2px;background:${esc(x.color)};border:1px solid var(--text);margin-right:8px;vertical-align:middle"></i>${esc(x.name)}</th>` +
    `<td class="numeric">${x.grams.toFixed(2)} g</td><td class="numeric">${x.drops} drops</td></tr>`).join("");

  const inner =
    `<section class="section">` +
    `<span class="eyebrow">${esc(st.style)}</span>` +
    `<h1 style="margin:6px 0 2px">${esc(rec.name)}</h1>` +
    `<p class="data" style="margin:0 0 var(--space-4)">by ${esc((rec.dn && String(rec.dn).trim()) || "a brewer")} · brew-water recipe · ${esc(st.vol)} · ${st.dropsPerG} drops/g${st.start ? ` · ${st.start.type === "ro" ? "RO/distilled" : `from ${st.start.type} water (GH ${st.start.gh} / KH ${st.start.kh})`}` : ""}</p>` +
    `<div class="cluster" style="gap:var(--space-4);flex-wrap:wrap;border-top:2px solid var(--text);border-bottom:1px solid var(--rule);padding:var(--space-3) 0">` +
    stat("Strength", `${st.ppm} ppm`, `in cup &middot; ${esc(st.gl)}`) +
    stat("Total drops", String(st.drops), `${st.grams.toFixed(2)} g concentrate`) +
    stat("Hardness · GH", String(st.GH), "ppm CaCO₃") +
    stat("Alkalinity · KH", String(st.KH), "ppm CaCO₃") +
    stat("Mg:Ca", st.mgca == null ? "all Mg" : `${st.mgca.toFixed(1)} : 1`, "molar") +
    `</div>` +
    // Split recipes: one ledger per water stream so it's clear which drops go where.
    (st.mode === "split" && st.streams.length > 1
      ? st.streams.map((s) =>
          `<table class="ledger" style="margin-top:var(--space-4)"><thead><tr><th colspan="3" class="left">${esc(s.label)} <span class="data">${s.vol} mL · ${s.tgt.toFixed(1)} g/L · ${s.drops} drops</span></th></tr></thead><tbody>` +
          (s.breakdown.length
            ? s.breakdown.map((x) =>
                `<tr><th class="left" style="border-left-color:${esc(x.color)};word-break:break-word"><i style="display:inline-block;width:11px;height:11px;border-radius:2px;background:${esc(x.color)};border:1px solid var(--text);margin-right:8px;vertical-align:middle"></i>${esc(x.name)}</th>` +
                `<td class="numeric">${x.grams.toFixed(2)} g</td><td class="numeric">${x.drops} drops</td></tr>`).join("")
            : `<tr><td colspan="3" class="data">No drops in this water.</td></tr>`) +
          `</tbody></table>`).join("")
      : (st.breakdown.length
        ? `<table class="ledger" style="margin-top:var(--space-4)"><thead><tr><th colspan="3" class="left">Drop breakdown <span class="data">what you dispense</span></th></tr></thead><tbody>${bd}</tbody></table>`
        : "")) +
    `<table class="ledger" style="margin-top:var(--space-4)"><thead><tr><th colspan="2" class="left">Ion profile <span class="data">mg/L</span></th></tr></thead><tbody>` +
    `<tr><th class="left">Ca²⁺ calcium</th><td class="numeric">${st.Ca} mg/L</td></tr>` +
    `<tr><th class="left">Mg²⁺ magnesium</th><td class="numeric">${st.Mg} mg/L</td></tr>` +
    `<tr><th class="left">HCO₃⁻ bicarbonate</th><td class="numeric">${st.HCO3} mg/L</td></tr>` +
    `</tbody></table>` +
    brewSection(st, G) +
    `<p style="margin-top:var(--space-5)"><a class="button" href="/">Build this water in ppmgauge →</a></p>` +
    `<p class="data" style="margin-top:var(--space-3)">ppmgauge.com — analytical brew-water dosing</p>` +
    `</section>`;
  const recUrl = `${SITE}/recipe/${encodeURIComponent(id)}`;
  const ogDesc = `${st.style} brew water — ${st.ppm} ppm in cup · GH ${st.GH} / KH ${st.KH} · ${st.drops} drops (${st.grams.toFixed(2)} g). Build it in ppmgauge.`;
  return recipeShell({ title: rec.name, desc: ogDesc, url: recUrl, ogImage: `${recUrl}/og.png` }, inner);
}
