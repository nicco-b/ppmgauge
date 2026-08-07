// Shared server-render primitives — the page chrome (shells + nav) and the
// reusable ledger/stat/tag helpers for the public reference pages. Pure
// string→Response/HTML (no DB); every page handler in index.ts + routes/* builds
// on these. publicNav is internal (seoShell owns it); everything else is exported.
import { esc } from "./http";

// The one HTML scaffold every server-rendered public page shares: doctype +
// charset/viewport + favicon + the Press CSS/JS, wrapping a <body>. The three
// shells below differ only in their head meta and their nav/crumbs, so they each
// compose those and hand the rest here. `head` goes between viewport and the
// favicon/Press links; `headTail` (style/JSON-LD) after them.
function baseDoc(opts: { head: string; headTail?: string; body: string; status?: number; cache?: string }): Response {
  const html =
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    opts.head +
    `<link rel="icon" href="/favicon.svg" type="image/svg+xml">` +
    `<link rel="stylesheet" href="https://press.gldn.workers.dev/v1/press.css?v=2026-06-04-dotted3">` +
    `<script src="https://press.gldn.workers.dev/v1/press.js?v=2026-06-03-gear-icons" defer></script>` +
    (opts.headTail || "") +
    `</head><body>${opts.body}</body></html>`;
  const headers: Record<string, string> = { "Content-Type": "text/html; charset=utf-8" };
  if (opts.cache) headers["Cache-Control"] = opts.cache;
  return new Response(html, { status: opts.status || 200, headers });
}

// Crumbs sit as a sibling of <main> (not inside it): flush to the deck's
// horizontal edges, no deck top-padding, single margin-top. Shared by bean+seo.
const crumbBar = (crumbs?: string): string =>
  crumbs
    ? `<nav class="crumbs deck" style="padding-top:0;padding-bottom:0;margin-top:var(--space-4)">${crumbs}</nav>`
    : "";

export function beanShell(title: string, header: string, crumbs: string, inner: string): Response {
  return baseDoc({
    head: `<title>${esc(title)} — ppmgauge</title>`,
    body: `${header}${crumbBar(crumbs)}<main class="deck">${inner}</main>`,
  });
}
export const BEAN_NAV = (current: string, user: { email: string; display_name: string | null }) =>
  `<header class="bridge">` +
    `<a href="/" class="callsign" style="text-decoration:none;color:inherit">ppmgauge</a>` +
    `<ul class="nav-list"><li><a href="/water">Water</a></li><li><a href="/logbook"${current === "log" ? ' aria-current="page"' : ""}>Logbook</a></li><li><a href="/library">Library</a></li></ul>` +
    `<span class="bridge-end cluster gap" style="align-items:center"><a class="button sm secondary" href="/account" title="${esc(user.email)}" style="max-width:15rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(user.display_name || user.email)}</a></span>` +
  `</header>`;

// ---------- shareable recipe page (server-rendered, public via unguessable id) ----------

export function recipeShell(opts: { title: string; desc?: string; url?: string; ogImage?: string; status?: number }, inner: string): Response {
  const desc = opts.desc || "A brew-water recipe on ppmgauge.";
  const ogTitle = `${opts.title} — ppmgauge`;
  const header =
    `<header class="bridge"><a href="/" class="callsign" style="text-decoration:none;color:inherit">ppmgauge</a>` +
    `<span class="bridge-end"><a class="button sm secondary" href="/">Open the calculator</a></span></header>`;
  const head =
    `<title>${esc(ogTitle)}</title>` +
    `<meta name="description" content="${esc(desc)}">` +
    // Link-preview / unfurl tags (iMessage, Slack, Twitter, …). og:image points at the
    // Phase-2 card route so it lights up once that ships, no second head edit needed.
    `<meta property="og:title" content="${esc(ogTitle)}">` +
    `<meta property="og:description" content="${esc(desc)}">` +
    `<meta property="og:type" content="article">` +
    (opts.url ? `<meta property="og:url" content="${esc(opts.url)}">` : "") +
    `<meta property="og:site_name" content="ppmgauge">` +
    (opts.ogImage
      ? `<meta property="og:image" content="${esc(opts.ogImage)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(opts.title)} — brew-water recipe">`
      : "") +
    `<meta name="twitter:card" content="summary_large_image">` +
    (opts.ogImage ? `<meta name="twitter:image" content="${esc(opts.ogImage)}">` : "") +
    `<meta name="twitter:title" content="${esc(ogTitle)}"><meta name="twitter:description" content="${esc(desc)}">`;
  return baseDoc({ head, body: `${header}<main class="deck">${inner}</main>`, status: opts.status });
}

export const SITE = "https://ppmgauge.com";
// Shared app nav for server-rendered public pages — matches the SPA bridge
// (Water / Logbook / Library) and is auth-aware on the right.
function publicNav(user: { email: string; display_name: string | null } | null, current?: string): string {
  const right = user
    ? `<a class="button sm secondary" href="/account" title="${esc(user.email)}" style="max-width:15rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(user.display_name || user.email)}</a>`
    : `<a class="button sm secondary" href="/">Open ppmgauge</a>`;
  const cur = (s: string) => (current === s ? ' aria-current="page"' : "");
  return `<header class="bridge">` +
    `<a href="/" class="callsign" style="text-decoration:none;color:inherit">ppmgauge</a>` +
    `<ul class="nav-list"><li><a href="/water">Water</a></li><li><a href="/logbook">Logbook</a></li><li><a href="/library"${cur("library")}>Library</a></li></ul>` +
    `<span class="bridge-end cluster gap" style="align-items:center">${right}</span></header>`;
}
// SEO-friendly public shell: full app nav + breadcrumbs + real <title>/description/
// canonical/OG + optional JSON-LD. `index:false` emits a noindex robots meta.
export function seoShell(opts: { title: string; desc: string; canonical?: string; jsonLd?: any; index?: boolean; status?: number; user?: { email: string; display_name: string | null } | null; crumbs?: string; navCurrent?: string }, inner: string): Response {
  const ld = opts.jsonLd ? `<script type="application/ld+json">${JSON.stringify(opts.jsonLd).replace(/</g, "\\u003c")}</script>` : "";
  const robots = opts.index === false ? `<meta name="robots" content="noindex,follow">` : "";
  const head =
    `<title>${esc(opts.title)}</title>` +
    `<meta name="description" content="${esc(opts.desc)}">` + robots +
    (opts.canonical ? `<link rel="canonical" href="${esc(opts.canonical)}">` : "") +
    `<meta property="og:title" content="${esc(opts.title)}"><meta property="og:description" content="${esc(opts.desc)}"><meta property="og:type" content="website">`;
  const headTail =
    // Favor the system-dark look in explicit dark too: press tints .ledger/.panel with --bg-soft
    // only under [data-theme=dark], which makes explicit dark diverge from system dark. Neutralize it.
    `<style>:root[data-theme="dark"] .ledger,:root[data-theme="dark"] .panel,:root[data-theme="dark"] .frame,:root[data-theme="dark"] .readout,:root[data-theme="dark"] .action-card{background:var(--bg)}` +
    // press input fixes: soften the pure-black border + give <select> a custom appearance (Safari ignores .input/.ledger-field chrome on selects). Most fields live in .ledger tables, mirror those selectors too.
    `input[type="number"].input,input[type="text"].input,input[type="search"].input,textarea.input,select.input,.input,.ledger input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([type="file"]):not(.qty-value),.ledger select,.ledger textarea,.product-edit input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([type="file"]):not(.qty-value),.product-edit select,.product-edit textarea{border-color:color-mix(in srgb,var(--text) 40%,var(--bg))}` +
    `select.input,.ledger select,.product-edit select{-webkit-appearance:none;-moz-appearance:none;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right var(--space-3) center;padding-right:calc(var(--space-3) * 2 + 0.9em)}</style>` +
    ld;
  // Nav is auth-aware (shows the account name when signed in) — never let a signed-in
  // response be shared-cached. Anonymous responses are the only shareable version.
  const cache = opts.user ? "private, no-store" : "public, max-age=60, stale-while-revalidate=300";
  return baseDoc({
    head,
    headTail,
    body: `${publicNav(opts.user || null, opts.navCurrent)}${crumbBar(opts.crumbs)}<main class="deck">${inner}</main>`,
    status: opts.status,
    cache,
  });
}

// ── Shared bits for the public reference pages (producer/variety/region/process/coffee) ──
export const seoRow = (h: string, d: string) => (d ? `<tr><th>${esc(h)}</th><td>${d}</td></tr>` : "");
export const seoLed = (title: string, tag: string, rows: string) =>
  rows ? `<table class="ledger" style="margin-top:var(--space-4)"><thead><tr><th colspan="2" class="left">${title}${tag ? ` <span class="data">${esc(tag)}</span>` : ""}</th></tr></thead><tbody>${rows}</tbody></table>` : "";
export const seoStat = (label: string, val: string, hint?: string) =>
  `<div style="flex:1;min-width:90px"><div class="data" style="font-size:.7rem;text-transform:uppercase;letter-spacing:.06em">${esc(label)}</div>` +
  `<div class="numeric" style="font-size:1.35rem;font-weight:600;line-height:1.15">${val}</div>` +
  (hint ? `<div class="data" style="font-size:.72rem">${esc(hint)}</div>` : "") + `</div>`;
export const seoStrip = (items: string[]) => { const f = items.filter(Boolean); return f.length ? `<div class="cluster" style="gap:var(--space-4);flex-wrap:wrap;border-top:2px solid var(--text);border-bottom:1px solid var(--rule);padding:var(--space-3) 0">${f.join("")}</div>` : ""; };
export const seoAbout = (title: string, text: string) => text ? `<table class="ledger" style="margin-top:var(--space-4)"><thead><tr><th class="left">${esc(title)}</th></tr></thead><tbody><tr><td class="left" style="border-left:4px solid var(--rule)">${esc(text)}</td></tr></tbody></table>` : "";
export const seoTags = (title: string, tags: string) => tags ? seoLed(title, "", `<tr><td colspan="2" class="left" style="border-left:4px solid var(--rule)"><div class="cluster gap" style="flex-wrap:wrap">${tags}</div></td></tr>`) : "";
export function jsonArr(s: any): string[] { try { const a = JSON.parse(s); return Array.isArray(a) ? a.map(String) : []; } catch { return []; } }
export function coffeeLabel(c: any, producerName?: string | null): string {
  if (c.name && String(c.name).trim()) return String(c.name);
  const bits = [producerName, c.lot_number ? `Lot ${c.lot_number}` : "", c.crop_year ? String(c.crop_year) : ""].filter(Boolean);
  return bits.length ? bits.join(" · ") : "Coffee lot";
}
export const lotsLedger = (rows: string, count: number) => rows
  ? `<table class="ledger" style="margin-top:var(--space-4)"><thead><tr><th colspan="3" class="left">Lots <span class="data">${count} on ppmgauge</span></th></tr></thead><tbody>${rows}</tbody></table>`
  : `<p class="data" style="margin-top:var(--space-4)">No lots recorded yet.</p>`;
// One lot row: coffee name → /library/lots/:id, producer → /library/producers/:id, cup score.
export const coffeeLotRow = (c: any) =>
  `<tr><th class="left"><a href="/library/lots/${encodeURIComponent(c.id)}">${esc(coffeeLabel(c, c.pname))}</a>${c.crop_year ? ` <span class="data">${esc(c.crop_year)}</span>` : ""}</th>` +
  `<td>${c.pid ? `<a href="/library/producers/${encodeURIComponent(c.pid)}" class="data">${esc(c.pname)}</a>` : ""}${c.country ? ` <span class="data">${esc(c.country)}</span>` : ""}</td>` +
  `<td class="numeric">${c.published_score != null ? `<b>${c.published_score}</b>` : '<span class="data">—</span>'}</td></tr>`;
export function refNotFound(user: any, label: string, crumbTop: string, crumbHref: string): Response {
  return seoShell({ title: `Not found — ppmgauge`, desc: `This ${label} isn’t on ppmgauge.`, index: false, status: 404, user, crumbs: `<a href="${crumbHref}">${esc(crumbTop)}</a><span aria-current="page">Not found</span>` },
    `<section class="section"><div class="signal" style="border-color:var(--negative)">No ${esc(label)} with that id.</div><p style="margin-top:var(--space-3)"><a class="button sm" href="${crumbHref}">Browse ${esc(crumbTop.toLowerCase())} →</a></p></section>`);
}
